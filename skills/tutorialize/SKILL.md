---
name: tutorialize
description: Transform a Playwright E2E test into a narrated tutorial video. Load before writing or reviewing any tutorial.step(), tutorial.context(), or tutorial.complete() call. Covers persona analysis, storytelling arc, choreography rules, and the pw-tutorial-video API.
---

# /tutorialize — Tutorial Design Skill

Turn a Playwright test into a tutorial that **teaches**, not just demonstrates.

Two reference files support this skill:
- [`references/storytelling.md`](references/storytelling.md) — Persona analysis, emotional arc, narration voice, pacing decisions
- [`references/api.md`](references/api.md) — `pw-tutorial-video` API, timing model, technical rules, checklist

**Read both before tutorializing.** Storytelling comes first — it drives every API decision.

## Process

### 1. Understand (read `storytelling.md`)
- **Who** is watching? (role, expertise, emotional state)
- **What** are they trying to accomplish? (goal, not feature)
- **What** do they already know? (skip the obvious, explain the surprising)

### 2. Design the arc
```
Navigate to first screen (before any tutorial call)
  ↓
CONTEXT (goal): "Here's what we'll accomplish"
  ↓
STEP (no-op): Describe what's on screen
  ↓
STEPS: Grouped by concept, do/explain narration
  ↓
CONTEXT (clarification): Only if a complex section needs framing
  ↓
MORE STEPS...
  ↓
COMPLETE: Celebrate the outcome, suggest what's next
```

### 3. Implement (read `api.md`)
- Use the Tutorial API: `context()`, `step()`, `complete()`
- Follow timing rules, blank-screen prevention, navigation handling
- Apply the polish checklist before submitting

### 4. Verify
- Test passes without `TUTORIAL_MODE` (plain E2E)
- Test passes with `TUTORIAL_MODE=true` (video generation)
- Watch the generated video — does it feel human?
