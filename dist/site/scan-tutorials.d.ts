import type { TimelineData } from '../timeline.js';
export interface ScannedTutorial {
    timeline: TimelineData;
    videoFile: string;
    /** Screenshot filenames with their step number, sorted by step number */
    stepScreenshots: {
        n: number;
        file: string;
    }[];
}
export declare function scanTutorials(inputDir: string): ScannedTutorial[];
//# sourceMappingURL=scan-tutorials.d.ts.map