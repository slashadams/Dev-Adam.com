---
layout: post
title: "Cameron Now Tracks Violations — The Enforcement Engine Is Live"
subtitle: "Procedural status workflows, automated follow-ups, repeat-offender detection, and conversational case management — all built into the CAM agent."
tags: [AI agents, property management, CAM, Cameron, violation enforcement, product update]
---

Two weeks ago I [launched Cameron](/blog/cameron-agent-launch/) — an AI assistant for Florida Community Association Managers. The feedback has been solid. People get why a CAM needs an agent that knows FS 718 the way a pilot knows a checklist.

But the first version had a gap. A big one.

Cameron could *draft* violation letters — beautifully formatted, statute-cited, ready to send. But once that first notice went out, he had no idea what happened next. Did the owner comply? Did the deadline pass? Is it time for the second notice? The fine hearing? The CAM had to keep tracking all of that manually, which defeated part of the point.

That gap is closed now.

## What the Violation Engine Does

### Every Violation Gets a Record

When the CAM says *"Log a violation for unit 204 — unapproved window tint"*, Cameron creates a structured record under that property's `violations/` directory. It generates a unique ID (`PV-2026-001`), stamps the date, prompts for the violation type and the specific CCR section, and stores everything in a queryable JSON format.

No spreadsheets. No sticky notes. No digging through email threads to figure out where things stand.

### The Status Workflow Mirrors the Real Process

Florida law has a specific enforcement procedure, and the violation engine enforces it:

```
discovered → 1st notice sent → compliance period → 2nd notice/final warning
  → response period → fine hearing scheduled → committee finds → fine imposed
    → cured (at any point) or escalated to legal
```

The engine knows which status transitions are legal. If a CAM asks *"Schedule a fine hearing for HC-2026-003"* but the violation is still in first-notice status, Cameron will say *"That unit hasn't received a final warning yet. Let me send the second notice first."*

This isn't just process for the sake of process — it's liability protection. Missing a procedural step in violation enforcement opens the association up to legal challenges. Cameron keeps the CAM in compliance without them having to think about it.

### Proactive Follow-Ups

Every morning during Cameron's check-in, he scans each property's records:

- **Compliance deadlines passed for first notice?** → Flags the CAM to send the second notice
- **Response deadline passed for final warning?** → Flags for hearing scheduling
- **Hearing scheduled for today or tomorrow?** → Reminds the CAM to prepare

The CAM doesn't have to remember to check. Cameron surfaces what needs attention.

### Repeat Offender Detection

When the same owner pops up with the same violation type three times, Cameron flags it. The engine maintains an `owners-index.json` that tracks violation history per unit — pattern detection that a busy CAM might miss across a portfolio of 5, 10, or 20 properties.

*"FYI — unit 204 at Palm Villas has 3 architectural violations this year, same category. This is now a recurring pattern worth discussing with the board."*

### Queryable, Not Just Trackable

The CAM can ask questions in plain language and get answers:

- *"What open violations does Palm Villas have?"* → Summary by status, oldest first
- *"Show me violations past their compliance deadline"* → Date comparison across all records
- *"Which units have had 3+ violations this year?"* → Owners index query
- *"List all violations for unit 204"* → Full timeline for a specific unit

This is the part I'm most excited about. A CAM managing 7 properties with a dozen open violations each doesn't have time to audit spreadsheets. They should be able to ask a question and get the answer.

## Reference Library for Violation Types

Alongside the engine, I added a comprehensive violation type reference — 8 categories with 50+ sub-types, each mapped to the typical governing document section and the relevant Florida statute:

- Architectural modifications (FS 718.113, FS 720.3075)
- Landscaping and grounds (FS 720.304)
- Parking and vehicles (FS 720.304)
- Noise and nuisance (FS 718.304)
- Pets and animals
- Trash and sanitation
- Rental and occupancy violations
- Health and safety

Plus the fine schedule caps from statute, the arbitration requirements for HOAs, and the procedural checklist for every enforcement stage. It's the reference I wish every CAM desk had pinned to the wall.

## What This Changes

Before: Cameron could write the letter, but you had to remember to come back and tell him what happened.

After: Cameron runs the enforcement workflow. The CAM logs the violation, sends the notices when prompted, marks it cured when resolved, and never has to wonder "wait, did I follow up on that one from last month?"

For a self-managed board or an independent CAM with five communities, this is the difference between violation enforcement being a constant nagging task versus something that just stays on track.

## Also: Delivery Model Thoughts

I've been thinking a lot about how to deliver this. The self-hosted package on Gumroad is still the main option — you bring your own VPS, you own your data, no monthly fees beyond your infrastructure.

But a lot of people have asked about a hosted version. "iat setup sounds great but I don't want to manage a server."

I'm considering it. If I did offer a managed tier — I host it, you subscribe monthly — would that change whether you'd try it? I'd love to hear from people who looked at the self-hosted option and passed.

Same as before — reach out however you find me. I'm still listening.

---

*Cameron is available now. The violation engine ships as a free update to all existing purchases.*
