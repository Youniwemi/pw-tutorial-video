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
| `overlayPosition` | `'TL' \| 'TR' \| 'BL' \| 'BR'` | `'TR'` | Overlay corner position |
| `variant` | `string` | `env TUTORIAL_VARIANT` | Suffixes `testName` (`<testName>-<variant>`) so a second recording never overwrites the first. `'mobile'` also compacts the overlay and pins the multi-scene split (see below) |

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
| `overlayPosition` | `'TL' \| 'TR' \| 'BL' \| 'BR'` | Override overlay position for this step |

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
│   └── {name}.md                 # Auto-generated transcript (editable — see below)
└── videos/
    ├── {name}.webm               # Merged video + audio
    ├── {name}-poster.webp        # Poster image (step 1)
    └── {name}-step-{n}.webp      # Per-step screenshots
```

### Reviewing & correcting narration

The transcript is the review surface: edit the narration texts in
`tutorials/transcripts/{name}.md`, then run `npx tutorial-transcript apply` —
it locates each original text in the test source (via the timeline JSON) and
rewrites the string literals in place. Entries are paired by the `**key:**`
lines in order (a key used twice corrects each occurrence in turn;
`**[Complete]**` is the completion message). Two-part narrations
(`do` + `explain`, title + description) are split at the first sentence
boundary and both halves replaced. Texts sourced from an i18n catalog, or a
first sentence that is the verbatim step key, are never rewritten — they are
reported with their key for a manual fix in the translations. Re-run with
`TUTORIAL_MODE=true` afterwards: only changed TTS clips are regenerated
(content-hash caching). `npx tutorial-transcript` (no subcommand) just
regenerates the transcripts from the timeline JSON.

## 10. Multiple user profiles (scenes)

When the story needs two people — one acts, the other reacts — declare each as a
**scene**. The stage becomes a browser-like tab bar with one `<iframe>` per scene.

```typescript
const tutorial = new Tutorial(page, {
  title: t('tutorial.invoice.title'),
  scenes: {
    accountant: { label: 'Sara — Accountant', baseUrl: 'http://localhost:5173' },
    client:     { label: 'ACME — Client',     baseUrl: 'http://localhost:5174' },
  },
  focus: 'accountant',
});

const accountant = tutorial.scene('accountant');   // a Playwright FrameLocator
const client     = tutorial.scene('client');

await tutorial.stage();                       // mount tab bar + iframes
await tutorial.goto('accountant', '/invoices/new');

tutorial.step('issue_invoice', () => tutorial.click(accountant.getByRole('button')),
  { scene: 'accountant' });

tutorial.step('client_pays', () => tutorial.click(client.getByRole('button')),
  { scene: 'client' });                       // tab switches automatically
```

### Scene methods

| Method | Effect |
|---|---|
| `tutorial.stage()` | Mount the stage — call once, before any `goto` |
| `tutorial.scene(name)` | The scene as a `FrameLocator` (full locator API) |
| `tutorial.goto(name, url)` | Navigate a scene; relative to its `baseUrl`, or absolute |
| `tutorial.focus(name \| names[], options?)` | Bring scene(s) on stage with optional `{ ratio: [30, 70] }` |

### Rules

**10.1 Scenes must be different origins.** Same-origin iframes share cookies and
`localStorage`, so the second login overwrites the first. Two users of the same
app need a second hostname (`app.localhost` / `app2.localhost`).

**10.2 Tag every step with its scene.** A hidden scene is not interactive —
acting on an off-stage scene times out. `{ scene }` switches the stage first.

**10.3 Split layout with ratios.** `{ scene: ['a', 'b'] }` splits the stage
for one step. By default panes share equally; pass `ratio` to `focus()` for
asymmetric splits:

```typescript
// 30/70 — focus on the right pane
await tutorial.focus(['accountant', 'client'], { ratio: [30, 70] });

// 50/50 — equal split
await tutorial.focus(['accountant', 'client'], { ratio: [50, 50] });

