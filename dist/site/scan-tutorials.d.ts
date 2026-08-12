import type { TimelineData } from '../timeline.js';
export interface ScannedTutorial {
    timeline: TimelineData;
    videoFile: string;
    /** Filenames sorted by step number */
    stepScreenshots: string[];
}
export declare function scanTutorials(inputDir: string): ScannedTutorial[];
//# sourceMappingURL=scan-tutorials.d.ts.map