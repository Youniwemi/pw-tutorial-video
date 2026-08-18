export interface TutorialOptions {
    /** Tutorial title shown in overlay */
    title: string;
    /** Test name for output files (default: auto-generated) */
    testName?: string;
    /** Raw test title as passed to `test(...)` — the i18n key. Used by the reporter
     *  to match this tutorial to its Playwright testCase without re-deriving. */
    testTitle?: string;
    /** Test file path (e.g., "free/01_company.init.ts") */
    testFile?: string;
    /** Playwright project name (e.g., "setup-free-init") */
    projectName?: string;
    /** Language for UI text and TTS (default: 'en') */
    lang?: string;
    /** Translation function — pass your i18n `t()`. Falls back to identity. */
    translate?: (key: string) => string;
    /** Base URL for serving audio files (default: 'http://localhost:5173') */
    audioBaseUrl?: string;
    /** Delay between steps in ms (default: 500) */
    stepDelay?: number;
    /** Duration of highlight animation in ms (default: 800) */
    highlightDuration?: number;
    /** Mouse movement speed - steps for smooth movement (default: 25) */
    mouseSteps?: number;
    /** Pause after mouse reaches target in ms (default: 300) */
    pauseBeforeClick?: number;
    /** Enable voice narration using Web Speech API */
    enableVoice?: boolean;
    /** Voice name to use (e.g., 'Google français', 'Microsoft David') */
    voiceName?: string;
    /** Voice rate (0.1 to 10, default: 0.9) */
    voiceRate?: number;
    /** Voice pitch (0 to 2, default: 1) */
    voicePitch?: number;
    /** Background music URL (relative to public folder or absolute URL) */
    backgroundMusic?: string;
    /** Background music volume (0 to 1, default: 0.15) */
    musicVolume?: number;
    /** Voice narration volume multiplier (default: 2.5) */
    voiceVolume?: number;
    /** Custom CSS to inject (overrides default styles) */
    customStyles?: string;
    /** Play audio in browser during test for live viewing (default: true) */
    playAudioInBrowser?: boolean;
    /** Feature tag (e.g., 'payroll') — sourced from @feature:* test tag */
    feature?: string;
    /** Named scenes, each an iframe of its own origin, shown as browser-like tabs.
     *  Distinct origins are what let two user profiles stay logged in at once. */
    scenes?: Record<string, SceneOptions>;
    /** Scene(s) active when the stage is mounted (default: the first one) */
    focus?: SceneFocus;
    /** Scene switch animation */
    sceneTransition?: {
        duration?: number;
    };
    /** Overlay position: TL (top-left), TR (top-right, default), BL (bottom-left), BR (bottom-right) */
    overlayPosition?: OverlayPosition;
}
export interface SceneOptions {
    /** Label shown on the scene's tab — keep it a person, not a URL */
    label: string;
    /** Origin that relative `goto` paths resolve against */
    baseUrl?: string;
}
/** One scene fills the stage; two share it side by side.
 *  In an array, the first scene is the one acting — it carries the cursor. */
export type SceneFocus = string | string[];
export interface FocusOptions {
    /** Flex ratio for each active scene, e.g. [30, 70]. Must match the number of scenes. */
    ratio?: number[];
}
export interface StepOptions {
    /** Optional description shown below step title */
    description?: string;
    /** Skip mouse movement for this step */
    skipMouse?: boolean;
    /** Custom delay after this step */
    delay?: number;
    /** Custom text for voice narration (if different from title/description) */
    voiceText?: string;
    /** Skip voice for this step */
    skipVoice?: boolean;
    /** Short action narration (defaults to title) */
    do?: string;
    /** Explanation that plays during action (two-phase timing) */
    explain?: string;
    /** Scene(s) this step plays on. The stage switches before the action runs,
     *  because a hidden scene cannot be interacted with. */
    scene?: SceneFocus;
    /** Override overlay position for this step */
    overlayPosition?: OverlayPosition;
}
export type OverlayPosition = 'TL' | 'TR' | 'BL' | 'BR';
export type ContextStyle = 'goal' | 'clarification' | 'attention';
export interface ContextOptions {
    /** Description shown below title */
    text?: string;
    /** Custom voice text (defaults to title + text) */
    voiceText?: string;
    /** Context style: goal (🎯), clarification (💡), attention (⚠️) */
    style?: ContextStyle;
}
//# sourceMappingURL=types.d.ts.map