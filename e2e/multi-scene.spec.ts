import { test, expect, type Page, type FrameLocator } from '@playwright/test';
import { Tutorial } from '../src/index.js';
import { ACCOUNTANT_ORIGIN, CLIENT_ORIGIN, serveFakeApps } from './fake-app.js';

/**
 * Multi-scene tutorial: two user profiles, one video.
 *
 * The stage is a browser-like tab bar. Every scene is an <iframe> of its own
 * origin, so each keeps its own cookies and localStorage — that is what makes
 * two simultaneous sessions possible. Inactive scenes stay mounted (hidden,
 * not unloaded), so their session survives while another scene is on screen.
 *
 * Focus is a *set* of scenes: one scene is the tab mode, two scenes is the
 * side-by-side exception, for the moment where cause and effect must be seen
 * in the same frame.
 *
 * Everything the tutorial draws — step banners, context cards, cursor — lives
 * in the parent page, above the tab bar. Nothing is injected into a scene.
 *
 * The two scenes are served by `fake-app.ts` on two distinct origins, so these
 * tests assert real interactions and real session isolation, offline.
 */

const SCENES = {
	accountant: { label: 'Sara — Accountant', baseUrl: ACCOUNTANT_ORIGIN },
	client: { label: 'ACME — Client', baseUrl: CLIENT_ORIGIN }
};

async function stage(page: Page, testTitle: string) {
	await serveFakeApps(page);

	const tutorial = new Tutorial(page, {
		title: 'Two profiles, one video',
		testTitle,
		lang: 'en',
		// The stage is served from this origin so narration audio loads freely.
		audioBaseUrl: ACCOUNTANT_ORIGIN,
		enableVoice: false,
		backgroundMusic: '',
		scenes: SCENES,
		focus: 'accountant',
		sceneTransition: { duration: 600 }
	});

	await tutorial.stage();
	await tutorial.goto('accountant', '/');
	await tutorial.goto('client', '/');

	return {
		tutorial,
		// A scene is a plain Playwright FrameLocator — the full locator API.
		accountant: tutorial.scene('accountant'),
		client: tutorial.scene('client'),
		tab: (name: string) => page.locator(`[data-tutorial-tab="${name}"]`),
		pane: (name: string) => page.locator(`[data-tutorial-scene="${name}"]`),
		width: async (name: string) =>
			(await page.locator(`[data-tutorial-scene="${name}"]`).boundingBox())!.width
	};
}

/** Sign a name into a scene's own session. */
async function signIn(tutorial: Tutorial, scene: FrameLocator, name: string) {
	await tutorial.fill(scene.locator('#name'), name);
	await tutorial.click(scene.locator('#save'));
}

const sessionOf = (scene: FrameLocator) => scene.locator('#who strong');

