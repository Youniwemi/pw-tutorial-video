export function buildEmbedTutorial(video, config) {
    let counter = 0;
    const steps = (video.stepsDetail ?? []).map((s) => ({
        ...(s.context ? {} : { num: ++counter }),
        ...(s.title ? { title: s.title } : {}),
        ...(s.text ? { text: s.text } : {}),
        ...(s.image ? { image: `videos/${s.image}` } : {}),
        ...(s.context ? { context: true } : {})
    }));
    const poster = (video.stepsDetail ?? []).find((s) => s.image)?.image;
    return {
        id: video.id,
        title: video.title,
        ...(video.description ? { description: video.description } : {}),
        duration: video.duration,
        ...(video.variant ? { variant: video.variant } : {}),
        // config.lang may be a comma-separated list — the first entry is the site default
        lang: (config.lang || 'en').split(',')[0].trim(),
        accent: config.primaryColor || '#6366f1',
        video: `videos/${video.file}`,
        ...(poster ? { poster: `videos/${poster}` } : {}),
        page: `${video.id}/`,
        steps
    };
}
/** All the JSON files the widget consumes: one payload per tutorial plus a
 *  small index (slug discovery / debugging). Paths are relative to the site
 *  root — scaffold writes them under public/. */
export function buildEmbedFiles(manifest, config) {
    const files = manifest.videos.map((v) => ({
        path: `embed/${v.id}.json`,
        data: buildEmbedTutorial(v, config)
    }));
    const index = {
        tutorials: manifest.videos.map((v) => ({
            id: v.id,
            title: v.title,
            duration: v.duration,
            ...(v.variant ? { variant: v.variant } : {})
        }))
    };
    files.push({ path: 'embed/index.json', data: index });
    return files;
}
//# sourceMappingURL=embed.js.map