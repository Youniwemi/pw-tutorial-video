import type { Page } from '@playwright/test';
import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { createTTSProvider, type TTSProvider } from './tts-provider';

const TUTORIAL_MODE = process.env.TUTORIAL_MODE === 'true';

export interface VoiceOptions {
	lang: string;
	voiceName: string;
	voiceRate: number;
	voicePitch: number;
	playInBrowser?: boolean;
	audioBaseUrl?: string;
}

// Audio files stored in static folder to be served by dev server
const AUDIO_STATIC_DIR = join(process.cwd(), 'static', 'audio', 'tutorial-voice');
const AUDIO_URL_BASE = '/audio/tutorial-voice';

/**
 * Get hash-based filename for text
 */
function getAudioFilename(text: string, lang: string): string {
	const hash = createHash('md5').update(`${lang}:${text}`).digest('hex').slice(0, 12);
	const ext = process.platform === 'darwin' ? 'wav' : 'mp3';
	return `${hash}.${ext}`;
}

export interface PreloadedAudio {
	text: string;
	filename: string;
	filePath: string;
	url: string;
	durationMs: number;
}

/**
 * TTS voice generation for tutorials.
 * Pre-generates audio files and tracks their durations.
 * Optionally plays audio in browser during test.
 */
export class TutorialVoice {
	private page: Page;
	private options: Required<VoiceOptions>;
	private ttsProvider: TTSProvider | null = null;
	private preloadedAudio: Map<string, PreloadedAudio> = new Map();

	constructor(page: Page, options: VoiceOptions) {
		this.page = page;
		this.options = {
			lang: options.lang,
			voiceName: options.voiceName,
			voiceRate: options.voiceRate,
			voicePitch: options.voicePitch,
			playInBrowser: options.playInBrowser ?? true,
			audioBaseUrl: options.audioBaseUrl ?? 'http://localhost:5173'
		};
	}

	switchPage(page: Page): void {
		this.page = page;
	}

	/**
	 * Pre-generate a single audio file (non-blocking).
	 * Returns a promise that resolves when preload is complete.
	 * No-op when TUTORIAL_MODE is not enabled.
	 */
	preloadSingle(text: string): Promise<void> {
		if (!TUTORIAL_MODE) return Promise.resolve();
		return this.generateAudio(text).then(() => {});
	}

	/**
	 * Pre-generate all audio files before the test runs.
	 * No-op when TUTORIAL_MODE is not enabled.
	 */
	async preload(texts: string[]): Promise<void> {
		if (!TUTORIAL_MODE) return;
		// Ensure output directory exists
		if (!existsSync(AUDIO_STATIC_DIR)) {
			mkdirSync(AUDIO_STATIC_DIR, { recursive: true });
		}

		// Initialize TTS provider
		if (!this.ttsProvider) {
			this.ttsProvider = await createTTSProvider({
				lang: this.options.lang,
				voice: this.options.voiceName || undefined,
				rate: this.options.voiceRate
			});
			console.log(`[Voice] Using TTS provider: ${this.ttsProvider.name}`);
		}

		console.log(`[Voice] Preloading ${texts.length} audio files...`);
		const startTime = Date.now();

		for (const text of texts) {
			const filename = getAudioFilename(text, this.options.lang);
			const filePath = join(AUDIO_STATIC_DIR, filename);
			const url = `${AUDIO_URL_BASE}/${filename}`;

			let durationMs: number;

			// Check cache
			if (existsSync(filePath)) {
				// Get duration from cached file
				durationMs = await this.getAudioDuration(filePath);
			} else {
				// Generate audio file
				const result = await this.ttsProvider.synthesize(text, filePath);
				durationMs = result.duration;
			}

			this.preloadedAudio.set(text, {
				text,
				filename,
				filePath,
				url,
				durationMs
			});
		}

		console.log(`[Voice] Preloaded ${texts.length} files in ${Date.now() - startTime}ms`);
	}

	/**
	 * Get audio info for a text (must be preloaded first)
	 */
	getAudio(text: string): PreloadedAudio | undefined {
		return this.preloadedAudio.get(text);
	}

	/**
	 * Get duration in ms for a text (must be preloaded)
	 */
	getDuration(text: string): number {
		return this.preloadedAudio.get(text)?.durationMs ?? 0;
	}

	/**
	 * Get the filename for a text (for timeline)
	 */
	getFilename(text: string): string {
		const cached = this.preloadedAudio.get(text);
		if (cached) return cached.filename;
		return getAudioFilename(text, this.options.lang);
	}

	/**
	 * Play audio in browser (optional, for live viewing)
	 * Returns duration in ms
	 * Will generate audio on-demand if not preloaded.
	 * No-op when TUTORIAL_MODE is not enabled (returns 0).
	 */
	async play(text: string): Promise<number> {
		if (!TUTORIAL_MODE) return 0;
		let audio: PreloadedAudio | null | undefined = this.preloadedAudio.get(text);

		if (!audio) {
			audio = await this.generateAudio(text);
		}

		if (!audio) {
			console.warn(`[Voice] Failed to generate audio for: "${text.substring(0, 30)}..."`);
			return 0;
		}

		if (this.options.playInBrowser) {
			await this.page.evaluate(
				({ url }) => {
					return new Promise<void>((resolve) => {
						const audio = new Audio(url);
						audio.onended = () => resolve();
						audio.onerror = () => resolve();
						audio.play().catch(() => resolve());
					});
				},
				{ url: `${this.options.audioBaseUrl}${audio.url}` }
			);
		} else {
			// Just wait for the duration (silent)
			await this.page.waitForTimeout(audio.durationMs);
		}

		return audio.durationMs;
	}

	/**
	 * Generate audio for a single text on demand
	 */
	private async generateAudio(text: string): Promise<PreloadedAudio | null> {
		// Ensure output directory exists
		if (!existsSync(AUDIO_STATIC_DIR)) {
			mkdirSync(AUDIO_STATIC_DIR, { recursive: true });
		}

		// Initialize TTS provider if needed
		if (!this.ttsProvider) {
			this.ttsProvider = await createTTSProvider({
				lang: this.options.lang,
				voice: this.options.voiceName || undefined,
				rate: this.options.voiceRate
			});
		}

		const filename = getAudioFilename(text, this.options.lang);
		const filePath = join(AUDIO_STATIC_DIR, filename);
		const url = `${AUDIO_URL_BASE}/${filename}`;

		let durationMs: number;

		try {
			// Check cache first
			if (existsSync(filePath)) {
				durationMs = await this.getAudioDuration(filePath);
			} else {
				// Generate audio file
				const result = await this.ttsProvider.synthesize(text, filePath);
				durationMs = result.duration;
			}

			const audio: PreloadedAudio = {
				text,
				filename,
				filePath,
				url,
				durationMs
			};

			// Cache for future use
			this.preloadedAudio.set(text, audio);
			return audio;
		} catch (error) {
			console.error(`[Voice] Error generating audio: ${error}`);
			return null;
		}
	}

	/**
	 * Get audio duration using ffprobe or file stats
	 */
	private async getAudioDuration(filePath: string): Promise<number> {
		try {
			const { execSync } = await import('child_process');
			const output = execSync(
				`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
				{ encoding: 'utf-8' }
			);
			return Math.ceil(parseFloat(output.trim()) * 1000);
		} catch {
			// Fallback: estimate based on file size (rough)
			const { statSync } = await import('fs');
			const stats = statSync(filePath);
			// Rough estimate: ~16KB per second for wav at 44100Hz mono
			return Math.ceil((stats.size / 16000) * 1000);
		}
	}

}
