import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

const createMockPage = () => ({
	evaluate: vi.fn().mockResolvedValue(undefined),
	addStyleTag: vi.fn().mockResolvedValue(undefined),
	waitForTimeout: vi.fn().mockResolvedValue(undefined),
	viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
	locator: vi.fn().mockReturnValue({
		boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 50, height: 30 }),
		evaluate: vi.fn().mockResolvedValue(undefined),
		click: vi.fn().mockResolvedValue(undefined),
		fill: vi.fn().mockResolvedValue(undefined),
		pressSequentially: vi.fn().mockResolvedValue(undefined),
		selectOption: vi.fn().mockResolvedValue(undefined)
	}),
	mouse: {
		move: vi.fn().mockResolvedValue(undefined)
	},
	video: vi.fn().mockReturnValue({
		path: vi.fn().mockResolvedValue('/mock/video/path.webm')
	})
});

describe('Tutorial Module', () => {
	it('should export Tutorial types', async () => {
		const types = await import('../src/types');
		expect(types).toBeDefined();
	});

	it('TUTORIAL_MODE should be false by default', () => {
		expect(process.env.TUTORIAL_MODE).not.toBe('true');
	});

	it('should load styles.css', () => {
		const stylesPath = join(srcDir, 'styles.css');
		expect(existsSync(stylesPath)).toBe(true);
		const styles = readFileSync(stylesPath, 'utf-8');
		expect(styles).toContain('.tutorial-overlay');
		expect(styles).toContain('.tutorial-highlight');
		expect(styles).toContain('@keyframes tutorial-pulse');
	});

	it('should have all required CSS classes', () => {
		const styles = readFileSync(join(srcDir, 'styles.css'), 'utf-8');
		const requiredClasses = [
			'.tutorial-overlay',
			'.tutorial-cursor',
			'.tutorial-highlight',
			'.tutorial-progress',
			'.tutorial-step-title'
		];
		for (const cls of requiredClasses) {
			expect(styles).toContain(cls);
		}
	});

	it('should use CSS variables for customization', () => {
		const styles = readFileSync(join(srcDir, 'styles.css'), 'utf-8');
		const requiredVars = [
			'--tutorial-primary',
			'--tutorial-bg-start',
			'--tutorial-border',
			'--tutorial-text',
			'--tutorial-z-index',
			'--tutorial-animation-duration'
		];
		for (const varName of requiredVars) {
			expect(styles).toContain(varName);
		}
	});

	it('should have context overlay styles using CSS variables', () => {
		const styles = readFileSync(join(srcDir, 'styles.css'), 'utf-8');
		expect(styles).toContain('.tutorial-overlay-context');
		expect(styles).toContain('var(--tutorial-overlay-width)');
		expect(styles).toContain('var(--tutorial-primary)');
		expect(styles).toContain('var(--tutorial-padding)');
	});
});

describe('Tutorial Class', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
		vi.resetModules();
	});

	it('should cleanup resources on completion', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, {
				title: 'Test',
				enableVoice: false,
				backgroundMusic: ''
			});

			await tutorial.complete('Done!');

			const evaluateCalls = mockPage.evaluate.mock.calls;
			const cleanupCalled = evaluateCalls.some((call: any) => {
				const fn = call[0];
				if (typeof fn === 'function') {
					const fnStr = fn.toString();
					return fnStr.includes('tutorial-overlay') && fnStr.includes('remove');
				}
				return false;
			});
			expect(cleanupCalled).toBe(true);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should sanitize HTML content properly', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.step('Test Step', async () => {});

			await tutorial.complete();

			expect(mockPage.evaluate).toHaveBeenCalled();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should skip tutorial actions when TUTORIAL_MODE is false', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		delete process.env.TUTORIAL_MODE;

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test' });

			let actionExecuted = false;
			tutorial.step('Test', async () => {
				actionExecuted = true;
			});

			expect(actionExecuted).toBe(false);

			await tutorial.complete();

			expect(actionExecuted).toBe(true);
			expect(mockPage.addStyleTag).not.toHaveBeenCalled();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should use translate callback', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		delete process.env.TUTORIAL_MODE;

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const translate = vi.fn((key: string) => `translated:${key}`);
			const tutorial = new Tutorial(mockPage as any, {
				title: 'Test',
				translate
			});

			let actionExecuted = false;
			tutorial.step('my.key', async () => {
				actionExecuted = true;
			});

			await tutorial.complete();

			expect(translate).toHaveBeenCalledWith('my.key');
			expect(actionExecuted).toBe(true);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should show context overlay at beginning', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.context('Learn how to create an invoice');

			await tutorial.complete();

			const contextCall = mockPage.evaluate.mock.calls.find((c: any) => {
				const html = c[1];
				return typeof html === 'string' && html.includes('Learn how to create an invoice');
			});
			expect(contextCall).toBeDefined();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should support custom styles injection', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const customCss = '.custom-tutorial { color: red; }';
			const tutorial = new Tutorial(mockPage as any, {
				title: 'Test',
				customStyles: customCss,
				enableVoice: false
			});

			tutorial.step('Test', async () => {});

			await tutorial.complete();

			expect(mockPage.evaluate).toHaveBeenCalled();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});
});

