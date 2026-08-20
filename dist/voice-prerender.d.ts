/**
 * Voice pre-rendering — generate the narration clips OUTSIDE of any test run,
 * where TTS synthesis is slow and serial. Texts are collected from the
 * artifacts that record them verbatim:
 *
 *  - `tutorials/transcripts/*.md` — one per tutorial, survives every run;
 *  - `tutorials/output/*_timeline.json` — fresh but wiped by Playwright runs.
 */
export interface NarrationText {
    lang: string;
    text: string;
}
export interface VoiceSources {
    timelineDir?: string;
    transcriptDir?: string;
}
/** Same naming scheme as the runtime voice cache (voice.ts). */
export declare function audioFilename(lang: string, text: string): string;
/** All known narration texts, deduplicated. */
export declare function collectVoices(sources?: VoiceSources): NarrationText[];
export interface RegenOptions extends VoiceSources {
    lang?: string;
    /** Parallel TTS syntheses (default 2) */
    workers?: number;
    /** Re-synthesize cached clips too (after a voice settings change). Default: missing only. */
    force?: boolean;
}
/**
 * Pre-render the voice cache without running any test: collect every known
 * narration text, synthesize the missing clips (all of them with `force`) with
 * the CURRENT TTS settings, in parallel. The audio dir may have been deleted
 * entirely — it is recreated. Videos are not remixed; a `TUTORIAL_MODE=true`
 * run picks the clips up from cache.
 */
export declare function regenVoices(audioDir: string, options?: RegenOptions): Promise<{
    total: number;
    cached: number;
    done: number;
    failed: number;
}>;
//# sourceMappingURL=voice-prerender.d.ts.map