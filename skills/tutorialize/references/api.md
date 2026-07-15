# API Reference — pw-tutorial-video

Technical reference for the `Tutorial` class, timing model, and implementation rules.

## 1. Setup

```typescript
import { Tutorial } from 'pw-tutorial-video';

const tutorial = new Tutorial(page, {
  title: 'My Tutorial',
  lang: 'en',
  audioBaseUrl: 'http://localhost:5173',
  testTitle: testInfo.title,
  testFile: testInfo.file,
  projectName: testInfo.project.name,
  backgroundMusic: '',
});
```

Or use a fixture that wraps this (the consuming project typically provides a `tutorial` fixture in its test setup).

### Constructor options

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | *required* | Overlay title |
| `lang` | `string` | `'en'` | Language for TTS and UI |
| `translate` | `(key: string) => string` | identity | i18n function — pass your `t()` |
| `audioBaseUrl` | `string` | `'http://localhost:5173'` | Base URL for audio files |
| `testTitle` | `string` | auto | Raw test title (for reporter matching) |
| `testFile` | `string` | `''` | Test file path (metadata) |
| `projectName` | `string` | `''` | Playwright project name |
| `enableVoice` | `boolean` | `true` | TTS enabled |
| `voiceName` | `string` | auto | TTS voice override |
| `voiceRate` | `number` | `1.0` | Speech rate multiplier |
| `backgroundMusic` | `string` | `''` | Music file URL |
| `musicVolume` | `number` | `0.15` | Music volume (0–1) |
| `voiceVolume` | `number` | `2.5` | Voice volume multiplier |
| `stepDelay` | `number` | `500` | Delay between steps (ms) |
| `mouseSteps` | `number` | `25` | Cursor animation smoothness |
| `customStyles` | `string` | built-in | CSS for overlay |

## 2. Core Methods

### `tutorial.context(key, options?)`

Add a context screen — an overlay card that explains something before the next steps.

```typescript
tutorial.context('Setting Up Your Company', {
  text: 'This will configure your invoicing identity',
  style: 'goal',        // 'goal' | 'clarification' | 'attention'
  voiceText: '...',      // TTS override (optional)
});
```

**Queued — no `await`.** Executed in order when `complete()` runs.

| Style | Icon | Use |
|---|---|---|
| `goal` | 🎯 | Tutorial opening — the ONE objective |
| `clarification` | 💡 | Framing before a complex section |
| `attention` | ⚠️ | Important warning |

### `tutorial.step(key, action, options?)`

Add a step — an action wrapped in narration and visual effects.

```typescript
// Simple step — action during title narration
tutorial.step('Save the document', async () => {
  await tutorial.click(page.locator('button[type="submit"]'));
});

// Two-phase — "do" narration, then action during "explain"
tutorial.step('Company Name', async () => {
  await tutorial.typeSlowly('input[name="name"]', 'ACME Corp');
}, {
  do: 'Enter your company name',
  explain: 'This will appear on all your invoices',
});

// With voiceText override (for acronym pronunciation)
tutorial.step('Tax Identifier', async () => {
  await tutorial.typeSlowly('input[name="ice"]', '001234567000089');
}, {
  do: 'Enter the ICE number',
  explain: 'ICE identifies your company for tax purposes',
  voiceText: "Enter the I.C.E. number. I.C.E. identifies your company for tax purposes",
});
```

**Queued — no `await`.** Step options:

| Option | Type | Description |
|---|---|---|
| `do` | `string` | Short action narration (≤ 8 words) |
| `explain` | `string` | WHY narration (plays during action) |
| `voiceText` | `string` | TTS override (on-screen text unchanged) |
| `skipVoice` | `boolean` | Skip voice for this step |
| `description` | `string` | Description below step title |
| `delay` | `number` | Custom post-step delay (ms) |

### `await tutorial.complete(message?)`

Execute all queued contexts and steps, then show the completion screen.

```typescript
await tutorial.complete('Client added! You can now invoice them.');
```

**This is the only `await`.** It runs everything in order.

## 3. Interaction Methods

Use these inside step actions instead of raw Playwright calls — they add cursor animation and visual highlights.

| Method | Replaces | Effect |
|---|---|---|
| `tutorial.click(locator)` | `page.click(...)` | Cursor animation → highlight → click |
| `tutorial.fill(locator, value)` | `page.fill(...)` | Highlight → fill |
| `tutorial.typeSlowly(locator, value, delay?)` | `page.fill(...)` | Highlight → character-by-character typing |
| `tutorial.selectOption(locator, value)` | `page.selectOption(...)` | Highlight → select |
| `tutorial.highlight(locator, duration?)` | — | Pulsing highlight around element |
| `tutorial.unhighlight(locator)` | — | Remove highlight |
| `tutorial.moveMouseToElement(locator)` | — | Animate cursor to element |
| `tutorial.showEmailPreview(options)` | — | Simulated email popup |
| `tutorial.switchPage(page)` | — | Switch recording to another tab |
| `tutorial.clearFields()` | — | Clear form fields on next load |

`locator` can be a Playwright `Locator` or a CSS selector string.

## 4. Timing Model

### Single-phase step (no `do`/`explain`)

```
|------ Voice plays title (0–2000ms) ------|
    |-- Action (25%–100%) --|
```

Action starts at 25% of voice duration.

### Two-phase step (`do` + `explain`)

```
|-- "do" voice --|-- "explain" voice --|
                 |-- Action happens --|
```

