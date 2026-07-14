import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface TTSResult {
	filePath: string;
	duration: number; // in milliseconds
}

export interface TTSProvider {
	readonly name: string;
	synthesize(text: string, outputPath: string): Promise<TTSResult>;
	isAvailable(): Promise<boolean>;
}

export interface TTSProviderOptions {
	lang: string;
	voice?: string;
	rate?: number; // speech rate multiplier (1.0 = normal)
}

/** Get audio duration using ffprobe */
async function getAudioDuration(filePath: string): Promise<number> {
	try {
		const { stdout } = await execAsync(
			`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
		);
		return Math.ceil(parseFloat(stdout.trim()) * 1000);
	} catch {
		// Fallback: estimate based on text length (80ms per character at normal rate)
		return 3000;
	}
}

/**
 * Command-based TTS provider. Defaults to macOS `say`, can be overridden
 * via TUTORIAL_TTS_CMD env var.
 * Supports placeholders: {lang}, {text}, {output}.
 * If {text}/{output} are present they are substituted in-place; otherwise
 * the legacy "-o <output> <text>" suffix is appended automatically.
 * Examples:
 *   TUTORIAL_TTS_CMD='qsay --my-voice jadou -l {lang} {text} -o {output}'
 *   TUTORIAL_TTS_CMD='say -v Thomas'   (legacy: appends -o <out> "<text>")
 */
export class CommandTTSProvider implements TTSProvider {
	readonly name: string;
	private command: string;
	private options: TTSProviderOptions;

	private static VOICES: Record<string, string> = {
		fr: 'Thomas',
		en: 'Samantha',
		ar: 'Maged'
	};

	private static LANG_NAMES: Record<string, string> = {
		fr: 'french',
		en: 'english',
		ar: 'arabic'
	};

	private static _logged = false;

	constructor(options: TTSProviderOptions) {
		this.options = options;
		const ttsCmd = process.env.TUTORIAL_TTS_CMD;
		if (!CommandTTSProvider._logged) {
			console.log(`[TTS] TUTORIAL_TTS_CMD=${ttsCmd ?? '(not set)'}`);
			CommandTTSProvider._logged = true;
		}
		if (ttsCmd) {
			const langName = CommandTTSProvider.LANG_NAMES[options.lang] || options.lang;
			this.command = ttsCmd.replace('{lang}', langName);
			this.name = `tts:${this.command.split(/\s/)[0]}`;
		} else {
			const voice = options.voice || CommandTTSProvider.VOICES[options.lang] || 'Samantha';
			const rate = Math.round((options.rate || 1) * 175);
			this.command = `say -v "${voice}" -r ${rate} --data-format=LEI16@44100`;
			this.name = 'macos-say';
		}
	}

	async isAvailable(): Promise<boolean> {
		const binary = this.command.split(/\s/)[0];
		try {
			await execAsync(`which ${binary}`);
			return true;
		} catch {
			return false;
		}
	}

	async synthesize(text: string, outputPath: string): Promise<TTSResult> {
		const escapedText = text.replace(/"/g, '\\"');
		const hasPlaceholders = this.command.includes('{text}') || this.command.includes('{output}');
		const cmd = hasPlaceholders
			? this.command.replace('{text}', `"${escapedText}"`).replace('{output}', `"${outputPath}"`)
			: `${this.command} -o "${outputPath}" "${escapedText}"`;
		console.log(`[TTS] Running: ${cmd}`);
		await execAsync(cmd);
		const duration = await getAudioDuration(outputPath);
		return { filePath: outputPath, duration };
	}
}

/** Edge TTS provider using Microsoft's free TTS API */
export class EdgeTTSProvider implements TTSProvider {
	readonly name = 'edge-tts';
	private options: TTSProviderOptions;

	private static VOICES: Record<string, string> = {
		fr: 'fr-FR-HenriNeural',
		en: 'en-US-GuyNeural',
		ar: 'ar-SA-HamedNeural'
	};

	constructor(options: TTSProviderOptions) {
		this.options = options;
	}

	async isAvailable(): Promise<boolean> {
		try {
			await execAsync('which edge-tts');
			return true;
		} catch {
			return false;
		}
	}

	async synthesize(text: string, outputPath: string): Promise<TTSResult> {
		const voice = this.options.voice || EdgeTTSProvider.VOICES[this.options.lang] || 'en-US-GuyNeural';
		const rate = this.options.rate || 1;
		const ratePercent = rate >= 1 ? `+${Math.round((rate - 1) * 100)}%` : `-${Math.round((1 - rate) * 100)}%`;

		await execAsync(
			`edge-tts --voice "${voice}" --rate="${ratePercent}" --text "${text.replace(/"/g, '\\"')}" --write-media "${outputPath}"`
		);

		const duration = await getAudioDuration(outputPath);
		return { filePath: outputPath, duration };
	}
}

/** Auto-detect and create the best available TTS provider */
export async function createTTSProvider(options: TTSProviderOptions): Promise<TTSProvider> {
	// Command provider: custom TUTORIAL_TTS_CMD or macOS say
	const cmdProvider = new CommandTTSProvider(options);
	if (await cmdProvider.isAvailable()) {
		return cmdProvider;
	}

	// Fallback to edge-tts
	const edgeProvider = new EdgeTTSProvider(options);
	if (await edgeProvider.isAvailable()) {
		return edgeProvider;
	}

	throw new Error('No TTS provider available. Install edge-tts: pip install edge-tts');
}

/** Audio segment info for later merging */
export interface AudioSegment {
	filePath: string;
	timestamp: number; // milliseconds from start of recording
	duration: number;
	text: string;
}

/** Manages TTS audio generation and tracking for tutorials */
export class TTSManager {
	private provider: TTSProvider | null = null;
	private options: TTSProviderOptions;
	private outputDir: string;
	private segments: AudioSegment[] = [];
	private recordingStartTime: number = 0;

	constructor(options: TTSProviderOptions, outputDir: string) {
		this.options = options;
		this.outputDir = outputDir;
	}

	async initialize(): Promise<void> {
		if (!existsSync(this.outputDir)) {
			mkdirSync(this.outputDir, { recursive: true });
		}
		this.provider = await createTTSProvider(this.options);
		console.log(`[TTS] Using provider: ${this.provider.name}`);
	}

	startRecording(): void {
		this.recordingStartTime = Date.now();
		this.segments = [];
	}

	async speak(text: string): Promise<number> {
		if (!this.provider) {
			await this.initialize();
		}

		const timestamp = Date.now() - this.recordingStartTime;
		const filename = `voice_${timestamp}.mp3`;
		const filePath = join(this.outputDir, filename);

		const result = await this.provider!.synthesize(text, filePath);

		this.segments.push({
			filePath: result.filePath,
			timestamp,
			duration: result.duration,
			text
		});

		return result.duration;
	}

	getSegments(): AudioSegment[] {
		return [...this.segments];
	}

	/** Generate a manifest file for post-processing */
	async writeManifest(videoPath: string): Promise<string> {
		const manifestPath = join(this.outputDir, 'audio-manifest.json');
		const manifest = {
			videoPath,
			recordingStart: this.recordingStartTime,
			segments: this.segments,
			provider: this.provider?.name
		};

		const { writeFileSync } = await import('fs');
		writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
		return manifestPath;
	}
}
