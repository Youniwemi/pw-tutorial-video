// Local container override (NOT committed): repo config + the pre-installed
// Chromium, because the pinned @playwright/test expects another browser revision.
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
	...base,
	use: {
		...base.use,
		launchOptions: { executablePath: '/opt/pw-browsers/chromium' }
	}
});
