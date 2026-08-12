import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TimelineData } from '../timeline.js';

export interface ScannedTutorial {
	timeline: TimelineData;
	videoFile: string;
	/** Filenames sorted by step number */
	stepScreenshots: string[];
}

export function scanTutorials(inputDir: string): ScannedTutorial[] {
	const outputDir = join(inputDir, 'output');
	const videosDir = join(inputDir, 'videos');
	const results: ScannedTutorial[] = [];

	if (!existsSync(videosDir)) return results;

	const videoFiles = readdirSync(videosDir).filter((f) => f.endsWith('.webm'));
	const allVideoDirFiles = readdirSync(videosDir);

	// Index timelines by testName
	const timelinesByName = new Map<string, TimelineData>();
	if (existsSync(outputDir)) {
		for (const tf of readdirSync(outputDir).filter((f) => f.endsWith('_timeline.json'))) {
			const timeline: TimelineData = JSON.parse(readFileSync(join(outputDir, tf), 'utf-8'));
			timelinesByName.set(timeline.testName, timeline);
		}
	}

	for (const videoFileName of videoFiles) {
		const baseName = videoFileName.replace(/\.webm$/, '');
		const timeline = timelinesByName.get(baseName);

		const stepPattern = new RegExp(`^${escapeRegex(baseName)}-step-(\\d+)\\.(png|jpe?g|webp|avif)$`);
		const steps: { n: number; file: string }[] = [];
		for (const file of allVideoDirFiles) {
			const m = file.match(stepPattern);
			if (m) steps.push({ n: parseInt(m[1], 10), file });
		}

		const syntheticTimeline: TimelineData = timeline ?? {
			testName: baseName,
			testTitle: baseName,
			testFile: '',
			projectName: '',
			lang: 'fr',
			totalDurationMs: 0,
			videoTrimMs: 0,
			steps: [],
			videoPath: '',
			mergeCommand: ''
		};

		results.push({
			timeline: syntheticTimeline,
			videoFile: videoFileName,
			stepScreenshots: steps.sort((a, b) => a.n - b.n).map((s) => s.file)
		});
	}

	return results;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
