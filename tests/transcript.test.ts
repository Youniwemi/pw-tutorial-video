import { describe, it, expect } from 'vitest';
import {
	buildTranscriptMarkdown,
	parseTranscript,
	applyCorrections,
	TranscriptCorrections
} from '../src/transcript';
import type { ApplyIO } from '../src/transcript';
import type { TimelineData } from '../src/timeline';

const sampleTimeline = (): TimelineData => ({
	testName: 'create-invoice',
	testTitle: 'tutorial.invoice.title',
	testFile: 'e2e/invoice.spec.ts',
	projectName: 'chromium',
	lang: 'fr',
	totalDurationMs: 62000,
	videoTrimMs: 1000,
	videoPath: '/tmp/video.webm',
	mergeCommand: 'ffmpeg ...',
	steps: [
		{ step: 0, title: 'Context', text: 'Bienvenue dans ce tutoriel.', key: 'invoice.context', audioFile: 'a.mp3', startMs: 0, durationMs: 2000 },
		{ step: 1, title: 'Créer la facture', text: 'Cliquez sur le bouton nouvelle facture.', key: 'invoice.create', audioFile: 'b.mp3', startMs: 2000, durationMs: 3000 },
		{ step: 2, title: 'Créer la facture', text: 'Recommencez pour la seconde facture.', key: 'invoice.create', audioFile: 'c.mp3', startMs: 5000, durationMs: 3000 },
		{ step: 3, title: 'Envoyer', text: 'Validez le montant. Le client reçoit un email automatiquement.', key: 'invoice.send', audioFile: 'd.mp3', startMs: 8000, durationMs: 2500 },
		{ step: 4, title: 'Complete', text: 'Tutoriel terminé!', audioFile: 'e.mp3', startMs: 11000, durationMs: 1500 }
	]
});

describe('buildTranscriptMarkdown', () => {
	it('renders header, context, steps with keys, and completion', () => {
		const md = buildTranscriptMarkdown(sampleTimeline());
		expect(md).toContain('# create-invoice');
		expect(md).toContain('- **Language:** fr');
		expect(md).toContain('**[Context]** Bienvenue dans ce tutoriel.');
		expect(md).toContain('**key:** `invoice.context`');
		expect(md).toContain('### Step 1: Créer la facture');
		expect(md).toContain('**key:** `invoice.create`');
		expect(md).toContain('### Step 3: Envoyer');
		expect(md).toContain('**[Complete]** Tutoriel terminé!');
		expect(md).toContain('tutorial-transcript apply');
	});

	it('skips steps without text', () => {
		const data = sampleTimeline();
		data.steps.push({ step: 5, title: 'Silent', audioFile: '', startMs: 0, durationMs: 0 });
		const md = buildTranscriptMarkdown(data);
		expect(md).not.toContain('Silent');
	});

	it('skips unvoiced steps (empty audioFile) even when they carry text', () => {
		const data = sampleTimeline();
		data.steps.splice(2, 0, { step: 2, title: 'Muet', text: 'Texte affiché mais non narré.', audioFile: '', startMs: 4000, durationMs: 0 });
		const md = buildTranscriptMarkdown(data);
		expect(md).not.toContain('Muet');
		expect(md).not.toContain('non narré');
		// Step numbering ignores the unvoiced step
		expect(md).toContain('### Step 3: Envoyer');
	});
});

describe('parseTranscript', () => {
	it('round-trips the generated markdown', () => {
		const entries = parseTranscript(buildTranscriptMarkdown(sampleTimeline()));
		expect(entries).toEqual([
			{ kind: 'context', key: 'invoice.context', text: 'Bienvenue dans ce tutoriel.' },
			{ kind: 'step', key: 'invoice.create', title: 'Créer la facture', text: 'Cliquez sur le bouton nouvelle facture.' },
			{ kind: 'step', key: 'invoice.create', title: 'Créer la facture', text: 'Recommencez pour la seconde facture.' },
			{ kind: 'step', key: 'invoice.send', title: 'Envoyer', text: 'Validez le montant. Le client reçoit un email automatiquement.' },
			{ kind: 'complete', text: 'Tutoriel terminé!' }
		]);
	});

	it('joins wrapped step body lines with spaces', () => {
		const md = [
			'### Step 1: Titre',
			'**key:** `k1`',
			'',
			'Première ligne',
			'suite de la phrase.',
			''
		].join('\n');
		const [entry] = parseTranscript(md);
		expect(entry.text).toBe('Première ligne suite de la phrase.');
	});

	it('tolerates transcripts without key lines', () => {
		const md = [
			'**[Context]** Intro sans clé.',
			'',
			'### Step 1: Titre',
			'',
			'Texte du pas.',
			''
		].join('\n');
		const entries = parseTranscript(md);
		expect(entries[0]).toEqual({ kind: 'context', text: 'Intro sans clé.' });
		expect(entries[1].key).toBeUndefined();
	});
});

