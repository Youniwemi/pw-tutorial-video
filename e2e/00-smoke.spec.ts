import { test, expect } from '@playwright/test';

/**
 * Infrastructure smoke test — no tutorial API involved.
 *
 * If this fails, the problem is the harness (browser, network, config),
 * not the multi-scene API under development.
 */
test.describe('e2e infrastructure', () => {
	test('the browser loads a page', async ({ page }) => {
		await page.goto('http://example.com/');
		await expect(page.getByRole('heading', { name: 'Example Domain' })).toBeVisible();
	});

	test('two distinct origins can be framed side by side', async ({ page }) => {
		await page.goto('http://example.com/');
		await page.setContent(`
			<div style="display:flex;height:100vh;margin:0">
				<iframe data-probe="left"  src="http://example.com/" style="flex:1;border:0"></iframe>
				<iframe data-probe="right" src="http://example.org/" style="flex:1;border:0"></iframe>
			</div>
		`);

		// Both frames must actually render — this is what Google and Bing forbid
		// via X-Frame-Options: SAMEORIGIN.
		await expect(
			page.frameLocator('[data-probe="left"]').getByRole('heading', { name: 'Example Domain' })
		).toBeVisible();
		await expect(
			page.frameLocator('[data-probe="right"]').getByRole('heading', { name: 'Example Domain' })
		).toBeVisible();
	});
});
