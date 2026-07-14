export interface MergeOptions {
    audioDir: string;
    musicFile: string;
    musicVolume: number;
    voiceVolume: number;
    /** Override file existence check (for testing) */
    checkFileExists?: (path: string) => boolean;
}
interface TimelineInput {
    totalDurationMs: number;
    videoTrimMs?: number;
    steps: Array<{
        audioFile: string;
        startMs: number;
    }>;
}
/**
 * Build the ffmpeg command to merge video with audio
 */
export declare function buildMergeCommand(timeline: TimelineInput, videoPath: string, outputPath: string, options?: Partial<MergeOptions>): {
    command: string;
    inputs: string[];
    filter: string;
};
export {};
//# sourceMappingURL=merge.d.ts.map