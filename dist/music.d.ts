import type { Page } from '@playwright/test';
export interface MusicOptions {
    backgroundMusic: string;
    musicVolume: number;
}
/**
 * In-browser music for live viewing during test execution.
 * Note: Music is NOT captured via MediaRecorder - it's added in post-processing
 * by the merge script (scripts/merge-tutorial-audio.sh) for continuous playback.
 *
 * All playback methods are no-ops when TUTORIAL_MODE is not enabled,
 * ensuring no audio plays during regular test runs.
 */
export declare class TutorialMusic {
    private page;
    private options;
    private initialized;
    constructor(page: Page, options: MusicOptions);
    switchPage(page: Page): void;
    get isInitialized(): boolean;
    /**
     * Ensure music is still playing (restart after page navigation)
     */
    ensurePlaying(): Promise<void>;
    start(): Promise<void>;
    stop(fadeOut?: boolean): Promise<void>;
    setVolume(volume: number): Promise<void>;
}
//# sourceMappingURL=music.d.ts.map