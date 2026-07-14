# pw-tutorial-video

**Turn your Playwright end-to-end tests into professional narrated tutorial videos — automatically.**

Write your tests once, get polished how-to videos with voice narration, animated cursor, step overlays, background music, and ffmpeg post-processing. No screen-recording software, no video editors, no extra effort.

---

## Why pw-tutorial-video?

Most software teams maintain **tests** and **documentation** separately. Tests verify features work; docs explain how to use them. When a feature changes, the docs lag behind — or never get updated.

`pw-tutorial-video` bridges this gap: your Playwright tests **are** your tutorial source. Run them normally for CI; flip a flag and they produce broadcast-ready video tutorials.

### Key Features

- **Dual-mode tests** — Same test file runs as a fast E2E test (`playwright test`) or a narrated video tutorial (`TUTORIAL_MODE=true`)
- **Voice narration** — Built-in TTS with macOS `say`, Microsoft Edge TTS, or any custom command via `TUTORIAL_TTS_CMD`
- **Animated cursor** — Smooth, eased mouse movements with click animations that follow your test actions
- **Step overlays** — On-screen banners showing current step, progress bar, and descriptions
- **Context screens** — Goal / clarification / attention cards between steps to explain what's happening
- **Background music** — Looping audio with fade-out on completion
- **Email previews** — Simulated email popups for verification flow demos
- **ffmpeg post-processing** — Automatic video + audio merge with timeline-accurate voice placement
- **Screenshot capture** — WebP screenshots at each step, poster image from step 1
- **Transcript generation** — Markdown transcripts auto-generated from timeline data
- **Multi-language** — Full RTL support (Arabic), per-language video filenames, i18n-ready
- **Playwright Reporter** — Auto-merges audio into video as each tutorial test completes
- **Zero runtime overhead** — All tutorial logic is no-op when `TUTORIAL_MODE` is not set

## Installation

```bash
npm install --save-dev pw-tutorial-video
```

### Peer Dependencies

| Package | Required | Notes |
|---|---|---|
| `@playwright/test` | Yes | >= 1.40.0 |
| `sharp` | Optional | For optimized WebP screenshots (falls back to raw PNG) |
| `ffmpeg` | Runtime | Required on PATH for audio/video merge |
| `ffprobe` | Runtime | Required on PATH for audio duration detection |

## Quick Start

### 1. Create a tutorial-enabled test

```typescript
import { test, expect } from '@playwright/test';
import { Tutorial } from 'pw-tutorial-video';

test('Create your first invoice', { tag: ['@tutorial'] }, async ({ page }, testInfo) => {
  const tutorial = new Tutorial(page, {
    title: 'Create Your First Invoice',
    lang: 'en',
    audioBaseUrl: 'http://localhost:5173',  // your dev server port
    backgroundMusic: '',                    // or a URL to a .mp3 file
    // Required for the reporter to match and merge the video:
    testTitle: testInfo.title,
    testFile: testInfo.file,
    projectName: testInfo.project.name,
  });

  // Add a context screen (goal explanation)
  tutorial.context('invoice.intro', {
    text: 'Learn how to create and send your first invoice',
    style: 'goal',
  });

  // Add steps — actions are queued, not executed yet
  tutorial.step('invoice.client', async () => {
    await tutorial.click(page.getByLabel('Client'));
    await tutorial.selectOption(page.getByLabel('Client'), 'Acme Corp');
  }, {
    do: 'Select your client',
    explain: 'Choose from your existing client list or create a new one',
  });

  tutorial.step('invoice.amount', async () => {
    await tutorial.fill(page.getByLabel('Amount'), '1500');
  }, {
    do: 'Enter the invoice amount',
  });

  tutorial.step('invoice.send', async () => {
    await tutorial.click(page.getByRole('button', { name: 'Send' }));
    await expect(page.getByText('Invoice sent')).toBeVisible();
  }, {
    do: 'Send the invoice',
    explain: 'Your client will receive the invoice by email',
  });

  // Execute all steps and finalize the video
  await tutorial.complete('Invoice created successfully!');
});
```

