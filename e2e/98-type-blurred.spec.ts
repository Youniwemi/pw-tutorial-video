import { test } from '@playwright/test';
import { Tutorial } from '../src/index.js';

/**
 * Visual experiment for typeBlurred: the value is typed while the field is
 * blurred, so a real password/secret never becomes readable in the video.
 * Run with: TUTORIAL_MODE=true TUTORIAL_VOICE=false npx playwright test e2e/98-type-blurred.spec.ts
 */
const ORIGIN = 'http://demo.test';

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Sign in</title>
<style>
	body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 64px; }
	h1 { font-size: 28px; margin: 0 0 24px; }
	label { display: block; margin-bottom: 16px; }
	input { font: inherit; padding: 8px 12px; width: 320px; display: block; }
	button { font: inherit; padding: 8px 16px; }
</style></head>
<body>
	<h1>Sign in</h1>
	<label>Email <input id="email" type="text"></label>
	<label>Password <input id="password" type="text"></label>
	<button id="submit">Sign in</button>
</body></html>`;

test.describe('typeBlurred', () => {
	test.skip(process.env.TUTORIAL_MODE !== 'true', 'run with TUTORIAL_MODE=true');
	test.slow();

	test('secret typing stays unreadable', { tag: '@tutorial' }, async ({ page }) => {
		const testTitle = 'secret typing stays unreadable';

		await page.route(`${ORIGIN}/**`, (route) =>
			route.fulfill({ contentType: 'text/html', body: HTML })
		);

		const tutorial = new Tutorial(page, {
			title: 'Typing a secret without leaking it',
			testName: 'type-blurred-demo',
			testTitle,
			testFile: '98-type-blurred.spec.ts',
			projectName: 'chromium',
			lang: 'en',
			audioBaseUrl: ORIGIN,
			backgroundMusic: '',
			scenes: { app: { label: 'Sara — Sign in', baseUrl: ORIGIN } },
			focus: 'app'
		});

		const app = tutorial.scene('app');

		await tutorial.stage();
		await tutorial.goto('app', '/');

		tutorial.step('The email is typed normally — it stays readable', async () => {
			await tutorial.typeSlowly(app.locator('#email'), 'sara@example.com');
		});

		tutorial.step('The password is typed blurred — unreadable on screen', async () => {
			await tutorial.typeBlurred(app.locator('#password'), 'sup3r-s3cret-passw0rd');
		});

		tutorial.step('Submit', async () => {
			await tutorial.click(app.locator('#submit'));
		});

		await tutorial.complete();
	});
});
