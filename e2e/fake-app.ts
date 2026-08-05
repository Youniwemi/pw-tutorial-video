import type { Page } from '@playwright/test';

export const ACCOUNTANT_ORIGIN = 'http://accountant.test';
export const CLIENT_ORIGIN = 'http://client.test';

/**
 * A tiny app served on two distinct origins, so the tests can assert real
 * interactions and real session isolation instead of poking at example.com.
 *
 * It keeps a "signed in" name in localStorage — the cheapest possible stand-in
 * for a session, and enough to prove the claim that matters: two scenes on
 * different origins do not share storage, and a hidden scene is not reloaded.
 */
const page_html = (product: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${product}</title>
<style>
	body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 48px; }
	h1 { font-size: 28px; margin: 0 0 24px; }
	input, button { font: inherit; padding: 8px 12px; }
	#who { margin-top: 24px; font-size: 20px; }
	strong { color: #0f766e; }
</style></head>
<body>
	<h1>${product}</h1>
	<label>Signed in as <input id="name" placeholder="nobody"></label>
	<button id="save">Sign in</button>
	<p id="who">Session: <strong>anonymous</strong></p>
	<script>
		const who = document.querySelector('#who strong');
		const render = () => { who.textContent = localStorage.getItem('user') || 'anonymous'; };
		document.querySelector('#save').addEventListener('click', () => {
			localStorage.setItem('user', document.querySelector('#name').value);
			render();
		});
		render();
	</script>
</body></html>`;

/** Serve the fake app on both origins for this page and all its frames. */
export async function serveFakeApps(page: Page): Promise<void> {
	await page.route(`${ACCOUNTANT_ORIGIN}/**`, (route) =>
		route.fulfill({ contentType: 'text/html', body: page_html('Books — Accounting') })
	);
	await page.route(`${CLIENT_ORIGIN}/**`, (route) =>
		route.fulfill({ contentType: 'text/html', body: page_html('Portal — Client') })
	);
}
