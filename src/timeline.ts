import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { buildMergeCommand } from './merge.js';

export interface TimelineStep {
	step: number;
	title: string;
	text?: string;
	key?: string;
	audioFile: string;
	startMs: number;
	durationMs: number;
}

export interface TimelineData {
	testName: string;
	/** Raw test title passed to Playwright's `test(...)` — the i18n key.
	 *  Lets the reporter match a timeline to its testCase without re-deriving testName. */
	testTitle: string;
	testFile: string;
	projectName: string;
	lang: string;
	totalDurationMs: number;
	/** Milliseconds to trim from video start (preload time) */
	videoTrimMs: number;
	steps: TimelineStep[];
	/** Video file path from Playwright */
	videoPath: string;
	/** Pre-built ffmpeg command */
	mergeCommand: string;
	/** Feature name sourced from @feature:* test tag */
	feature?: string;
}

export interface TimelineMusicOptions {
	musicFile?: string;
	musicVolume?: number;
	voiceVolume?: number;
}

/**
 * Tracks timing of tutorial steps for post-processing audio merge.
 */
export class TutorialTimeline {
	private testName: string;
	private testTitle: string;
	private testFile: string;
	private projectName: string;
	private lang: string;
	private feature: string = '';
	private musicOptions: TimelineMusicOptions;
	private startTime: number = 0;
	private videoTrimMs: number = 0;
	private steps: TimelineStep[] = [];
	private videoPath: string = '';

	constructor(
		testName: string,
		testFile: string = '',
		projectName: string = '',
		lang: string = 'fr',
		testTitle: string = '',
		feature: string = '',
		musicOptions: TimelineMusicOptions = {}
	) {
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
	start(videoTrimMs: number = 0): void {
		this.startTime = Date.now();
		this.videoTrimMs = videoTrimMs;
		console.log(`[Timeline] Started at ${new Date().toISOString()} (trim ${videoTrimMs}ms from video start)`);
	}

	/**
	 * Set the video path (from Playwright's page.video()?.path())
	 */
	setVideoPath(path: string): void {
		this.videoPath = path;
	}

	/**
	 * Record a step at a specific timestamp (for accurate voice timing)
	 */
	addStep(step: number, title: string, audioFile: string, durationMs: number, timestamp: number, text?: string, key?: string): void {
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
	getData(): TimelineData {
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
	save(outputPath: string): void {
		const data = this.getData();
		writeFileSync(outputPath, JSON.stringify(data, null, 2));
		console.log(`[Timeline] Saved to ${outputPath}`);

		const transcriptDir = join(process.cwd(), 'tutorials/transcripts');
		if (!existsSync(transcriptDir)) mkdirSync(transcriptDir, { recursive: true });

		const lines: string[] = [];
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
			if (!step.text) continue;

			if (step.step === 0 && step.title === 'Context') {
				lines.push(`**[Context]** ${step.text}`);
				if (step.key) lines.push(`**key:** \`${step.key}\``);
				lines.push('');
			} else if (step.title === 'Complete') {
				lines.push(`**[Complete]** ${step.text}`);
				lines.push('');
			} else {
				stepNum++;
				lines.push(`### Step ${stepNum}: ${step.title}`);
				if (step.key) lines.push(`**key:** \`${step.key}\``);
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
