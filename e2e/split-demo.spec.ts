import { test, expect } from '@playwright/test';
import { Tutorial } from '../src/index.js';
import { ACCOUNTANT_ORIGIN, CLIENT_ORIGIN, serveFakeApps } from './fake-app.js';

const SCENES = {
	accountant: { label: 'Sara — Comptable', baseUrl: ACCOUNTANT_ORIGIN },
	client: { label: 'ACME — Client', baseUrl: CLIENT_ORIGIN }
};

test('split demo — tabs, ratios, back to tabs', { tag: '@tutorial' }, async ({ page }) => {
	await serveFakeApps(page);

	const tutorial = new Tutorial(page, {
		title: 'Split screen demo',
		testTitle: 'split demo — tabs, ratios, back to tabs',
		lang: 'fr',
		audioBaseUrl: ACCOUNTANT_ORIGIN,
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

	// 1 — Single tab: accountant active
	tutorial.step('Sara ouvre son espace comptable', async () => {
		await tutorial.fill(accountant.locator('#name'), 'Sara');
		await tutorial.click(accountant.locator('#save'));
		await expect(accountant.locator('#who strong')).toHaveText('Sara');
	}, { scene: 'accountant' });

	// 2 — Split 30/70
	tutorial.step('Vue partagée — focus sur le client', async () => {
		await tutorial.focus(['accountant', 'client'], { ratio: [30, 70] });
		await tutorial.fill(client.locator('#name'), 'ACME');
		await tutorial.click(client.locator('#save'));
		await expect(client.locator('#who strong')).toHaveText('ACME');
	});

	// 3 — Split 50/50
	tutorial.step('Les deux écrans côte à côte', async () => {
		await tutorial.focus(['accountant', 'client'], { ratio: [50, 50] });
		await expect(accountant.locator('#who strong')).toHaveText('Sara');
		await expect(client.locator('#who strong')).toHaveText('ACME');
	});

	// 4 — Split 70/30
	tutorial.step('Focus sur la comptable', async () => {
		await tutorial.focus(['accountant', 'client'], { ratio: [70, 30] });
		await expect(accountant.locator('#who strong')).toHaveText('Sara');
	});

	// 5 — Back to single tab: client active
	tutorial.step('Le client reprend la main', async () => {
		await tutorial.focus('client');
		await expect(client.locator('#who strong')).toHaveText('ACME');
	});

	await tutorial.complete();
});
