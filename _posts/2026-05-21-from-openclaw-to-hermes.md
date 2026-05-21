---
layout: post
title: "Why I Switched from OpenClaw to Hermes"
subtitle: "Better security, smarter memory, and a tool ecosystem that actually grows with you"
date: 2026-05-20 22:09:00 -04:00
tags: [hermes, openclaw, agents, migration, security]
---

## The Short Version

I ran OpenClaw for weeks. It worked. But there were cracks — small at first, then harder to ignore. A few days ago I moved my whole agent setup to **Hermes Agent**, and it's worth talking about why.

## What OpenClaw Got Right

Let me be fair first. OpenClaw's concept — persistent agent sessions, a workspace you could tune, skills you could write — was genuinely good. It introduced me to what a personal AI agent could be. Felix ran on it for weeks without major drama.

But the longer I used it, the more things started grating.

## What Started Bothering Me

### No Command Approval

OpenClaw has no concept of "ask before you do something destructive." The agent sees a shell, the shell has `rm -rf`, and nothing stops it. I never actually got wrecked, but I felt it. Every time the agent ran a command I thought "you know, if it parsed that path wrong..." That ambient anxiety isn't sustainable.

### Secrets Visible Everywhere

API keys appeared in tool output constantly. Not leaked to the internet — just sitting there in my chat buffer, plaintext. A token in a `curl` command. An API key in a config dump. It's not a breach if nobody's looking, but it feels sloppy.

### Memory Wiped on Reset

OpenClaw stores agent memory in a SQLite database that accumulates endlessly. When it hits a limit, it hard-resets — poof, everything gone. Felix went through multiple memory wipes. Each time I had to re-explain things. The workspace files survived, but the agent's continuous sense of who I was didn't.

### Gateway Security Was Thin

The gateway was a simple HTTP server with a bearer token. One token, all access. No granular permissions, no user model, no policy engine. Fine for a LAN project. Not something I'd point at the internet.

### Tool Access Was All-or-Nothing

Every tool was available to every agent in every context. The browser could hit internal IPs. The terminal had full filesystem access. You could tune profiles, but the defaults were wide open and tuning was manual.

## Where Hermes Fixed It

### Real Command Approval

`approvals.mode: manual` means I explicitly approve anything risky — `rm -rf`, `git reset --hard`, file overwrites, destructive API calls. The agent still works autonomously for reads, searches, and safe operations. But the threshold is clear, and I'm the one who decides.

There's also a `smart` mode that learns what you trust over time and only interrupts for genuinely novel risks.

### Secrets Never Hit My Screen

`security.redact_secrets: true` masks API keys, tokens, and credentials in tool output before I ever see them. The agent can still use them — they just don't appear in the chat. That alone fixes an entire class of exposure I was uncomfortable with.

### Memory That Survives

Hermes has two layers: **persistent memory** (facts stored across sessions, survive resets) and **session search** (full-text recall of past conversations). No SQLite blobs that hard-reset. If I told Felix something Tuesday, he remembers it Friday. If I ask "what did we say about X?" he searches his session history and answers.

### A Real Policy Engine (Tirith)

Tirith evaluates every tool call against a policy set before execution. The agent can't browse private URLs. It can't run commands that violate policy. It's not a suggestion — it's enforced at runtime, and the gateway uses the same engine.

### Granular Tool Controls

Toolsets are scoped per platform. My CLI session sees everything. A Telegram session only gets messaging-safe tools. Cron runs in isolated sub-agents with restricted capabilities. The defaults are locked down, and you open up as needed.

### Smarter Cron

OpenClaw's cron system injected system events into the agent's main session. Fine for simple reminders, but the agent's context ballooned every tick. Hermes runs cron jobs as isolated sub-agents — independent sessions with their own skill sets, tool restrictions, and delivery targets. The nightly revenue review doesn't pollute my morning chat.

## What I Miss (Honest)

A couple things from OpenClaw I wish Hermes had:

- **The dreaming feature.** OpenClaw had this beautifully weird system where the agent wrote dream diary entries at 3 AM. Not useful, but delightful.
- **Obsidian vault integration.** OpenClaw had a skill that wrote memory to an Obsidian vault. Hermes doesn't ship with one out of the box, though the skill system makes it straightforward to wire up.

That's it. Two things. Not bad for a migration.

## The Bottom Line

OpenClaw was the right tool for the exploration phase. It showed me what an AI agent could be. Hermes is the production phase tool — when you stop tinkering and start relying on it daily.

| Area | OpenClaw | Hermes |
|------|----------|--------|
| Security | All-or-nothing | Granular (approvals, policy engine, secret redaction) |
| Memory | SQLite blobs that hard-reset | Persistent memory + full-text session search |
| Cron | Injects into main session | Isolated sub-agent sessions |
| Gateway | Bearer token | Policy-enforced, multi-platform |
| Skills | Workspace-local files | Hub with install, discovery, versioning |
| Session search | None | Full-text across all past conversations |

If you're running an agent and haven't thought about the security model yet — think about it. The gap between "it works" and "it works safely" is wider than most people realize.

I'm glad I switched.
