export interface MobileStageOptions {
    /** Video oversampling factor (default 2). Playwright records video at *window*
     *  pixels and never upscales, so a phone-sized viewport yields a blurry ~400px-wide
     *  video. The scale is applied as `--force-device-scale-factor` + matching
     *  `deviceScaleFactor`, and the video size is multiplied accordingly — the page
     *  layout (CSS viewport) is unchanged. Set to 1 to record at native CSS pixels. */
    scale?: number;
    /** Extra Chromium args. `test.use()` REPLACES the config's `launchOptions`
     *  wholesale, so any arg your playwright.config sets for tutorial runs
     *  (e.g. `--autoplay-policy=no-user-gesture-required`) must be repeated here. */
    launchArgs?: string[];
}
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
export declare function mobileStage(scenes?: number, device?: string | {
    width: number;
    height: number;
}, options?: MobileStageOptions): {
    viewport?: {
        width: number;
        height: number;
    };
    deviceScaleFactor?: number;
    video?: {
        mode: 'on';
        size: {
            width: number;
            height: number;
        };
    };
    launchOptions?: {
        args: string[];
    };
};
//# sourceMappingURL=stage-presets.d.ts.map