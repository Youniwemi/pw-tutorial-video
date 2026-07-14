import type { Page } from '@playwright/test';

const TUTORIAL_MODE = process.env.TUTORIAL_MODE === 'true';

export interface MusicOptions {
	backgroundMusic: string;
	musicVolume: number;
}

/**
 * In-browser music for live viewing during test execution.
 * Note: Music is NOT captured via MediaRecorder - it's added in post-processing
 * by the merge script (scripts/merge-tutorial-audio.sh) for continuous playback.
 *
 * All playback methods are no-ops when TUTORIAL_MODE is not enabled,
 * ensuring no audio plays during regular test runs.
 */
export class TutorialMusic {
	private page: Page;
	private options: MusicOptions;
	private initialized = false;

	constructor(page: Page, options: MusicOptions) {
		this.page = page;
		this.options = options;
	}

	switchPage(page: Page): void {
		this.page = page;
	}

	get isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Ensure music is still playing (restart after page navigation)
	 */
	async ensurePlaying(): Promise<void> {
		if (!TUTORIAL_MODE) return;
		if (!this.initialized || !this.options.backgroundMusic) return;

		const isPlaying = await this.page.evaluate(() => {
			const audio = document.getElementById('tutorial-music') as HTMLAudioElement;
			return audio && !audio.paused;
		});

		if (!isPlaying) {
			console.log('[Music] Lost after navigation, restarting...');
			this.initialized = false;
			await this.start();
		}
	}

	async start(): Promise<void> {
		if (!TUTORIAL_MODE) return;
		if (!this.options.backgroundMusic || this.initialized) return;

		const result = await this.page.evaluate(
			({ musicUrl, volume }) => {
				const existing = document.getElementById('tutorial-music');
				if (existing) existing.remove();

				const audio = document.createElement('audio');
				audio.id = 'tutorial-music';
				audio.src = musicUrl;
				audio.loop = true;
				audio.volume = volume;
				audio.style.display = 'none';
				document.body.appendChild(audio);

				return audio
					.play()
					.then(() => ({ success: true, error: null }))
					.catch((e: Error) => ({ success: false, error: e.message }));
			},
			{ musicUrl: this.options.backgroundMusic, volume: this.options.musicVolume }
		);

		if (result?.success) {
			console.log('[Music] Background music playing (live only, will be added in post-processing)');
		} else if (result?.error) {
			console.warn(`[Music] Autoplay blocked: ${result.error}`);
		}

		this.initialized = true;
	}

	async stop(fadeOut = true): Promise<void> {
		if (!this.initialized) return;

		await this.page.evaluate(({ fadeOut }) => {
			const audio = document.getElementById('tutorial-music') as HTMLAudioElement;
			if (!audio) return;

			if (fadeOut) {
				const fadeInterval = setInterval(() => {
					if (audio.volume > 0.01) {
						audio.volume = Math.max(0, audio.volume - 0.01);
					} else {
						clearInterval(fadeInterval);
						audio.pause();
						audio.remove();
					}
				}, 20);
			} else {
				audio.pause();
				audio.remove();
			}
		}, { fadeOut });

		this.initialized = false;
	}

	async setVolume(volume: number): Promise<void> {
		if (!this.initialized) return;

		await this.page.evaluate(
			({ volume }) => {
				const audio = document.getElementById('tutorial-music') as HTMLAudioElement;
				if (audio) audio.volume = Math.max(0, Math.min(1, volume));
			},
			{ volume }
		);
	}
}
