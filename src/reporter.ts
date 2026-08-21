import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || 'tutorials/output';

export interface TutorialReporterOptions {
	mappingFile?: string;
	tutorialsJson?: string;
}

class TutorialMergeReporter implements Reporter {
	private mappingFile: string;
	private tutorialsJson: string;

	constructor(options: TutorialReporterOptions = {}) {
		this.mappingFile = options.mappingFile ?? process.env.TUTORIAL_MAPPING_FILE ?? 'tutorial-mapping.txt';
		this.tutorialsJson = options.tutorialsJson ?? process.env.TUTORIAL_TUTORIALS_JSON ?? 'tutorials.json';
	}

	onBegin(): void {
		console.log('[TutorialMerge] Reporter loaded — will merge videos after each tutorial test');
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		if (result.status !== 'passed') return;
		if (!test.tags.includes('@tutorial')) return;

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
						if (existsSync(videoPath)) break;
					}
				}
				if (existsSync(videoPath)) {
					let prevSize = -1;
					for (let i = 0; i < 15; i++) {
						const { size } = statSync(videoPath);
						if (size > 0 && size === prevSize) break;
						prevSize = size;
						execSync('sleep 0.5');
					}
				}
			}

			let finalCmd = mergeCmd;
			if (timeline.syncMarker && videoPath && existsSync(videoPath)) {
				const exactTrim = this.detectSyncMarker(videoPath);
				if (exactTrim !== null) {
					const declared = (timeline.videoTrimMs ?? 0) / 1000;
					console.log(`[TutorialMerge] Sync marker at ${exactTrim.toFixed(3)}s (wall-clock trim was ${declared.toFixed(3)}s)`);
					const ss = `-ss ${exactTrim.toFixed(3)}`;
					finalCmd = /-ss [\d.]+/.test(finalCmd)
						? finalCmd.replace(/-ss [\d.]+/, ss)
						: finalCmd.replace('ffmpeg -y', `ffmpeg -y ${ss}`);
				} else {
					console.log('[TutorialMerge] Sync marker not found on tape — using wall-clock trim');
				}
			}

			console.log(`[TutorialMerge] Merging: ${test.title}`);
			execSync(finalCmd, { stdio: 'inherit' });
			console.log(`[TutorialMerge] Done: ${test.title}`);

			this.patchTutorialsDuration(timeline);
		} catch (e: any) {
			console.error(`[TutorialMerge] Failed for "${test.title}": ${e.message}`);
		}
	}

	/**
	 * Find the full-screen black sync marker in the source video and return
	 * the timestamp (seconds) of its END — the exact video time of timeline
	 * zero. Returns null when no black interval is found.
	 */
	private detectSyncMarker(videoPath: string): number | null {
		try {
			const out = execSync(
				`ffmpeg -hide_banner -i "${videoPath}" -vf "blackdetect=d=0.2:pic_th=0.95" -an -f null - 2>&1`,
				{ encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 }
			);
			const m = out.match(/black_end:([\d.]+)/);
			return m ? parseFloat(m[1]) : null;
		} catch {
			return null;
		}
	}

	private patchTutorialsDuration(timeline: { testName: string; lang: string; totalDurationMs: number; feature?: string }): void {
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
		const video = (tutorialsData.videos ?? []).find((v: { id: string }) => v.id === videoId);
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
		if (!video.uploadDate) video.uploadDate = today;
		video.dateModified = today;
		writeFileSync(this.tutorialsJson, JSON.stringify(tutorialsData, null, 2) + '\n');
		console.log(`[TutorialMerge] Duration[${lang}] ${duration} → ${this.tutorialsJson} (${videoId})`);
	}

	private findTimelineByTitle(testTitle: string): string | null {
		if (!existsSync(OUTPUT_DIR)) return null;
		// The same test recorded in several variants leaves one timeline per
		// variant with the same testTitle: keep the one matching this run's
		// TUTORIAL_VARIANT (older JSONs without the field count as no-variant),
		// and break remaining ties by most recent mtime.
		const runVariant = process.env.TUTORIAL_VARIANT || undefined;
		const candidates: { path: string; mtimeMs: number }[] = [];
		for (const entry of readdirSync(OUTPUT_DIR)) {
			if (!entry.endsWith('_timeline.json')) continue;
			const path = join(OUTPUT_DIR, entry);
			try {
				const data = JSON.parse(readFileSync(path, 'utf-8'));
				if (data.testTitle !== testTitle) continue;
				if ((data.variant || undefined) !== runVariant) continue;
				candidates.push({ path, mtimeMs: statSync(path).mtimeMs });
			} catch {
				// ignore malformed
			}
		}
		if (candidates.length === 0) return null;
		candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
		return candidates[0].path;
	}
}

export default TutorialMergeReporter;
