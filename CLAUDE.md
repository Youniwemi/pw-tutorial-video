# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

No `Co-Authored-By` trailer in commits.

## Maintenance rule

When adding or changing a feature, always update:
1. This `CLAUDE.md` file (architecture, options, design decisions)
2. The skill in `skills/tutorialize/` (especially `references/api.md` for API changes)

## What this is

`pw-tutorial-video` is a standalone npm package that turns Playwright E2E tests into narrated tutorial videos. Tests run normally in CI; with `TUTORIAL_MODE=true` they produce videos with TTS voice, animated cursor, step overlays, and ffmpeg post-processing.

## Commands

```bash
npm run build      # tsc + copy styles.css → dist/
npm test           # vitest run (unit tests)

# E2E tests (requires Playwright browsers)
npx playwright test                          # all e2e tests (non-tutorial mode)
TUTORIAL_MODE=true TUTORIAL_VOICE=false \
  npx playwright test e2e/overlay-position   # single e2e file with overlays
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
- `src/transcript.ts` — Shared transcript markdown builder + parser + `applyCorrections()` (writes edited transcript texts back into the test source)
- `src/bin/export-transcript.ts` — `tutorial-transcript` CLI: regenerates transcript markdown from timeline JSON; `tutorial-transcript apply` writes edited transcripts back into the test sources

### Package exports

Three entry points: `pw-tutorial-video` (main), `pw-tutorial-video/reporter`, `pw-tutorial-video/slugify`, plus `pw-tutorial-video/styles.css`.

## Key design decisions

- **TTS audio is written to `static/audio/tutorial-voice/`** in the consuming project (not configurable). Files are content-hashed for caching.
- **`testTitle`, `testFile`, `projectName`** must be passed to the constructor for the reporter to match timelines to test results. Without `testTitle`, the merge step silently skips.
- **`backgroundMusic` defaults to empty string** for external consumers. Pass `backgroundMusic: ''` explicitly if you have no music asset.
- **Voice playback errors are silent** (`audio.onerror = () => resolve()`) — a wrong `audioBaseUrl` produces no narration without any error.
- All overlay HTML is built as string templates in `overlay-html.ts` and injected via `page.evaluate()`.
- **Overlay position** is configurable via `overlayPosition: 'TL' | 'TR' | 'BL' | 'BR'` on `TutorialOptions` (default `'TR'`). Per-step override via `StepOptions.overlayPosition`. RTL mode (`lang: 'ar'`) mirrors positions automatically (TL↔TR, BL↔BR). CSS classes: `.tutorial-overlay-tr`, `.tutorial-overlay-bl`, `.tutorial-overlay-br` (TL is the base, no extra class).
- **Split mode** (`data-split` on the stage): when multiple scenes are active, the shared tab bar hides and each scene pane gets its own label header + a visible separator. `focus()` accepts `{ ratio: [30, 70] }` for asymmetric splits. In single mode the regular tab bar shows all tabs.
- **Narration corrections** (`tutorial-transcript apply`): the workflow is *edit the generated transcript markdown → apply → re-run*. `applyCorrections()` pairs transcript entries with timeline steps by kind (context/step/complete) + i18n key, consumed in file order (duplicate keys correct each occurrence in turn; keyless entries fall back to kind-order), then rewrites the original text in `testFile` as a quoted string literal (searching `'`/`"`/`` ` `` with escaping, forward-cursor so source order follows step order). Two-part narrations (`${do}. ${explain}`, `${title}. ${text}`) are split at the first `'. '` and both halves replaced. Guard rails: a first sentence equal to the step key (identity translate) is never rewritten — only the free half is edited; texts not found as literals (i18n catalog) are reported for manual fixing with their key. On success the timeline JSON's step texts are updated too, making a second `apply` a no-op. The transcript itself is regenerated by `buildTranscriptMarkdown()` (shared between `TutorialTimeline.save()` and the CLI).

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
