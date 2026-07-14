import type { Page, Locator } from '@playwright/test';
import { readFileSync, unlinkSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { TutorialOptions, StepOptions, ContextOptions, ContextStyle } from './types.js';
import { TutorialVoice } from './voice.js';
import { TutorialMusic } from './music.js';
import { TutorialCursor } from './cursor.js';
import { TutorialOverlay } from './overlay.js';
import { TutorialTimeline } from './timeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TUTORIAL_MODE = process.env.TUTORIAL_MODE === 'true';
const TUTORIAL_VOICE = process.env.TUTORIAL_VOICE !== 'false';
const TUTORIAL_VOICE_NAME = process.env.TUTORIAL_VOICE_NAME;
const TUTORIAL_OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || 'tutorials/output';

const DEFAULT_AUDIO_BASE_URL = 'http://localhost:5173';
const DEFAULT_MUSIC_URL_PATH = '/audio/tutorial-background.mp3';
const TUTORIAL_MUSIC = process.env.TUTORIAL_MUSIC;
const TUTORIAL_MUSIC_VOLUME = parseFloat(process.env.TUTORIAL_MUSIC_VOLUME || '0.15');
const TUTORIAL_VOICE_VOLUME = parseFloat(process.env.TUTORIAL_VOICE_VOLUME || '2.5');

const DEFAULT_STYLES = readFileSync(join(__dirname, 'styles.css'), 'utf-8');

let _sharp: typeof import('sharp') | null = null;
async function getSharp(): Promise<typeof import('sharp') | null> {
	if (_sharp !== null) return _sharp;
	try {
		_sharp = (await import('sharp')).default;
		return _sharp;
	} catch {
		return null;
	}
}

interface PendingContext {
	type: 'context';
	title: string;
	text?: string;
	style: ContextStyle;
	voiceText: string;
	voicePreload: Promise<void>;
	key?: string;
}

interface PendingStep {
	type: 'step';
	title: string;
	action: () => Promise<void>;
	overlayText: string;
	overlayDescription?: string;
	voiceText: string;
	skipVoice?: boolean;
	delay?: number;
	voicePreload: Promise<void>;
	key?: string;
}

type PendingItem = PendingContext | PendingStep;

export class Tutorial {
	private page: Page;
	private options: Required<Omit<TutorialOptions, 'testTitle' | 'feature' | 'translate'>> & { testTitle?: string; feature?: string };
	private initialized = false;
	private testName: string;
	private translateFn: (key: string) => string;

	private voice: TutorialVoice;
	private music: TutorialMusic;
	private cursor: TutorialCursor;
	private overlay: TutorialOverlay;
	private timeline: TutorialTimeline;

	private pendingItems: PendingItem[] = [];
	private stepCounter = 0;
	private videoStartTime = 0;

	constructor(page: Page, options: TutorialOptions) {
		this.page = page;
		this.testName = options.testName ?? `tutorial_${Date.now()}`;
		this.translateFn = options.translate ?? ((k: string) => k);

		const audioBaseUrl = options.audioBaseUrl ?? DEFAULT_AUDIO_BASE_URL;
		const defaultMusicUrl = TUTORIAL_MUSIC ?? '';

		this.options = {
			title: options.title,
			testFile: options.testFile ?? '',
			projectName: options.projectName ?? '',
			testName: this.testName,
			testTitle: options.testTitle,
			feature: options.feature,
			lang: options.lang ?? 'en',
			audioBaseUrl,
			stepDelay: options.stepDelay ?? 500,
			highlightDuration: options.highlightDuration ?? 800,
			mouseSteps: options.mouseSteps ?? 25,
			pauseBeforeClick: options.pauseBeforeClick ?? 300,
			enableVoice: options.enableVoice ?? TUTORIAL_VOICE,
			voiceName: options.voiceName ?? TUTORIAL_VOICE_NAME ?? '',
			voiceRate: options.voiceRate ?? 1.0,
			voicePitch: options.voicePitch ?? 1,
			backgroundMusic: options.backgroundMusic ?? defaultMusicUrl,
			musicVolume: options.musicVolume ?? TUTORIAL_MUSIC_VOLUME,
			voiceVolume: options.voiceVolume ?? TUTORIAL_VOICE_VOLUME,
			customStyles: options.customStyles ?? '',
			playAudioInBrowser: options.playAudioInBrowser ?? true
		};

		this.voice = new TutorialVoice(page, {
			lang: this.options.lang,
			voiceName: this.options.voiceName,
			voiceRate: this.options.voiceRate,
			voicePitch: this.options.voicePitch,
			playInBrowser: this.options.playAudioInBrowser,
			audioBaseUrl
		});

		this.music = new TutorialMusic(page, {
			backgroundMusic: this.options.backgroundMusic,
			musicVolume: this.options.musicVolume
		});

		this.cursor = new TutorialCursor(page, {
			mouseSteps: this.options.mouseSteps,
			pauseBeforeClick: this.options.pauseBeforeClick
		});

		this.overlay = new TutorialOverlay(page, {
			title: this.options.title,
			lang: this.options.lang,
			highlightDuration: this.options.highlightDuration
		});

		this.timeline = new TutorialTimeline(
			this.testName,
			this.options.testFile,
			this.options.projectName,
			this.options.lang,
			options.testTitle ?? '',
			options.feature ?? '',
			{
				musicFile: this.options.backgroundMusic?.startsWith('http')
					? 'static/audio/tutorial-background.mp3'
					: this.options.backgroundMusic,
				musicVolume: this.options.musicVolume,
				voiceVolume: this.options.voiceVolume
			}
		);

		this.videoStartTime = Date.now();
	}

	static get isEnabled(): boolean {
		return TUTORIAL_MODE;
	}

	private translate(key: string): string {
		return this.translateFn(key);
	}

	clearFields(): void {
		if (!TUTORIAL_MODE) return;
		const clearOnce = () => {
			this.page.evaluate(() => {
				document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
					'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea'
				).forEach(el => { el.value = ''; });
			}).catch(() => {});
			this.page.off('load', clearOnce);
		};
		this.page.on('load', clearOnce);
	}

	get hasSteps(): boolean {
		return this.stepCounter > 0;
	}

	get stepCount(): number {
		return this.stepCounter;
	}

	switchPage(page: Page): void {
		if (!TUTORIAL_MODE) return;
		this.page = page;
		this.voice.switchPage(page);
		this.music.switchPage(page);
		this.cursor.switchPage(page);
		this.overlay.switchPage(page);
	}

	/** @deprecated Total steps are now calculated automatically. */
	setTotalSteps(total: number): void {
		console.warn('[Tutorial] setTotalSteps is deprecated - total steps are calculated automatically');
		this.overlay.setTotalSteps(total);
	}

	/** @deprecated Voice preloading is now automatic when steps/contexts are added. */
	async preloadVoice(texts: string[]): Promise<void> {
		console.warn('[Tutorial] preloadVoice is deprecated - voice preloading is now automatic');
		if (!TUTORIAL_MODE || !this.options.enableVoice) return;
		await this.voice.preload(texts);
	}

	private async initialize(): Promise<void> {
		if (this.initialized || !TUTORIAL_MODE) return;

		await this.ensureStyles();
		await this.cursor.initialize();

		if (this.options.backgroundMusic && this.options.playAudioInBrowser) {
			await this.music.start();
		}

		this.initialized = true;
	}

	private async ensureStyles(): Promise<void> {
		const styles = this.options.customStyles || DEFAULT_STYLES;

		await this.page.evaluate((css) => {
			if (document.getElementById('tutorial-styles')) return;
			const style = document.createElement('style');
			style.id = 'tutorial-styles';
			style.textContent = css;
			document.head.appendChild(style);
		}, styles);
	}

	context(key: string, options?: ContextOptions): void {
		if (!TUTORIAL_MODE) return;

		const title = this.translate(key);
		const style = options?.style ?? 'goal';
		const text = options?.text;
		const voiceText = options?.voiceText ?? (text ? `${title}. ${text}` : title);

		const voicePreload = this.options.enableVoice
			? this.voice.preloadSingle(voiceText)
			: Promise.resolve();

		this.pendingItems.push({
			type: 'context',
			title,
			text,
			style,
			voiceText,
			voicePreload,
			key
		});
	}

	step(key: string, action: () => Promise<void>, options?: StepOptions): void {
		const title = this.translate(key);

		if (!TUTORIAL_MODE) {
			this.pendingItems.push({
				type: 'step',
				title,
				action,
				overlayText: title,
				voiceText: title,
				voicePreload: Promise.resolve()
			});
			return;
		}

		this.stepCounter++;

		let voiceText: string;
		if (options?.voiceText) {
			voiceText = options.voiceText;
		} else if (options?.do && options?.explain) {
			voiceText = `${options.do}. ${options.explain}`;
		} else if (options?.do) {
			voiceText = options.do;
		} else if (options?.description) {
			voiceText = `${title}. ${options.description}`;
		} else {
			voiceText = title;
		}

		const voicePreload = this.options.enableVoice && !options?.skipVoice
			? this.voice.preloadSingle(voiceText)
			: Promise.resolve();

		this.pendingItems.push({
			type: 'step',
			title,
			action,
			overlayText: options?.do ?? title,
			overlayDescription: options?.explain ?? options?.description,
			voiceText,
			skipVoice: options?.skipVoice,
			delay: options?.delay,
			voicePreload,
			key
		});
	}

	async highlight(selector: string | Locator, duration?: number): Promise<void> {
		if (!TUTORIAL_MODE) return;
		const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;

		await locator.scrollIntoViewIfNeeded();
		await this.cursor.moveToElement(locator);
		await this.overlay.highlight(locator, duration);
	}

	async unhighlight(selector: string | Locator): Promise<void> {
		if (!TUTORIAL_MODE) return;
		await this.overlay.unhighlight(selector);
	}

	async moveMouseToElement(locator: Locator): Promise<void> {
		if (!TUTORIAL_MODE) return;
		await locator.scrollIntoViewIfNeeded();
		await this.cursor.moveToElement(locator);
	}

	async moveMouse(targetX: number, targetY: number): Promise<void> {
		if (!TUTORIAL_MODE) return;
		await this.cursor.moveTo(targetX, targetY);
	}

	async animateClick(): Promise<void> {
		if (!TUTORIAL_MODE) return;
		await this.cursor.animateClick();
	}

	async click(selector: string | Locator): Promise<void> {
		const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
		if (TUTORIAL_MODE) {
			await locator.scrollIntoViewIfNeeded();
			await this.highlight(locator);
			await this.animateClick();
		}
		await locator.click();
		if (TUTORIAL_MODE) await this.unhighlight(locator);
	}

	async fill(selector: string | Locator, value: string): Promise<void> {
		const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
		if (TUTORIAL_MODE) {
			await locator.scrollIntoViewIfNeeded();
			await this.highlight(locator);
			await this.animateClick();
		}
		await locator.fill(value);
		if (TUTORIAL_MODE) await this.unhighlight(locator);
	}

	async typeSlowly(selector: string | Locator, value: string, delay = 50): Promise<void> {
		const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
		if (TUTORIAL_MODE) {
			await locator.scrollIntoViewIfNeeded();
			await this.highlight(locator);
			await this.animateClick();
			await locator.click({ clickCount: 3 });
			await locator.pressSequentially(value, { delay });
			await this.unhighlight(locator);
		} else {
			await locator.fill(value);
		}
	}

	async selectOption(selector: string | Locator, value: string): Promise<void> {
		const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
		if (TUTORIAL_MODE) {
			await locator.scrollIntoViewIfNeeded();
			await this.highlight(locator);
			await this.animateClick();
		}
		await locator.selectOption(value);
		if (TUTORIAL_MODE) await this.unhighlight(locator);
	}

	async hideOverlay(): Promise<void> {
		if (!TUTORIAL_MODE) return;
		await this.overlay.hide();
		await this.cursor.hide();
	}

	async showEmailPreview(options: {
		subject: string;
		from?: string;
		to?: string;
		body: string;
		highlightCode?: string;
		duration?: number;
	}): Promise<void> {
		if (!TUTORIAL_MODE) return;
		await this.overlay.showEmailPreview(options);
		const duration = options.duration ?? 3000;
		await this.page.evaluate(
			(durationMs) => {
				const iframe = document.querySelector('.tutorial-email-iframe') as HTMLIFrameElement | null;
				const doc = iframe?.contentDocument;
				const scroller = doc?.scrollingElement as HTMLElement | undefined;
				if (!iframe || !doc || !scroller) return;

				const run = () => {
					const viewportH = iframe.clientHeight;
					const docH = scroller.scrollHeight;
					const maxScroll = Math.max(0, docH - viewportH);
					if (maxScroll <= 0) return;

					const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[];
					const cta = anchors.find((a) => a.offsetHeight > 0 && a.offsetWidth > 0) ?? null;
					let target = maxScroll;
					if (cta) {
						const rect = cta.getBoundingClientRect();
						const ctaTopInDoc = scroller.scrollTop + rect.top;
						target = Math.max(0, Math.min(maxScroll, ctaTopInDoc - viewportH / 3));
					}

					const startDelay = Math.min(700, durationMs * 0.15);
					const scrollWindow = Math.max(durationMs - startDelay * 2, 500);
					const start = performance.now() + startDelay;
					const step = (now: number) => {
						const t = Math.max(0, Math.min(1, (now - start) / scrollWindow));
						const eased = 1 - Math.pow(1 - t, 2);
						scroller.scrollTop = target * eased;
						if (t < 1) requestAnimationFrame(step);
					};
					requestAnimationFrame(step);
				};

				if (doc.readyState === 'complete') run();
				else iframe.addEventListener('load', run, { once: true });
			},
			duration
		);
		await this.page.waitForTimeout(duration);
	}

	async hideEmailPreview(): Promise<void> {
		if (!TUTORIAL_MODE) return;
		await this.overlay.hideEmailPreview();
	}

	async complete(message?: string): Promise<void> {
		if (!TUTORIAL_MODE) {
			for (const item of this.pendingItems) {
				if (item.type === 'step') {
					await item.action();
				}
			}
			return;
		}

		const defaultMessage = this.options.lang === 'fr' ? 'Tutoriel terminé!' : 'Tutorial complete!';
		const completionMessage = message || defaultMessage;
		const completionVoicePreload = this.options.enableVoice
			? this.voice.preloadSingle(completionMessage)
			: Promise.resolve();

		const preloads = this.pendingItems.map(item => item.voicePreload);
		preloads.push(completionVoicePreload);
		await Promise.all(preloads);

		const videoTrimMs = Date.now() - this.videoStartTime;
		this.timeline.start(videoTrimMs);

		await this.initialize();

		this.overlay.setTotalSteps(this.stepCounter);

		let currentStep = 0;

		for (const item of this.pendingItems) {

			await this.ensureStyles();

			if (item.type === 'context') {
				await this.overlay.showContext(item.title, item.text, item.style);

				if (this.options.enableVoice) {
					const audioFilename = this.voice.getFilename(item.voiceText);
					const voiceStartTime = Date.now();
					const duration = await this.voice.play(item.voiceText);
					this.timeline.addStep(0, 'Context', audioFilename, duration, voiceStartTime, item.voiceText, item.key);
				}

				await this.page.waitForTimeout(this.options.stepDelay);

			} else if (item.type === 'step') {
				currentStep++;
				this.overlay.setCurrentStep(currentStep);

				await this.cursor.ensureVisible();

				if (this.options.backgroundMusic && this.options.playAudioInBrowser) {
					await this.music.ensurePlaying();
				}

				await this.overlay.showStep(item.overlayText, item.overlayDescription);

				if (this.options.enableVoice && !item.skipVoice) {
					const audioFilename = this.voice.getFilename(item.voiceText);
					const voiceStartTime = Date.now();
					const duration = await this.voice.play(item.voiceText);
					this.timeline.addStep(currentStep, item.title, audioFilename, duration, voiceStartTime, item.voiceText, item.key);
				}

				await this.page.waitForTimeout(this.options.stepDelay);
				await item.action();
				await this.page.waitForTimeout(item.delay ?? 300);

				await this.captureStepScreenshot(currentStep);
			}
		}

		await this.overlay.showComplete(completionMessage);

		if (this.options.enableVoice) {
			const audioFilename = this.voice.getFilename(completionMessage);
			const voiceStartTime = Date.now();
			const duration = await this.voice.play(completionMessage);
			this.timeline.addStep(this.stepCounter + 1, 'Complete', audioFilename, duration, voiceStartTime, completionMessage);
		}

		if (this.music.isInitialized) {
			await this.music.stop(true);
		}

		await this.page.waitForTimeout(2000);

		const video = this.page.video();
		if (video) {
			const videoPath = await video.path();
			this.timeline.setVideoPath(videoPath);
		}

		const outputDir = join(process.cwd(), TUTORIAL_OUTPUT_DIR);
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}
		this.timeline.save(join(outputDir, `${this.testName}_timeline.json`));

		await this.hideOverlay();
	}

	getTimeline(): ReturnType<TutorialTimeline['getData']> {
		return this.timeline.getData();
	}

	private async captureStepScreenshot(stepNumber: number): Promise<void> {
		try {
			const screenshotDir = join(process.cwd(), 'tutorials/videos');
			if (!existsSync(screenshotDir)) {
				mkdirSync(screenshotDir, { recursive: true });
			}

			const sharp = await getSharp();

			if (sharp) {
				const screenshotPath = join(screenshotDir, `${this.testName}-step-${stepNumber}.webp`);
				const raw = await this.page.screenshot({ type: 'png', fullPage: false });
				const buffer = await sharp(raw).resize({ width: 500, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
				writeFileSync(screenshotPath, buffer);
				if (stepNumber === 1) {
					const posterPath = join(screenshotDir, `${this.testName}-poster.webp`);
					const posterBuffer = await sharp(raw).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
					writeFileSync(posterPath, posterBuffer);
				}
				console.log(`[Tutorial] Screenshot: ${this.testName}-step-${stepNumber}.webp`);
			} else {
				const screenshotPath = join(screenshotDir, `${this.testName}-step-${stepNumber}.png`);
				const raw = await this.page.screenshot({ type: 'png', fullPage: false });
				writeFileSync(screenshotPath, raw);
				if (stepNumber === 1) {
					const posterPath = join(screenshotDir, `${this.testName}-poster.png`);
					writeFileSync(posterPath, raw);
				}
				console.log(`[Tutorial] Screenshot (PNG, install sharp for WebP): ${this.testName}-step-${stepNumber}.png`);
			}
		} catch (err: any) {
			console.warn(`[Tutorial] Screenshot failed for step ${stepNumber}: ${err.message}`);
		}
	}

	async deleteVideoIfEmpty(): Promise<boolean> {
		if (!TUTORIAL_MODE) return false;

		if (!this.hasSteps) {
			const video = this.page.video();
			if (video) {
				try {
					const videoPath = await video.path();
					if (videoPath && existsSync(videoPath)) {
						unlinkSync(videoPath);
						console.log(`[Tutorial] Deleted empty video: ${videoPath}`);
						return true;
					}
				} catch {
					// Video might not be saved yet
				}
			}
			console.log('[Tutorial] No steps recorded, video will be deleted');
			return true;
		}
		return false;
	}
}
