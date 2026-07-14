import type { ContextStyle } from './types.js';
export declare const CURSOR_SVG = "\n<svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n\t<path d=\"M4 4L10.5 20.5L13 13L20.5 10.5L4 4Z\" fill=\"white\" stroke=\"var(--tutorial-cursor-stroke, #1e293b)\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>\n";
export interface StepOverlayParams {
    tutorialTitle: string;
    step: number;
    title: string;
    description?: string;
    isRtl?: boolean;
    progressPercent?: number;
}
export declare function renderStepOverlay(params: StepOverlayParams): string;
export interface ContextOverlayParams {
    tutorialTitle: string;
    contextTitle: string;
    text?: string;
    style: ContextStyle;
    isRtl?: boolean;
}
export declare function renderContextOverlay(params: ContextOverlayParams): string;
export interface CompleteOverlayParams {
    title: string;
    message: string;
}
export declare function renderCompleteOverlay(params: CompleteOverlayParams): string;
export interface EmailPreviewParams {
    subject: string;
    from?: string;
    to?: string;
    body: string;
    highlightCode?: string;
    isRtl?: boolean;
}
export declare function renderEmailPreview(params: EmailPreviewParams): string;
//# sourceMappingURL=overlay-html.d.ts.map