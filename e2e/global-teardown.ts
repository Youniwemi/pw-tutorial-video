import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || 'tutorials/output';
const VIDEO_DIR = 'tutorials/videos';

/**
 * Inspects the merged video after the reporter has run ffmpeg.
 *
 * This exists because the most damaging failure of this package is silent:
 * a wrong `audioBaseUrl` yields a perfectly valid, perfectly mute video, and
 * every assertion in the suite still passes. Only ffprobe catches it.
 */
export default function globalTeardown(): void {
	if (process.env.TUTORIAL_MODE !== 'true') return;

	if (!existsSync(OUTPUT_DIR)) throw new Error(`No timeline directory: ${OUTPUT_DIR}`);

	// Only @tutorial-tagged tests get merged by the reporter; every other test
	// that calls complete() still leaves a timeline behind, so presence of the
	// merged file is what identifies a real recording. Unit tests leave mock
	// timelines with no title at all.
	const merged = readdirSync(OUTPUT_DIR)
		.filter((f) => f.endsWith('.json'))
		.map((f) => JSON.parse(readFileSync(join(OUTPUT_DIR, f), 'utf-8')))
		.filter((t) => t.testTitle && existsSync(join(VIDEO_DIR, `${t.testName}.webm`)));

	if (merged.length === 0) {
		throw new Error('No video was merged — the reporter never ran ffmpeg (missing @tutorial tag?)');
	}

	for (const timeline of merged) {
		const video = join(VIDEO_DIR, `${timeline.testName}.webm`);

		const probe = JSON.parse(
			execFileSync(
				'ffprobe',
				['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video],
				{ encoding: 'utf-8' }
			)
		);

		const kinds = probe.streams.map((s: { codec_type: string }) => s.codec_type);
		if (!kinds.includes('video')) throw new Error(`${video}: no video stream`);
		if (!kinds.includes('audio')) {
			throw new Error(`${video}: no audio stream — narration was lost (check audioBaseUrl)`);
		}

		// A merged video far shorter than the timeline means clips were dropped
		// or scene transitions were never given time to play.
		const seconds = parseFloat(probe.format.duration);
		const expected = timeline.totalDurationMs / 1000;
		if (seconds < expected * 0.5) {
			throw new Error(`${video}: ${seconds.toFixed(1)}s for a ${expected.toFixed(1)}s timeline`);
		}

		console.log(`[video] ${video} — ${seconds.toFixed(1)}s, streams: ${kinds.join(' + ')}`);
	}
}
