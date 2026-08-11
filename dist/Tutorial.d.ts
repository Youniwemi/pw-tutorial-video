import type { Page, Locator, FrameLocator } from '@playwright/test';
import type { TutorialOptions, StepOptions, ContextOptions, SceneFocus } from './types.js';
import { TutorialTimeline } from './timeline.js';
export declare class Tutorial {
    private page;
    private options;
    private initialized;
    private testName;
    private translateFn;
    private voice;
    private music;
    private cursor;
    private overlay;
    private timeline;
    private pendingItems;
    private stepCounter;
    private videoStartTime;
    private scenes;
    private activeScenes;
    private sceneTransitionMs;
    constructor(page: Page, options: TutorialOptions);
    private requireScene;
    /**
     * Mount the stage: a tab bar plus one iframe per scene.
     *
     * The parent page is loaded from `audioBaseUrl` first, because setContent
     * keeps the current origin — that is what lets narration audio load without
     * cross-origin friction, with no stage file to deploy.
     */
    stage(): Promise<void>;
    /** A scene is a plain FrameLocator — the whole Playwright locator API. */
    scene(name: string): FrameLocator;
    /** Navigate a scene. Relative paths resolve against its baseUrl; an absolute
     *  URL is honoured as-is, so a scene may change origin mid-tutorial. */
    goto(name: string, url: string): Promise<void>;
    /**
     * Bring scene(s) to the stage. One fills it; two share it side by side.
     * The cursor is hidden across the switch so it never streaks between panes.
     */
    focus(target: SceneFocus): Promise<void>;
    /** What to stamp on a timeline entry: a bare name, or a pair when two
     *  scenes shared the stage. Undefined for single-scene tutorials. */
    private get stagedScene();
    private sameFocus;
    static get isEnabled(): boolean;
    private translate;
    clearFields(): void;
    get hasSteps(): boolean;
    get stepCount(): number;
    switchPage(page: Page): void;
    /** @deprecated Total steps are now calculated automatically. */
    setTotalSteps(total: number): void;
    /** @deprecated Voice preloading is now automatic when steps/contexts are added. */
    preloadVoice(texts: string[]): Promise<void>;
    private initialize;
    private ensureStyles;
    context(key: string, options?: ContextOptions): void;
    step(key: string, action: () => Promise<void>, options?: StepOptions): void;
    highlight(selector: string | Locator, duration?: number): Promise<void>;
    unhighlight(selector: string | Locator): Promise<void>;
    moveMouseToElement(locator: Locator): Promise<void>;
    moveMouse(targetX: number, targetY: number): Promise<void>;
    animateClick(): Promise<void>;
    click(selector: string | Locator): Promise<void>;
    fill(selector: string | Locator, value: string): Promise<void>;
    typeSlowly(selector: string | Locator, value: string, delay?: number): Promise<void>;
    typeBlurred(selector: string | Locator, value: string, delay?: number): Promise<void>;
    selectOption(selector: string | Locator, value: string): Promise<void>;
    hideOverlay(): Promise<void>;
    showEmailPreview(options: {
        subject: string;
        from?: string;
        to?: string;
        body: string;
        highlightCode?: string;
        duration?: number;
    }): Promise<void>;
    hideEmailPreview(): Promise<void>;
    complete(message?: string): Promise<void>;
    getTimeline(): ReturnType<TutorialTimeline['getData']>;
    private captureStepScreenshot;
    deleteVideoIfEmpty(): Promise<boolean>;
}
//# sourceMappingURL=Tutorial.d.ts.map