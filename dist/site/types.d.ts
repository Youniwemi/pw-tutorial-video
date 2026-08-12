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
    };
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
    uploadDate: string;
    dateModified?: string;
    steps: number;
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