import type { TimelineData } from './timeline.js';
/** One narrated entry of a transcript markdown file. */
export interface TranscriptEntry {
    kind: 'context' | 'step' | 'complete';
    /** i18n key of the step/context (from the `**key:**` line, when present) */
    key?: string;
    /** Step title (from the `### Step N: <title>` heading) */
    title?: string;
    /** Narration text */
    text: string;
}
/**
 * Build the transcript markdown for a timeline. Shared by the automatic
 * generation in `TutorialTimeline.save()` and the `tutorial-transcript` CLI,
 * so both always produce the same format `parseTranscript` reads back.
 */
export declare function buildTranscriptMarkdown(data: TimelineData): string;
/**
 * Parse a transcript markdown file back into its narrated entries.
 * Tolerant of surrounding noise (header, comments, separators): only the
 * `**[Context]**`, `**[Complete]**`, `### Step N:` and `**key:**` markers
 * plus step body text are significant.
 */
export declare function parseTranscript(markdown: string): TranscriptEntry[];
/**
 * Narration overrides loaded from an edited transcript
 * (`tutorials/transcripts/<testName>.corrections.md`).
 *
 * Entries are matched by kind + key, consumed in file order so a key used
 * twice corrects each occurrence in turn. Entries without a key (older
 * transcript files) fall back to kind-order matching.
 */
export declare class TranscriptCorrections {
    private queues;
    constructor(entries: TranscriptEntry[]);
    /** Load corrections from a file; null when the file does not exist. */
    static load(path: string): TranscriptCorrections | null;
    /**
     * Consume the next correction for this kind (+ key). Exact key match
     * first, then keyless entries of the same kind as an ordered fallback.
     */
    next(kind: TranscriptEntry['kind'], key?: string): string | undefined;
    /** Corrections that never matched a narrated step — likely stale keys. */
    get remaining(): number;
    describeRemaining(): string[];
}
export interface ApplyChange {
    kind: TranscriptEntry['kind'];
    key?: string;
    file: string;
    from: string;
    to: string;
}
export interface ApplyProblem extends ApplyChange {
    reason: string;
}
export interface ApplyReport {
    /** Replacements written into source files */
    applied: ApplyChange[];
    /** Corrections that could not be applied automatically */
    manual: ApplyProblem[];
    /** Narrated steps whose text was not edited */
    unchanged: number;
    /** Files that were modified */
    files: string[];
    /** True when step texts changed in the timeline data (caller should re-save the JSON) */
    timelineUpdated: boolean;
}
/** Filesystem boundary, injectable for deterministic tests. */
export interface ApplyIO {
    read(path: string): string | null;
    write(path: string, content: string): void;
}
/**
 * Write edited transcript texts back into the test source file.
 *
 * Each narrated timeline step is paired with its transcript entry (kind + key,
 * in order). When the edited text differs, the original text is located in
 * `data.testFile` as a quoted string literal and replaced. A narration composed
 * as `` `${do}. ${explain}` `` (or title + description) is handled by replacing
 * both halves, splitting old and new at the first sentence boundary. Texts that
 * cannot be found (e.g. coming from an i18n catalog) are reported for manual
 * correction with their key. Applied texts are also written back into the
 * timeline data, keeping a second `apply` run idempotent.
 */
export declare function applyCorrections(data: TimelineData, entries: TranscriptEntry[], io: ApplyIO): ApplyReport;
//# sourceMappingURL=transcript.d.ts.map