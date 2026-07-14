import type { Page, Locator } from '@playwright/test';
export interface CursorOptions {
    mouseSteps: number;
    pauseBeforeClick: number;
}
export declare class TutorialCursor {
    private page;
    private options;
    private x;
    private y;
    private initialized;
    constructor(page: Page, options: CursorOptions);
    switchPage(page: Page): void;
    initialize(): Promise<void>;
    /** Inject cursor element into page */
    private injectCursor;
    /** Ensure cursor is visible (re-inject after navigation) */
    ensureVisible(): Promise<void>;
    moveToElement(locator: Locator): Promise<void>;
    moveTo(targetX: number, targetY: number): Promise<void>;
    animateClick(): Promise<void>;
    hide(): Promise<void>;
}
//# sourceMappingURL=cursor.d.ts.map