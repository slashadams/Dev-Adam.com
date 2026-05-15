---
layout: post
title: "Building a Violation Tracking Engine for My CAM Assistant Project"
subtitle: "Status workflows, automated follow-ups, repeat-offender detection, and conversational case management — the latest piece I built."
tags: [AI agents, property management, CAM, side projects, development]
---

I've been working on a project — an AI assistant for Florida Community Association Managers. If you've been following along since my [first post on the concept](/blog/building-ai-assistant-for-cams/), you know the gist: an OpenClaw agent that handles compliance tracking, document drafting, deadline reminders, and property management admin work so the CAM can focus on people.

The statute library was done. The property vault structure was solid. The templates were in place. But there was a hole I kept coming back to.

The agent could draft violation letters — properly formatted with statute citations, ready to review. But once that first notice went out, there was nothing connecting it to what happened next. Did the owner comply? Did the deadline pass? Is it time for the second notice? The fine hearing? That's a lot of threads to keep in your head when you're managing 7 communities.

So I built a system to handle it.

## What I Built

### Every Violation Gets a Record

I set up a structured JSON schema that lives in each property's directory. When the agent logs a violation, it auto-generates a unique ID (`PV-2026-001`, `HC-2026-003`), stamps the date, and prompts for the violation type and the relevant CCR section. Everything lives in a single `records.json` that the agent can read and update conversationally.

No spreadsheets to maintain. No sticky notes. No digging through email threads to figure out where something stands.

### The Status Workflow Mirrors Real Enforcement Procedure

Florida law has a specific enforcement pipeline, so I mapped it directly into the state machine:

```
discovered → 1st notice sent → compliance period → 2nd notice/final warning
  → response period → fine hearing scheduled → committee finds → fine imposed
    → cured (at any point) or escalated to legal
```

The engine enforces valid transitions. If someone were to ask "schedule a fine hearing" for a violation that's still in first-notice status, it would catch that and suggest sending the final warning first. Missing a procedural step in violation enforcement creates real legal exposure for the association — this is one of those places where getting the process right matters more than speed.

### Proactive Follow-Ups

I wired this into the agent's daily check-in so it scans each property's records every morning:

- Compliance deadlines passed for first notice? → Flag for second notice
- Response deadline passed for final warning? → Flag for hearing scheduling
- Hearing scheduled for today or tomorrow? → Surface it before the CAM has to ask

The idea is the agent surfaces what needs attention instead of the CAM having to remember to check.

### Repeat Offender Detection

I added an `owners-index.json` that tracks violation history per unit. When the same owner pops up with the same violation type multiple times, it flags the pattern — something that's easy to miss across a portfolio.

I'm excited about this one. A CAM with 5+ properties doesn't have time to cross-reference which units keep showing up for the same issue. Let the agent do the pattern matching.

### Conversational Queries

The part I'm happiest with: the agent can answer questions about violations in plain language by reading the records directly:

- *"What open violations does Palm Villas have?"* → Summary by status
- *"Show me violations past their compliance deadline"* → Date comparison across records
- *"Which units have had 3+ violations this year?"* → Owners index query
- *"List all violations for unit 204"* → Full timeline for a specific unit

No dashboards to check. No reports to run. Just ask.

## The Violation Types Reference

Alongside the engine, I put together a reference file covering 8 violation categories with 50+ sub-types, each mapped to common governing document sections and the relevant Florida statute:

- Architectural modifications (FS 718.113, FS 720.3075)
- Landscaping and grounds (FS 720.304)
- Parking and vehicles (FS 720.304)
- Noise and nuisance (FS 718.304)
- Pets and animals
- Trash and sanitation
- Rental and occupancy violations
- Health and safety

Plus the fine schedule caps from statute, the arbitration requirements for HOAs, and the procedural checklist for each enforcement stage. It's the kind of reference I'd want pinned to the wall.

## What's Next

The core pieces are coming together — statute reference, document drafting, deadline tracking, property vaults, multi-user support, and now violation management. The multi-user routing (each CAM sees only their own properties) was a fun challenge to get right since it all happens conversationally without any dashboard.

I'm still thinking through the delivery model. Self-hosted gives CAMs full control over their data, but it requires infrastructure comfort that not everyone has. I'm exploring what makes sense.

Mostly I'm focused on getting the agent right. If you're a CAM or work in property management, I'd love to hear what I'm missing — the whole point of building in the open is finding out what I haven't thought of yet.

---

*Building this one piece at a time. Reach out if something here resonates or if I'm way off.*
