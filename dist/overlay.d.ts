import type { Page, Locator } from '@playwright/test';
import type { ContextStyle } from './types';
export interface OverlayOptions {
    title: string;
    lang: string;
    highlightDuration: number;
}
export declare class TutorialOverlay {
    private page;
    private options;
    private currentStep;
    private totalSteps;
    constructor(page: Page, options: OverlayOptions);
    switchPage(page: Page): void;
    setTotalSteps(total: number): void;
    setCurrentStep(step: number): void;
    incrementStep(): number;
    get step(): number;
    showStep(title: string, description?: string): Promise<void>;
    showContext(contextTitle: string, text?: string, style?: ContextStyle): Promise<void>;
    showComplete(message: string): Promise<void>;
    /**
     * Show a simulated email preview popup with HTML rendering
     */
    showEmailPreview(options: {
        subject: string;
        from?: string;
        to?: string;
        body: string;
        highlightCode?: string;
        isHtml?: boolean;
    }): Promise<void>;
    hideEmailPreview(): Promise<void>;
    hide(): Promise<void>;
    highlight(selector: string | Locator, duration?: number): Promise<void>;
    unhighlight(selector: string | Locator): Promise<void>;
}
//# sourceMappingURL=overlay.d.ts.map