import type { SiteConfig, VideoManifest, VideoManifestEntry } from './types.js';
/** One step of a widget payload. Display numbers are precomputed
 *  (sequential, contexts don't count) so the widget stays dumb. */
export interface EmbedStep {
    num?: number;
    title?: string;
    text?: string;
    /** Site-relative path, e.g. "videos/demo-step-1.webp" */
    image?: string;
    context?: boolean;
}
/** Payload served at embed/<id>.json — everything the in-app widget needs
 *  to render one tutorial. All paths are relative to the site base URL,
 *  which the widget derives from its own script src. */
export interface EmbedTutorial {
    id: string;
    title: string;
    description?: string;
    duration: string;
    variant?: string;
    lang: string;
    /** Site primary color — the widget's default accent */
    accent: string;
    /** Site-relative video path ("videos/<file>") */
    video: string;
    /** First step screenshot, used as the video poster */
    poster?: string;
    /** Site-relative path of the full tutorial page ("<id>/") */
    page: string;
    steps: EmbedStep[];
}
export interface EmbedIndex {
    tutorials: {
        id: string;
        title: string;
        duration: string;
        variant?: string;
    }[];
}
export declare function buildEmbedTutorial(video: VideoManifestEntry, config: SiteConfig): EmbedTutorial;
/** All the JSON files the widget consumes: one payload per tutorial plus a
 *  small index (slug discovery / debugging). Paths are relative to the site
 *  root — scaffold writes them under public/. */
export declare function buildEmbedFiles(manifest: VideoManifest, config: SiteConfig): {
    path: string;
    data: EmbedTutorial | EmbedIndex;
}[];
//# sourceMappingURL=embed.d.ts.map