import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	globalTeardown: './e2e/global-teardown.ts',
	timeout: 120_000,
	fullyParallel: false,
	workers: 1,
	// The reporter is what actually runs ffmpeg, in onTestEnd.
	reporter:
		process.env.TUTORIAL_MODE === 'true'
			? [['list'], ['./src/reporter.ts']]
			: [['list']],
	use: {
		viewport: { width: 1280, height: 720 },
		video: process.env.TUTORIAL_MODE === 'true' ? 'on' : 'off'
	},
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
