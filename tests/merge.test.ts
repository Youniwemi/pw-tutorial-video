import { describe, it, expect } from 'vitest';
import { buildMergeCommand } from '../src/merge';

const mockTimeline = {
	totalDurationMs: 66849,
	steps: [
		{ audioFile: 'abc123.wav', startMs: 7988 },
		{ audioFile: 'def456.wav', startMs: 13492 }
	]
};

describe('buildMergeCommand', () => {
	it('should build correct ffmpeg command structure', () => {
		const result = buildMergeCommand(
			mockTimeline,
			'/path/to/video.webm',
			'/path/to/output.webm',
			{ musicFile: '', checkFileExists: () => false }
		);

		expect(result.command).toContain('ffmpeg -y');
		expect(result.command).toContain('-i "/path/to/video.webm"');
		expect(result.command).toContain('-c:v copy');
		expect(result.command).toContain('-c:a libopus');
		expect(result.command).toContain('-t 66.849');
	});

	it('should include adelay for each voice clip', () => {
		const result = buildMergeCommand(
			mockTimeline,
			'/path/to/video.webm',
			'/path/to/output.webm',
			{ musicFile: '', checkFileExists: () => true }
		);

		expect(result.filter).toContain('adelay=7988|7988');
		expect(result.filter).toContain('adelay=13492|13492');
	});

	it('should use correct video duration from timeline', () => {
		const result = buildMergeCommand(
			{ ...mockTimeline, totalDurationMs: 120000 },
			'/path/to/video.webm',
			'/path/to/output.webm',
			{ musicFile: '', checkFileExists: () => false }
		);

		expect(result.command).toContain('-t 120.000');
	});

	it('should handle empty steps gracefully', () => {
		const result = buildMergeCommand(
			{ totalDurationMs: 10000, steps: [] },
			'/path/to/video.webm',
			'/path/to/output.webm',
			{ musicFile: '', checkFileExists: () => false }
		);

		expect(result.command).toContain('ffmpeg');
		expect(result.filter).toContain('anullsrc');
	});

	it('should add background music when file exists', () => {
		const result = buildMergeCommand(
			mockTimeline,
			'/path/to/video.webm',
			'/path/to/output.webm',
			{ musicFile: '/path/to/music.mp3', musicVolume: 0.2, checkFileExists: () => true }
		);

		expect(result.command).toContain('-stream_loop -1 -i "/path/to/music.mp3"');
		expect(result.filter).toContain('volume=0.2');
	});

	it('should use amix when multiple audio streams', () => {
		const result = buildMergeCommand(
			mockTimeline,
			'/path/to/video.webm',
			'/path/to/output.webm',
			{ musicFile: '/path/to/music.mp3', checkFileExists: () => true }
		);

		// Music + 2 voices = 3 streams
		expect(result.filter).toContain('amix=inputs=3');
		expect(result.filter).toContain('[aout]');
	});

	it('should use anull for single audio stream', () => {
		const result = buildMergeCommand(
			{ totalDurationMs: 10000, steps: [{ audioFile: 'only.wav', startMs: 1000 }] },
			'/path/to/video.webm',
			'/path/to/output.webm',
			{ musicFile: '', checkFileExists: () => true }
		);

		expect(result.filter).toContain('anull[aout]');
		expect(result.filter).not.toContain('amix');
	});

	it('should include output path in command', () => {
		const result = buildMergeCommand(
			mockTimeline,
			'/path/to/video.webm',
			'/output/final.webm',
			{ musicFile: '', checkFileExists: () => false }
		);

		expect(result.command).toContain('"/output/final.webm"');
	});

	it('should skip missing audio files', () => {
		const result = buildMergeCommand(
			mockTimeline,
			'/path/to/video.webm',
			'/path/to/output.webm',
			{
				musicFile: '',
				checkFileExists: (path) => path.includes('abc123') // only first file exists
			}
		);

		expect(result.filter).toContain('adelay=7988');
		expect(result.filter).not.toContain('adelay=13492');
	});
});
