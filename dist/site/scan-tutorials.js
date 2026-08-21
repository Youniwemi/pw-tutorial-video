import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
export function scanTutorials(inputDir) {
    const outputDir = join(inputDir, 'output');
    const videosDir = join(inputDir, 'videos');
    const results = [];
    if (!existsSync(videosDir))
        return results;
    const videoFiles = readdirSync(videosDir).filter((f) => f.endsWith('.webm'));
    const allVideoDirFiles = readdirSync(videosDir);
    // Index timelines by testName
    const timelinesByName = new Map();
    if (existsSync(outputDir)) {
        for (const tf of readdirSync(outputDir).filter((f) => f.endsWith('_timeline.json'))) {
            const timeline = JSON.parse(readFileSync(join(outputDir, tf), 'utf-8'));
            timelinesByName.set(timeline.testName, timeline);
        }
    }
    for (const videoFileName of videoFiles) {
        const baseName = videoFileName.replace(/\.webm$/, '');
        const timeline = timelinesByName.get(baseName);
        const stepPattern = new RegExp(`^${escapeRegex(baseName)}-step-(\\d+)\\.(png|jpe?g|webp|avif)$`);
        const steps = [];
        for (const file of allVideoDirFiles) {
            const m = file.match(stepPattern);
            if (m)
                steps.push({ n: parseInt(m[1], 10), file });
        }
        const syntheticTimeline = timeline ?? {
            testName: baseName,
            testTitle: baseName,
            testFile: '',
            projectName: '',
            lang: 'fr',
            totalDurationMs: 0,
            videoTrimMs: 0,
            steps: [],
            videoPath: '',
            mergeCommand: '',
            // No timeline to read the variant from — recognize the common suffixes.
            variant: baseName.match(/-(mobile|tablet)$/)?.[1]
        };
        results.push({
            timeline: syntheticTimeline,
            videoFile: videoFileName,
            stepScreenshots: steps.sort((a, b) => a.n - b.n)
        });
    }
    return results;
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=scan-tutorials.js.map