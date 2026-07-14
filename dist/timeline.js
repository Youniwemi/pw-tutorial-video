import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { buildMergeCommand } from './merge.js';
/**
 * Tracks timing of tutorial steps for post-processing audio merge.
 */
export class TutorialTimeline {
    testName;
    testTitle;
    testFile;
    projectName;
    lang;
    feature = '';
    musicOptions;
    startTime = 0;
    videoTrimMs = 0;
    steps = [];
    videoPath = '';
    constructor(testName, testFile = '', projectName = '', lang = 'fr', testTitle = '', feature = '', musicOptions = {}) {
        this.testName = testName;
        this.testTitle = testTitle;
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
    addStep(step, title, audioFile, durationMs, timestamp, text, key) {
        const startMs = timestamp - this.startTime;
        this.steps.push({
            step,
            title,
            ...(text ? { text } : {}),
            ...(key ? { key } : {}),
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
        const lines = [];
        lines.push(`# ${data.testName}`);
        lines.push('');
        lines.push(`- **Test:** \`${data.testTitle}\``);
        lines.push(`- **Language:** ${data.lang}`);
        lines.push(`- **Duration:** ${(data.totalDurationMs / 1000).toFixed(1)}s`);
        lines.push('');
        lines.push('---');
        lines.push('');
        let stepNum = 0;
        for (const step of data.steps) {
            if (!step.text)
                continue;
            if (step.step === 0 && step.title === 'Context') {
                lines.push(`**[Context]** ${step.text}`);
                if (step.key)
                    lines.push(`**key:** \`${step.key}\``);
                lines.push('');
            }
            else if (step.title === 'Complete') {
                lines.push(`**[Complete]** ${step.text}`);
                lines.push('');
            }
            else {
                stepNum++;
                lines.push(`### Step ${stepNum}: ${step.title}`);
                if (step.key)
                    lines.push(`**key:** \`${step.key}\``);
                lines.push('');
                lines.push(step.text);
                lines.push('');
            }
        }
        const transcriptPath = join(transcriptDir, `${data.testName}.md`);
        writeFileSync(transcriptPath, lines.join('\n'), 'utf-8');
        console.log(`[Timeline] Transcript: tutorials/transcripts/${data.testName}.md`);
    }
}
//# sourceMappingURL=timeline.js.map