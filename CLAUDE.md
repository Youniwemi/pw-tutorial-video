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
- **Audio/video sync uses a recorded black marker, not wall-clock anchors.** Recording starts at page creation and Playwright may buffer several seconds before the video file exists, so no wall-clock anchor (constructor time, file `birthtime`) reliably maps to the tape's t=0 — on a real app the error reached ~5s (constant), leaving every frame lagging the audio clips. `complete()` flashes a full-screen black div for 500ms right before `timeline.start()`; the reporter finds it with `ffmpeg blackdetect` (`detectSyncMarker`) and rewrites the merge command's `-ss` with the marker's end — the exact video time of timeline zero. `videoTrimMs` (birthtime, else constructor anchor) stays in the timeline as the fallback when the marker isn't found; `syncMarker: true` in the timeline JSON tells the reporter to look for it.
- **`TUTORIAL_DEBUG_CLOCK=true`** burns a wall-clock overlay (epoch ms % 1e6, bottom-left) into the recording — comparing the clock shown in a frame at video time T against `timelineStartEpoch + T` measures desync frame by frame. Debug only: the clock ends up in the final video.
- **Narration/action overlap** (option B of `docs/narration-action-overlap.md`): a voiced step's action starts *during* the narration clip at `narrationActionOffset(duration, fullText, doText)` — character-share estimate of the do/explain boundary (`(len(do)+2)/len(full)`), 25% for single-phase, voiceText split at its first `'. '`. `TutorialVoice.startPlayback()` starts browser playback without awaiting the end; wall clock is clamped to `max(duration, offset + action)` so the next clip never overlaps in the ffmpeg mix. Non-voiced steps keep the serial `stepDelay → action` path. Timeline/merge/transcripts/cache are untouched.
- **Overlay position** is configurable via `overlayPosition: 'TL' | 'TR' | 'BL' | 'BR'` on `TutorialOptions` (default `'TR'`). Per-step override via `StepOptions.overlayPosition`. RTL mode (`lang: 'ar'`) mirrors positions automatically (TL↔TR, BL↔BR). CSS classes: `.tutorial-overlay-tr`, `.tutorial-overlay-bl`, `.tutorial-overlay-br` (TL is the base, no extra class).
- **Split mode** (`data-split` on the stage): when multiple scenes are active, the shared tab bar hides and each scene pane gets its own label header + a visible separator. `focus()` accepts `{ ratio: [30, 70] }` for asymmetric splits. In single mode the regular tab bar shows all tabs.
- **Narration corrections** (`tutorial-transcript apply`): the workflow is *edit the generated transcript markdown → apply → re-run*. `applyCorrections()` pairs transcript entries with timeline steps by kind (context/step/complete) + i18n key, consumed in file order (duplicate keys correct each occurrence in turn; keyless entries fall back to kind-order), then rewrites the original text in `testFile` as a quoted string literal (searching `'`/`"`/`` ` `` with escaping, forward-cursor so source order follows step order). Two-part narrations (`${do}. ${explain}`, `${title}. ${text}`) are split at the first `'. '` and both halves replaced. Guard rails: a first sentence equal to the step key (identity translate) is never rewritten — only the free half is edited; texts not found as literals (i18n catalog) are reported for manual fixing with their key. On success the timeline JSON's step texts are updated too, making a second `apply` a no-op. The transcript itself is regenerated by `buildTranscriptMarkdown()` (shared between `TutorialTimeline.save()` and the CLI).
- **Variants** (`variant` option, default `env TUTORIAL_VARIANT`): suffixes `testName` (`<name>-<variant>`) so all outputs (video, timeline, transcript, screenshots) coexist with the base recording; the variant is stored in the timeline JSON and stamped on `<html>` as `data-tutorial-variant`. The reporter matches timelines by `testTitle` AND variant, newest mtime as tiebreak. `mobileStage(scenes, device?)` (exported) returns `test.use()` options (viewport + video = N phone panes, from Playwright `devices`), inert unless `TUTORIAL_VARIANT=mobile`.
- **Mobile variant preset** (`variant === 'mobile'`, internal — no extra options): (1) *pinned split* when 2+ scenes — `data-layout="split"` on the stage, all scenes always visible at equal width, tab bar never shown, labels always visible (inactive dimmed), `focus()` ignores ratios and never sets inline flex; (2) *compact overlay* — pure CSS-variable remaps under `html[data-tutorial-variant='mobile']` from `--tutorial-*-mobile` values defined in `:root` (so consumers tune them with a plain `:root` override), plus icon/step-badge hidden via `--tutorial-icon-display-mobile`/`--tutorial-badge-display-mobile`. Outside the mobile variant, stage/focus behavior is strictly unchanged.
- **Overlay surface is variable-driven**: `--tutorial-overlay-bg` (was hardcoded `#fff` — set an `rgba()` for transparency), `--tutorial-overlay-blur`, `--tutorial-overlay-shadow`, `--tutorial-icon-size`, `--tutorial-context-max-width`.
- **Site variant filter**: the manifest entries carry `variant` (read from the timeline, filename suffix `-mobile`/`-tablet` as fallback); the gallery index shows a Desktop/Mobile filter when variants exist and cards get a variant badge.
- **Site step guide layout** is configurable via `tutorials.stepsLayout` in `tutorial-site.config.js`: `'strip'` (default — horizontal thumbnail strip), `'cards'` (numbered text cards with a small screenshot, click opens a lightbox), `'text'` (text-only cards, click reveals the screenshot inline), `'full'` (narration text + full-width screenshot per step). Scaffold passes it to the template through `site-config.json`.
- **Site step data**: `buildStepsDetail()` (`src/site/generate-manifest.ts`) merges timeline steps with the scanned screenshots by step number into `stepsDetail` on the manifest entry: leading context narrations become `description` (shown under the title), mid-flow contexts stay in the list as unnumbered callouts, and the `Complete` narration is excluded. Display numbers are sequential (contexts don't count). A video with no timeline still gets a screenshot-only guide, and screenshots whose step is absent from the timeline (older recordings) are inserted at their position with no text.
- **Unvoiced steps are recorded in the timeline** with empty `audioFile` and `durationMs: 0` (steps with `skipVoice`, or any step/context/complete when voice is disabled), so their text reaches the site's step guide. Empty `audioFile` marks them: `buildMergeCommand`, `buildTranscriptMarkdown`, `applyCorrections`, and voice-prerender all skip such steps — transcripts stay narration-only and no TTS is synthesized for them.

## Environment variables

| Variable | Controls |
|---|---|
| `TUTORIAL_MODE` | Master switch — must be `'true'` to generate video |
| `TUTORIAL_VARIANT` | Recording variant (suffixes outputs; `mobile` = compact overlay + pinned split) |
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
