import { devices } from '@playwright/test';
/**
 * Playwright `test.use()` options for recording the mobile variant of a
 * tutorial: N phone-sized panes side by side. Inert unless
 * `TUTORIAL_VARIANT=mobile`, so the same spec records desktop and mobile.
 *
 * Must be passed to `test.use()` at the top of the spec — the video size is
 * frozen when the browser context is created, a later `setViewportSize`
 * would not resize the recording.
 *
 * Only the viewport (and video size in tutorial mode) is widened; the other
 * device traits (userAgent, deviceScaleFactor, isMobile…) stay whatever the
 * consuming playwright.config sets.
 *
 * @param scenes number of phones side by side (1 for a single-scene tutorial)
 * @param device a Playwright device name (default 'Pixel 7') or an explicit viewport
 */
export function mobileStage(scenes = 1, device = 'Pixel 7') {
    if (process.env.TUTORIAL_VARIANT !== 'mobile')
        return {};
    const base = typeof device === 'string' ? devices[device]?.viewport : device;
    if (!base)
        throw new Error(`[Tutorial] Unknown Playwright device "${device}"`);
    const viewport = { width: base.width * scenes, height: base.height };
    return {
        viewport,
        ...(process.env.TUTORIAL_MODE === 'true' ? { video: { mode: 'on', size: viewport } } : {})
    };
}
//# sourceMappingURL=stage-presets.js.map