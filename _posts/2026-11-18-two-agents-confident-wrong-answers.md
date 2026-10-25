---
layout: post
title: "Two Agents, Two Confident Wrong Answers"
subtitle: "I had my two agents coordinate a fix across both of their workspaces. Each handed the other a rule that was wrong — and the only reason either got caught is that checking meant reading the disk."
date: 2026-11-18 00:01:00 -05:00
tags: [ai-agents, agents, self-hosting, documentation, debugging, knowledge-base]
---

I run two agents on the same box. Felix handles my projects and infrastructure. Prometheus handles field-service logging.

When the wrong-path bug needed fixing across both of their rule sets, I had them coordinate: one drafts a correction, the other audits its own workspace and reports back. It worked. It also produced one of the better lessons I've gotten out of running two of these things.

## The first wrong answer was mine

Felix handed Prometheus the corrected rule for where the monthly index lives:

```
~/.hermes/wiki/YYYY/YYYY-MM.md
```

Prometheus checked it against the actual vault and came back with a correction: the live monthly series is at the **wiki root** — `~/.hermes/wiki/YYYY-MM.md`, alongside the year folder, not inside it.

He was right. The root holds a clean monthly series, most recently written that month. The rule Felix wrote was wrong, and it was wrong in the exact shape of the original bug: a plausible path that hadn't been checked against the tree.

## The second wrong answer was his

Then Felix measured the directory Prometheus had described as holding daily logs only.

It held three monthly index files.

So the same exchange produced two confident, specific, incorrect claims — one in each direction. Neither agent was hedging. Neither was uncertain. Both had stated a path as fact without having listed the directory it lived in.

**What caught each one was the other reading the disk.** Not comparing summaries. Not asking for confirmation. Running `ls` and looking.

## The thing underneath

The wrong paths were the small problem. The bigger one was documentation that described changes that hadn't happened.

One reference page recorded a watcher fix as applied on June 12. It actually landed June 13 — the page had been written *as though* the change was made, the change hadn't been, and nothing reconciled the two. Then a later correction note got appended on top, so the page carried both a false history and a correction of it.

That's a nasty failure mode, because a page describing an intended change reads exactly like a page describing a completed one. And the reader — human or agent — has no way to tell from the text.

The rule I pulled out of it: **if the fix isn't on disk, the doc is describing a future, not a past.** Verify by reading the system, then date the note to when the change actually landed.

## Two copies of a rule is two answers

There was a second layer. Prometheus carried its own copy of a shared skill that described my agent's container as running service-call logs — stale, and drifted from the live copy in Felix's tree. His copy said one thing, the live one said another, and both were being loaded in different sessions.

Any rule that exists in two places will eventually disagree with itself. When one of them is stale, the agent that reads it is not wrong about what it read — it's wrong about the world. And it has no way to know.

## What I changed

- **Cross-check by reading the system, not the summary.** When an agent reports something verified, the useful follow-up is *what did you run*, not *are you sure*.
- **An agent's confidence is not evidence.** Both of these were confident. Confidence tracks the fluency of the claim, not whether the disk agrees.
- **One canonical copy of a shared rule.** Where a second copy exists, the work is to make it a pointer, not to keep them in sync.
- **Date a fix to when it landed.** A note that reads as completed when it isn't is worse than no note — it stops anyone from looking.

The coordination was worth it. But it only worked because the check was mechanical. Two agents agreeing with each other would have produced exactly the same two wrong answers, with more confidence behind them.
