import { readFileSync, existsSync } from 'fs';
/**
 * Build the transcript markdown for a timeline. Shared by the automatic
 * generation in `TutorialTimeline.save()` and the `tutorial-transcript` CLI,
 * so both always produce the same format `parseTranscript` reads back.
 */
export function buildTranscriptMarkdown(data) {
    const lines = [];
    lines.push(`# ${data.testName}`);
    lines.push('');
    lines.push(`- **Test:** \`${data.testTitle}\``);
    lines.push(`- **Language:** ${data.lang}`);
    lines.push(`- **Duration:** ${(data.totalDurationMs / 1000).toFixed(1)}s`);
    lines.push('');
    lines.push('<!-- Edit the narration texts below, then run `npx tutorial-transcript apply`');
    lines.push('     to write the corrections back into the test source. -->');
    lines.push('');
    lines.push('---');
    lines.push('');
    let stepNum = 0;
    for (const step of data.steps) {
        // Unvoiced steps (empty audioFile) have no narration to correct.
        if (!step.text || !step.audioFile)
            continue;
        if (step.step === 0 && step.title === 'Context') {
            lines.push(`**[Context]** ${step.text}`);
            if (step.key)
                lines.push(`**key:** \`${step.key}\``);
            lines.push('');
        }
        else if (step.title === 'Complete') {
            lines.push(`**[Complete]** ${step.text}`);
            lines.push('');
        }
        else {
            stepNum++;
            lines.push(`### Step ${stepNum}: ${step.title}`);
            if (step.key)
                lines.push(`**key:** \`${step.key}\``);
            lines.push('');
            lines.push(step.text);
            lines.push('');
        }
    }
    return lines.join('\n');
}
const KEY_LINE = /^\*\*key:\*\* `(.+)`\s*$/;
const STEP_HEADING = /^### Step \d+: (.*)$/;
const CONTEXT_LINE = /^\*\*\[Context\]\*\* (.*)$/;
const COMPLETE_LINE = /^\*\*\[Complete\]\*\* (.*)$/;
/**
 * Parse a transcript markdown file back into its narrated entries.
 * Tolerant of surrounding noise (header, comments, separators): only the
 * `**[Context]**`, `**[Complete]**`, `### Step N:` and `**key:**` markers
 * plus step body text are significant.
 */
export function parseTranscript(markdown) {
    const entries = [];
    let current = null;
    let bodyLines = [];
    const flush = () => {
        if (current && current.kind === 'step') {
            current.text = bodyLines.join(' ').replace(/\s+/g, ' ').trim();
        }
        if (current && current.text)
            entries.push(current);
        current = null;
        bodyLines = [];
    };
    for (const rawLine of markdown.split('\n')) {
        const line = rawLine.trimEnd();
        const context = line.match(CONTEXT_LINE);
        if (context) {
            flush();
            current = { kind: 'context', text: context[1].trim() };
            continue;
        }
        const complete = line.match(COMPLETE_LINE);
        if (complete) {
            flush();
            current = { kind: 'complete', text: complete[1].trim() };
            continue;
        }
        const heading = line.match(STEP_HEADING);
        if (heading) {
            flush();
            current = { kind: 'step', title: heading[1].trim(), text: '' };
            continue;
        }
        const keyLine = line.match(KEY_LINE);
        if (keyLine) {
            if (current)
                current.key = keyLine[1];
            continue;
        }
        // Everything else is either step body text or ignorable scaffolding.
        if (current?.kind === 'step') {
            if (line.startsWith('#') || line.startsWith('---') || line.startsWith('<!--'))
                continue;
            if (line.trim())
                bodyLines.push(line.trim());
        }
    }
    flush();
    return entries;
}
/**
 * Narration overrides loaded from an edited transcript
 * (`tutorials/transcripts/<testName>.corrections.md`).
 *
 * Entries are matched by kind + key, consumed in file order so a key used
 * twice corrects each occurrence in turn. Entries without a key (older
 * transcript files) fall back to kind-order matching.
 */
export class TranscriptCorrections {
    queues = new Map();
    constructor(entries) {
        for (const entry of entries) {
            const bucket = `${entry.kind}:${entry.key ?? ''}`;
            const queue = this.queues.get(bucket) ?? [];
            queue.push(entry.text);
            this.queues.set(bucket, queue);
        }
    }
    /** Load corrections from a file; null when the file does not exist. */
    static load(path) {
        if (!existsSync(path))
            return null;
        const entries = parseTranscript(readFileSync(path, 'utf-8'));
        return entries.length > 0 ? new TranscriptCorrections(entries) : null;
    }
    /**
     * Consume the next correction for this kind (+ key). Exact key match
     * first, then keyless entries of the same kind as an ordered fallback.
     */
    next(kind, key) {
        const exact = this.queues.get(`${kind}:${key ?? ''}`);
        if (exact && exact.length > 0)
            return exact.shift();
        if (key) {
            const keyless = this.queues.get(`${kind}:`);
            if (keyless && keyless.length > 0)
                return keyless.shift();
        }
        return undefined;
    }
    /** Corrections that never matched a narrated step — likely stale keys. */
    get remaining() {
        let count = 0;
        for (const queue of this.queues.values())
            count += queue.length;
        return count;
    }
    describeRemaining() {
        const out = [];
        for (const [bucket, queue] of this.queues) {
            for (const text of queue) {
                out.push(`[${bucket}] ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`);
            }
        }
        return out;
    }
}
const QUOTES = ["'", '"', '`'];
function escapeLiteral(text, quote) {
    return text.split('\\').join('\\\\').split(quote).join('\\' + quote);
}
/** Find `oldText` as a complete quoted string literal and swap it for `newText`.
 *  Searches from `cursor` first (source order follows step order), then from 0. */
