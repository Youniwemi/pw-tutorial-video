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
- **Multiple user profiles** — Two signed-in personas as browser-like tabs in one video, with an optional side-by-side moment
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
| `scenes` | `Record<string, SceneOptions>` | — | Named scenes for multi-profile tutorials — see [Multiple user profiles](#multiple-user-profiles) |
| `focus` | `string \| string[]` | first scene | Scene(s) active when the stage mounts |
| `sceneTransition` | `{ duration?: number }` | `{ duration: 600 }` | Pause on a scene switch (ms) |

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
| `stage()` | Mount the multi-scene stage (tab bar + one iframe per scene) |
| `scene(name)` | Get a scene as a Playwright `FrameLocator` |
| `goto(name, url)` | Navigate a scene (relative to its `baseUrl`, or absolute) |
| `focus(name \| names[])` | Bring scene(s) on stage — one fills it, two share it |

### `StepOptions`

| Option | Type | Description |
|---|---|---|
| `do` | `string` | Short action text shown in overlay |
| `explain` | `string` | Explanation played during/after action |
| `voiceText` | `string` | Custom TTS text (overrides do/explain) |
| `skipVoice` | `boolean` | Skip voice for this step |
| `description` | `string` | Description shown below step title |
| `delay` | `number` | Custom delay after this step (ms) |
| `scene` | `string \| string[]` | Scene(s) this step plays on — the stage switches before the action runs |

### `ContextOptions`

| Option | Type | Description |
|---|---|---|
| `text` | `string` | Description shown below title |
| `style` | `'goal' \| 'clarification' \| 'attention'` | Visual style |
| `voiceText` | `string` | Custom TTS text |

## Multiple user profiles

Some stories need two people: an accountant issues an invoice, a client pays it.
Declare each one as a **scene** and the stage becomes a browser-like tab bar,
with one `<iframe>` per scene.

```typescript
const tutorial = new Tutorial(page, {
  title: 'Invoice, end to end',
  testTitle: 'invoice issued then paid',
  audioBaseUrl: 'http://localhost:5173',
  scenes: {
    accountant: { label: 'Sara — Accountant', baseUrl: 'http://localhost:5173' },
    client:     { label: 'ACME — Client',     baseUrl: 'http://localhost:5174' },
  },
  focus: 'accountant',
});

const accountant = tutorial.scene('accountant'); // a Playwright FrameLocator
const client     = tutorial.scene('client');

await tutorial.stage();
await tutorial.goto('accountant', '/invoices/new');
await tutorial.goto('client', '/login');

tutorial.step('The accountant issues the invoice',
  () => tutorial.click(accountant.getByRole('button', { name: 'Issue' })),
  { scene: 'accountant' });

tutorial.step('The client pays it',
  () => tutorial.click(client.getByRole('button', { name: 'Pay now' })),
  { scene: 'client' });          // the stage switches tabs on its own

tutorial.step('Both sides, at once',
  () => expect(accountant.getByText('Paid')).toBeVisible(),
  { scene: ['accountant', 'client'] });   // side by side, just for this step

await tutorial.complete();
```

### How it behaves

- **Sessions are independent** because each scene is a separate **origin**. Two
  iframes on the same origin share cookies and `localStorage`, so the second
  login overwrites the first. For two users of the *same* app, serve it under a
  second hostname (`app.localhost` / `app2.localhost`) to get a second origin.
- **Inactive scenes stay mounted**, hidden but never unloaded — a profile logged
  in behind another tab is still logged in when you come back to it.
- **A hidden scene is not interactive.** Pass `scene` on every step that touches
  one; the stage switches before the action runs. Acting on an off-stage scene
  will simply time out.
- **`scene: [a, b]` puts two scenes side by side**, each taking half the stage.
  Treat it as an exception for the moment cause and effect must share one frame:
  at 1280px wide, each pane only gets ~640px. In an array, the first scene is
  the one acting.
- **Tabs are always all visible**, so the viewer knows who else is in the story
  and who is speaking now.
- Each timeline step records its `scene`, so transcripts say who was on screen.

### Requirements

- Target pages must allow framing. Sites sending `X-Frame-Options: SAMEORIGIN`
  or `DENY` (Google, Bing, many SaaS apps) **cannot** be used as scenes. For
  your own app, relax `frame-ancestors` in tutorial mode only.
- `stage()` navigates the parent page to `audioBaseUrl` before injecting the
  stage, so narration audio loads same-origin. Point `audioBaseUrl` at the app
  serving `static/audio/tutorial-voice/`.

## Variants — record the same tutorial for mobile

Set `TUTORIAL_VARIANT=mobile` (or pass `variant: 'mobile'`) to record a second,
phone-sized version of a tutorial without touching the spec:

```typescript
import { Tutorial, mobileStage } from 'pw-tutorial-video';

// Widens the viewport (and video) to N phones side by side.
// Inert unless TUTORIAL_VARIANT=mobile — the same spec records both versions.
test.use(mobileStage(2)); // default device 'Pixel 7'; or mobileStage(2, 'iPhone 14'), or an explicit {width, height}

const tutorial = new Tutorial(page, { /* options unchanged */ });
```

```bash
TUTORIAL_MODE=true npx playwright test                          # → tutorials/videos/<name>.webm
TUTORIAL_MODE=true TUTORIAL_VARIANT=mobile npx playwright test  # → tutorials/videos/<name>-mobile.webm
```

What the `mobile` variant does automatically:

- **Suffixes every output** with `-mobile` (video, timeline, transcript,
  screenshots, poster) so the desktop version is never overwritten.
- **Pins the split** on multi-scene tutorials: every phone stays visible at
  equal width for the whole video, the tab bar never shows, per-scene labels
  take over (the inactive one is dimmed), and `focus()` ratios are ignored —
  on phone-width panes an asymmetric split has no room to work.
- **Compacts the overlay**: smaller card, smaller type, icon and step badge
  hidden. It is all CSS variables scoped under `html[data-tutorial-variant='mobile']`
  remapping to `--tutorial-*-mobile` values, so tuning it is a plain `:root`
  override from your own styles (see [Styling](#styling)):

```css
:root {
  --tutorial-overlay-width-mobile: 220px;
  --tutorial-icon-display-mobile: inline-flex; /* bring the icon back */
}
```

Any other variant name (`TUTORIAL_VARIANT=tablet`) only suffixes the outputs
and stamps `data-tutorial-variant` — no preset. The reporter matches each run
to the timeline of the same variant, so both runs can share
`TUTORIAL_OUTPUT_DIR`, and the gallery site gains a Desktop/Mobile filter when
variants are present.

Note: `mobileStage()` must be passed to `test.use()` at the top of the spec —
the video size is frozen when the browser context is created.

### Sharp mobile video (oversampling)

Playwright records video at *window* pixels and never upscales, so a
phone-sized viewport would yield a blurry ~400px-wide video. In tutorial mode,
`mobileStage()` therefore records **oversampled 2× by default**: it launches
Chromium with `--force-device-scale-factor=2`, aligns `deviceScaleFactor`, and
doubles the video size — the page layout (CSS viewport) is unchanged, a Pixel 7
video comes out at 824×1678.

```typescript
test.use(mobileStage(2, 'Pixel 7', { scale: 3 })); // even sharper
test.use(mobileStage(2, 'Pixel 7', { scale: 1 })); // old behavior, native CSS pixels
```

Caveat: `test.use()` replaces the config's `launchOptions` wholesale. If your
playwright.config passes Chromium args for tutorial runs (e.g.
`--autoplay-policy=no-user-gesture-required`), repeat them via `launchArgs`:

```typescript
test.use(mobileStage(2, 'Pixel 7', {
  launchArgs: ['--autoplay-policy=no-user-gesture-required'],
}));
```

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

### Pre-rendering the voice cache

TTS synthesis is the slow part of a tutorial run, and clips are cached by
`md5(lang:text)` — the hash covers the **text only**, so a voice or
`TUTORIAL_TTS_CMD` change never invalidates old clips. `regen-voices` generates
the clips outside of any test run:

```bash
npx pw-tutorial-video regen-voices                    # synthesize the missing clips
npx pw-tutorial-video regen-voices --workers=4        # parallel TTS (default 2)
npx pw-tutorial-video regen-voices --force            # after a voice change: redo everything
npx pw-tutorial-video regen-voices --lang=fr          # one language only
rm -rf static/audio/tutorial-voice && npx pw-tutorial-video regen-voices   # full rebuild
```

Narration texts are collected from the artifacts that record them verbatim:
the transcripts (`tutorials/transcripts/*.md`) and the timelines
(`tutorials/output/*_timeline.json`). The project `.env` is loaded for the
`TUTORIAL_*` settings. Videos are not remixed — the next `TUTORIAL_MODE=true`
run picks the clips up from cache.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TUTORIAL_MODE` | `false` | Enable tutorial video generation |
| `TUTORIAL_VARIANT` | none | Recording variant — suffixes outputs; `mobile` also compacts the overlay and pins the split |
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

  /* Multi-scene stage */
  --tutorial-stage-bg: #1e293b;
  --tutorial-scene-bg: #ffffff;
  --tutorial-tab-bg: #334155;
  --tutorial-tab-text: #94a3b8;
  --tutorial-tab-bg-active: #f8fafc;
  --tutorial-tab-text-active: #0f172a;
  --tutorial-tab-dot: #64748b;
  --tutorial-tab-dot-active: #22c55e;
  --tutorial-tab-padding: 10px 20px;
  --tutorial-tab-radius: 10px 10px 0 0;
  --tutorial-tab-size: 15px;
  --tutorial-tab-transition: 250ms;
  --tutorial-stage-gap: 2px;
  --tutorial-tabbar-padding: 8px 8px 0;
}
```

Scene panes deliberately expose no size variables: they share the stage evenly
via flexbox, and animating that sizing makes Playwright treat the frame as never
stable, which times out every click inside it.

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

## Reviewing & Correcting Narration

Every tutorial run auto-generates a markdown transcript in
`tutorials/transcripts/{test-name}.md`. To rework the narration, edit the
transcript and write the corrections back into your test source:

```bash
# 1. (Optional) regenerate transcripts from the timeline JSON files
npx tutorial-transcript

# 2. Edit tutorials/transcripts/{test-name}.md — fix the narration texts

# 3. Apply: rewrites the corrected texts in your test file
npx tutorial-transcript apply

# 4. Re-run: only the changed TTS clips are regenerated (content-hash caching)
TUTORIAL_MODE=true npx playwright test
```

`apply` pairs each transcript entry with its timeline step (by the `**key:**`
lines, in order — a key used twice corrects each occurrence in turn; the
`**[Complete]**` entry is the completion message), then locates the original
text in the test file (`testFile` from the timeline) as a quoted string
literal and replaces it. A narration composed of two fields
(`do` + `explain`, or title + `description`/`text`) is handled by splitting
old and new text at the first sentence boundary and replacing both halves.

What `apply` **won't** touch: texts that come from an i18n catalog (the
literal isn't in the test file) and step keys rendered verbatim as titles —
those are reported with their key so you can fix the translation instead.
The timeline JSON is updated on success, so re-running `apply` is a no-op.

`npx tutorial-transcript apply [file.md ...]` limits the run to specific
transcripts; without arguments it processes every `.md` in the transcript
directory (`TUTORIAL_TRANSCRIPT_DIR`, default `tutorials/transcripts`).

## Claude Code Integration

This package ships **two assets for Claude Code** that teach AI agents how to convert your Playwright tests into professional tutorials:

### What you get

| Asset | Installed to | Purpose |
|---|---|---|
| `/tutorialize` skill | `.claude/skills/tutorialize/` | Slash command that loads tutorial design methodology — persona analysis, storytelling arc, choreography rules, and the full `pw-tutorial-video` API. Invoke with `/tutorialize` in Claude Code. |
| `tutorial-crafter` agent | `.claude/agents/tutorial-crafter.md` | Specialized agent (Sonnet) that reads your test, designs the tutorial arc, and writes the tutorial code. Dispatched automatically or manually. |

### Skill reference files

The skill bundles two reference documents that Claude reads before tutorializing:

| File | Content |
|---|---|
| `SKILL.md` | 4-phase process: understand the viewer → design the arc → implement with `pw-tutorial-video` → verify |
| `references/storytelling.md` | Who is watching (role, expertise, emotional state), narration voice rules, pacing decisions, when to use context screens vs steps, multi-profile scene heuristics |
| `references/api.md` | Complete `Tutorial` class API with timing model, critical rules (e.g., navigate before any tutorial call, never override `--reporter`), and a pre-commit checklist |

### Setup

```bash
npx pw-tutorial-video init
```

This interactively copies the skill and agent into your `.claude/` directory. Example session:

```
  pw-tutorial-video 0.2.0 — Claude Code Setup

  Install /tutorialize skill into .claude/skills/? [Y/n] y
  + Skill copied to .claude/skills/tutorialize/
  Install tutorial-crafter agent into .claude/agents/? [Y/n] y
  + Agent copied to .claude/agents/tutorial-crafter.md

  Done! You can now use /tutorialize in Claude Code.
```

### Usage in Claude Code

```
# Ask Claude to convert a test into a tutorial
> Tutorialize tests/free/01_company.init.ts

# Or invoke the skill directly
> /tutorialize tests/premium/10_expense-scan.test.ts
```

Claude will:
1. Read the test and identify the viewer persona
2. Design a storytelling arc (goal → steps → completion)
3. Write the tutorial code with `tutorial.context()`, `tutorial.step()`, voice narration text, and `tutorial.complete()`
4. Verify the test still passes in both normal and tutorial mode

### Keeping them up to date

The skill and agent are **copies**, so upgrading the package does not auto-update them.
`init` stamps the version it installed in `.claude/.pw-tutorial-video.json`, and:

- after an upgrade, a post-install message names what went stale and tells you to
  re-run `init` — it only speaks when there is something to say, and never writes
  to `.claude/` on its own;
- re-running `init` shows the transition (`0.1.0 → 0.2.0`) and skips anything
  already current;
- `npx pw-tutorial-video init --yes` answers yes to everything, for scripted
  updates.

If you customize the copied skill, keep your additions in a separate file next to
it — `init` overwrites, it does not merge.

## Tutorial Gallery Site

Generate a static video gallery website from your tutorials — one command, zero config.

### Quick start

```bash
npx pw-tutorial-video build-site
```

On the first run, a `tutorial-site.config.js` file is created with sensible defaults. Edit it to customize branding, then re-run `build-site` — the config is reused automatically.

The command scans your `tutorials/` directory for videos, screenshots, and timeline metadata, then builds a static site ready to deploy (e.g., to Cloudflare Pages, Netlify, or any static host).

### What gets generated

```
tutorial-site-dist/          # Static site output (configurable)
├── index.html               # Gallery home — videos grouped by category
├── {video-slug}/index.html  # Dedicated page per video with player + step screenshots
└── videos/                  # Copied from tutorials/videos/
    ├── *.webm               # Video files
    └── *-step-*.webp        # Step screenshots (carousel on cards)
```

### Configuration

```js
// tutorial-site.config.js
export default {
  // Branding
  title: "My App Tutorials",       // Site title (header + page titles)
  logo: "./assets/logo.svg",       // Path to logo image (optional)
  primaryColor: "#6366f1",         // Primary color (CSS)
  font: "system-ui, sans-serif",   // Font family (CSS)

  // Paths
  input: "tutorials/",             // Where videos + timelines live
  output: "tutorial-site-dist/",   // Where the static site is built

  // Site
  baseUrl: "https://tutorials.myapp.com",  // For SEO (optional)
  lang: "fr",                              // Site language

  // Content overrides (optional)
  tutorials: {
    categories: {
      "getting-started": { icon: "⭐", label: "Getting Started" },
      "advanced":        { icon: "🚀", label: "Advanced" },
    },
    ui: {
      heroTitle: "Learn My App",
      heroSubtitle: "Step-by-step video tutorials",
    },
  },
};
```

### How videos are discovered

The scanner looks for `.webm` files in `<input>/videos/`. For each video:

- If a matching `_timeline.json` exists in `<input>/output/`, its metadata is used (title from narration steps, duration, category from `@feature:*` tag)
- Otherwise, a human-readable title is derived from the filename and duration is left blank

Step screenshots (`{video}-step-{n}.{png,webp}`) are auto-detected and displayed as a carousel on each video card.

### Previewing locally

The generated site uses relative paths, but browsers block `<video>` elements on `file://`. Use any static server:

```bash
npx serve tutorial-site-dist
```

### CLI options

```bash
pw-tutorial-video build-site                      # Uses ./tutorial-site.config.js
pw-tutorial-video build-site --config=path/to.js   # Custom config path
```

## How It Works

1. **Test registration** — `tutorial.step()` / `tutorial.context()` queue actions and start preloading TTS audio in background
2. **Execution** — `tutorial.complete()` waits for all TTS preloads, then executes steps sequentially with overlays, cursor animation, and voice playback
3. **Timeline** — Each step records its timestamp and audio file reference
4. **Post-processing** — The Playwright reporter reads the timeline JSON, waits for Playwright to finalize the video file, then runs ffmpeg to merge the silent screen recording with the voice clips and background music

## License

MIT
