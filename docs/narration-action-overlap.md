# Narration/action overlap — the do·explain·voiceText problem

Status: **design discussion** — nothing here is implemented.

## The problem

The API promises a two-phase timing model (`do` narration first, action running
*during* the `explain` narration), and the single-phase model starting the
action at 25% of the title narration. The implementation does neither: playback
is fully serial.

```
await voice.play(voiceText)   // the WHOLE narration — do + explain, one merged clip
await waitForTimeout(stepDelay)
await item.action()           // the screen only moves now
await waitForTimeout(300)
```

Consequences:

- every step costs `narration + stepDelay + action + 300ms` instead of
  `≈ max(narration, action)` — tutorial generation is slow, and the viewer
  stares at a frozen screen for the length of the sentence;
- the docs describe behavior that does not exist.

## Why it is not a one-line fix

The narration of a two-phase step is **one string** (`"{do}. {explain}"`) and
therefore **one audio clip**, hashed as `md5(lang:text)`. To start the action
"when the explain begins" we need to know where the `do` ends *inside* that
clip — and we don't. Everything downstream leans on the one-clip-per-step
shape:

1. **voiceText** — the pronunciation override replaces the *entire* narration
   with a single free-form string. There is no marker for where its "do" part
   ends. Any split of a voiceText is a guess.
2. **Remerge (ffmpeg)** — the timeline records one `audioFile` + `startMs` +
   `durationMs` per step; `merge.ts` lays each clip with `adelay` and `amix`es
   them. Two clips per step means a timeline schema change and a merge change.
3. **Transcripts** — `tutorials/transcripts/*.md` print one paragraph per step
   (the merged text). `tutorial-transcript apply` re-splits it at the first
   sentence boundary to write `do`/`explain` back. `regen-voices` hashes
   transcript paragraphs to pre-render clips — split clips would not match
   those hashes.
4. **Headed mode / live playback** — whatever timing we compute must hold both
   for the browser `Audio` playback (live viewing) and for the final ffmpeg
   mix. A heuristic that only works in one of the two produces videos that
   don't match what the author saw.
5. **TTS cache** — clips are content-addressed. Changing what constitutes "a
   clip" (merged vs split) invalidates the existing cache for two-phase steps:
   one mandatory `regen-voices` pass after upgrading.

## Candidate solutions

### A. Keep serial, fix the docs

Cheapest. The speed problem remains; authors compensate with shorter
narrations and a lower `stepDelay`. Rejected as the end state, acceptable as
the fallback for the cases below that stay unsplittable.

### B. One clip + computed offset (no split)

Keep the merged clip; start the action at
`offset = durationMs × len(do) / len(fullText)` (sentence-boundary rule, the
same one `transcript apply` uses). Wall clock stays
`max(durationMs, offset + action)`, so the next clip never overlaps in the mix
and remerge is untouched. voiceText works unchanged (offset falls back to its
first sentence boundary).

- ✅ zero schema/cache/transcript impact, headed and merge stay in sync
  (`durationMs` is metadata known at preload — nothing is "not yet read").
- ❌ the boundary is an *estimate*: character share ≠ speech time share
  (numbers, abbreviations, pauses). The action may start slightly before or
  after the audible end of the `do`.

### C. Two clips for do/explain (the "correct" model)

Synthesize `do` and `explain` separately. Play `do` to the end, then
`Promise.all([play(explain), action()])`, clamping wall clock to the explain
clip's metadata duration (so a navigation that kills live playback cannot make
the next clip overlap in the mix).

Requires:
- timeline: per-step `voices: [{file, text, startMs, durationMs}]` (keep
  `audioFile`/`text` as the merged view for compat);
- merge: iterate `voices` when present;
- transcripts: display stays the merged paragraph (apply unchanged);
  `regen-voices` must collect from timeline `voices[].text` — transcript-only
  collection would pre-render merged clips that the runtime no longer uses.

And the open question — **what about voiceText?**

- **C1 — voiceText stays a string → that step stays serial.** Honest, simple.
  But the steps that need voiceText most (acronyms) are often the long ones we
  want to speed up.
- **C2 — voiceText accepts an object: `{ do, explain }`.** The author controls
  the split; the string form keeps the serial legacy behavior. Costs an API
  addition, i18n files gain a nested shape, transcript `apply` needs to write
  back to whichever form is present.
- **C3 — split the voiceText string at its first sentence boundary.** Uniform
  with `transcript apply`'s documented rule, no API change — but it is exactly
  the kind of guess this proposal was supposed to eliminate, applied to the
  one field where the author hand-tuned pronunciation.

### D. Word-level timing from the TTS

Some engines emit word timestamps (edge-tts metadata, `say` doesn't). With
them the exact do/explain boundary inside a merged clip is known — B without
the guess. Requires per-provider support and a sidecar timing file per clip;
degrades to B when the engine can't provide it.

## Comparison

| | speed gain | voiceText | remerge | transcripts | cache | risk of drift |
|---|---|---|---|---|---|---|
| A serial | none | ✅ | ✅ | ✅ | ✅ | none |
| B offset | full | ✅ (estimated) | ✅ | ✅ | ✅ | boundary estimate |
| C1 two clips | partial (not voiceText steps) | ✅ serial | schema change | collector change | regen pass | low |
| C2 two clips + object | full | new API | schema change | apply + collector | regen pass | low |
| C3 two clips + auto-split | full | guessed split | schema change | apply + collector | regen pass | split guess |
| D word timings | full | ✅ | ✅ | ✅ | sidecar files | provider-dependent |

## Current lean

**B now, C2 later if B's estimate proves audible.** B delivers the whole speed
gain with a one-file change and no migration; its only flaw is an
approximation of a boundary that `stepDelay` padding already blurs. If real
videos show the action visibly jumping the gun, C2 is the principled follow-up
— with C1's rule (string voiceText = serial) as the transition so nobody's
hand-tuned pronunciation gets machine-split.

Either way, single-phase steps (title only, no explain) should start their
action at a fixed fraction of the known clip duration — that part of the
documented model needs no boundary at all.

Illustration tests to ship with the implementation: a demo spec with one long
`do` + short `explain`, one voiceText step, and one navigating action, asserted
on wall-clock ordering (action started before narration end; next clip's
`startMs` ≥ previous clip's end) in both headed and headless runs.
