/**
 * Gallery config for this repo's own demo site, deployed by
 * .github/workflows/deploy-site.yml to GitHub Pages under /gallery/.
 *
 * @type {import('pw-tutorial-video/site').SiteConfig}
 */
export default {
	title: 'pw-tutorial-video — Demo Gallery',
	primaryColor: '#6366f1',
	font: 'system-ui, -apple-system, sans-serif',
	input: 'tutorials/',
	output: 'tutorial-site-dist/',
	// Full URL including the /gallery/ path: Astro derives site + base from it,
	// so every asset link works under the GitHub Pages sub-path.
	baseUrl: 'https://youniwemi.github.io/pw-tutorial-video/gallery/',
	lang: 'en',
	tutorials: {
		ui: {
			heroTitle: 'pw-tutorial-video in action',
			heroSubtitle:
				'Every video below was generated in CI from the Playwright e2e tests of this repository — no screen recording, no editing.'
		}
	}
};
