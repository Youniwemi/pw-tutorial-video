import type { Page, Locator } from '@playwright/test';
import type { ContextStyle } from './types';
import {
	renderStepOverlay,
	renderContextOverlay,
	renderCompleteOverlay,
	renderEmailPreview
} from './overlay-html';

export interface OverlayOptions {
	title: string;
	lang: string;
	highlightDuration: number;
}

export class TutorialOverlay {
	private page: Page;
	private options: OverlayOptions;
	private currentStep = 0;
	private totalSteps = 0;

	constructor(page: Page, options: OverlayOptions) {
		this.page = page;
		this.options = options;
	}

	switchPage(page: Page): void {
		this.page = page;
	}

	setTotalSteps(total: number): void {
		this.totalSteps = total;
	}

	setCurrentStep(step: number): void {
		this.currentStep = step;
	}

	incrementStep(): number {
		return ++this.currentStep;
	}

	get step(): number {
		return this.currentStep;
	}

	async showStep(title: string, description?: string): Promise<void> {
		const isRtl = this.options.lang === 'ar';
		const progressPercent = this.totalSteps > 0 ? (this.currentStep / this.totalSteps) * 100 : 0;

		const html = renderStepOverlay({
			tutorialTitle: this.options.title,
			step: this.currentStep,
			title,
			description,
			isRtl,
			progressPercent
		});

		await this.page.evaluate((html) => {
			const existing = document.getElementById('tutorial-overlay');
			if (existing) existing.remove();
			const container = document.createElement('div');
			container.innerHTML = html;
			const overlay = container.firstElementChild!;
			document.body.appendChild(overlay);
		}, html);
	}

	async showContext(
		contextTitle: string,
		text?: string,
		style: ContextStyle = 'goal'
	): Promise<void> {
		const isRtl = this.options.lang === 'ar';

		const html = renderContextOverlay({
			tutorialTitle: this.options.title,
			contextTitle,
			text,
			style,
			isRtl
		});

		await this.page.evaluate((html) => {
			const existing = document.getElementById('tutorial-overlay');
			if (existing) existing.remove();
			const container = document.createElement('div');
			container.innerHTML = html;
			const overlay = container.firstElementChild!;
			document.body.appendChild(overlay);
		}, html);
	}

	async showComplete(message: string): Promise<void> {
		const html = renderCompleteOverlay({
			title: this.options.title,
			message
		});

		await this.page.evaluate((html) => {
			const overlay = document.getElementById('tutorial-overlay');
			if (overlay) {
				const container = document.createElement('div');
				container.innerHTML = html;
				const newOverlay = container.firstElementChild!;
				overlay.replaceWith(newOverlay);
			}
		}, html);
	}

	/**
	 * Show a simulated email preview popup with HTML rendering
	 */
	async showEmailPreview(options: {
		subject: string;
		from?: string;
		to?: string;
		body: string;
		highlightCode?: string;
		isHtml?: boolean;
	}): Promise<void> {
		const isRtl = this.options.lang === 'ar';

		const html = renderEmailPreview({
			subject: options.subject,
			from: options.from,
			to: options.to,
			body: options.body,
			highlightCode: options.highlightCode,
			isRtl
		});

		await this.page.evaluate((html) => {
			const existing = document.getElementById('tutorial-email-preview');
			if (existing) existing.remove();
			const container = document.createElement('div');
			container.innerHTML = html;
			const preview = container.firstElementChild!;
			document.body.appendChild(preview);
		}, html);
	}

	async hideEmailPreview(): Promise<void> {
		await this.page.evaluate(() => {
			const preview = document.getElementById('tutorial-email-preview');
			if (preview) preview.remove();
		});
	}

	async hide(): Promise<void> {
		await this.page.evaluate(() => {
			const overlay = document.getElementById('tutorial-overlay');
			if (overlay) overlay.remove();
		});
	}

	async highlight(selector: string | Locator, duration?: number): Promise<void> {
		const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
		await locator.evaluate((el) => el.classList.add('tutorial-highlight'));
		await this.page.waitForTimeout(duration ?? this.options.highlightDuration);
	}

	async unhighlight(selector: string | Locator): Promise<void> {
		const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
		try {
			await locator.evaluate((el) => el.classList.remove('tutorial-highlight'), null, { timeout: 2000 });
		} catch {
			// Element may have been removed after click (dialog closed, navigation, etc.)
		}
	}
}
