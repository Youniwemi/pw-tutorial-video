import { describe, it, expect } from 'vitest';
import { buildStepsDetail } from '../src/site/generate-manifest.js';
import type { ScannedTutorial } from '../src/site/scan-tutorials.js';
import type { TimelineData, TimelineStep } from '../src/timeline.js';

const step = (n: number, title: string, text?: string): TimelineStep => ({
	step: n,
	title,
	...(text ? { text } : {}),
	audioFile: text ? `audio-${n}.mp3` : '',
	startMs: n * 1000,
	durationMs: 2000
});

const context = (text: string): TimelineStep => ({ ...step(0, 'Context', text) });

const makeTutorial = (steps: TimelineStep[], shots: { n: number; file: string }[]): ScannedTutorial => ({
	timeline: {
		testName: 'demo',
		testTitle: 'demo',
		testFile: 'demo.spec.ts',
		projectName: 'chromium',
		lang: 'fr',
		totalDurationMs: 60000,
		videoTrimMs: 0,
		steps,
		videoPath: '',
		mergeCommand: ''
	} as TimelineData,
	videoFile: 'demo.webm',
	stepScreenshots: shots
});

describe('buildStepsDetail', () => {
	it('merges timeline narration with screenshots by step number', () => {
		const t = makeTutorial(
			[
				context('Bienvenue dans ce tutoriel.'),
				step(1, 'Créer un compte', 'Cliquez sur inscription. Aucune carte requise.'),
				step(2, 'Configurer', 'Renseignez vos informations.'),
				step(3, 'Complete', 'Voilà, terminé !')
			],
			[
				{ n: 1, file: 'demo-step-1.webp' },
				{ n: 2, file: 'demo-step-2.webp' }
			]
		);

		const { description, stepsDetail } = buildStepsDetail(t);

		expect(description).toBe('Bienvenue dans ce tutoriel.');
		expect(stepsDetail).toEqual([
			{ n: 1, title: 'Créer un compte', text: 'Cliquez sur inscription. Aucune carte requise.', image: 'demo-step-1.webp' },
			{ n: 2, title: 'Configurer', text: 'Renseignez vos informations.', image: 'demo-step-2.webp' }
		]);
	});

	it('keeps mid-flow contexts as unnumbered entries and inserts screenshot-only steps in position', () => {
		const t = makeTutorial(
			[
				context('Intro.'),
				step(1, 'Premier pas', 'Faites ceci.'),
				context('Passons à la configuration.'),
				step(3, 'Troisième pas', 'Faites cela.')
			],
			[
				{ n: 1, file: 'demo-step-1.webp' },
				{ n: 2, file: 'demo-step-2.webp' },
				{ n: 3, file: 'demo-step-3.webp' }
			]
		);

		const { description, stepsDetail } = buildStepsDetail(t);

		expect(description).toBe('Intro.');
		// Step 2 was non-voiced (no timeline entry) — its screenshot still lands
		// between steps 1 and 3.
		expect(stepsDetail.map((s) => s.n)).toEqual([1, undefined, 2, 3]);
		expect(stepsDetail[1]).toEqual({ text: 'Passons à la configuration.', context: true });
		expect(stepsDetail[2]).toEqual({ n: 2, image: 'demo-step-2.webp' });
	});

	it('shows text for unvoiced timeline steps (empty audioFile)', () => {
		const unvoiced: TimelineStep = { step: 2, title: 'Étape muette', text: 'Texte affiché sans narration.', audioFile: '', startMs: 5000, durationMs: 0 };
		const t = makeTutorial(
			[step(1, 'Premier', 'Faites ceci.'), unvoiced],
			[
				{ n: 1, file: 'demo-step-1.webp' },
				{ n: 2, file: 'demo-step-2.webp' }
			]
		);

		const { stepsDetail } = buildStepsDetail(t);

		expect(stepsDetail[1]).toEqual({
			n: 2,
			title: 'Étape muette',
			text: 'Texte affiché sans narration.',
			image: 'demo-step-2.webp'
		});
	});

	it('handles a video with no timeline (screenshots only)', () => {
		const t = makeTutorial([], [
			{ n: 1, file: 'demo-step-1.webp' },
			{ n: 2, file: 'demo-step-2.webp' }
		]);

		const { description, stepsDetail } = buildStepsDetail(t);

		expect(description).toBeUndefined();
		expect(stepsDetail).toEqual([
			{ n: 1, image: 'demo-step-1.webp' },
			{ n: 2, image: 'demo-step-2.webp' }
		]);
	});

	it('joins multiple leading contexts into the description', () => {
		const t = makeTutorial(
			[context('Première phrase.'), context('Deuxième phrase.'), step(1, 'Go', 'Allons-y.')],
			[]
		);

		const { description, stepsDetail } = buildStepsDetail(t);

		expect(description).toBe('Première phrase. Deuxième phrase.');
		expect(stepsDetail).toEqual([{ n: 1, title: 'Go', text: 'Allons-y.' }]);
	});
});
