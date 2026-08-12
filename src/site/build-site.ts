import { existsSync, writeFileSync, cpSync, rmSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { scanTutorials } from './scan-tutorials.js';
import { generateManifest } from './generate-manifest.js';
import { scaffold } from './scaffold.js';
import type { SiteConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CONFIG: SiteConfig = {
	title: 'Tutorials',
	primaryColor: '#6366f1',
	font: 'system-ui, -apple-system, sans-serif',
	input: 'tutorials/',
	output: 'tutorial-site-dist/',
	baseUrl: '/',
	lang: 'fr'
};

function ask(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((res) => {
		rl.question(question, (answer) => {
			rl.close();
			res(answer.trim().toLowerCase());
		});
	});
}

export async function buildSite(configPath?: string) {
	const resolvedConfigPath = resolve(configPath || join(process.cwd(), 'tutorial-site.config.js'));

	let config: SiteConfig;

	if (existsSync(resolvedConfigPath)) {
		console.log(`  Using config: ${resolvedConfigPath}`);
		const imported = await import(pathToFileURL(resolvedConfigPath).href);
		config = { ...DEFAULT_CONFIG, ...imported.default };
	} else {
		console.log('  No config file found. Generating tutorial-site.config.js with defaults...');
		const configContent = `/** @type {import('pw-tutorial-video/site').SiteConfig} */
export default ${JSON.stringify(DEFAULT_CONFIG, null, 2)};
`;
		writeFileSync(resolvedConfigPath, configContent);
		console.log(`  Created ${resolvedConfigPath}`);

		const answer = await ask('  Continue with defaults? [Y/n] ');
		if (answer && answer !== 'y' && answer !== 'yes') {
			console.log('  Edit the config file, then re-run build-site.');
			return;
		}
		config = { ...DEFAULT_CONFIG };
	}

	config.input = resolve(config.input);
	config.output = resolve(config.output);

	console.log(`\n  Scanning ${config.input} for tutorials...`);
	const tutorials = scanTutorials(config.input);

	if (tutorials.length === 0) {
		console.error(
			'  No tutorials found. Make sure you have _timeline.json files in the output/ subdirectory and .webm files in the videos/ subdirectory.'
		);
		process.exit(1);
	}

	console.log(`  Found ${tutorials.length} tutorial(s).`);

	const manifest = generateManifest(tutorials, config);
	console.log(
		`  Generated manifest: ${manifest.videos.length} videos, ${Object.keys(manifest.categories).length} categories.`
	);

	const tempDir = join(config.output, '.astro-build');
	console.log('  Scaffolding Astro project...');
	scaffold(config, manifest, tempDir);

	console.log('  Building static site...');
	try {
		const astroBin = join(__dirname, '..', '..', 'node_modules', '.bin', 'astro');
		execSync(`${astroBin} build`, {
			cwd: tempDir,
			stdio: 'inherit',
			env: { ...process.env, NODE_ENV: 'production' }
		});
	} catch {
		console.error('  Astro build failed.');
		process.exit(1);
	}

	cpSync(join(tempDir, 'dist'), config.output, { recursive: true });
	rmSync(tempDir, { recursive: true, force: true });

	console.log(`\n  ✓ Site built to ${config.output}`);
	console.log(`  Open ${join(config.output, 'index.html')} to preview.\n`);
}
