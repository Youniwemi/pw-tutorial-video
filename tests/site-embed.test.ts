import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildEmbedFiles, buildEmbedTutorial } from '../src/site/embed.js';
import { scaffold } from '../src/site/scaffold.js';
import type { SiteConfig, VideoManifest, VideoManifestEntry } from '../src/site/types.js';

const config: SiteConfig = {
	title: 'Docs',
	primaryColor: '#16a34a',
	font: 'system-ui',
	input: 'tutorials/',
	output: 'dist/',
	baseUrl: 'https://tutorials.example.com/gallery/',
	lang: 'fr,en'
};

const video: VideoManifestEntry = {
	id: 'create-account',
	category: 'getting-started',
	title: 'Créer un compte',
	duration: '1:24',
	premium: false,
	file: 'create-account.webm',
	uploadDate: '2026-08-21',
	steps: 2,
	description: 'Bienvenue dans ce tutoriel.',
	stepsDetail: [
		{ n: 1, title: 'Inscription', text: 'Cliquez sur inscription.', image: 'create-account-step-1.webp' },
		{ text: 'Passons à la configuration.', context: true },
		{ n: 3, title: 'Configurer', text: 'Renseignez vos informations.' }
	]
};

const manifest: VideoManifest = {
	categories: { 'getting-started': { icon: '⭐', label: 'Getting started' } },
	videos: [video, { ...video, id: 'create-account-mobile', variant: 'mobile', stepsDetail: undefined }],
	ui: { heroTitle: 'Docs', heroSubtitle: 'Tutorials' }
};

describe('buildEmbedTutorial', () => {
	it('builds a widget payload with site-relative paths and sequential step numbers', () => {
		const payload = buildEmbedTutorial(video, config);

		expect(payload).toEqual({
			id: 'create-account',
			title: 'Créer un compte',
			description: 'Bienvenue dans ce tutoriel.',
			duration: '1:24',
			lang: 'fr',
			accent: '#16a34a',
			video: 'videos/create-account.webm',
			poster: 'videos/create-account-step-1.webp',
			page: 'create-account/',
			steps: [
				{ num: 1, title: 'Inscription', text: 'Cliquez sur inscription.', image: 'videos/create-account-step-1.webp' },
				{ text: 'Passons à la configuration.', context: true },
				// display number is sequential — contexts don't count, timeline gaps close
				{ num: 2, title: 'Configurer', text: 'Renseignez vos informations.' }
			]
		});
	});

	it('handles entries without steps, description or poster', () => {
		const bare = buildEmbedTutorial({ ...video, description: undefined, stepsDetail: undefined }, config);
		expect(bare.steps).toEqual([]);
		expect(bare.description).toBeUndefined();
		expect(bare.poster).toBeUndefined();
	});
});

describe('buildEmbedFiles', () => {
	it('emits one payload per tutorial plus an index of slugs', () => {
		const files = buildEmbedFiles(manifest, config);

		expect(files.map((f) => f.path)).toEqual([
			'embed/create-account.json',
			'embed/create-account-mobile.json',
			'embed/index.json'
		]);
		const index = files[2].data as { tutorials: { id: string; variant?: string }[] };
		expect(index.tutorials).toEqual([
			{ id: 'create-account', title: 'Créer un compte', duration: '1:24' },
			{ id: 'create-account-mobile', title: 'Créer un compte', duration: '1:24', variant: 'mobile' }
		]);
	});
});

describe('scaffold widget output', () => {
	const tempDir = join(tmpdir(), `pw-tutorial-embed-test-${process.pid}`);

	afterEach(() => rmSync(tempDir, { recursive: true, force: true }));

	it('ships widget.js and the embed JSON files in public/', () => {
		scaffold(config, manifest, tempDir);

		expect(existsSync(join(tempDir, 'public', 'widget.js'))).toBe(true);
		const payload = JSON.parse(readFileSync(join(tempDir, 'public', 'embed', 'create-account.json'), 'utf-8'));
		expect(payload.video).toBe('videos/create-account.webm');
		const index = JSON.parse(readFileSync(join(tempDir, 'public', 'embed', 'index.json'), 'utf-8'));
		expect(index.tutorials).toHaveLength(2);
	});
});
