import { test, expect } from '@playwright/test';
import { Tutorial, mobileStage } from '../src/index.js';
import { ACCOUNTANT_ORIGIN, CLIENT_ORIGIN, serveFakeApps } from './fake-app.js';

// Two phones side by side. Run with:
//   TUTORIAL_VARIANT=mobile [TUTORIAL_MODE=true TUTORIAL_VOICE=false] npx playwright test e2e/mobile-split
// Without TUTORIAL_VARIANT the stage behaves exactly like the desktop multi-scene one.
test.use(mobileStage(2));

const SCENES = {
	accountant: { label: 'Sara — Comptable', baseUrl: ACCOUNTANT_ORIGIN },
	client: { label: 'ACME — Client', baseUrl: CLIENT_ORIGIN }
};

const isMobileVariant = process.env.TUTORIAL_VARIANT === 'mobile';

test('mobile split — two phones always visible', { tag: '@tutorial' }, async ({ page }) => {
	await serveFakeApps(page);

	const tutorial = new Tutorial(page, {
		title: 'Mobile split demo',
		testName: 'mobile-split-demo',
		testTitle: 'mobile split — two phones always visible',
		lang: 'fr',
		audioBaseUrl: ACCOUNTANT_ORIGIN,
		enableVoice: false,
		backgroundMusic: '',
		scenes: SCENES,
		focus: 'accountant',
		sceneTransition: { duration: 400 }
	});

	await tutorial.stage();
	await tutorial.goto('accountant', '/');
	await tutorial.goto('client', '/');

	const accountant = tutorial.scene('accountant');
	const client = tutorial.scene('client');

	tutorial.step('Sara ouvre son espace comptable', async () => {
		await tutorial.fill(accountant.locator('#name'), 'Sara');
		await tutorial.click(accountant.locator('#save'));
		await expect(accountant.locator('#who strong')).toHaveText('Sara');
	}, { scene: 'accountant' });

	tutorial.step('Le client répond sur son téléphone', async () => {
		await tutorial.fill(client.locator('#name'), 'ACME');
		await tutorial.click(client.locator('#save'));
		await expect(client.locator('#who strong')).toHaveText('ACME');
	}, { scene: 'client' });

	// Ratios are ignored in pinned split — both phones keep their width.
	tutorial.step('Retour chez la comptable', async () => {
		await tutorial.focus(['accountant', 'client'], { ratio: [70, 30] });
		await expect(accountant.locator('#who strong')).toHaveText('Sara');
	});

	await tutorial.complete();

	if (isMobileVariant) {
		// Pinned split: the tab bar never shows, every scene stays visible with its label.
		await expect(page.locator('.tutorial-stage')).toHaveAttribute('data-layout', 'split');
		await expect(page.locator('.tutorial-stage')).toHaveAttribute('data-split', 'true');
		await expect(page.locator('.tutorial-tabbar')).toBeHidden();
		await expect(page.locator('.tutorial-scene[data-tutorial-scene="accountant"]')).toBeVisible();
		await expect(page.locator('.tutorial-scene[data-tutorial-scene="client"]')).toBeVisible();
		await expect(page.locator('[data-tutorial-scene-label="accountant"]')).toBeVisible();
		// Ratios ignored: no inline flex was set on the panes.
		const flex = await page
			.locator('.tutorial-scene[data-tutorial-scene="accountant"]')
			.evaluate((el) => (el as HTMLElement).style.flex);
		expect(flex).toBe('');
		// Compact overlay scope set by the variant.
		await expect(page.locator('html')).toHaveAttribute('data-tutorial-variant', 'mobile');
	} else {
		await expect(page.locator('.tutorial-stage')).not.toHaveAttribute('data-layout', 'split');
	}
});