"Do" voice plays first. Action starts when "explain" begins.

### Between steps

`stepDelay` ms pause (default 500ms). Override per-step with `{ delay: 1000 }`.

## 5. Critical Rules

### 5.1 No blank-screen opening

Navigate to the first screen **BEFORE** any `tutorial.context()`. TTS preloads and voice plays before step actions run — if navigation is inside step 1, viewers see `about:blank` for 5–10 seconds.

```typescript
// WRONG
test('my-flow', async ({ page, tutorial }) => {
  tutorial.context('Goal', { text: '...', style: 'goal' });
  tutorial.step('Open page', async () => {
    await page.goto('/page/');  // blank until here
  });
  await tutorial.complete('Done');
});

// RIGHT
test('my-flow', async ({ page, tutorial }) => {
  await page.goto('/page/');
  await expect(page.getByRole('heading', { name: 'Expected' })).toBeVisible();

  tutorial.context('Goal', { text: '...', style: 'goal' });
  tutorial.step('The page', async () => {
    // no-op — screen is already visible
  }, { do: 'Here is the page', explain: 'This is where...' });
  await tutorial.complete('Done');
});
```

### 5.2 Navigation transitions

When a step triggers a page change (form submit → redirect), either:
1. `waitForURL(...)` at the end of that step, or
2. Describe the new screen in the *following* step

Un-awaited client-side `goto()` calls (e.g., onboarding auto-advance) **must** be awaited:
```typescript
await page.waitForURL(url => url.pathname.startsWith('/next/'), { timeout: 5000 }).catch(() => {});
```

Without this, the next step's voice is killed by "Execution context was destroyed."

### 5.3 Dual-mode (test + tutorial)

The same file runs as both:
- `playwright test` → fast E2E test (tutorial calls are no-op)
- `TUTORIAL_MODE=true playwright test` → narrated video

**Never create separate tutorial files.** One file, two modes.

### 5.4 Tag requirement

```typescript
test('My Tutorial', { tag: ['@tutorial'] }, async ({ page, tutorial }) => { ... });
```

Tutorial-mode runners filter by `--grep "@tutorial"`.

### 5.5 Queue vs execute

- `tutorial.context()` → **queues** (no await)
- `tutorial.step()` → **queues** (no await)  
- `await tutorial.complete()` → **executes everything** (the only await)

## 6. Acronym Pronunciation (voiceText)

TTS engines mispronounce acronyms. `voiceText` overrides what TTS says without changing on-screen text.

Only add when TTS actually mispronounces — not preemptively.

| Language | Strategy | Example |
|---|---|---|
| French | Phonetic spelling | "cé-i-ène" for CIN, "caisse nationale de sécurité sociale" for CNSS |
| English | Dotted abbreviations | "C.I.N.", "C.N.S.S." |
| Arabic | Usually fine (full terms) | Only if a Latin acronym appears in Arabic text |

When using i18n, put `voiceText` in the translation file alongside `do`/`explain`:
```json
{
  "employee_identity": {
    "do": "Entrez le nom et la CIN",
    "explain": "La CIN est le numéro de la carte d'identité nationale",
    "voiceText": "Entrez le nom et le numéro de carte d'identité nationale."
  }
}
```

## 7. TTS Configuration

| Provider | Setup | Best for |
|---|---|---|
| macOS `say` | Default, no config | Local dev |
| Edge TTS | `pip install edge-tts` | Free neural voices |
| Custom | `TUTORIAL_TTS_CMD='cmd {lang} {text} {output}'` | Premium voices |

Environment variables:
- `TUTORIAL_MODE` — master switch (`'true'` to generate video)
- `TUTORIAL_VOICE` — `'false'` disables TTS
- `TUTORIAL_TTS_CMD` — custom TTS command with `{lang}`, `{text}`, `{output}` placeholders
- `TUTORIAL_VOICE_NAME` — voice name override
- `TUTORIAL_OUTPUT_DIR` — timeline output dir (default: `tutorials/output`)

## 8. Playwright Reporter

Auto-merges audio into video after each tutorial test:

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['pw-tutorial-video/reporter', {
      mappingFile: 'path/to/tutorial-mapping.txt',
      tutorialsJson: 'path/to/tutorials.json',
    }],
  ],
});
```

Never override `--reporter` on the CLI — it disables the merge step.

## 9. Output

```
tutorials/
├── output/
│   └── {name}_timeline.json      # Timing + ffmpeg command
├── transcripts/
│   └── {name}.md                 # Auto-generated transcript
└── videos/
    ├── {name}.webm               # Merged video + audio
    ├── {name}-poster.webp        # Poster image (step 1)
    └── {name}-step-{n}.webp      # Per-step screenshots
```

## 10. Checklist

Before submitting a tutorialized test:

- [ ] First screen rendered BEFORE `tutorial.context()` — no blank opening
- [ ] Every navigation inside a step either `waitForURL` or described in the next step
- [ ] Opens with a `goal` context
- [ ] No step has more than 2 sentences of narration
- [ ] Related fields grouped into single steps
- [ ] "Do" phrases ≤ 8 words
- [ ] "Explain" gives WHY, not WHAT
- [ ] Acronyms have `voiceText` where TTS mispronounces them
- [ ] Encouraging, specific completion message
- [ ] Test passes without `TUTORIAL_MODE` (plain E2E)
- [ ] Test passes with `TUTORIAL_MODE=true` (video generation)
- [ ] Video watched — does it feel human?
