import type { ManifestStep, SiteConfig, VideoManifest } from './types.js';
import type { ScannedTutorial } from './scan-tutorials.js';
/**
 * Merge a tutorial's timeline narration with its step screenshots into the
 * step-by-step guide shown on the video page. Leading context narrations
 * become the page description; mid-flow contexts stay in the list as
 * unnumbered entries; screenshots of non-voiced steps (absent from the
 * timeline) are inserted at their step position with no text.
 */
export declare function buildStepsDetail(t: ScannedTutorial): {
    description?: string;
    stepsDetail: ManifestStep[];
};
export declare function generateManifest(tutorials: ScannedTutorial[], config: SiteConfig): VideoManifest;
//# sourceMappingURL=generate-manifest.d.ts.map