function replaceQuoted(content, cursor, oldText, newText) {
    for (const start of cursor > 0 ? [cursor, 0] : [0]) {
        let best = null;
        for (const quote of QUOTES) {
            const needle = quote + escapeLiteral(oldText, quote) + quote;
            const at = content.indexOf(needle, start);
            if (at !== -1 && (!best || at < best.at))
                best = { at, quote };
        }
        if (best) {
            const needle = best.quote + escapeLiteral(oldText, best.quote) + best.quote;
            const replacement = best.quote + escapeLiteral(newText, best.quote) + best.quote;
            return {
                content: content.slice(0, best.at) + replacement + content.slice(best.at + needle.length),
                at: best.at
            };
        }
    }
    return null;
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
export function applyCorrections(data, entries, io) {
    const corrections = new TranscriptCorrections(entries);
    const report = { applied: [], manual: [], unchanged: 0, files: [], timelineUpdated: false };
    let content = data.testFile ? io.read(data.testFile) : null;
    let dirty = false;
    let cursor = 0;
    for (const step of data.steps) {
        if (!step.text || !step.audioFile)
            continue;
        const kind = step.step === 0 && step.title === 'Context' ? 'context'
            : step.title === 'Complete' ? 'complete'
                : 'step';
        const corrected = corrections.next(kind, step.key);
        if (!corrected || corrected === step.text) {
            report.unchanged++;
            continue;
        }
        const change = { kind, key: step.key, file: data.testFile, from: step.text, to: corrected };
        if (content === null) {
            report.manual.push({ ...change, reason: `test file not found: ${data.testFile || '(unknown)'}` });
            continue;
        }
        // 1. The whole narration as one literal (voiceText, do-only, plain title…)
        let result = replaceQuoted(content, cursor, step.text, corrected);
        // 2. Two-part narration: `${do}. ${explain}` / `${title}. ${description}` —
        //    replace each half, splitting old and new at the first sentence boundary.
        let keyEditBlocked = false;
        if (!result) {
            const oldSplit = step.text.indexOf('. ');
            const newSplit = corrected.indexOf('. ');
            if (oldSplit > 0 && newSplit > 0) {
                const oldFirst = step.text.slice(0, oldSplit);
                const newFirst = corrected.slice(0, newSplit);
                const oldRest = step.text.slice(oldSplit + 2);
                const newRest = corrected.slice(newSplit + 2);
                if (oldFirst === step.key) {
                    // The first sentence IS the i18n key rendered verbatim (identity
                    // translate). Rewriting it would break the key — only the rest
                    // may be edited from the transcript.
                    if (newFirst === oldFirst) {
                        result = replaceQuoted(content, cursor, oldRest, newRest);
                    }
                    else {
                        keyEditBlocked = true;
                    }
                }
                else {
                    const first = replaceQuoted(content, cursor, oldFirst, newFirst);
                    if (first) {
                        const second = replaceQuoted(first.content, cursor, oldRest, newRest);
                        if (second)
                            result = { content: second.content, at: Math.max(first.at, second.at) };
                    }
                }
            }
        }
        if (result) {
            content = result.content;
            cursor = result.at;
            dirty = true;
            step.text = corrected;
            report.timelineUpdated = true;
            report.applied.push(change);
        }
        else if (keyEditBlocked) {
            report.manual.push({
                ...change,
                reason: `the first sentence is the step key \`${step.key}\` — rename the key in the test (or fix its translation) instead of editing it here`
            });
        }
        else {
            const hint = step.key
                ? ` — probably an i18n text (key \`${step.key}\`), fix it in the translation catalog`
                : '';
            report.manual.push({ ...change, reason: `text not found as a string literal in ${data.testFile}${hint}` });
        }
    }
    for (const desc of corrections.describeRemaining()) {
        report.manual.push({
            kind: 'step', file: data.testFile, from: '', to: desc,
            reason: 'transcript entry matches no narrated step (stale key after a test change?)'
        });
    }
    if (dirty && content !== null) {
        io.write(data.testFile, content);
        report.files.push(data.testFile);
    }
    return report;
}
//# sourceMappingURL=transcript.js.map