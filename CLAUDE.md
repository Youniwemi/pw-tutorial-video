# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

No `Co-Authored-By` trailer in commits.

## What this is

`pw-tutorial-video` is a standalone npm package that turns Playwright E2E tests into narrated tutorial videos. Tests run normally in CI; with `TUTORIAL_MODE=true` they produce videos with TTS voice, animated cursor, step overlays, and ffmpeg post-processing.

## Commands

```bash
npm run build      # tsc + copy styles.css → dist/
npm test           # vitest run (unit tests)
```

## Architecture

The package has a **dual-mode design**: all tutorial logic (overlays, cursor, voice, music) is no-op when `TUTORIAL_MODE !== 'true'`. In non-tutorial mode, `complete()` simply executes queued step actions sequentially.

### Core class: `Tutorial` (`src/Tutorial.ts`)

Orchestrates five subsystems, each in its own file:

| Subsystem | File | Responsibility |
|---|---|---|
| `TutorialVoice` | `src/voice.ts` | TTS audio generation (macOS `say` / Edge TTS / custom cmd), caching via content hash, in-browser playback |
| `TutorialMusic` | `src/music.ts` | In-browser background music (live preview only — actual audio is mixed by ffmpeg) |
| `TutorialCursor` | `src/cursor.ts` | Animated SVG cursor injected into the page, smooth eased movement |
| `TutorialOverlay` | `src/overlay.ts` + `overlay-html.ts` | Step banners, context cards, completion screen, email preview — all rendered as injected HTML |
| `TutorialTimeline` | `src/timeline.ts` | Records step timestamps/audio refs, saves `_timeline.json`, auto-generates transcript markdown |

### Execution flow

1. `tutorial.step()` / `tutorial.context()` **queue** actions and kick off TTS preloading in background
2. `tutorial.complete()` waits for all TTS preloads, then executes steps sequentially with overlays + cursor + voice
3. Timeline JSON is saved with a pre-built ffmpeg merge command
4. The **Playwright Reporter** (`src/reporter.ts`) runs `onTestEnd`, finds the timeline by `testTitle`, waits for the video file to stabilize, then executes the ffmpeg command

### Other modules

- `src/merge.ts` — Builds the ffmpeg filter-complex command (voice clips at precise timestamps + background music + video copy)
- `src/tts-provider.ts` — TTS provider abstraction: `CommandTTSProvider` (macOS say / custom `TUTORIAL_TTS_CMD`), `EdgeTTSProvider`, `TTSManager`
- `src/slugify.ts` — Unicode-aware slug generation (handles Latin diacritics + Arabic hamza marks)
- `bin/export-transcript.ts` — CLI tool to regenerate transcript markdown from timeline JSON

### Package exports

Three entry points: `pw-tutorial-video` (main), `pw-tutorial-video/reporter`, `pw-tutorial-video/slugify`, plus `pw-tutorial-video/styles.css`.

## Key design decisions

- **TTS audio is written to `static/audio/tutorial-voice/`** in the consuming project (not configurable). Files are content-hashed for caching.
- **`testTitle`, `testFile`, `projectName`** must be passed to the constructor for the reporter to match timelines to test results. Without `testTitle`, the merge step silently skips.
- **`backgroundMusic` defaults to empty string** for external consumers. Pass `backgroundMusic: ''` explicitly if you have no music asset.
- **Voice playback errors are silent** (`audio.onerror = () => resolve()`) — a wrong `audioBaseUrl` produces no narration without any error.
- All overlay HTML is built as string templates in `overlay-html.ts` and injected via `page.evaluate()`.

## Environment variables

| Variable | Controls |
|---|---|
| `TUTORIAL_MODE` | Master switch — must be `'true'` to generate video |
| `TUTORIAL_VOICE` | `'false'` disables TTS (default: enabled) |
| `TUTORIAL_TTS_CMD` | Custom TTS command with `{lang}`, `{text}`, `{output}` placeholders |
| `TUTORIAL_VOICE_NAME` | Override TTS voice name |
| `TUTORIAL_OUTPUT_DIR` | Timeline JSON output dir (default: `tutorials/output`) |
| `TUTORIAL_MUSIC` | Background music file URL |
| `TUTORIAL_MUSIC_VOLUME` / `TUTORIAL_VOICE_VOLUME` | Audio levels |
| `TUTORIAL_MAPPING_FILE` / `TUTORIAL_TUTORIALS_JSON` | Reporter: mapping + metadata files |

## Testing notes

- Tests use `vi.resetModules()` heavily because `TUTORIAL_MODE` is read at module load time (top-level `const`)
- `buildMergeCommand` accepts `checkFileExists` for deterministic testing without real files
- Mock page objects simulate Playwright's `Page` interface with `vi.fn()` stubs
