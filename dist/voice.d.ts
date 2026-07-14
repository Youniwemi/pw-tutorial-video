import type { Page } from '@playwright/test';
export interface VoiceOptions {
    lang: string;
    voiceName: string;
    voiceRate: number;
    voicePitch: number;
    playInBrowser?: boolean;
    audioBaseUrl?: string;
}
export interface PreloadedAudio {
    text: string;
    filename: string;
    filePath: string;
    url: string;
    durationMs: number;
}
/**
 * TTS voice generation for tutorials.
 * Pre-generates audio files and tracks their durations.
 * Optionally plays audio in browser during test.
 */
export declare class TutorialVoice {
    private page;
    private options;
    private ttsProvider;
    private preloadedAudio;
    constructor(page: Page, options: VoiceOptions);
    switchPage(page: Page): void;
    /**
     * Pre-generate a single audio file (non-blocking).
     * Returns a promise that resolves when preload is complete.
     * No-op when TUTORIAL_MODE is not enabled.
     */
    preloadSingle(text: string): Promise<void>;
    /**
     * Pre-generate all audio files before the test runs.
     * No-op when TUTORIAL_MODE is not enabled.
     */
    preload(texts: string[]): Promise<void>;
    /**
     * Get audio info for a text (must be preloaded first)
     */
    getAudio(text: string): PreloadedAudio | undefined;
    /**
     * Get duration in ms for a text (must be preloaded)
     */
    getDuration(text: string): number;
    /**
     * Get the filename for a text (for timeline)
     */
    getFilename(text: string): string;
    /**
     * Play audio in browser (optional, for live viewing)
     * Returns duration in ms
     * Will generate audio on-demand if not preloaded.
     * No-op when TUTORIAL_MODE is not enabled (returns 0).
     */
    play(text: string): Promise<number>;
    /**
     * Generate audio for a single text on demand
     */
    private generateAudio;
    /**
     * Get audio duration using ffprobe or file stats
     */
    private getAudioDuration;
}
//# sourceMappingURL=voice.d.ts.map