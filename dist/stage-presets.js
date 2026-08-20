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
 * The viewport is widened to N phones; in tutorial mode the video is recorded
 * oversampled (see {@link MobileStageOptions.scale}) for a sharp result. Other
 * device traits (userAgent, isMobile…) stay whatever the consuming
 * playwright.config sets.
 *
 * @param scenes number of phones side by side (1 for a single-scene tutorial)
 * @param device a Playwright device name (default 'Pixel 7') or an explicit viewport
 * @param options scale / extra launch args, see {@link MobileStageOptions}
 */
export function mobileStage(scenes = 1, device = 'Pixel 7', options = {}) {
    if (process.env.TUTORIAL_VARIANT !== 'mobile')
        return {};
    const base = typeof device === 'string' ? devices[device]?.viewport : device;
    if (!base)
        throw new Error(`[Tutorial] Unknown Playwright device "${device}"`);
    const scale = options.scale ?? 2;
    const viewport = { width: base.width * scenes, height: base.height };
    if (process.env.TUTORIAL_MODE !== 'true')
        return { viewport };
    return {
        viewport,
        // The window must actually render at `scale`× — Playwright pastes frames onto
        // the video canvas without upscaling (gray padding otherwise). The emulated
        // deviceScaleFactor is aligned with the window's so screenshots match.
        deviceScaleFactor: scale,
        launchOptions: {
            args: [`--force-device-scale-factor=${scale}`, ...(options.launchArgs ?? [])]
        },
        video: {
            mode: 'on',
            size: { width: viewport.width * scale, height: viewport.height * scale }
        }
    };
}
//# sourceMappingURL=stage-presets.js.map