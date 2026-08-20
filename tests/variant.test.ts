import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync, rmSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

const createMockPage = () => ({
	evaluate: vi.fn().mockResolvedValue(undefined),
	goto: vi.fn().mockResolvedValue(undefined),
	setContent: vi.fn().mockResolvedValue(undefined),
	addStyleTag: vi.fn().mockResolvedValue(undefined),
	waitForTimeout: vi.fn().mockResolvedValue(undefined),
	viewportSize: vi.fn().mockReturnValue({ width: 780, height: 844 }),
	frameLocator: vi.fn().mockReturnValue({
		locator: vi.fn().mockReturnValue({ waitFor: vi.fn().mockResolvedValue(undefined) })
	}),
	mouse: { move: vi.fn().mockResolvedValue(undefined) },
	video: vi.fn().mockReturnValue({ path: vi.fn().mockResolvedValue('/mock/video/path.webm') })
});

const TWO_SCENES = {
	one: { label: 'One', baseUrl: 'http://localhost:1001' },
	two: { label: 'Two', baseUrl: 'http://localhost:1002' }
};

describe('Variant option', () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.TUTORIAL_VARIANT;
	});

	afterEach(() => {
		delete process.env.TUTORIAL_VARIANT;
	});

	it('suffixes testName with the variant option', async () => {
		const { Tutorial } = await import('../src/Tutorial');
		const tutorial = new Tutorial(createMockPage() as any, {
			title: 'T',
			testName: 'my-tutorial',
			variant: 'mobile'
		});
		expect((tutorial as any).testName).toBe('my-tutorial-mobile');
	});

	it('reads the variant from TUTORIAL_VARIANT', async () => {
		process.env.TUTORIAL_VARIANT = 'mobile';
		const { Tutorial } = await import('../src/Tutorial');
		const tutorial = new Tutorial(createMockPage() as any, {
			title: 'T',
			testName: 'my-tutorial'
		});
		expect((tutorial as any).testName).toBe('my-tutorial-mobile');
	});

	it('explicit variant option wins over the env', async () => {
		process.env.TUTORIAL_VARIANT = 'mobile';
		const { Tutorial } = await import('../src/Tutorial');
		const tutorial = new Tutorial(createMockPage() as any, {
			title: 'T',
			testName: 'my-tutorial',
			variant: 'tablet'
		});
		expect((tutorial as any).testName).toBe('my-tutorial-tablet');
	});

	it('leaves testName untouched without a variant', async () => {
		const { Tutorial } = await import('../src/Tutorial');
		const tutorial = new Tutorial(createMockPage() as any, {
			title: 'T',
			testName: 'my-tutorial'
		});
		expect((tutorial as any).testName).toBe('my-tutorial');
	});

	it('records the variant in the timeline JSON', async () => {
		const { TutorialTimeline } = await import('../src/timeline');
		const timeline = new TutorialTimeline('t-mobile', '', '', 'fr', 'title', '', {}, 'T', 'mobile');
		timeline.start();
		expect(timeline.getData().variant).toBe('mobile');
	});

	it('omits the variant field from the timeline when unset', async () => {
		const { TutorialTimeline } = await import('../src/timeline');
		const timeline = new TutorialTimeline('t');
		timeline.start();
		expect(timeline.getData().variant).toBeUndefined();
	});
});

describe('Mobile pinned split', () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.TUTORIAL_VARIANT;
	});

	it('mobile variant with 2+ scenes pins the split', async () => {
		const { Tutorial } = await import('../src/Tutorial');
		const tutorial = new Tutorial(createMockPage() as any, {
			title: 'T',
			testName: 't',
			variant: 'mobile',
			scenes: TWO_SCENES
		});
		expect((tutorial as any).pinnedSplit).toBe(true);
	});

	it('no pinned split for a single scene or without the mobile variant', async () => {
		const { Tutorial } = await import('../src/Tutorial');
		const single = new Tutorial(createMockPage() as any, {
			title: 'T',
			testName: 't',
			variant: 'mobile',
			scenes: { one: TWO_SCENES.one }
		});
		expect((single as any).pinnedSplit).toBe(false);

		const desktop = new Tutorial(createMockPage() as any, {
			title: 'T',
			testName: 't',
			scenes: TWO_SCENES
		});
		expect((desktop as any).pinnedSplit).toBe(false);
	});

	it('focus() keeps data-split and ignores ratios when pinned', async () => {
		const { Tutorial } = await import('../src/Tutorial');
		const page = createMockPage();
		const tutorial = new Tutorial(page as any, {
			title: 'T',
			testName: 't',
			variant: 'mobile',
			scenes: TWO_SCENES
		});

		await tutorial.focus('one', { ratio: [30, 70] });

		const focusCall = page.evaluate.mock.calls.find((c: any) => c[1]?.active);
		expect(focusCall).toBeDefined();
		expect(focusCall![1].pinned).toBe(true);
	});

	it('focus() stays unpinned without the mobile variant', async () => {
		const { Tutorial } = await import('../src/Tutorial');
		const page = createMockPage();
		const tutorial = new Tutorial(page as any, {
			title: 'T',
			testName: 't',
			scenes: TWO_SCENES
		});

		await tutorial.focus(['one', 'two'], { ratio: [30, 70] });

		const focusCall = page.evaluate.mock.calls.find((c: any) => c[1]?.active);
		expect(focusCall![1].pinned).toBe(false);
		expect(focusCall![1].ratios).toEqual([30, 70]);
	});
});

