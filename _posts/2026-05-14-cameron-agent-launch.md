---
layout: post
title: "Cameron Is Taking Shape — Building an AI Assistant for CAMs"
subtitle: "Statute library, document templates, property vaults, and deadline tracking — here's what I've built so far."
tags: [AI agents, property management, CAM, Cameron, side projects, development]
---

A few weeks ago I [wrote about the concept for an AI assistant for CAMs](/blog/building-ai-assistant-for-cams/). The problem was clear — too much paperwork, too little time, and the tools haven't caught up. I laid out the architecture and asked if I was on the right track.

Nobody told me I was wrong.

So I started building.

## What's Built So Far

### Self-Configuring Setup

This was the one that mattered most. I didn't want this to be another dashboard, another login, another tool the manager has to learn. The whole thing works through conversation. When a new CAM joins the firm, the manager just says "Add Brian — he's handling Ocean View and Sunset Bay." The agent creates the profile, sets up the property folders, and Brian can start working immediately. Same for adding a new property, updating a board roster, or filing an insurance cert.

No admin panel. No config files to edit. No IT ticket.

### Florida Statute Library

FS 718 (Condominiums), FS 719 (Cooperatives), and FS 720 (Homeowners' Associations) — loaded as reference documents. The agent answers compliance questions with exact statute citations. "How many days notice for a condo annual meeting?" → 60 days per 718.112(2)(d)1. "What's the fine cap for an HOA?" → $100/day per 720.305(2).

### Property Vault System

A structured directory for every managed community. Governing documents, board rosters, insurance certificates, meeting minutes, vendor records. Each property gets its own folder with a consistent structure and a template so onboarding a new community doesn't mean reinventing the layout.

### Document Templates

Pre-built violation letters (first notice, second notice, fine hearing), meeting agendas, meeting minutes, and annual meeting notices. Statue-compliant language, proper citations, ready for the manager to review and send.

### Deadline Tracking

Cron-based calendar monitoring for the statutory deadlines: annual meeting notices, budget delivery, insurance renewals, CAM license CE tracking. The agent surfaces reminders proactively instead of relying on someone remembering to check.

## The Next Pieces

The [violation tracking engine](/blog/cameron-violation-engine/) is the latest addition — structured records, status workflows, proactive follow-ups, and repeat-offender detection. That one was a gap I kept coming back to, and I'm glad I took the time to get it right.

Multi-user routing took a while to figure out. Each CAM sees only their own properties, and it all happens through conversation — the agent knows who's talking based on their chat handle and loads the right context. No dashboard, no user management screen. That was a fun design challenge.

## What I'm Still Figuring Out

Delivery model is the big one. Self-hosted gives full control over data, but it requires infrastructure comfort that not every firm has. I'd like to offer both options eventually, but I'm not rushing that decision until the agent itself is where I want it.

If you're a CAM or work in property management, I'd love to hear what I'm missing. The whole point of building in the open is catching the blind spots before they turn into problems.

---

*Built by someone who's been in the room. Not a tech company guessing what CAMs need.*
