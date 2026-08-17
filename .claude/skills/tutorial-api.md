# Tutorial API Reference

## Constructor

```ts
new Tutorial(page, {
  title: string,              // overlay title
  testTitle?: string,         // must match test() name for reporter
  testFile?: string,          // e.g. "free/01_company.init.ts"
  projectName?: string,       // Playwright project name
  lang?: string,              // 'en' | 'fr' | 'ar' — default 'en'
  backgroundMusic?: string,   // URL or '' for none
  overlayPosition?: 'TL' | 'TR' | 'BL' | 'BR',  // default 'TL'
  scenes?: Record<string, { label: string, baseUrl?: string }>,
  focus?: string | string[],
  // voice, music, cursor options — see TutorialOptions in types.ts
})
```

## Queuing steps

```ts
tutorial.step('Step title', async () => { /* action */ }, {
  description?: string,
  voiceText?: string,
  skipVoice?: boolean,
  do?: string,           // short action narration
  explain?: string,      // explanation during action
  scene?: string | string[],
  overlayPosition?: 'TL' | 'TR' | 'BL' | 'BR',  // per-step override
})

tutorial.context('Goal title', {
  text?: string,
  style?: 'goal' | 'clarification' | 'attention',
})
```

## Execution

```ts
await tutorial.complete(message?)  // runs all queued steps
```

## Multi-scene

```ts
await tutorial.stage()                    // mount scene iframes
await tutorial.goto('sceneName', '/path')
const frame = tutorial.scene('name')      // FrameLocator
await tutorial.focus('name')              // switch scene
await tutorial.focus(['a', 'b'])          // side-by-side
await tutorial.focus(['a', 'b'], { ratio: [30, 70] })
```

## Overlay position

- `TL` = top-left (default), `TR` = top-right, `BL` = bottom-left, `BR` = bottom-right
- RTL (`lang: 'ar'`) mirrors automatically: TL↔TR, BL↔BR
- Set globally via `TutorialOptions.overlayPosition`
- Override per-step via `StepOptions.overlayPosition`
- CSS classes: base is TL (no class), others are `.tutorial-overlay-{tr,bl,br}`