### 2. Run as a normal test

```bash
npx playwright test --grep "@tutorial"
```

### 3. Run in tutorial mode (generates video)

```bash
TUTORIAL_MODE=true npx playwright test --grep "@tutorial"
```

Videos are saved to `tutorials/videos/`, timelines to `tutorials/output/`.

> **Important**: Never override `--reporter` on the CLI for tutorial runs — it disables the merge step. Use the config file instead.

### 4. Add generated paths to `.gitignore`

Tutorial runs create files in your project. Add these to `.gitignore`:

```gitignore
# pw-tutorial-video generated files
tutorials/
static/audio/tutorial-voice/
```

### 5. Converting an existing test

The most common use case is converting an existing Playwright test:

| Before (plain test) | After (tutorial) |
|---|---|
| `await page.click(...)` | `await tutorial.click(...)` |
| `await page.fill(...)` | `await tutorial.fill(...)` or `tutorial.typeSlowly(...)` |
| `await page.selectOption(...)` | `await tutorial.selectOption(...)` |
| — | `tutorial.context(...)` between sections |
| — | `tutorial.step(title, action, { do, explain })` wrapping groups |
| — | `await tutorial.complete(message)` at the end |

Keep the `expect()` assertions — they still run in both modes, ensuring your tutorial stays in sync with the real UI.

## API Reference

### `Tutorial` class

```typescript
import { Tutorial } from 'pw-tutorial-video';

const tutorial = new Tutorial(page, options);
```

#### `TutorialOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | *required* | Tutorial title shown in overlay |
| `translate` | `(key: string) => string` | `k => k` | Translation function — pass your i18n `t()` |
| `audioBaseUrl` | `string` | `'http://localhost:5173'` | Base URL for serving audio files |
| `lang` | `string` | `'en'` | Language for UI text and TTS (e.g. `'en'`, `'fr'`, `'ar'`) |
| `testName` | `string` | auto | Output filename slug |
| `testFile` | `string` | `''` | Test file path for metadata |
| `projectName` | `string` | `''` | Playwright project name |
| `enableVoice` | `boolean` | `true` | Enable TTS voice narration |
| `voiceName` | `string` | auto | TTS voice name |
| `voiceRate` | `number` | `1.0` | Speech rate multiplier |
| `backgroundMusic` | `string` | `''` | Music file URL |
| `musicVolume` | `number` | `0.15` | Background music volume (0-1) |
| `voiceVolume` | `number` | `2.5` | Voice volume multiplier |
| `stepDelay` | `number` | `500` | Delay between steps (ms) |
| `mouseSteps` | `number` | `25` | Cursor animation smoothness |
| `customStyles` | `string` | built-in | Custom CSS for overlays |

#### Methods

| Method | Description |
|---|---|
| `context(key, options?)` | Add a context screen (goal/clarification/attention) |
| `step(key, action, options?)` | Add a tutorial step with an action callback |
| `complete(message?)` | Execute all queued steps and finalize |
| `click(locator)` | Click with cursor animation and highlight |
| `fill(locator, value)` | Fill input with highlight |
| `typeSlowly(locator, value, delay?)` | Type character by character (visual effect) |
| `selectOption(locator, value)` | Select dropdown option with highlight |
| `highlight(locator, duration?)` | Highlight an element |
| `moveMouseToElement(locator)` | Animate cursor to element |
| `showEmailPreview(options)` | Show simulated email popup |
| `switchPage(page)` | Switch recording to another tab/window |
| `clearFields()` | Clear form fields on next page load |

### `StepOptions`

| Option | Type | Description |
|---|---|---|
| `do` | `string` | Short action text shown in overlay |
| `explain` | `string` | Explanation played during/after action |
| `voiceText` | `string` | Custom TTS text (overrides do/explain) |
| `skipVoice` | `boolean` | Skip voice for this step |
| `description` | `string` | Description shown below step title |
| `delay` | `number` | Custom delay after this step (ms) |

