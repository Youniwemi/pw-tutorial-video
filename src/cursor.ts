import type { Page, Locator } from '@playwright/test';
import { CURSOR_SVG } from './overlay-html';

export interface CursorOptions {
	mouseSteps: number;
	pauseBeforeClick: number;
}

export class TutorialCursor {
	private page: Page;
	private options: CursorOptions;
	private x = 0;
	private y = 0;
	private initialized = false;

	constructor(page: Page, options: CursorOptions) {
		this.page = page;
		this.options = options;
	}

	switchPage(page: Page): void {
		this.page = page;
		this.initialized = false; // cursor must be re-injected into the new page
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		await this.injectCursor();

		const viewport = this.page.viewportSize();
		if (viewport) {
			this.x = viewport.width / 2;
			this.y = viewport.height / 2;
		}

		this.initialized = true;
	}

	/** Inject cursor element into page */
	private async injectCursor(): Promise<void> {
		await this.page.evaluate((cursorSvg) => {
			if (document.getElementById('tutorial-cursor')) return;
			const cursor = document.createElement('div');
			cursor.id = 'tutorial-cursor';
			cursor.className = 'tutorial-cursor';
			cursor.innerHTML = cursorSvg;
			cursor.style.display = 'none';
			document.body.appendChild(cursor);
		}, CURSOR_SVG);
	}

	/** Ensure cursor is visible (re-inject after navigation) */
	async ensureVisible(): Promise<void> {
		await this.injectCursor();
	}

	async moveToElement(locator: Locator): Promise<void> {
		const box = await locator.boundingBox();
		if (!box) return;
		await this.moveTo(box.x + box.width / 2, box.y + box.height / 2);
	}

	async moveTo(targetX: number, targetY: number): Promise<void> {
		await this.page.evaluate(() => {
			const cursor = document.getElementById('tutorial-cursor');
			if (cursor) cursor.style.display = 'block';
		});

		const startX = this.x;
		const startY = this.y;
		const steps = this.options.mouseSteps;

		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const eased = 1 - Math.pow(1 - t, 3); // Ease-out cubic
			const x = startX + (targetX - startX) * eased;
			const y = startY + (targetY - startY) * eased;

			await this.page.evaluate(({ x, y }) => {
				const cursor = document.getElementById('tutorial-cursor');
				if (cursor) {
					cursor.style.left = `${x}px`;
					cursor.style.top = `${y}px`;
				}
			}, { x, y });

			await this.page.waitForTimeout(16); // ~60fps
		}

		this.x = targetX;
		this.y = targetY;
		await this.page.mouse.move(targetX, targetY);
		await this.page.waitForTimeout(this.options.pauseBeforeClick);
	}

	async animateClick(): Promise<void> {
		await this.page.evaluate(() => {
			const cursor = document.getElementById('tutorial-cursor');
			if (cursor) {
				cursor.classList.add('tutorial-cursor-clicking');
				setTimeout(() => cursor.classList.remove('tutorial-cursor-clicking'), 150);
			}
		});
		await this.page.waitForTimeout(150);
	}

	async hide(): Promise<void> {
		await this.page.evaluate(() => {
			const cursor = document.getElementById('tutorial-cursor');
			if (cursor) cursor.style.display = 'none';
		});
	}
}