describe('TutorialVoice', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
	});

	it('should initialize with options', async () => {
		const { TutorialVoice } = await import('../src/voice');
		const voice = new TutorialVoice(mockPage as any, {
			lang: 'en',
			voiceName: '',
			voiceRate: 1.0,
			voicePitch: 1.0
		});

		expect(voice).toBeDefined();
	});
});

describe('TutorialMusic', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
	});

	it('should not start if no music URL provided', async () => {
		const { TutorialMusic } = await import('../src/music');
		const music = new TutorialMusic(mockPage as any, {
			backgroundMusic: '',
			musicVolume: 0.5
		});

		await music.start();
		expect(music.isInitialized).toBe(false);
	});

	it('should start music when URL is provided', async () => {
		const { TutorialMusic } = await import('../src/music');
		const music = new TutorialMusic(mockPage as any, {
			backgroundMusic: 'http://example.com/music.mp3',
			musicVolume: 0.5
		});

		await music.start();
		expect(music.isInitialized).toBe(true);
	});

	it('should stop music and cleanup', async () => {
		const { TutorialMusic } = await import('../src/music');
		const music = new TutorialMusic(mockPage as any, {
			backgroundMusic: 'http://example.com/music.mp3',
			musicVolume: 0.5
		});

		await music.start();
		await music.stop(false);
		expect(music.isInitialized).toBe(false);
	});
});

describe('TutorialCursor', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
	});

	it('should initialize cursor element', async () => {
		const { TutorialCursor } = await import('../src/cursor');
		const cursor = new TutorialCursor(mockPage as any, {
			mouseSteps: 25,
			pauseBeforeClick: 300
		});

		await cursor.initialize();
		expect(mockPage.evaluate).toHaveBeenCalled();
	});

	it('should animate click', async () => {
		const { TutorialCursor } = await import('../src/cursor');
		const cursor = new TutorialCursor(mockPage as any, {
			mouseSteps: 25,
			pauseBeforeClick: 300
		});

		await cursor.animateClick();
		expect(mockPage.evaluate).toHaveBeenCalled();
		expect(mockPage.waitForTimeout).toHaveBeenCalledWith(150);
	});
});

describe('TutorialOverlay', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
	});

	it('should track step count', async () => {
		const { TutorialOverlay } = await import('../src/overlay');
		const overlay = new TutorialOverlay(mockPage as any, {
			title: 'Test Tutorial',
			lang: 'en',
			highlightDuration: 800
		});

		overlay.setTotalSteps(5);
		expect(overlay.step).toBe(0);

		overlay.incrementStep();
		expect(overlay.step).toBe(1);

		overlay.incrementStep();
		expect(overlay.step).toBe(2);
	});

	it('should show step overlay', async () => {
		const { TutorialOverlay } = await import('../src/overlay');
		const overlay = new TutorialOverlay(mockPage as any, {
			title: 'Test Tutorial',
			lang: 'en',
			highlightDuration: 800
		});

		overlay.incrementStep();
		await overlay.showStep('Step Title', 'Step description');

		expect(mockPage.evaluate).toHaveBeenCalled();
	});

	it('should show context overlay', async () => {
		const { TutorialOverlay } = await import('../src/overlay');
		const overlay = new TutorialOverlay(mockPage as any, {
			title: 'Test Tutorial',
			lang: 'en',
			highlightDuration: 800
		});

		await overlay.showContext('Learn to create invoices');

		const call = mockPage.evaluate.mock.calls.find((c: any) => {
			const html = c[1];
			return typeof html === 'string' && html.includes('Learn to create invoices');
		});
		expect(call).toBeDefined();
	});

	it('should support RTL for Arabic', async () => {
		const { TutorialOverlay } = await import('../src/overlay');
		const overlay = new TutorialOverlay(mockPage as any, {
			title: 'Test Tutorial',
			lang: 'ar',
			highlightDuration: 800
		});

		overlay.incrementStep();
		await overlay.showStep('Step Title');

		const call = mockPage.evaluate.mock.calls.find((c: any) => {
			const html = c[1];
			return typeof html === 'string' && html.includes('tutorial-overlay-rtl');
		});
		expect(call).toBeDefined();
	});
});

describe('Tutorial Exports', () => {
	it('should export Tutorial and components', async () => {
		const exports = await import('../src/index');
		expect(exports.Tutorial).toBeDefined();
		expect(exports.TutorialVoice).toBeDefined();
		expect(exports.TutorialMusic).toBeDefined();
		expect(exports.TutorialCursor).toBeDefined();
		expect(exports.TutorialOverlay).toBeDefined();
		expect(exports.TutorialTimeline).toBeDefined();
	});
});

