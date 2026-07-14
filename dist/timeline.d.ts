export interface TimelineStep {
    step: number;
    title: string;
    text?: string;
    key?: string;
    audioFile: string;
    startMs: number;
    durationMs: number;
}
export interface TimelineData {
    testName: string;
    /** Raw test title passed to Playwright's `test(...)` — the i18n key.
     *  Lets the reporter match a timeline to its testCase without re-deriving testName. */
    testTitle: string;
    testFile: string;
    projectName: string;
    lang: string;
    totalDurationMs: number;
    /** Milliseconds to trim from video start (preload time) */
    videoTrimMs: number;
    steps: TimelineStep[];
    /** Video file path from Playwright */
    videoPath: string;
    /** Pre-built ffmpeg command */
    mergeCommand: string;
    /** Feature name sourced from @feature:* test tag */
    feature?: string;
}
export interface TimelineMusicOptions {
    musicFile?: string;
    musicVolume?: number;
    voiceVolume?: number;
}
/**
 * Tracks timing of tutorial steps for post-processing audio merge.
 */
export declare class TutorialTimeline {
    private testName;
    private testTitle;
    private testFile;
    private projectName;
    private lang;
    private feature;
    private musicOptions;
    private startTime;
    private videoTrimMs;
    private steps;
    private videoPath;
    constructor(testName: string, testFile?: string, projectName?: string, lang?: string, testTitle?: string, feature?: string, musicOptions?: TimelineMusicOptions);
    /**
     * Mark the start of the tutorial (second 0 for video)
     */
    start(videoTrimMs?: number): void;
    /**
     * Set the video path (from Playwright's page.video()?.path())
     */
    setVideoPath(path: string): void;
    /**
     * Record a step at a specific timestamp (for accurate voice timing)
     */
    addStep(step: number, title: string, audioFile: string, durationMs: number, timestamp: number, text?: string, key?: string): void;
    /**
     * Get the timeline data with merge command
     */
    getData(): TimelineData;
    /**
     * Save timeline to JSON file and auto-generate transcript markdown.
     */
    save(outputPath: string): void;
}
//# sourceMappingURL=timeline.d.ts.map