describe('renderStage layout', () => {
	it('pinned split renders data-layout="split" and data-split="true"', async () => {
		const { renderStage } = await import('../src/overlay-html');
		const html = renderStage(TWO_SCENES, ['one'], true);
		expect(html).toContain(`data-layout="split"`);
		expect(html).toContain(`data-split="true"`);
	});

	it('default markup is unchanged (no data-layout)', async () => {
		const { renderStage } = await import('../src/overlay-html');
		const html = renderStage(TWO_SCENES, ['one']);
		expect(html).not.toContain('data-layout');
		expect(html).toContain(`data-split="false"`);
	});
});

describe('Variant CSS', () => {
	const styles = readFileSync(join(srcDir, 'styles.css'), 'utf-8');

	it('exposes the overlay surface as variables', () => {
		expect(styles).toContain('--tutorial-overlay-bg');
		expect(styles).toContain('--tutorial-overlay-blur');
		expect(styles).toContain('--tutorial-overlay-shadow');
		expect(styles).toContain('background: var(--tutorial-overlay-bg)');
	});

	it('defines mobile values in :root and remaps them under the variant scope', () => {
		expect(styles).toContain('--tutorial-overlay-width-mobile');
		expect(styles).toContain("html[data-tutorial-variant='mobile']");
		expect(styles).toContain('--tutorial-overlay-width: var(--tutorial-overlay-width-mobile)');
		expect(styles).toContain('--tutorial-icon-display-mobile');
	});

	it('has pinned split rules', () => {
		expect(styles).toContain(".tutorial-stage[data-layout='split'] .tutorial-tabbar");
		expect(styles).toContain(".tutorial-stage[data-layout='split'] .tutorial-scene-label");
		expect(styles).toContain('--tutorial-scene-inactive-opacity');
	});
});

describe('Reporter variant matching', () => {
	let outDir: string;

	beforeEach(() => {
		vi.resetModules();
		outDir = mkdtempSync(join(tmpdir(), 'tutorial-reporter-'));
		process.env.TUTORIAL_OUTPUT_DIR = outDir;
		delete process.env.TUTORIAL_VARIANT;
	});

	afterEach(() => {
		rmSync(outDir, { recursive: true, force: true });
		delete process.env.TUTORIAL_OUTPUT_DIR;
		delete process.env.TUTORIAL_VARIANT;
	});

	const writeTimeline = (name: string, data: object, mtime?: Date) => {
		const path = join(outDir, `${name}_timeline.json`);
		writeFileSync(path, JSON.stringify(data));
		if (mtime) utimesSync(path, mtime, mtime);
		return path;
	};

	const findTimeline = async (testTitle: string): Promise<string | null> => {
		const { default: Reporter } = await import('../src/reporter');
		const reporter = new Reporter();
		return (reporter as any).findTimelineByTitle(testTitle);
	};

	it('picks the timeline matching the run variant', async () => {
		writeTimeline('demo', { testTitle: 'my test' });
		const mobilePath = writeTimeline('demo-mobile', { testTitle: 'my test', variant: 'mobile' });

		process.env.TUTORIAL_VARIANT = 'mobile';
		expect(await findTimeline('my test')).toBe(mobilePath);
	});

	it('a run without variant skips variant timelines', async () => {
		const desktopPath = writeTimeline('demo', { testTitle: 'my test' });
		writeTimeline('demo-mobile', { testTitle: 'my test', variant: 'mobile' });

		expect(await findTimeline('my test')).toBe(desktopPath);
	});

	it('breaks ties by most recent mtime', async () => {
		writeTimeline('old', { testTitle: 'my test' }, new Date('2024-01-01'));
		const fresh = writeTimeline('fresh', { testTitle: 'my test' }, new Date('2025-01-01'));

		expect(await findTimeline('my test')).toBe(fresh);
	});

	it('returns null when nothing matches', async () => {
		writeTimeline('demo', { testTitle: 'other test' });
		expect(await findTimeline('my test')).toBeNull();
	});
});

describe('mobileStage helper', () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.TUTORIAL_VARIANT;
		delete process.env.TUTORIAL_MODE;
	});

	afterEach(() => {
		delete process.env.TUTORIAL_VARIANT;
		delete process.env.TUTORIAL_MODE;
	});

	it('is inert without TUTORIAL_VARIANT=mobile', async () => {
		const { mobileStage } = await import('../src/stage-presets');
		expect(mobileStage(2)).toEqual({});
	});

	it('widens the device viewport by the scene count', async () => {
		process.env.TUTORIAL_VARIANT = 'mobile';
		const { mobileStage } = await import('../src/stage-presets');
		const { devices } = await import('@playwright/test');
		const base = devices['Pixel 7'].viewport!;

		const use = mobileStage(2);
		expect(use.viewport).toEqual({ width: base.width * 2, height: base.height });
		expect(use.video).toBeUndefined();
	});

	it('freezes the video size in tutorial mode and accepts an explicit viewport', async () => {
		process.env.TUTORIAL_VARIANT = 'mobile';
		process.env.TUTORIAL_MODE = 'true';
		const { mobileStage } = await import('../src/stage-presets');

		const use = mobileStage(3, { width: 390, height: 844 });
		expect(use.viewport).toEqual({ width: 1170, height: 844 });
		expect(use.video).toEqual({ mode: 'on', size: { width: 1170, height: 844 } });
	});

	it('throws on an unknown device name', async () => {
		process.env.TUTORIAL_VARIANT = 'mobile';
		const { mobileStage } = await import('../src/stage-presets');
		expect(() => mobileStage(1, 'Nokia 3310')).toThrow(/Unknown Playwright device/);
	});
});