// 70/30 — focus on the left pane
await tutorial.focus(['accountant', 'client'], { ratio: [70, 30] });

// Back to single tab
await tutorial.focus('client');
```

In split mode the shared tab bar hides; each pane gets its own label header
above its iframe, and a visible separator divides the two sides. In single
mode the regular tab bar shows all tabs (so the viewer knows who else is in
the story). In the array, the first scene is the one acting.

**10.4 Alternation is free.** Changing `scene` between steps switches tabs — you
never write the switch. Narration should acknowledge it ("meanwhile, the client…"),
otherwise the cut feels abrupt.

**10.5 The target app must allow framing.** `X-Frame-Options` or a strict
`frame-ancestors` blocks the scene and leaves an empty pane. Relax it in tutorial
mode only.

## 11. Overlay Position

The overlay defaults to **top-right** (`TR`). Set `overlayPosition` globally or per-step to move it.

```typescript
// Global — all steps in bottom-right
const tutorial = new Tutorial(page, {
  title: 'My Tutorial',
  overlayPosition: 'BR',
});

// Per-step override — this step only
tutorial.step('Look here', async () => { ... }, {
  overlayPosition: 'TR',
});
```

| Position | Placement |
|---|---|
| `TL` | Top-left |
| `TR` | Top-right (default) |
| `BL` | Bottom-left |
| `BR` | Bottom-right |

**RTL mirroring**: when `lang: 'ar'`, positions mirror automatically — `TL`↔`TR`, `BL`↔`BR`. No manual override needed.

**When to move the overlay**: place it where it won't cover the action. If the step interacts with a top-left form, move the overlay to `BR`. If the action is bottom-right, keep `TL`.

## 12. Variants (mobile recording)

Record a second, phone-sized version of the same tutorial without touching the spec: run with `TUTORIAL_VARIANT=mobile` (or pass `variant: 'mobile'`).

```typescript
import { Tutorial, mobileStage } from 'pw-tutorial-video';

// Top of the spec: widens viewport + video to N phones side by side.
// Inert unless TUTORIAL_VARIANT=mobile.
test.use(mobileStage(2)); // device name ('Pixel 7' default) or explicit {width, height}
```

```bash
TUTORIAL_MODE=true npx playwright test                          # <name>.webm
TUTORIAL_MODE=true TUTORIAL_VARIANT=mobile npx playwright test  # <name>-mobile.webm
```

The `mobile` variant automatically:

- suffixes every output (`-mobile`) — video, timeline, transcript, screenshots;
- **pins the split** on multi-scene tutorials: all scenes always visible at equal width, tab bar hidden, per-scene labels shown (inactive dimmed), `focus()` ratios ignored;
- **compacts the overlay** (smaller card and type, icon + step badge hidden). All of it is CSS variables scoped on `html[data-tutorial-variant='mobile']` remapping `--tutorial-*` to `--tutorial-*-mobile` values — tune from the consuming project with a plain `:root { --tutorial-overlay-width-mobile: 220px; }` override, or bring the icon back with `--tutorial-icon-display-mobile: inline-flex`.

Any other variant name only suffixes outputs and stamps `data-tutorial-variant` (no preset). The reporter matches timelines by `testTitle` **and** variant (newest mtime wins), so both runs may share the same output dir.

In tutorial mode `mobileStage()` records **oversampled 2× by default** (Playwright never upscales video, so 1× phone video is blurry): it forces `--force-device-scale-factor=2`, aligns `deviceScaleFactor` and doubles `video.size` — layout unchanged. Tune with `mobileStage(2, 'Pixel 7', { scale })`. Caveat: `test.use()` replaces the config's `launchOptions`; repeat any tutorial-mode Chromium args via `{ launchArgs: [...] }`.

## 13. Checklist

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

Multi-scene tutorials, additionally:

- [ ] Every step touching a scene carries `{ scene }`
- [ ] Scenes are on distinct origins (or aliased hostnames)
- [ ] Side-by-side used only where simultaneity carries meaning
- [ ] Narration acknowledges each tab switch
