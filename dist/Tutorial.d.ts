import type { Page, Locator } from '@playwright/test';
import type { TutorialOptions, StepOptions, ContextOptions } from './types.js';
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
    constructor(page: Page, options: TutorialOptions);
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