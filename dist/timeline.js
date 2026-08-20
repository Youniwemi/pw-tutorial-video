import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { buildMergeCommand } from './merge.js';
import { buildTranscriptMarkdown } from './transcript.js';
/**
 * Tracks timing of tutorial steps for post-processing audio merge.
 */
export class TutorialTimeline {
    testName;
    testTitle;
    title = '';
    testFile;
    projectName;
    lang;
    feature = '';
    musicOptions;
    startTime = 0;
    videoTrimMs = 0;
    steps = [];
    videoPath = '';
    constructor(testName, testFile = '', projectName = '', lang = 'fr', testTitle = '', feature = '', musicOptions = {}, title = '') {
        this.testName = testName;
        this.testTitle = testTitle;
        this.title = title;
        this.testFile = testFile;
        this.projectName = projectName;
        this.lang = lang;
        this.feature = feature;
        this.musicOptions = musicOptions;
    }
    /**
     * Mark the start of the tutorial (second 0 for video)
     */
    start(videoTrimMs = 0) {
        this.startTime = Date.now();
        this.videoTrimMs = videoTrimMs;
        console.log(`[Timeline] Started at ${new Date().toISOString()} (trim ${videoTrimMs}ms from video start)`);
    }
    /**
     * Set the video path (from Playwright's page.video()?.path())
     */
    setVideoPath(path) {
        this.videoPath = path;
    }
    /**
     * Record a step at a specific timestamp (for accurate voice timing)
     */
    addStep(step, title, audioFile, durationMs, timestamp, text, key, scene) {
        const startMs = timestamp - this.startTime;
        this.steps.push({
            step,
            title,
            ...(text ? { text } : {}),
            ...(key ? { key } : {}),
            ...(scene ? { scene } : {}),
            audioFile,
            startMs,
            durationMs
        });
        console.log(`[Timeline] Step ${step}: "${title}" at ${startMs}ms (${durationMs}ms audio)`);
    }
    /**
     * Get the timeline data with merge command
     */
    getData() {
        const data = {
            testName: this.testName,
            testTitle: this.testTitle,
            title: this.title || undefined,
            testFile: this.testFile,
            projectName: this.projectName,
            lang: this.lang,
            feature: this.feature || undefined,
            totalDurationMs: Date.now() - this.startTime,
            videoTrimMs: this.videoTrimMs,
            steps: this.steps,
            videoPath: this.videoPath
        };
        // Output filename is already language-specific (testName = slugified translated title).
        // No `-en` / `-ar` suffix needed — each locale produces its own SEO-friendly slug.
        const { command } = buildMergeCommand(data, this.videoPath, `tutorials/videos/${this.testName}.webm`, this.musicOptions);
        return {
            ...data,
            mergeCommand: command
        };
    }
    /**
     * Save timeline to JSON file and auto-generate transcript markdown.
     */
    save(outputPath) {
        const data = this.getData();
        writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`[Timeline] Saved to ${outputPath}`);
        const transcriptDir = join(process.cwd(), 'tutorials/transcripts');
        if (!existsSync(transcriptDir))
            mkdirSync(transcriptDir, { recursive: true });
        const transcriptPath = join(transcriptDir, `${data.testName}.md`);
        writeFileSync(transcriptPath, buildTranscriptMarkdown(data), 'utf-8');
        console.log(`[Timeline] Transcript: tutorials/transcripts/${data.testName}.md`);
    }
}
//# sourceMappingURL=timeline.js.map