### `ContextOptions`

| Option | Type | Description |
|---|---|---|
| `text` | `string` | Description shown below title |
| `style` | `'goal' \| 'clarification' \| 'attention'` | Visual style |
| `voiceText` | `string` | Custom TTS text |

### Playwright Reporter

Auto-merge audio into video after each tutorial test:

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['pw-tutorial-video/reporter', {
      mappingFile: 'path/to/tutorial-mapping.txt',  // optional
      tutorialsJson: 'path/to/tutorials.json',      // optional
    }],
  ],
});
```

### Utilities

```typescript
import { slugify } from 'pw-tutorial-video/slugify';
import { createTTSProvider } from 'pw-tutorial-video';
import { buildMergeCommand } from 'pw-tutorial-video';
```

## TTS Configuration

### macOS (default)

Uses the built-in `say` command. Voices per language:
- French: Thomas
- English: Samantha
- Arabic: Maged

### Edge TTS

Free Microsoft neural voices. Install: `pip install edge-tts`

### Custom TTS

Set `TUTORIAL_TTS_CMD` with placeholders:

```bash
# Custom voice engine
TUTORIAL_TTS_CMD='my-tts --voice premium -l {lang} {text} -o {output}'
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TUTORIAL_MODE` | `false` | Enable tutorial video generation |
| `TUTORIAL_VOICE` | `true` | Enable/disable voice narration |
| `TUTORIAL_VOICE_NAME` | auto | TTS voice name override |
| `TUTORIAL_TTS_CMD` | `say` (macOS) | Custom TTS command |
| `TUTORIAL_OUTPUT_DIR` | `tutorials/output` | Timeline output directory |
| `TUTORIAL_MUSIC` | none | Background music file URL |
| `TUTORIAL_MUSIC_VOLUME` | `0.15` | Background music volume |
| `TUTORIAL_VOICE_VOLUME` | `2.5` | Voice narration volume |
| `TUTORIAL_MAPPING_FILE` | none | Tutorial-to-video mapping file |
| `TUTORIAL_TUTORIALS_JSON` | none | Tutorials metadata JSON |

## Styling

Import the default styles or provide your own:

```typescript
// Use default styles (automatic)
const tutorial = new Tutorial(page, { title: 'My Tutorial' });

// Use custom styles
const tutorial = new Tutorial(page, {
  title: 'My Tutorial',
  customStyles: '.tutorial-overlay { background: navy; }'
});
```

CSS variables for theming:

```css
:root {
  --tutorial-primary: #3b82f6;
  --tutorial-bg-start: rgba(30, 41, 59, 0.95);
  --tutorial-border: rgba(148, 163, 184, 0.3);
  --tutorial-text: #f8fafc;
  --tutorial-z-index: 10000;
  --tutorial-animation-duration: 0.3s;
}
```

## Output Files

After running in tutorial mode:

```
tutorials/
├── output/
│   └── {test-name}_timeline.json    # Step timing + ffmpeg command
├── transcripts/
│   └── {test-name}.md               # Auto-generated transcript
└── videos/
    ├── {test-name}.webm             # Merged video with audio
    ├── {test-name}-poster.webp      # Poster image (step 1)
    └── {test-name}-step-{n}.webp    # Step screenshots
```

## How It Works

1. **Test registration** — `tutorial.step()` / `tutorial.context()` queue actions and start preloading TTS audio in background
2. **Execution** — `tutorial.complete()` waits for all TTS preloads, then executes steps sequentially with overlays, cursor animation, and voice playback
3. **Timeline** — Each step records its timestamp and audio file reference
4. **Post-processing** — The Playwright reporter reads the timeline JSON, waits for Playwright to finalize the video file, then runs ffmpeg to merge the silent screen recording with the voice clips and background music

## License

MIT
