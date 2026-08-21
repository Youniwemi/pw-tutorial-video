import { cpSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { buildEmbedFiles } from './embed.js';
import type { SiteConfig, VideoManifest } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function scaffold(config: SiteConfig, manifest: VideoManifest, tempDir: string): string {
	const templateDir = join(__dirname, '..', '..', 'templates', 'site');

	mkdirSync(tempDir, { recursive: true });
	cpSync(templateDir, tempDir, { recursive: true });

	const siteConfigData: {
		title: string;
		logo?: string;
		primaryColor: string;
		font: string;
		baseUrl: string;
		lang: string;
		stepsLayout: string;
		showStrip: boolean;
	} = {
		title: config.title,
		logo: config.logo,
		primaryColor: config.primaryColor,
		font: config.font,
		baseUrl: config.baseUrl,
		lang: config.lang,
		stepsLayout: config.tutorials?.stepsLayout || 'text',
		showStrip: config.tutorials?.showStrip !== false
	};

	if (config.logo && existsSync(config.logo)) {
		const logoExt = config.logo.split('.').pop();
		mkdirSync(join(tempDir, 'public'), { recursive: true });
		cpSync(config.logo, join(tempDir, 'public', `logo.${logoExt}`));
		siteConfigData.logo = `/logo.${logoExt}`;
	}

	mkdirSync(join(tempDir, 'src', 'data'), { recursive: true });
	writeFileSync(join(tempDir, 'src', 'data', 'site-config.json'), JSON.stringify(siteConfigData, null, 2));
	writeFileSync(join(tempDir, 'src', 'data', 'tutorials.json'), JSON.stringify(manifest, null, 2));

	// In-app widget data: one JSON payload per tutorial + an index, served
	// next to widget.js (template public/) so any app can embed tutorials.
	const embedDir = join(tempDir, 'public', 'embed');
	mkdirSync(embedDir, { recursive: true });
	for (const file of buildEmbedFiles(manifest, config)) {
		writeFileSync(join(tempDir, 'public', file.path), JSON.stringify(file.data, null, 2));
	}

	const videosDir = join(resolve(config.input), 'videos');
	const publicVideos = join(tempDir, 'public', 'videos');
	if (existsSync(videosDir)) {
		mkdirSync(publicVideos, { recursive: true });
		cpSync(videosDir, publicVideos, { recursive: true });
	}

	let siteDirective = '';
	let baseDirective = '';
	if (config.baseUrl && config.baseUrl.startsWith('http')) {
		siteDirective = `site: ${JSON.stringify(config.baseUrl)},`;
		try {
			const basePath = new URL(config.baseUrl).pathname;
			if (basePath && basePath !== '/') {
				baseDirective = `base: ${JSON.stringify(basePath)},`;
			}
		} catch { /* invalid URL, skip */ }
	}

	const astroConfig = `import { defineConfig } from 'astro/config';

export default defineConfig({
  srcDir: './src',
  publicDir: './public',
  outDir: './dist',
  ${siteDirective}
  ${baseDirective}
  build: { assets: 'assets' },
});
`;
	writeFileSync(join(tempDir, 'astro.config.mjs'), astroConfig);

	writeFileSync(
		join(tempDir, 'package.json'),
		JSON.stringify({ name: 'tutorial-site-build', type: 'module', private: true }, null, 2)
	);

	return tempDir;
}
