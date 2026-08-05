import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Tutorial } from '../src/index.js';
import { ACCOUNTANT_ORIGIN, CLIENT_ORIGIN, serveFakeApps } from './fake-app.js';

/**
 * The only test that walks the real recording path: TUTORIAL_MODE=true,
 * voice on, video on. Passing DOM assertions prove nothing about the video —
 * this test checks the timeline, and global-teardown.ts checks the file.
 *
 * Skipped in the normal run so the suite stays fast and offline-ish.
 */
const OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || 'tutorials/output';

test.describe('video output', () => {
	test.skip(process.env.TUTORIAL_MODE !== 'true', 'run with TUTORIAL_MODE=true');
	test.slow();

	// The @tutorial tag is what makes the reporter run ffmpeg for this test.
	test('a two-scene tutorial produces a coherent timeline', { tag: '@tutorial' }, async ({ page }) => {
		const testTitle = 'a two-scene tutorial produces a coherent timeline';

		await serveFakeApps(page);

		const tutorial = new Tutorial(page, {
			title: 'Two profiles, one video',
			testTitle,
			testFile: '99-video.spec.ts',
			projectName: 'chromium',
			lang: 'en',
			audioBaseUrl: ACCOUNTANT_ORIGIN,
			backgroundMusic: '',
			scenes: {
				accountant: { label: 'Sara — Accountant', baseUrl: ACCOUNTANT_ORIGIN },
				client: { label: 'ACME — Client', baseUrl: CLIENT_ORIGIN }
			},
			focus: 'accountant'
		});

		const accountant = tutorial.scene('accountant');
		const client = tutorial.scene('client');

		await tutorial.stage();
		await tutorial.goto('accountant', '/');
		await tutorial.goto('client', '/');

		tutorial.context('Two people, two sessions, one screen.');

		tutorial.step(
			'Sara signs in to the accounting app',
			async () => {
				await tutorial.typeSlowly(accountant.locator('#name'), 'Sara');
				await tutorial.click(accountant.locator('#save'));
			},
			{ scene: 'accountant' }
		);

		tutorial.step(
			'ACME signs in to the client portal',
			async () => {
				await tutorial.typeSlowly(client.locator('#name'), 'ACME');
				await tutorial.click(client.locator('#save'));
			},
			{ scene: 'client' }
		);

		tutorial.step(
			'Both profiles, signed in at once',
			async () => {
				await expect(accountant.locator('#who strong')).toHaveText('Sara');
				await expect(client.locator('#who strong')).toHaveText('ACME');
			},
			{ scene: ['accountant', 'client'] }
		);

		await tutorial.complete();

		// --- the timeline is the contract between the run and ffmpeg ---
		const file = readdirSync(OUTPUT_DIR)
			.filter((f) => f.endsWith('.json'))
			.map((f) => join(OUTPUT_DIR, f))
			.find((p) => JSON.parse(readFileSync(p, 'utf-8')).testTitle === testTitle);
		expect(file, 'no timeline was written for this test').toBeTruthy();

		const timeline = JSON.parse(readFileSync(file!, 'utf-8'));

		expect(timeline.videoPath, 'video path missing — the merge would silently skip').toBeTruthy();
		expect(timeline.steps.length).toBe(5); // context + 3 steps + completion
		expect(timeline.totalDurationMs).toBeGreaterThan(0);

		// Timestamps must be strictly ordered, or clips land on the wrong frames.
		const starts = timeline.steps.map((s: { startMs: number }) => s.startMs);
		expect(starts).toEqual([...starts].sort((a, b) => a - b));

		// Every step carries the scene it played on — this is what lets a reader
		// of the transcript know who was on screen.
		for (const step of timeline.steps) {
			expect(step.scene, `step "${step.title}" has no scene`).toBeTruthy();
		}
		const sideBySide = timeline.steps.find((s: { title: string }) => s.title === 'Both profiles, signed in at once');
		expect(sideBySide.scene).toEqual(['accountant', 'client']);

		// Narration must have produced real audio, not silence.
		for (const step of timeline.steps) {
			expect(step.audioFile, `step "${step.title}" has no audio`).toBeTruthy();
			expect(step.durationMs).toBeGreaterThan(0);
		}
	});
});
