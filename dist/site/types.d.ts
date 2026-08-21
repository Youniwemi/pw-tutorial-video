export interface SiteConfig {
    title: string;
    logo?: string;
    primaryColor: string;
    font: string;
    input: string;
    output: string;
    baseUrl: string;
    /** Single lang or comma-separated list, e.g. "fr,en,ar" */
    lang: string;
    tutorials?: {
        categories?: Record<string, {
            icon: string;
            label: string;
        }>;
        ui?: {
            heroTitle?: string;
            heroSubtitle?: string;
        };
        /** Video page step guide layout:
         *  - 'strip': horizontal thumbnail strip (default)
         *  - 'cards': numbered text cards with a small screenshot, click to enlarge
         *  - 'text':  text-only cards, click to reveal the screenshot
         *  - 'full':  full-width screenshot under each step's text */
        stepsLayout?: 'strip' | 'cards' | 'text' | 'full';
    };
}
/** One entry of a video page's step-by-step guide, built from the timeline
 *  narration merged with the step screenshots. */
export interface ManifestStep {
    /** Timeline step number; absent for mid-flow context narrations */
    n?: number;
    title?: string;
    /** Narration text spoken during this step */
    text?: string;
    /** Screenshot filename relative to videos/ */
    image?: string;
    /** True for a context narration shown between steps (no number, no image) */
    context?: boolean;
}
export interface VideoManifestEntry {
    id: string;
    category: string;
    title: string;
    duration: string;
    premium: boolean;
    /** Filename relative to videos/ */
    file: string;
    feature?: string;
    /** Recording variant (e.g. 'mobile'); absent = regular/desktop */
    variant?: string;
    uploadDate: string;
    dateModified?: string;
    steps: number;
    /** Intro narration (leading context steps), shown under the video title */
    description?: string;
    /** Step-by-step guide rendered on the video page */
    stepsDetail?: ManifestStep[];
}
export interface VideoManifest {
    categories: Record<string, {
        icon: string;
        label: string;
    }>;
    videos: VideoManifestEntry[];
    ui: {
        heroTitle: string;
        heroSubtitle: string;
    };
}
//# sourceMappingURL=types.d.ts.map