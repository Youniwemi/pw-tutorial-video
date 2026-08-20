import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { regenVoices, collectVoices, audioFilename } from '../src/voice-prerender';

let dir: string;
let audioDir: string;
let timelineDir: string;
let transcriptDir: string;
let sources: { timelineDir: string; transcriptDir: string };

function writeTranscript(name: string, lang: string, texts: string[]) {
	mkdirSync(transcriptDir, { recursive: true });
	writeFileSync(
		join(transcriptDir, `${name}.md`),
		[
			`# ${name}`,
			'',
			`- **Test:** \`${name}\``,
			`- **Language:** ${lang}`,
			'',
			'---',
			'',
			...texts.flatMap((text, i) => [`### Step ${i + 1}: Step ${i + 1}`, '', text, ''])
		].join('\n')
	);
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'voice-prerender-'));
	audioDir = join(dir, 'static', 'audio', 'tutorial-voice');
	timelineDir = join(dir, 'tutorials', 'output');
	transcriptDir = join(dir, 'tutorials', 'transcripts');
	sources = { timelineDir, transcriptDir };
	delete process.env.TUTORIAL_TTS_CMD;
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env.TUTORIAL_TTS_CMD;
});

describe('voice pre-rendering', () => {
	it('collects texts from transcripts and timelines, deduplicated', () => {
		writeTranscript('demo', 'fr', ['Cliquez ici. Ça ouvre le dossier.', 'Voilà.']);
		mkdirSync(timelineDir, { recursive: true });
		writeFileSync(
			join(timelineDir, 'demo_timeline.json'),
			JSON.stringify({
				lang: 'fr',
				steps: [{ step: 1, title: 'x', text: 'Voilà.' }, { step: 2, title: 'y', text: 'Suivant.' }]
			})
		);

		const texts = collectVoices(sources).map((e) => `${e.lang}:${e.text}`);
		expect(texts).toEqual([
			'fr:Cliquez ici. Ça ouvre le dossier.',
			'fr:Voilà.',
			'fr:Suivant.'
		]);
	});

	it('synthesizes only the missing clips by default, everything with force', async () => {
		process.env.TUTORIAL_TTS_CMD = 'touch {output} # {lang} {text}';
		writeTranscript('demo', 'fr', ['Bonjour.', 'Au revoir.']);
		mkdirSync(audioDir, { recursive: true });
		writeFileSync(join(audioDir, audioFilename('fr', 'Bonjour.')), 'cached');

		const first = await regenVoices(audioDir, sources);
		expect(first).toEqual({ total: 2, cached: 1, done: 1, failed: 0 });

		const forced = await regenVoices(audioDir, { ...sources, force: true });
		expect(forced).toEqual({ total: 2, cached: 0, done: 2, failed: 0 });
	});

	it('rebuilds a deleted audio dir', async () => {
		process.env.TUTORIAL_TTS_CMD = 'touch {output} # {lang} {text}';
		writeTranscript('demo', 'fr', ['Bonjour.']);
		expect(existsSync(audioDir)).toBe(false);

		const result = await regenVoices(audioDir, sources);
		expect(result.done).toBe(1);
		expect(existsSync(join(audioDir, audioFilename('fr', 'Bonjour.')))).toBe(true);
	});

	it('filters by language', async () => {
		process.env.TUTORIAL_TTS_CMD = 'touch {output} # {lang} {text}';
		writeTranscript('demo-fr', 'fr', ['Bonjour.']);
		writeTranscript('demo-en', 'en', ['Hello.']);

		const result = await regenVoices(audioDir, { ...sources, lang: 'fr' });
		expect(result.total).toBe(1);
		expect(existsSync(join(audioDir, audioFilename('fr', 'Bonjour.')))).toBe(true);
		expect(existsSync(join(audioDir, audioFilename('en', 'Hello.')))).toBe(false);
	});

	it('counts failures without stopping the run', async () => {
		process.env.TUTORIAL_TTS_CMD = 'false # {text} {output}';
		writeTranscript('demo', 'fr', ['Bonjour.']);

		const result = await regenVoices(audioDir, sources);
		expect(result).toEqual({ total: 1, cached: 0, done: 0, failed: 1 });
		expect(existsSync(join(audioDir, audioFilename('fr', 'Bonjour.')))).toBe(false);
	});
});
