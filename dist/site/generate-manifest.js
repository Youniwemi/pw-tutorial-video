const DEFAULT_CATEGORY_ICONS = {
    'getting-started': '⭐',
    premium: '💎',
    portal: '👥',
    accountant: '🧾',
    payroll: '💰',
    accounting: '📊',
    settings: '⚙️'
};
function humanize(slug) {
    const s = slug.replace(/[-_]/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}
export function generateManifest(tutorials, config) {
    const detectedCategories = new Set();
    for (const t of tutorials) {
        detectedCategories.add(t.timeline.feature || 'general');
    }
    const categories = {};
    for (const cat of detectedCategories) {
        categories[cat] = {
            icon: DEFAULT_CATEGORY_ICONS[cat] || '📹',
            label: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ')
        };
    }
    if (config.tutorials?.categories) {
        Object.assign(categories, config.tutorials.categories);
    }
    const videos = tutorials.map((t) => {
        const durationSec = Math.round(t.timeline.totalDurationMs / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        return {
            id: t.timeline.testName,
            category: t.timeline.feature || 'general',
            // Older timelines don't carry `title` (the Tutorial display title) —
            // fall back to the Playwright test title, then the slug.
            title: t.timeline.title || t.timeline.testTitle || humanize(t.timeline.testName),
            duration: durationSec > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '',
            premium: false,
            file: t.videoFile,
            feature: t.timeline.feature,
            variant: t.timeline.variant,
            uploadDate: new Date().toISOString().slice(0, 10),
            steps: t.stepScreenshots.length
        };
    });
    return {
        categories,
        videos,
        ui: {
            heroTitle: config.tutorials?.ui?.heroTitle || config.title,
            heroSubtitle: config.tutorials?.ui?.heroSubtitle || 'Video tutorials'
        }
    };
}
//# sourceMappingURL=generate-manifest.js.map