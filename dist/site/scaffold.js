import { cpSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export function scaffold(config, manifest, tempDir) {
    const templateDir = join(__dirname, '..', '..', 'templates', 'site');
    mkdirSync(tempDir, { recursive: true });
    cpSync(templateDir, tempDir, { recursive: true });
    const siteConfigData = {
        title: config.title,
        logo: config.logo,
        primaryColor: config.primaryColor,
        font: config.font,
        baseUrl: config.baseUrl,
        lang: config.lang
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
    const videosDir = join(resolve(config.input), 'videos');
    const publicVideos = join(tempDir, 'public', 'videos');
    if (existsSync(videosDir)) {
        mkdirSync(publicVideos, { recursive: true });
        cpSync(videosDir, publicVideos, { recursive: true });
    }
    const astroConfig = `import { defineConfig } from 'astro/config';

export default defineConfig({
  srcDir: './src',
  publicDir: './public',
  outDir: './dist',
  ${config.baseUrl && config.baseUrl.startsWith('http') ? `site: ${JSON.stringify(config.baseUrl)},` : ''}
  build: { assets: 'assets' },
});
`;
    writeFileSync(join(tempDir, 'astro.config.mjs'), astroConfig);
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'tutorial-site-build', type: 'module', private: true }, null, 2));
    return tempDir;
}
//# sourceMappingURL=scaffold.js.map