# Storytelling — The Human Side of Tutorials

Great tutorials feel human, not robotic. Narration LEADS, action FOLLOWS. One concept at a time. Explain WHY before showing HOW. Let the viewer's brain catch up.

## 1. Persona — Know Your Viewer

Before writing a single step, identify who is watching. This shapes vocabulary, pacing, what to explain, what to skip.

### Persona dimensions

| Dimension | Why it matters | Signals |
|---|---|---|
| **Role** | Which features they care about | Test path: `tests/free/` (owner), `tests/accountant/` (pro), `tests/portal/` (client) |
| **Domain expertise** | Whether to explain business concepts or just UI | An accountant knows what TVA is; a freelancer may not |
| **Technical comfort** | Pacing — fast for power users, slower for first-timers | Settings pages → power user; onboarding → newcomer |
| **Emotional state** | First-time setup is anxious; daily use is impatient | Onboarding tutorials reassure; feature tutorials are efficient |
| **Language & culture** | Tone, formality, examples, RTL layout | Moroccan French is more formal than Canadian French |

### How to determine the persona

1. **Test path** tells user type (`free/`, `premium/`, `accountant/`, `portal/`)
2. **Feature complexity** tells expertise level (payroll = HR manager, invoicing = any business user)
3. **Flow type** tells emotional state (onboarding = anxious newcomer, daily feature = impatient regular)
4. **When in doubt, ask.** Don't guess — narration tone depends on it.

### Persona → narration style

| Persona | Vocabulary | Pace | Explain |
|---|---|---|---|
| First-time owner (onboarding) | Simple, no jargon | Slow, reassuring | Why each field matters |
| Accountant switching tools | Professional, precise | Brisk, efficient | Where things are, what's different |
| Client in portal | Friendly, non-technical | Moderate | How to pay, where to find docs |
| HR manager (payroll) | Domain-appropriate | Moderate | Calculations, legal requirements |

## 2. Goal — What Is the Viewer Trying to Accomplish?

State the goal as a **user outcome**, not a feature description.

| Bad | Good |
|---|---|
| "This tutorial covers the company settings page" | "Set up your company so your invoices show the right name, address, and tax IDs" |
| "Learn how to use the payroll module" | "Generate your first pay slip in under 5 minutes" |
| "Client creation walkthrough" | "Add a client so you can start invoicing them" |

The goal determines:
- What the opening `context({ style: 'goal' })` says
- Which steps are worth narrating and which are just mechanical (group or skip)
- What the completion message celebrates

## 3. Prior Knowledge — What to Explain, What to Skip

| If the viewer is… | Explain | Skip |
|---|---|---|
| First-time user (onboarding) | Why each field matters, what happens after save | Basic navigation |
| Accountant switching tools | Where things are in this UI, what's different | What an ICE number is |
| Client viewing the portal | How to pay, where to find documents | Accounting terminology |
| Power user exploring settings | What each setting controls | How to click a button |

**Rule:** if the persona would say "obviously", don't explain it. If they'd say "wait, why?", explain it.

## 4. Emotional Arc

Every good tutorial follows this arc:

```
Reassurance    →    Confidence    →    Accomplishment
"Here's what        "See, that        "You did it!
 we'll do"           was easy"         Here's what
                                       you can do next"
```

### Opening (goal context)
- Set expectations — what will we accomplish?
- Reduce anxiety — "this only takes a minute"
- Be specific — "by the end, your invoices will show your company info"

### Middle (clarification contexts, sparingly)
- Before complex sections: frame why they matter
- After a save: "great, that's locked in — now let's…"
- Before a warning: "one thing to know before we continue…"

### Ending (complete)
- Celebrate the outcome, not the steps
- Tell them what they can do next
- Be encouraging, not generic

| Bad completion | Good completion |
|---|---|
| "Setup complete." | "Your company is ready! You can now create invoices." |
| "Tutorial finished." | "Pay slip generated! Your employee can view it in their portal." |
| "Done." | "Client added — you can invoice them right away." |

## 5. Narration Voice

### Write like you're sitting next to the viewer

| Rule | Bad (robotic) | Good (human) |
|---|---|---|
| ≤ 8 words for "do" | "Click on the save button to save your changes" | "Save your changes" |
| "Explain" gives the WHY | "This field is for the company name" | "This appears on all your invoices" |
| Second person | "The user enters their company name" | "Enter your company name" |
| No robot words | "Step 1: Fill in the name field" | "Start with your company name" |
| Natural speech | "Navigate to the clients section" | "Head over to your clients" |
| No tech-speak to non-tech viewers | "Click the CTA in the modal" | "Hit the button to confirm" |

### Conversation, not instruction manual

Think of "do" as **what you'd say out loud** while pointing at the screen. Think of "explain" as **the follow-up when they ask "why?"**.

```
"do":     "Enter your company name"
"explain": "This goes on every invoice you send"
             ↑ that's what you'd say if they paused and looked at you
```

## 6. Grouping Decisions

### Group by concept, not by field

If the viewer would think of multiple fields as "one thing", they're one step.

| Separate concept | Same concept (group) |
|---|---|
| Company name + tax ID | Street + city + postal code ("address") |
| Select client + set date | Email + phone ("contact details") |
| Enter salary + pick benefits | First name + last name + CIN ("identity") |

### When NOT to group

- Fields on different screens
- Fields that need individual explanation
- A field whose value depends on the previous one (show cause → effect)

## 7. Context Placement

| Context style | When | Frequency |
|---|---|---|
| `goal` 🎯 | Tutorial opening — the ONE objective | Exactly once, always first |
| `clarification` 💡 | Before a complex section needing framing | 0–2 per tutorial |
| `attention` ⚠️ | Irreversible action, legal requirement, gotcha | Only when genuinely important |

**Overusing context cards breaks immersion.** If you have more than 3 total in a tutorial, cut the weakest ones.