describe('TranscriptCorrections matching', () => {
	const corrections = () =>
		new TranscriptCorrections(parseTranscript(buildTranscriptMarkdown(sampleTimeline())));

	it('matches by kind and key', () => {
		const c = corrections();
		expect(c.next('context', 'invoice.context')).toBe('Bienvenue dans ce tutoriel.');
		expect(c.next('step', 'invoice.send')).toContain('Validez le montant.');
		expect(c.next('complete')).toBe('Tutoriel terminé!');
	});

	it('consumes duplicate keys in file order', () => {
		const c = corrections();
		expect(c.next('step', 'invoice.create')).toBe('Cliquez sur le bouton nouvelle facture.');
		expect(c.next('step', 'invoice.create')).toBe('Recommencez pour la seconde facture.');
		expect(c.next('step', 'invoice.create')).toBeUndefined();
	});

	it('falls back to keyless entries of the same kind', () => {
		const c = new TranscriptCorrections([
			{ kind: 'step', text: 'Premier texte.' },
			{ kind: 'step', text: 'Second texte.' }
		]);
		expect(c.next('step', 'some.key')).toBe('Premier texte.');
		expect(c.next('step', 'other.key')).toBe('Second texte.');
	});
});

describe('applyCorrections', () => {
	const memoryIO = (files: Record<string, string>): ApplyIO & { files: Record<string, string> } => ({
		files,
		read: (path) => files[path] ?? null,
		write: (path, content) => { files[path] = content; }
	});

	const editTranscript = (edits: Record<string, string>): ReturnType<typeof parseTranscript> => {
		let md = buildTranscriptMarkdown(sampleTimeline());
		for (const [from, to] of Object.entries(edits)) md = md.replace(from, to);
		return parseTranscript(md);
	};

	it('replaces a single-literal narration in the test source', () => {
		const io = memoryIO({
			'e2e/invoice.spec.ts': `tutorial.step('invoice.create', action, { voiceText: 'Cliquez sur le bouton nouvelle facture.' });`
		});
		const data = sampleTimeline();
		const entries = editTranscript({
			'Cliquez sur le bouton nouvelle facture.': 'Cliquez sur le bouton bleu en haut à droite.'
		});

		const report = applyCorrections(data, entries, io);

		expect(report.applied).toHaveLength(1);
		expect(io.files['e2e/invoice.spec.ts']).toContain("'Cliquez sur le bouton bleu en haut à droite.'");
		expect(data.steps[1].text).toBe('Cliquez sur le bouton bleu en haut à droite.');
		expect(report.timelineUpdated).toBe(true);
	});

	it('replaces two-part do/explain narrations by splitting at the first sentence', () => {
		const io = memoryIO({
			'e2e/invoice.spec.ts': `tutorial.step('invoice.send', action, { do: 'Validez le montant', explain: 'Le client reçoit un email automatiquement.' });`
		});
		const data = sampleTimeline();
		const entries = editTranscript({
			'Validez le montant. Le client reçoit un email automatiquement.':
				'Vérifiez puis validez le montant. Le client est notifié par email dans la minute.'
		});

		const report = applyCorrections(data, entries, io);

		expect(report.applied).toHaveLength(1);
		expect(io.files['e2e/invoice.spec.ts']).toContain("do: 'Vérifiez puis validez le montant'");
		expect(io.files['e2e/invoice.spec.ts']).toContain("explain: 'Le client est notifié par email dans la minute.'");
	});

	it('escapes quotes matching the source delimiter', () => {
		const io = memoryIO({
			'e2e/invoice.spec.ts': `tutorial.step('invoice.create', action, { voiceText: 'Cliquez sur le bouton nouvelle facture.' });`
		});
		const entries = editTranscript({
			'Cliquez sur le bouton nouvelle facture.': "Cliquez sur l'icône de facture."
		});

		const report = applyCorrections(sampleTimeline(), entries, io);

		expect(report.applied).toHaveLength(1);
		expect(io.files['e2e/invoice.spec.ts']).toContain("voiceText: 'Cliquez sur l\\'icône de facture.'");
	});

	it('finds escaped literals in the source', () => {
		const io = memoryIO({
			'e2e/invoice.spec.ts': `tutorial.step('k', action, { voiceText: 'C\\'est parti.' });`
		});
		const data = sampleTimeline();
		data.steps = [{ step: 1, title: 'Go', text: "C'est parti.", key: 'k', audioFile: 'a', startMs: 0, durationMs: 1 }];
		const entries = parseTranscript('### Step 1: Go\n**key:** `k`\n\nOn démarre.\n');

		const report = applyCorrections(data, entries, io);

		expect(report.applied).toHaveLength(1);
		expect(io.files['e2e/invoice.spec.ts']).toContain("voiceText: 'On démarre.'");
	});

	it('reports i18n-sourced texts for manual correction instead of touching the file', () => {
		const source = `tutorial.context('invoice.context');`;
		const io = memoryIO({ 'e2e/invoice.spec.ts': source });
		const entries = editTranscript({
			'Bienvenue dans ce tutoriel.': 'Bienvenue dans cette démonstration.'
		});

		const report = applyCorrections(sampleTimeline(), entries, io);

		expect(report.applied).toHaveLength(0);
		expect(report.manual).toHaveLength(1);
		expect(report.manual[0].reason).toContain('invoice.context');
		expect(io.files['e2e/invoice.spec.ts']).toBe(source);
	});

	it('counts untouched narrations as unchanged and is idempotent', () => {
		const io = memoryIO({
			'e2e/invoice.spec.ts': `t.step('invoice.create', a, { voiceText: 'Cliquez sur le bouton nouvelle facture.' });`
		});
		const data = sampleTimeline();
		const entries = editTranscript({
			'Cliquez sur le bouton nouvelle facture.': 'Nouveau texte.'
		});

		const first = applyCorrections(data, entries, io);
		expect(first.applied).toHaveLength(1);
		expect(first.unchanged).toBe(4);

		// Second run with the same edited transcript: timeline now matches, nothing to do.
		const second = applyCorrections(data, editTranscript({
			'Cliquez sur le bouton nouvelle facture.': 'Nouveau texte.'
		}), io);
		expect(second.applied).toHaveLength(0);
		expect(second.manual).toHaveLength(0);
	});

	it('edits only the free half when the first sentence is the verbatim step key', () => {
		const source = `tutorial.context('welcome', { text: 'Bienvenue dans ce tutoriel.' });`;
		const io = memoryIO({ 'e2e/invoice.spec.ts': source });
		const data = sampleTimeline();
		data.steps = [{ step: 0, title: 'Context', text: 'welcome. Bienvenue dans ce tutoriel.', key: 'welcome', audioFile: 'a', startMs: 0, durationMs: 1 }];

		// Editing the text half works…
		const ok = applyCorrections(data, parseTranscript(
			'**[Context]** welcome. Bienvenue dans cette démo.\n**key:** `welcome`\n'
		), io);
		expect(ok.applied).toHaveLength(1);
		expect(io.files['e2e/invoice.spec.ts']).toContain("text: 'Bienvenue dans cette démo.'");

		// …but editing the key half is refused, so the key literal stays intact.
		const blocked = applyCorrections(data, parseTranscript(
			'**[Context]** Accueil. Bienvenue dans cette démo.\n**key:** `welcome`\n'
		), io);
		expect(blocked.applied).toHaveLength(0);
		expect(blocked.manual[0].reason).toContain('step key');
		expect(io.files['e2e/invoice.spec.ts']).toContain("'welcome'");
	});

	it('reports transcript entries that match no step', () => {
		const data = sampleTimeline();
		const io = memoryIO({ 'e2e/invoice.spec.ts': '' });
		const entries = [
			...parseTranscript(buildTranscriptMarkdown(data)),
			{ kind: 'step' as const, key: 'ghost.key', text: 'Texte fantôme.' }
		];

		const report = applyCorrections(data, entries, io);
		expect(report.manual.some(m => m.reason.includes('matches no narrated step'))).toBe(true);
	});
});
