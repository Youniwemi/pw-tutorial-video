import { readFileSync, unlinkSync, existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { renderStage } from './overlay-html.js';
import { TutorialVoice } from './voice.js';
import { TutorialMusic } from './music.js';
import { TutorialCursor } from './cursor.js';
import { TutorialOverlay } from './overlay.js';
import { TutorialTimeline } from './timeline.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TUTORIAL_MODE = process.env.TUTORIAL_MODE === 'true';
const TUTORIAL_VOICE = process.env.TUTORIAL_VOICE !== 'false';
const TUTORIAL_VOICE_NAME = process.env.TUTORIAL_VOICE_NAME;
const TUTORIAL_OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || 'tutorials/output';
const DEFAULT_AUDIO_BASE_URL = 'http://localhost:5173';
const DEFAULT_MUSIC_URL_PATH = '/audio/tutorial-background.mp3';
const TUTORIAL_MUSIC = process.env.TUTORIAL_MUSIC;
const TUTORIAL_MUSIC_VOLUME = parseFloat(process.env.TUTORIAL_MUSIC_VOLUME || '0.15');
const TUTORIAL_VOICE_VOLUME = parseFloat(process.env.TUTORIAL_VOICE_VOLUME || '2.5');
const DEFAULT_STYLES = readFileSync(join(__dirname, 'styles.css'), 'utf-8');
let _sharp = null;
async function getSharp() {
    if (_sharp !== null)
        return _sharp;
    try {
        _sharp = (await import('sharp')).default;
        return _sharp;
    }
    catch {
        return null;
    }
}
/**
 * When to start a step's action inside its narration clip (option B of
 * docs/narration-action-overlap.md — one merged clip, computed offset).
 *
 * Two-phase (`doText` known): character-share estimate of where the "do"
 * sentence ends — `duration × (len(do) + 2) / len(full)` (the +2 is the
 * ". " separator). Single-phase: fixed 25% of the clip.
 */
export function narrationActionOffset(durationMs, fullText, doText) {
    if (!doText || !fullText || doText.length >= fullText.length) {
        return Math.round(durationMs * 0.25);
    }
    const fraction = Math.min(1, (doText.length + 2) / fullText.length);
    return Math.round(durationMs * fraction);
}
const asList = (focus) => (Array.isArray(focus) ? focus : [focus]);
export class Tutorial {
    page;
    // Scene and variant options are kept in their own fields below, not in this bag.
    options;
    initialized = false;
    testName;
    translateFn;
    voice;
    music;
    cursor;
    overlay;
    timeline;
    pendingItems = [];
    stepCounter = 0;
    videoStartTime = 0;
    scenes;
    activeScenes = [];
    sceneTransitionMs;
    variant;
    /** Mobile multi-scene: every scene stays on stage, focus() only marks the active one. */
    pinnedSplit = false;
    constructor(page, options) {
        this.page = page;
        // Env read here, not at module load, so tests can stub it per-instance.
        this.variant = options.variant ?? (process.env.TUTORIAL_VARIANT || undefined);
        const baseName = options.testName ?? `tutorial_${Date.now()}`;
        this.testName = this.variant && options.testName ? `${baseName}-${this.variant}` : baseName;
        this.translateFn = options.translate ?? ((k) => k);
        const audioBaseUrl = options.audioBaseUrl ?? DEFAULT_AUDIO_BASE_URL;
        const defaultMusicUrl = TUTORIAL_MUSIC ?? '';
        this.options = {
            title: options.title,
            testFile: options.testFile ?? '',
            projectName: options.projectName ?? '',
            testName: this.testName,
            testTitle: options.testTitle,
            feature: options.feature,
            lang: options.lang ?? 'en',
            audioBaseUrl,
            stepDelay: options.stepDelay ?? 500,
            highlightDuration: options.highlightDuration ?? 800,
            mouseSteps: options.mouseSteps ?? 25,
            pauseBeforeClick: options.pauseBeforeClick ?? 300,
            enableVoice: options.enableVoice ?? TUTORIAL_VOICE,
            voiceName: options.voiceName ?? TUTORIAL_VOICE_NAME ?? '',
            voiceRate: options.voiceRate ?? 1.0,
            voicePitch: options.voicePitch ?? 1,
            backgroundMusic: options.backgroundMusic ?? defaultMusicUrl,
            musicVolume: options.musicVolume ?? TUTORIAL_MUSIC_VOLUME,
            voiceVolume: options.voiceVolume ?? TUTORIAL_VOICE_VOLUME,
            customStyles: options.customStyles ?? '',
            playAudioInBrowser: options.playAudioInBrowser ?? true,
            overlayPosition: options.overlayPosition ?? 'TR'
        };
        this.voice = new TutorialVoice(page, {
            lang: this.options.lang,
            voiceName: this.options.voiceName,
            voiceRate: this.options.voiceRate,
            voicePitch: this.options.voicePitch,
            playInBrowser: this.options.playAudioInBrowser,
            audioBaseUrl
        });
        this.music = new TutorialMusic(page, {
            backgroundMusic: this.options.backgroundMusic,
            musicVolume: this.options.musicVolume
        });
        this.cursor = new TutorialCursor(page, {
            mouseSteps: this.options.mouseSteps,
            pauseBeforeClick: this.options.pauseBeforeClick
        });
        this.overlay = new TutorialOverlay(page, {
            title: this.options.title,
            lang: this.options.lang,
            highlightDuration: this.options.highlightDuration,
            position: this.options.overlayPosition ?? 'TR'
        });
        this.timeline = new TutorialTimeline(this.testName, this.options.testFile, this.options.projectName, this.options.lang, options.testTitle ?? '', options.feature ?? '', {
            musicFile: this.options.backgroundMusic?.startsWith('http')
                ? 'static/audio/tutorial-background.mp3'
                : this.options.backgroundMusic,
            musicVolume: this.options.musicVolume,
            voiceVolume: this.options.voiceVolume
        }, this.options.title, this.variant ?? '');
        this.scenes = options.scenes ?? {};
        this.sceneTransitionMs = options.sceneTransition?.duration ?? 600;
        const sceneNames = Object.keys(this.scenes);
        if (sceneNames.length > 0) {
            this.activeScenes = asList(options.focus ?? sceneNames[0]);
            this.activeScenes.forEach((name) => this.requireScene(name));
        }
        this.pinnedSplit = this.variant === 'mobile' && sceneNames.length > 1;
        this.videoStartTime = Date.now();
    }
    // ── Scenes ──────────────────────────────────────────────────────────
    // Scene plumbing runs in both modes: it is the stage, not the decoration.
    requireScene(name) {
        const scene = this.scenes[name];
        if (!scene) {
            const known = Object.keys(this.scenes).join(', ') || 'none declared';
            throw new Error(`[Tutorial] Unknown scene "${name}" (known: ${known})`);
        }
        return scene;
    }
    /**
     * Mount the stage: a tab bar plus one iframe per scene.
     *
     * The parent page is loaded from `audioBaseUrl` first, because setContent
     * keeps the current origin — that is what lets narration audio load without
     * cross-origin friction, with no stage file to deploy.
     */
    async stage() {
        if (Object.keys(this.scenes).length === 0) {
            throw new Error('[Tutorial] stage() requires `scenes` in the constructor options');
        }
        await this.page.goto(this.options.audioBaseUrl);
        await this.page.setContent(renderStage(this.scenes, this.activeScenes, this.pinnedSplit));
        await this.ensureStyles();
        await this.initialize();
    }
    /** A scene is a plain FrameLocator — the whole Playwright locator API. */
    scene(name) {
        this.requireScene(name);
        return this.page.frameLocator(`[data-tutorial-frame="${name}"]`);
    }
    /** Navigate a scene. Relative paths resolve against its baseUrl; an absolute
     *  URL is honoured as-is, so a scene may change origin mid-tutorial. */
    async goto(name, url) {
        const scene = this.requireScene(name);
        const target = scene.baseUrl ? new URL(url, scene.baseUrl).toString() : url;
        await this.page.evaluate(({ frame, href }) => {
            const el = document.querySelector(`[data-tutorial-frame="${frame}"]`);
            el.src = href;
        }, { frame: name, href: target });
        // Cross-origin: contentDocument is unreadable, so wait through the frame.
        await this.scene(name).locator('body').waitFor({ state: 'attached' });
    }
    /**
     * Bring scene(s) to the stage. One fills it; two share it side by side.
     * The cursor is hidden across the switch so it never streaks between panes.
     */
    async focus(target, options) {
        const names = asList(target);
        names.forEach((name) => this.requireScene(name));
        if (TUTORIAL_MODE && this.initialized)
            await this.cursor.hide();
        const ratios = options?.ratio ?? names.map(() => 1);
        await this.page.evaluate(({ active, ratios, pinned }) => {
            const stage = document.getElementById('tutorial-stage');
            if (stage)
                stage.setAttribute('data-split', String(pinned || active.length > 1));
            document.querySelectorAll('[data-tutorial-tab]').forEach((el) => {
                const name = el.getAttribute('data-tutorial-tab');
                el.setAttribute('data-active', String(active.includes(name)));
            });
            document.querySelectorAll('[data-tutorial-scene]').forEach((el) => {
                const name = el.getAttribute('data-tutorial-scene');
                const idx = active.indexOf(name);
                const isActive = idx !== -1;
                el.setAttribute('data-active', String(isActive));
                // Pinned split (mobile): every phone keeps its equal width — no inline flex.
                if (!pinned)
                    el.style.flex = isActive ? `${ratios[idx]} 1 0` : '';
            });
        }, { active: names, ratios, pinned: this.pinnedSplit });
        this.activeScenes = names;
        await this.page.waitForTimeout(TUTORIAL_MODE ? this.sceneTransitionMs : 0);
        if (TUTORIAL_MODE && this.initialized)
            await this.cursor.ensureVisible();
    }
    /** What to stamp on a timeline entry: a bare name, or a pair when two
     *  scenes shared the stage. Undefined for single-scene tutorials. */
    get stagedScene() {
        if (this.activeScenes.length === 0)
            return undefined;
        return this.activeScenes.length === 1 ? this.activeScenes[0] : [...this.activeScenes];
    }
    sameFocus(target) {
        const names = asList(target);
        return (names.length === this.activeScenes.length &&
            names.every((name, i) => name === this.activeScenes[i]));
    }
    static get isEnabled() {
        return TUTORIAL_MODE;
    }
    translate(key) {
        return this.translateFn(key);
    }
    clearFields() {
        if (!TUTORIAL_MODE)
            return;
        const clearOnce = () => {
            this.page.evaluate(() => {
                document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea').forEach(el => { el.value = ''; });
            }).catch(() => { });
            this.page.off('load', clearOnce);
        };
        this.page.on('load', clearOnce);
    }
    get hasSteps() {
        return this.stepCounter > 0;
    }
    get stepCount() {
        return this.stepCounter;
    }
    switchPage(page) {
        if (!TUTORIAL_MODE)
            return;
        this.page = page;
        this.voice.switchPage(page);
        this.music.switchPage(page);
        this.cursor.switchPage(page);
        this.overlay.switchPage(page);
    }
    /** @deprecated Total steps are now calculated automatically. */
    setTotalSteps(total) {
        console.warn('[Tutorial] setTotalSteps is deprecated - total steps are calculated automatically');
        this.overlay.setTotalSteps(total);
    }
    /** @deprecated Voice preloading is now automatic when steps/contexts are added. */
    async preloadVoice(texts) {
        console.warn('[Tutorial] preloadVoice is deprecated - voice preloading is now automatic');
        if (!TUTORIAL_MODE || !this.options.enableVoice)
            return;
        await this.voice.preload(texts);
    }
    async initialize() {
        if (this.initialized || !TUTORIAL_MODE)
            return;
        await this.ensureStyles();
        // Debug overlay: paints wall-clock epoch ms into the recording so any
        // audio/video desync can be measured frame by frame on the final file.
        if (process.env.TUTORIAL_DEBUG_CLOCK === 'true') {
            await this.page.evaluate(() => {
                if (document.getElementById('tutorial-debug-clock'))
                    return;
                const el = document.createElement('div');
                el.id = 'tutorial-debug-clock';
                el.style.cssText =
                    'position:fixed;bottom:4px;left:4px;z-index:2147483647;font:bold 24px monospace;background:#000;color:#0f0;padding:2px 8px;pointer-events:none';
                document.body.appendChild(el);
                const tick = () => {
                    el.textContent = String(Date.now() % 1000000);
                    requestAnimationFrame(tick);
                };
                tick();
            }).catch(() => { });
        }
        await this.cursor.initialize();
        if (this.options.backgroundMusic && this.options.playAudioInBrowser) {
            await this.music.start();
        }
        this.initialized = true;
    }
    async ensureStyles() {
        const styles = this.options.customStyles || DEFAULT_STYLES;
        await this.page.evaluate(({ css, variant }) => {
            // The attribute scopes variant CSS (e.g. the compact mobile overlay) and
            // survives overlay re-injections, which only replace #tutorial-overlay.
            if (variant)
                document.documentElement.setAttribute('data-tutorial-variant', variant);
            if (document.getElementById('tutorial-styles'))
                return;
            const style = document.createElement('style');
            style.id = 'tutorial-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }, { css: styles, variant: this.variant ?? '' });
    }
    context(key, options) {
        if (!TUTORIAL_MODE)
            return;
        const title = this.translate(key);
        const style = options?.style ?? 'goal';
        const text = options?.text;
        const voiceText = options?.voiceText ?? (text ? `${title}. ${text}` : title);
        const voicePreload = this.options.enableVoice
            ? this.voice.preloadSingle(voiceText)
            : Promise.resolve();
        this.pendingItems.push({
            type: 'context',
            title,
            text,
            style,
            voiceText,
            voicePreload,
            key
        });
    }
    step(key, action, options) {
        const title = this.translate(key);
        if (!TUTORIAL_MODE) {
            this.pendingItems.push({
                type: 'step',
                title,
                action,
                overlayText: title,
                voiceText: title,
                voicePreload: Promise.resolve(),
                scene: options?.scene
            });
            return;
        }
        this.stepCounter++;
        let voiceText;
        let voiceDoText;
        if (options?.voiceText) {
            voiceText = options.voiceText;
            // Same sentence-boundary rule as `tutorial-transcript apply`.
            const boundary = options.voiceText.indexOf('. ');
            if (boundary > 0)
                voiceDoText = options.voiceText.slice(0, boundary);
        }
        else if (options?.do && options?.explain) {
            voiceText = `${options.do}. ${options.explain}`;
            voiceDoText = options.do;
        }
        else if (options?.do) {
            voiceText = options.do;
        }
        else if (options?.description) {
            voiceText = `${title}. ${options.description}`;
            voiceDoText = title;
        }
        else {
            voiceText = title;
        }
        const voicePreload = this.options.enableVoice && !options?.skipVoice
            ? this.voice.preloadSingle(voiceText)
            : Promise.resolve();
        this.pendingItems.push({
            type: 'step',
            title,
            action,
            overlayText: options?.do ?? title,
            overlayDescription: options?.explain ?? options?.description,
            voiceText,
            voiceDoText,
            skipVoice: options?.skipVoice,
            delay: options?.delay,
            voicePreload,
            key,
            scene: options?.scene,
            overlayPosition: options?.overlayPosition
        });
    }
    async highlight(selector, duration) {
        if (!TUTORIAL_MODE)
            return;
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await locator.scrollIntoViewIfNeeded();
        await this.cursor.moveToElement(locator);
        await this.overlay.highlight(locator, duration);
    }
    async unhighlight(selector) {
        if (!TUTORIAL_MODE)
            return;
        await this.overlay.unhighlight(selector);
    }
    async moveMouseToElement(locator) {
        if (!TUTORIAL_MODE)
            return;
        await locator.scrollIntoViewIfNeeded();
        await this.cursor.moveToElement(locator);
    }
    async moveMouse(targetX, targetY) {
        if (!TUTORIAL_MODE)
            return;
        await this.cursor.moveTo(targetX, targetY);
    }
    async animateClick() {
        if (!TUTORIAL_MODE)
            return;
        await this.cursor.animateClick();
    }
    async click(selector) {
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        if (TUTORIAL_MODE) {
            await locator.scrollIntoViewIfNeeded();
            await this.highlight(locator);
            await this.animateClick();
        }
        await locator.click();
        if (TUTORIAL_MODE)
            await this.unhighlight(locator);
    }
    async fill(selector, value) {
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        if (TUTORIAL_MODE) {
            await locator.scrollIntoViewIfNeeded();
            await this.highlight(locator);
            await this.animateClick();
        }
        await locator.fill(value);
        if (TUTORIAL_MODE)
            await this.unhighlight(locator);
    }
    async typeSlowly(selector, value, delay = 50) {
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        if (TUTORIAL_MODE) {
            await locator.scrollIntoViewIfNeeded();
            await this.highlight(locator);
            await this.animateClick();
            await locator.click({ clickCount: 3 });
            await locator.pressSequentially(value, { delay });
            await this.unhighlight(locator);
        }
        else {
            await locator.fill(value);
        }
    }
    /**
     * Type a secret into a field that stays blurred. The blur is applied before
     * the first keystroke and is NOT removed afterwards — the finished value must
     * never become readable, or the whole point is lost. Call `unblur()` if a
     * later step really needs the field legible again.
     */
    async typeBlurred(selector, value, options = {}) {
        const opts = typeof options === 'number' ? { delay: options } : options;
        const { delay = 50, blur = 4, reveal = false } = opts;
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        if (TUTORIAL_MODE) {
            await locator.scrollIntoViewIfNeeded();
            await this.highlight(locator);
            await this.animateClick();
            await locator.click({ clickCount: 3 });
            await locator.evaluate((el, px) => {
                el.style.filter = `blur(${px}px)`;
            }, blur);
            await locator.pressSequentially(value, { delay });
            if (reveal)
                await this.unblur(locator);
            await this.unhighlight(locator);
        }
        else {
            await locator.fill(value);
        }
    }
    /** Remove the blur left by `typeBlurred`. */
    async unblur(selector) {
        if (!TUTORIAL_MODE)
            return;
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await locator.evaluate((el) => {
            el.style.filter = '';
        });
    }
    async selectOption(selector, value) {
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        if (TUTORIAL_MODE) {
            await locator.scrollIntoViewIfNeeded();
            await this.highlight(locator);
            await this.animateClick();
        }
        await locator.selectOption(value);
        if (TUTORIAL_MODE)
            await this.unhighlight(locator);
    }
    async hideOverlay() {
        if (!TUTORIAL_MODE)
            return;
        await this.overlay.hide();
        await this.cursor.hide();
    }
    async showEmailPreview(options) {
        if (!TUTORIAL_MODE)
            return;
        await this.overlay.showEmailPreview(options);
        const duration = options.duration ?? 3000;
        await this.page.evaluate((durationMs) => {
            const iframe = document.querySelector('.tutorial-email-iframe');
            const doc = iframe?.contentDocument;
            const scroller = doc?.scrollingElement;
            if (!iframe || !doc || !scroller)
                return;
            const run = () => {
                const viewportH = iframe.clientHeight;
                const docH = scroller.scrollHeight;
                const maxScroll = Math.max(0, docH - viewportH);
                if (maxScroll <= 0)
                    return;
                const anchors = Array.from(doc.querySelectorAll('a[href]'));
                const cta = anchors.find((a) => a.offsetHeight > 0 && a.offsetWidth > 0) ?? null;
                let target = maxScroll;
                if (cta) {
                    const rect = cta.getBoundingClientRect();
                    const ctaTopInDoc = scroller.scrollTop + rect.top;
                    target = Math.max(0, Math.min(maxScroll, ctaTopInDoc - viewportH / 3));
                }
                const startDelay = Math.min(700, durationMs * 0.15);
                const scrollWindow = Math.max(durationMs - startDelay * 2, 500);
                const start = performance.now() + startDelay;
                const step = (now) => {
                    const t = Math.max(0, Math.min(1, (now - start) / scrollWindow));
                    const eased = 1 - Math.pow(1 - t, 2);
                    scroller.scrollTop = target * eased;
                    if (t < 1)
                        requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            };
            if (doc.readyState === 'complete')
                run();
            else
                iframe.addEventListener('load', run, { once: true });
        }, duration);
        await this.page.waitForTimeout(duration);
    }
    async hideEmailPreview() {
        if (!TUTORIAL_MODE)
            return;
        await this.overlay.hideEmailPreview();
    }
    async complete(message) {
        if (!TUTORIAL_MODE) {
            for (const item of this.pendingItems) {
                if (item.type === 'step') {
                    // Even without narration, a hidden scene is not interactive.
                    if (item.scene && !this.sameFocus(item.scene))
                        await this.focus(item.scene);
                    await item.action();
                }
            }
            return;
        }
        const defaultMessage = this.options.lang === 'fr' ? 'Tutoriel terminé!' : 'Tutorial complete!';
        const completionMessage = message || defaultMessage;
        const completionVoicePreload = this.options.enableVoice
            ? this.voice.preloadSingle(completionMessage)
            : Promise.resolve();
        const preloads = this.pendingItems.map(item => item.voicePreload);
        preloads.push(completionVoicePreload);
        await Promise.all(preloads);
        // Sync marker: recording starts at page creation and the recorder may
        // buffer several seconds before the file even exists, so no wall-clock
        // anchor (constructor time, file birthtime) reliably maps to the video's
        // t=0. Instead, flash a full-screen black frame whose END is timeline
        // zero: the reporter finds it on tape with ffmpeg blackdetect and sets
        // the exact trim. The wall-clock trim below stays as the fallback.
        const syncMarker = await this.page.evaluate(() => {
            const el = document.createElement('div');
            el.id = 'tutorial-sync-marker';
            el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:2147483647';
            (document.body ?? document.documentElement).appendChild(el);
        }).then(() => true).catch(() => false);
        if (syncMarker) {
            await this.page.waitForTimeout(500);
            await this.page.evaluate(() => {
                document.getElementById('tutorial-sync-marker')?.remove();
            }).catch(() => { });
        }
        let videoTrimMs = Date.now() - this.videoStartTime;
        try {
            const video = this.page.video();
            if (video) {
                const birthMs = statSync(await video.path()).birthtimeMs;
                if (birthMs > 0)
                    videoTrimMs = Date.now() - birthMs;
            }
        }
        catch {
            // No video or no birthtime on this platform — keep the constructor anchor.
        }
        this.timeline.start(videoTrimMs, syncMarker);
        await this.initialize();
        this.overlay.setTotalSteps(this.stepCounter);
        let currentStep = 0;
        for (const item of this.pendingItems) {
            await this.ensureStyles();
            if (item.type === 'context') {
                await this.overlay.showContext(item.title, item.text, item.style);
                if (this.options.enableVoice) {
                    // Wall clock comes from the clip's metadata duration, not from the
                    // browser "ended" event — an early/failed playback must not let the
                    // next step's narration start over this one in the mix.
                    const audioFilename = this.voice.getFilename(item.voiceText);
                    const voiceStartTime = Date.now();
                    const duration = await this.voice.startPlayback(item.voiceText);
                    this.timeline.addStep(0, 'Context', audioFilename, duration, voiceStartTime, item.voiceText, item.key, this.stagedScene);
                    const remaining = duration - (Date.now() - voiceStartTime);
                    if (remaining > 0)
                        await this.page.waitForTimeout(remaining);
                }
                await this.page.waitForTimeout(this.options.stepDelay);
            }
            else if (item.type === 'step') {
                currentStep++;
                this.overlay.setCurrentStep(currentStep);
                // Switch before narrating: the viewer should already be looking at
                // the right tab when the sentence about it starts.
                if (item.scene && !this.sameFocus(item.scene))
                    await this.focus(item.scene);
                await this.cursor.ensureVisible();
                if (this.options.backgroundMusic && this.options.playAudioInBrowser) {
                    await this.music.ensurePlaying();
                }
                await this.overlay.showStep(item.overlayText, item.overlayDescription, item.overlayPosition);
                if (this.options.enableVoice && !item.skipVoice) {
                    // Narration/action overlap (option B): start the merged clip,
                    // launch the action at the estimated end of its "do" half, then
                    // clamp wall clock to the clip duration so the next clip never
                    // overlaps in the ffmpeg mix.
                    const audioFilename = this.voice.getFilename(item.voiceText);
                    const voiceStartTime = Date.now();
                    const duration = await this.voice.startPlayback(item.voiceText);
                    this.timeline.addStep(currentStep, item.title, audioFilename, duration, voiceStartTime, item.voiceText, item.key, this.stagedScene);
                    const offset = narrationActionOffset(duration, item.voiceText, item.voiceDoText);
                    if (offset > 0)
                        await this.page.waitForTimeout(offset);
                    await item.action();
                    const remaining = duration - (Date.now() - voiceStartTime);
                    if (remaining > 0)
                        await this.page.waitForTimeout(remaining);
                }
                else {
                    await this.page.waitForTimeout(this.options.stepDelay);
                    await item.action();
                }
                await this.page.waitForTimeout(item.delay ?? 300);
                await this.captureStepScreenshot(currentStep);
            }
        }
        await this.overlay.showComplete(completionMessage);
        if (this.options.enableVoice) {
            const audioFilename = this.voice.getFilename(completionMessage);
            const voiceStartTime = Date.now();
            const duration = await this.voice.startPlayback(completionMessage);
            this.timeline.addStep(this.stepCounter + 1, 'Complete', audioFilename, duration, voiceStartTime, completionMessage, undefined, this.stagedScene);
            const remaining = duration - (Date.now() - voiceStartTime);
            if (remaining > 0)
                await this.page.waitForTimeout(remaining);
        }
        if (this.music.isInitialized) {
            await this.music.stop(true);
        }
        await this.page.waitForTimeout(2000);
        const video = this.page.video();
        if (video) {
            const videoPath = await video.path();
            this.timeline.setVideoPath(videoPath);
        }
        const outputDir = join(process.cwd(), TUTORIAL_OUTPUT_DIR);
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }
        this.timeline.save(join(outputDir, `${this.testName}_timeline.json`));
        await this.hideOverlay();
    }
    getTimeline() {
        return this.timeline.getData();
    }
    async captureStepScreenshot(stepNumber) {
        try {
            const screenshotDir = join(process.cwd(), 'tutorials/videos');
            if (!existsSync(screenshotDir)) {
                mkdirSync(screenshotDir, { recursive: true });
            }
            const sharp = await getSharp();
            if (sharp) {
                const screenshotPath = join(screenshotDir, `${this.testName}-step-${stepNumber}.webp`);
                const raw = await this.page.screenshot({ type: 'png', fullPage: false });
                const buffer = await sharp(raw).resize({ width: 500, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
                writeFileSync(screenshotPath, buffer);
                if (stepNumber === 1) {
                    const posterPath = join(screenshotDir, `${this.testName}-poster.webp`);
                    const posterBuffer = await sharp(raw).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
                    writeFileSync(posterPath, posterBuffer);
                }
                console.log(`[Tutorial] Screenshot: ${this.testName}-step-${stepNumber}.webp`);
            }
            else {
                const screenshotPath = join(screenshotDir, `${this.testName}-step-${stepNumber}.png`);
                const raw = await this.page.screenshot({ type: 'png', fullPage: false });
                writeFileSync(screenshotPath, raw);
                if (stepNumber === 1) {
                    const posterPath = join(screenshotDir, `${this.testName}-poster.png`);
                    writeFileSync(posterPath, raw);
                }
                console.log(`[Tutorial] Screenshot (PNG, install sharp for WebP): ${this.testName}-step-${stepNumber}.png`);
            }
        }
        catch (err) {
            console.warn(`[Tutorial] Screenshot failed for step ${stepNumber}: ${err.message}`);
        }
    }
    async deleteVideoIfEmpty() {
        if (!TUTORIAL_MODE)
            return false;
        if (!this.hasSteps) {
            const video = this.page.video();
            if (video) {
                try {
                    const videoPath = await video.path();
                    if (videoPath && existsSync(videoPath)) {
                        unlinkSync(videoPath);
                        console.log(`[Tutorial] Deleted empty video: ${videoPath}`);
                        return true;
                    }
                }
                catch {
                    // Video might not be saved yet
                }
            }
            console.log('[Tutorial] No steps recorded, video will be deleted');
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=Tutorial.js.map