test.describe('multi-scene tutorial', () => {
	test('accountant acts, client reacts', async ({ page }) => {
		const { tutorial, accountant, client } = await stage(page, 'accountant acts, client reacts');

		tutorial.context('Two people, two sessions, one screen.');

		tutorial.step(
			'Sara signs in to the accounting app',
			async () => {
				await signIn(tutorial, accountant, 'Sara');
				await expect(sessionOf(accountant)).toHaveText('Sara');
			},
			{ scene: 'accountant' }
		);

		tutorial.step(
			'ACME signs in to the client portal',
			async () => {
				// Sara's session must not have leaked across the origin boundary.
				await expect(sessionOf(client)).toHaveText('anonymous');
				await signIn(tutorial, client, 'ACME');
				await expect(sessionOf(client)).toHaveText('ACME');
			},
			{ scene: 'client' }
		);

		// The side-by-side exception: both sessions visible in the same frame.
		// This is the shot the whole feature exists for.
		tutorial.step(
			'Both profiles, signed in at once',
			async () => {
				await expect(sessionOf(accountant)).toHaveText('Sara');
				await expect(sessionOf(client)).toHaveText('ACME');
			},
			{ scene: ['accountant', 'client'] }
		);

		// A scene may change origin mid-tutorial — and lands on a fresh session.
		tutorial.step(
			'The client is redirected to the accounting origin',
			async () => {
				await tutorial.goto('client', `${ACCOUNTANT_ORIGIN}/`);
				await expect(client.getByRole('heading')).toHaveText('Books — Accounting');
				await expect(sessionOf(client)).toHaveText('Sara');
			},
			{ scene: 'client' }
		);

		await tutorial.complete();
	});

	/**
	 * The core claim of the feature. Without this, "two profiles at once" is
	 * just a layout trick.
	 */
	test('each scene keeps its own session', async ({ page }) => {
		const { tutorial, accountant, client } = await stage(page, 'each scene keeps its own session');

		// Each scene must be on stage to be driven — see the inertness test below.
		await signIn(tutorial, accountant, 'Sara');
		await tutorial.focus('client');
		await signIn(tutorial, client, 'ACME');
		await tutorial.focus(['accountant', 'client']);

		// Two origins, two storages: neither overwrites the other.
		await expect(sessionOf(accountant)).toHaveText('Sara');
		await expect(sessionOf(client)).toHaveText('ACME');

		// Proven at the storage level, not just on screen.
		const storageOf = (origin: string) =>
			page
				.frames()
				.find((f) => f.url().startsWith(origin))!
				.evaluate(() => localStorage.getItem('user'));

		expect(await storageOf(CLIENT_ORIGIN)).toBe('ACME');
		// The parent page shares ACCOUNTANT_ORIGIN (it is the audioBaseUrl), so
		// the accountant frame is read through the pane it actually renders in.
		expect(await storageOf(ACCOUNTANT_ORIGIN)).toBe('Sara');
	});

	test('a hidden scene keeps its session and its unsaved state', async ({ page }) => {
		const { tutorial, accountant, client } = await stage(
			page,
			'a hidden scene keeps its session'
		);

		await signIn(tutorial, accountant, 'Sara');
		await accountant.locator('#name').fill('unsaved draft');

		// Send the accountant off stage for a while.
		await tutorial.focus('client');
		await signIn(tutorial, client, 'ACME');
		await tutorial.focus('accountant');

		// Hidden, not unloaded: the session survived...
		await expect(sessionOf(accountant)).toHaveText('Sara');
		// ...and so did unsaved in-page state, which a reload would have wiped.
		await expect(accountant.locator('#name')).toHaveValue('unsaved draft');
	});

	test('an off-stage scene cannot be interacted with', async ({ page }) => {
		const { tutorial, client } = await stage(page, 'off-stage scenes are inert');

		// 'client' is not focused, so its pane is display:none.
		await expect(
			client.locator('#save').click({ timeout: 1500 }),
			'clicking a hidden scene must fail, not silently succeed'
		).rejects.toThrow();

		await tutorial.focus('client');
		await client.locator('#save').click({ timeout: 1500 });
	});

	test('every scene keeps a tab, only active scenes hold the stage', async ({ page }) => {
		const { tutorial, tab, pane } = await stage(page, 'every scene keeps a tab');

		// Both tabs stay visible and labelled — that is how the viewer knows
		// who else is in the story and which profile is speaking.
		await expect(page.locator('[data-tutorial-tab]')).toHaveCount(2);
		await expect(page.getByText('Sara — Accountant')).toBeVisible();
		await expect(page.getByText('ACME — Client')).toBeVisible();

		await expect(tab('accountant')).toHaveAttribute('data-active', 'true');
		await expect(tab('client')).toHaveAttribute('data-active', 'false');

		await expect(pane('accountant')).toBeVisible();
		await expect(pane('client')).toBeHidden();

		await tutorial.focus('client');

		await expect(tab('client')).toHaveAttribute('data-active', 'true');
		await expect(pane('client')).toBeVisible();
		await expect(pane('accountant')).toBeHidden();
	});

	test('focusing two scenes puts them side by side', async ({ page }) => {
		const { tutorial, tab, pane, width, accountant, client } = await stage(page, 'side by side');
		const fullWidth = await width('accountant');

		await tutorial.focus(['accountant', 'client']);

		// Both scenes are usable at the same time, not merely painted.
		await expect(tab('accountant')).toHaveAttribute('data-active', 'true');
		await expect(tab('client')).toHaveAttribute('data-active', 'true');
		await signIn(tutorial, accountant, 'Sara');
		await signIn(tutorial, client, 'ACME');
		await expect(sessionOf(accountant)).toHaveText('Sara');
		await expect(sessionOf(client)).toHaveText('ACME');

		// They share the stage evenly, client on the right.
		const [left, right] = [await width('accountant'), await width('client')];
		expect(left).toBeLessThan(fullWidth);
		expect(Math.abs(left - right)).toBeLessThan(4);
		const leftBox = (await pane('accountant').boundingBox())!;
		const rightBox = (await pane('client').boundingBox())!;
		expect(rightBox.x).toBeGreaterThan(leftBox.x);

		// Side by side is an exception, not a state we stay in.
		await tutorial.focus('accountant');
		expect(await width('accountant')).toBeCloseTo(fullWidth, 0);
	});

	// Overlays and cursor are no-ops outside tutorial mode, so the two tests
	// below only have something to assert when the video path is active.
	test('overlays land on the parent page, never inside a scene', async ({ page }) => {
		test.skip(process.env.TUTORIAL_MODE !== 'true', 'overlays exist in tutorial mode only');
		const { tutorial, accountant } = await stage(page, 'overlays land on the parent page');

		tutorial.step(
			'A step draws its banner on the parent page',
			async () => {
				await expect(page.locator('#tutorial-overlay')).toBeVisible();
				await expect(accountant.locator('#tutorial-overlay')).toHaveCount(0);
			},
			{ scene: 'accountant' }
		);

		await tutorial.complete();
	});

	/**
	 * These are the failure modes that make a video unwatchable while every
	 * other assertion still passes. Cheap to catch here, expensive to catch
	 * by watching footage.
	 */
	test('the tutorial layer stays on top and the cursor lands true', async ({ page }) => {
		test.skip(process.env.TUTORIAL_MODE !== 'true', 'overlays exist in tutorial mode only');
		const { tutorial, accountant, pane } = await stage(page, 'layer and cursor integrity');

		tutorial.step(
			'Sara reaches for the sign-in button',
			async () => {
				// 1. The banner must not slip behind an iframe — the classic
				//    stacking-context trap for injected overlays.
				//    The overlay is deliberately pointer-events:none so it never
				//    swallows clicks, which makes it invisible to hit-testing.
				//    So we lift that for the length of one probe, then restore it.
				const topmost = await page.evaluate(() => {
					const el = document.querySelector('#tutorial-overlay') as HTMLElement;
					const saved = el.style.pointerEvents;
					el.style.pointerEvents = 'auto';
					const r = el.getBoundingClientRect();
					const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
					el.style.pointerEvents = saved;
					return hit?.closest('#tutorial-overlay') ? 'overlay' : (hit?.tagName ?? 'none');
				});
				expect(topmost).toBe('overlay');

				// 2. The cursor must sit on the element it points at, inside the
				//    iframe. This is the coordinate-offset bug, as an assertion.
				const button = accountant.locator('#save');
				await tutorial.moveMouseToElement(button);

				const target = (await button.boundingBox())!;
				const cursor = (await page.locator('#tutorial-cursor').boundingBox())!;
				expect(cursor.x).toBeGreaterThan(target.x - 40);
				expect(cursor.x).toBeLessThan(target.x + target.width + 40);
				expect(cursor.y).toBeGreaterThan(target.y - 40);
				expect(cursor.y).toBeLessThan(target.y + target.height + 40);

				// 3. Nothing may spill outside the recorded frame.
				const viewport = page.viewportSize()!;
				const stageBox = (await pane('accountant').boundingBox())!;
				expect(stageBox.x).toBeGreaterThanOrEqual(0);
				expect(stageBox.y).toBeGreaterThanOrEqual(0);
				expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(viewport.width + 1);
				expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(viewport.height + 1);
			},
			{ scene: 'accountant' }
		);

		await tutorial.complete();
	});
});