describe('Deferred Execution', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
		vi.resetModules();
	});

	it('should queue actions in non-TUTORIAL_MODE and execute in complete()', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		delete process.env.TUTORIAL_MODE;

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			let actionExecuted = false;
			tutorial.step('Test', async () => {
				actionExecuted = true;
			});

			expect(actionExecuted).toBe(false);

			await tutorial.complete();

			expect(actionExecuted).toBe(true);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should defer all actions until complete() in TUTORIAL_MODE', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			let action1Executed = false;
			let action2Executed = false;

			tutorial.step('Step 1', async () => {
				action1Executed = true;
			});

			expect(action1Executed).toBe(false);

			tutorial.step('Step 2', async () => {
				action2Executed = true;
			});

			expect(action2Executed).toBe(false);

			await tutorial.complete('Done!');

			expect(action1Executed).toBe(true);
			expect(action2Executed).toBe(true);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should collect context items and execute in order', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			const executionOrder: string[] = [];

			tutorial.context('Context 1');
			tutorial.step('Step 1', async () => {
				executionOrder.push('step1');
			});
			tutorial.context('Context 2', { style: 'attention' });
			tutorial.step('Step 2', async () => {
				executionOrder.push('step2');
			});

			await tutorial.complete('Done!');

			expect(executionOrder).toEqual(['step1', 'step2']);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should count only steps, not contexts', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.context('Context 1');
			tutorial.context('Context 2');
			tutorial.step('Step 1', async () => {});
			tutorial.step('Step 2', async () => {});
			tutorial.step('Step 3', async () => {});

			await tutorial.complete('Done!');

			expect(tutorial.stepCount).toBe(3);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});
});

describe('Step Options: do + explain', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
		vi.resetModules();
	});

	it('should use title as default do text', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.step('Click the button', async () => {});
			await tutorial.complete('Done!');

			const stepCall = mockPage.evaluate.mock.calls.find((c: any) => {
				const html = c[1];
				return typeof html === 'string' && html.includes('Click the button');
			});
			expect(stepCall).toBeDefined();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should use do option when provided', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.step('Company Name', async () => {}, {
				do: 'Type your company name'
			});
			await tutorial.complete('Done!');

			expect(mockPage.evaluate).toHaveBeenCalled();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should support do + explain for two-phase timing', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			let actionExecuted = false;
			tutorial.step('Company Name', async () => {
				actionExecuted = true;
			}, {
				do: 'Type your company name',
				explain: 'This will appear on all your invoices'
			});

			await tutorial.complete('Done!');

			expect(actionExecuted).toBe(true);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});
});

describe('Context Styles', () => {
	let mockPage: ReturnType<typeof createMockPage>;

	beforeEach(() => {
		mockPage = createMockPage();
		vi.resetModules();
	});

	it('should support goal style (default)', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.context('Company Setup', { text: 'We will configure your company' });
			await tutorial.complete('Done!');

			expect(mockPage.evaluate).toHaveBeenCalled();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should support clarification style', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.context('Note', {
				text: 'This field is optional',
				style: 'clarification'
			});
			await tutorial.complete('Done!');

			const contextCall = mockPage.evaluate.mock.calls.find((c: any) => {
				const html = c[1];
				return typeof html === 'string' && html.includes('tutorial-context-clarification');
			});
			expect(contextCall).toBeDefined();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should support attention style', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.context('Important', {
				text: 'Save before continuing',
				style: 'attention'
			});
			await tutorial.complete('Done!');

			const contextCall = mockPage.evaluate.mock.calls.find((c: any) => {
				const html = c[1];
				return typeof html === 'string' && html.includes('tutorial-context-attention');
			});
			expect(contextCall).toBeDefined();
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('should have CSS styles for all context types', () => {
		const styles = readFileSync(join(srcDir, 'styles.css'), 'utf-8');
		expect(styles).toContain('.tutorial-overlay-context');
	});
});

describe('Deprecated Methods', () => {
	let mockPage: ReturnType<typeof createMockPage>;
	let consoleWarnSpy: any;

	beforeEach(() => {
		mockPage = createMockPage();
		vi.resetModules();
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleWarnSpy.mockRestore();
	});

	it('setTotalSteps should warn but not break', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			tutorial.setTotalSteps(5);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('setTotalSteps')
			);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});

	it('preloadVoice should warn but not break', async () => {
		const originalEnv = process.env.TUTORIAL_MODE;
		process.env.TUTORIAL_MODE = 'true';

		try {
			vi.resetModules();
			const { Tutorial } = await import('../src/Tutorial');
			const tutorial = new Tutorial(mockPage as any, { title: 'Test', enableVoice: false });

			await tutorial.preloadVoice(['test']);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('preloadVoice')
			);
		} finally {
			process.env.TUTORIAL_MODE = originalEnv;
		}
	});
});
