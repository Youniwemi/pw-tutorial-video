import { createHash } from 'crypto';
import { existsSync, readFileSync, rmSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createTTSProvider } from './tts-provider.js';
import { parseTranscript } from './transcript.js';
import type { TimelineData } from './timeline.js';

/**
 * Voice pre-rendering — generate the narration clips OUTSIDE of any test run,
 * where TTS synthesis is slow and serial. Texts are collected from the
 * artifacts that record them verbatim:
 *
 *  - `tutorials/transcripts/*.md` — one per tutorial, survives every run;
 *  - `tutorials/output/*_timeline.json` — fresh but wiped by Playwright runs.
 */
export interface NarrationText {
	lang: string;
	text: string;
}

export interface VoiceSources {
	timelineDir?: string;
	transcriptDir?: string;
}

/** Same naming scheme as the runtime voice cache (voice.ts). */
export function audioFilename(lang: string, text: string): string {
	const hash = createHash('md5').update(`${lang}:${text}`).digest('hex').slice(0, 12);
	const ext = process.platform === 'darwin' ? 'wav' : 'mp3';
	return `${hash}.${ext}`;
}

function collectFromTimelines(timelineDir: string): NarrationText[] {
	if (!existsSync(timelineDir)) return [];
	const entries: NarrationText[] = [];
	for (const file of readdirSync(timelineDir).filter((f) => f.endsWith('_timeline.json'))) {
		try {
			const data = JSON.parse(readFileSync(join(timelineDir, file), 'utf-8')) as TimelineData;
			for (const step of data.steps) {
				if (step.audioFile && step.text?.trim()) entries.push({ lang: data.lang, text: step.text });
			}
		} catch {
			console.warn(`[Voice] Skipping unreadable timeline: ${file}`);
		}
	}
	return entries;
}

function collectFromTranscripts(transcriptDir: string): NarrationText[] {
	if (!existsSync(transcriptDir)) return [];
	const entries: NarrationText[] = [];
	for (const file of readdirSync(transcriptDir).filter((f) => f.endsWith('.md'))) {
		try {
			const markdown = readFileSync(join(transcriptDir, file), 'utf-8');
			const lang = markdown.match(/^- \*\*Language:\*\* (\S+)/m)?.[1];
			if (!lang) continue;
			for (const entry of parseTranscript(markdown)) {
				if (entry.text.trim()) entries.push({ lang, text: entry.text });
			}
		} catch {
			console.warn(`[Voice] Skipping unreadable transcript: ${file}`);
		}
	}
	return entries;
}

/** All known narration texts, deduplicated. */
export function collectVoices(sources: VoiceSources = {}): NarrationText[] {
	const timelineDir =
		sources.timelineDir ?? process.env.TUTORIAL_OUTPUT_DIR ?? join(process.cwd(), 'tutorials', 'output');
	const transcriptDir =
		sources.transcriptDir ??
		process.env.TUTORIAL_TRANSCRIPT_DIR ??
		join(process.cwd(), 'tutorials', 'transcripts');

	const seen = new Set<string>();
	const all: NarrationText[] = [];
	for (const entry of [...collectFromTranscripts(transcriptDir), ...collectFromTimelines(timelineDir)]) {
		const key = `${entry.lang}:${entry.text}`;
		if (seen.has(key)) continue;
		seen.add(key);
		all.push(entry);
	}
	return all;
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
	const queue = [...items];
	const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
		while (queue.length) await fn(queue.shift()!);
	});
	await Promise.all(workers);
}

export interface RegenOptions extends VoiceSources {
	lang?: string;
	/** Parallel TTS syntheses (default 2) */
	workers?: number;
	/** Re-synthesize cached clips too (after a voice settings change). Default: missing only. */
	force?: boolean;
}

/**
 * Pre-render the voice cache without running any test: collect every known
 * narration text, synthesize the missing clips (all of them with `force`) with
 * the CURRENT TTS settings, in parallel. The audio dir may have been deleted
 * entirely — it is recreated. Videos are not remixed; a `TUTORIAL_MODE=true`
 * run picks the clips up from cache.
 */
export async function regenVoices(
	audioDir: string,
	options: RegenOptions = {}
): Promise<{ total: number; cached: number; done: number; failed: number }> {
	const all = collectVoices(options).filter((e) => !options.lang || e.lang === options.lang);
	const todo = options.force
		? all
		: all.filter((e) => !existsSync(join(audioDir, audioFilename(e.lang, e.text))));
	const result = { total: all.length, cached: all.length - todo.length, done: 0, failed: 0 };

	console.log(
		`[Voice] ${all.length} narration(s) known, ${todo.length} to synthesize` +
			(options.force ? ' (force)' : `, ${result.cached} already cached`)
	);
	if (todo.length === 0) return result;

	mkdirSync(audioDir, { recursive: true });

	// One provider per language — the provider resolves voice/rate from the env.
	const providers = new Map<string, Awaited<ReturnType<typeof createTTSProvider>>>();
	for (const lang of new Set(todo.map((e) => e.lang))) {
		const provider = await createTTSProvider({
			lang,
			voice: process.env.TUTORIAL_VOICE_NAME || undefined,
			rate: 1.0
		});
		console.log(`[Voice] ${lang}: TTS provider ${provider.name}`);
		providers.set(lang, provider);
	}

	await pool(todo, options.workers ?? 2, async ({ lang, text }) => {
		const filePath = join(audioDir, audioFilename(lang, text));
		try {
			// Remove first: a failed synthesis must not leave a stale clip
			// pretending to be regenerated.
			rmSync(filePath, { force: true });
			await providers.get(lang)!.synthesize(text, filePath);
			result.done++;
			console.log(
				`  ✔ [${result.done}/${todo.length}] ${lang} ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`
			);
		} catch (error) {
			result.failed++;
			console.error(`  ✖ ${lang} ${text.slice(0, 40)}… ${error}`);
		}
	});
	return result;
}
