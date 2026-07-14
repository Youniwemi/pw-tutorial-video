import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
const OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || 'tutorials/output';
class TutorialMergeReporter {
    mappingFile;
    tutorialsJson;
    constructor(options = {}) {
        this.mappingFile = options.mappingFile ?? process.env.TUTORIAL_MAPPING_FILE ?? 'tutorial-mapping.txt';
        this.tutorialsJson = options.tutorialsJson ?? process.env.TUTORIAL_TUTORIALS_JSON ?? 'tutorials.json';
    }
    onBegin() {
        console.log('[TutorialMerge] Reporter loaded — will merge videos after each tutorial test');
    }
    onTestEnd(test, result) {
        if (result.status !== 'passed')
            return;
        if (!test.tags.includes('@tutorial'))
            return;
        const timelinePath = this.findTimelineByTitle(test.title);
        if (!timelinePath) {
            console.log(`[TutorialMerge] No timeline for "${test.title}", skipping`);
            return;
        }
        try {
            const timeline = JSON.parse(readFileSync(timelinePath, 'utf-8'));
            const mergeCmd = timeline.mergeCommand;
            if (!mergeCmd) {
                console.log(`[TutorialMerge] No merge command for "${test.title}"`);
                return;
            }
            const videoPath = mergeCmd.match(/-i "([^"]*\.webm)"/)?.[1];
            if (videoPath) {
                if (!existsSync(videoPath)) {
                    console.log(`[TutorialMerge] Waiting for video: ${videoPath}`);
                    for (let i = 0; i < 30; i++) {
                        execSync('sleep 1');
                        if (existsSync(videoPath))
                            break;
                    }
                }
                if (existsSync(videoPath)) {
                    let prevSize = -1;
                    for (let i = 0; i < 15; i++) {
                        const { size } = statSync(videoPath);
                        if (size > 0 && size === prevSize)
                            break;
                        prevSize = size;
                        execSync('sleep 0.5');
                    }
                }
            }
            console.log(`[TutorialMerge] Merging: ${test.title}`);
            execSync(mergeCmd, { stdio: 'inherit' });
            console.log(`[TutorialMerge] Done: ${test.title}`);
            this.patchTutorialsDuration(timeline);
        }
        catch (e) {
            console.error(`[TutorialMerge] Failed for "${test.title}": ${e.message}`);
        }
    }
    patchTutorialsDuration(timeline) {
        const { testName, lang, totalDurationMs } = timeline;
        const mins = Math.floor(totalDurationMs / 60000);
        const secs = Math.floor((totalDurationMs % 60000) / 1000);
        const duration = `${mins}:${secs.toString().padStart(2, '0')}`;
        if (!existsSync(this.mappingFile)) {
            console.log(`[TutorialMerge] ${this.mappingFile} not found, skipping duration patch`);
            return;
        }
        const mappingLines = readFileSync(this.mappingFile, 'utf-8').split('\n');
        const videoId = mappingLines
            .filter(line => !line.startsWith('#') && line.trim())
            .map(line => line.split(':'))
            .find(([name]) => name === testName)?.[1];
        if (!videoId) {
            console.log(`[TutorialMerge] No mapping for "${testName}", add to ${this.mappingFile} + ${this.tutorialsJson}`);
            return;
        }
        if (!existsSync(this.tutorialsJson)) {
            console.log(`[TutorialMerge] ${this.tutorialsJson} not found, skipping duration patch`);
            return;
        }
        const tutorialsData = JSON.parse(readFileSync(this.tutorialsJson, 'utf-8'));
        const video = (tutorialsData.videos ?? []).find((v) => v.id === videoId);
        if (!video) {
            console.log(`[TutorialMerge] "${videoId}" not in ${this.tutorialsJson}, add it manually`);
            return;
        }
        if (typeof video.duration === 'string') {
            video.duration = { fr: video.duration };
        }
        video.duration[lang] = duration;
        if (timeline.feature) {
            video.feature = timeline.feature;
        }
        const today = new Date().toISOString().slice(0, 10);
        if (!video.uploadDate)
            video.uploadDate = today;
        video.dateModified = today;
        writeFileSync(this.tutorialsJson, JSON.stringify(tutorialsData, null, 2) + '\n');
        console.log(`[TutorialMerge] Duration[${lang}] ${duration} → ${this.tutorialsJson} (${videoId})`);
    }
    findTimelineByTitle(testTitle) {
        if (!existsSync(OUTPUT_DIR))
            return null;
        for (const entry of readdirSync(OUTPUT_DIR)) {
            if (!entry.endsWith('_timeline.json'))
                continue;
            const path = join(OUTPUT_DIR, entry);
            try {
                const data = JSON.parse(readFileSync(path, 'utf-8'));
                if (data.testTitle === testTitle)
                    return path;
            }
            catch {
                // ignore malformed
            }
        }
        return null;
    }
}
export default TutorialMergeReporter;
//# sourceMappingURL=reporter.js.map