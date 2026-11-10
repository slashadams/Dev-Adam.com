---
layout: post
title: "Your Agent Routes on 60 Characters Per Skill. The Rest Doesn't Exist."
subtitle: "191 skills across three agents, one index line each, and a hard truncation point I'd never seen written down anywhere. The skills were fine — the titles were the problem."
description: "191 skills across three agents, one index line each, and a truncation point I had never seen written down. The skills were fine; the titles were not."
date: 2026-11-02 00:01:00 -05:00
tags: [ai-agents, hermes, openclaw, skill-routing, developer-tools]
---

I run three AI agents off the same machine, and between them they carry **191 skills** — the individual procedures each one can load when a task calls for one. Writing them is the easy part. What I had no grip on was whether the *right* one was loading when it mattered, and I'd been assuming the answer was "probably, they're described clearly enough."

They were described clearly. That turned out to be the problem.

## There is no matcher

I expected a relevance pass somewhere — keywords, embeddings, something that scores a skill against what you just asked. There isn't one. At the top of every session the agent receives one block listing every skill it can load:

```
<available_skills>
- skill-name: description
...
</available_skills>
```

That's the whole thing. One line per skill. The model reads it like a menu and decides from the line alone; the body of a skill isn't touched until after something has already been chosen. Which means **the description is not documentation. It's the trigger.**

Then we read the code that builds that block, and found the line that reframed everything:

```python
SKILL_PROMPT_DESC_LIMIT = 60

def extract_skill_description(frontmatter):
    desc = ...
    return desc[:SKILL_PROMPT_DESC_LIMIT - 3] + "..." if len(desc) > SKILL_PROMPT_DESC_LIMIT else desc
```

**Sixty characters.** Anything past that is replaced with `...` before the model ever sees it. A description can be 471 characters long on disk; at routing time it is 57 characters and an ellipsis, and the other 414 simply do not exist.

There's no warning. Nothing validates it. The description looks correct in the file you wrote, and it is correct — as documentation. As a trigger it's been amputated, and you won't find out from anything the agent says.

## What that does to a description written as a title

Every description in my trees had been written by describing what the skill *is*, because that's what a description is for. So the budget went to the title:

```
Adam's home network — UniFi topology and controller APIs,
```

That's the first 57 characters of one of my most-used skills. It's a perfectly good title. As a trigger it tells the model the topic and never the situation, which is the half that matters when the model is deciding whether to open the thing.

The worst case was simply spent: `public-site-headers` was 471 characters and got cut mid-word.

Add up three trees and it looked like this:

| Tree | Skills | Descriptions truncated | Started with "Use when" |
|---|---|---|---|
| default | 124 | 18 | 7 |
| atlas | 43 | 7 | 1 |
| prometheus | 23 | 6 | 1 |

## The number that convinced me

One of the agents keeps a usage ledger. Of its **43 skills, seven had ever been loaded.**

And the two most-used skills in that tree — 45 uses and 41 uses, against a field of skills sitting at zero — were the two whose descriptions happened to name their domain in the first few words.

That's the part that made this worth doing rather than mildly tidying. Usage wasn't tracking usefulness. It was tracking how well a sentence survived a truncation I didn't know about.

## What's new here, and what isn't

Most of this idea isn't mine. There's a body of work in the MCP tool world on exactly this problem — a paper that formalises ["tool description smells"](https://arxiv.org/abs/2602.14878), and a broad consensus that a tool description is prompt engineering rather than documentation. Their measurement is the same failure seen from the other side: missing usage guidance shows up in nearly 90% of the descriptions they surveyed.

What I couldn't find anywhere was a hard **character budget** on the routing metadata itself — a silent ceiling that decides half of what the model is allowed to consider — or any measurement of the question sitting underneath. Not "was this skill used," but "should this one have been used, and it wasn't." That second half is the part I hadn't seen anyone build, and it's where the number above came from.

## What we built

**A retitle pass.** Every description rewritten to `Use when <situation>. <what it does>.`, with the trigger clause inside the first 57 characters. Driven by one shared map of 133 entries rather than three hand-edited lists, so three trees can't drift apart. Dry-run by default, idempotent, and it refuses to write anything over the limit.

**An audit, in two passes — and the split is the point.**

- **FACT**, from the usage ledger: never-loaded skills, stale skills, and *dead index rows* — never loaded and never even keyword-matched. The ledger can tell you a skill was used. It cannot tell you one should have been.
- **MISS**: for each user message in the window, match it against that skill's own trigger text, then check whether the skill was actually loaded in that session. Match plus never-loaded equals a suspected miss. That's the question the ledger structurally cannot answer.

**A weekly sweep across all three trees.** One agent owns it and every other profile is **read-only** — their skill directories and session database are only read, and all state is written under the reader's own cache. Nothing lands in another agent's home.

**A judgement inbox.** Keyword matching guesses; a session review actually saw what happened. So both daily self-audits now end by appending findings to a JSONL file — loaded the wrong skill, or never loaded the one that applied — each with a required one-line evidence field and a confidence level. Speculation is banned, and the audit is not allowed to act on a finding, only to record it. The weekly sweep consumes them and reports each exactly once.

## The results, and what I don't get to claim

**191 skills rewritten across three trees.** Verified with Hermes's own parser and its own truncation predicate rather than a regex I wrote, because "no descriptions are too long" is precisely the kind of statement you'd like to be wrong about in a way you can detect: `0 truncated, longest 59`, and a second run changes nothing.

**Suspected misses fell from 51 to 8** on the same seven-day window. The honest caveat: tighter trigger text also matches less junk, so part of that drop is the measurement getting narrower rather than the behaviour getting better. The ledger's use counts over the next few weeks are the real test, and I'll know when they move.

**Precision was tuned by measuring, not taste.** The first version of the audit flagged 47 hits over seven days on one tree, nearly all noise. On another it flagged **410**, and the cause was worth the whole exercise: `cron_*` sessions and the injected session brief are *machine-authored text*, dense with exactly the vocabulary skill descriptions use. They aren't user language, and scoring them the way you'd score a user message produces garbage. Filtering them took 410 to 51.

**The silence contract is verified by byte count:** the first run produced 1,898 bytes of report, and repeat runs produce 0.

## The rules I'd keep

**A description is a trigger, not documentation.** Spend the first 57 characters on when to use it. The rest can explain.

**Precision beats recall in an audit.** A monitor that cries wolf gets mentally filtered by its human, and a monitor that's been filtered out can't warn you about anything. If the threshold is producing junk, raise it — never lower it chasing coverage.

**A digest carries news, not a standing list.** Deduplicate by identity and stay silent when nothing changed. Repeat findings are how a useful report becomes a thing you scroll past.

**Silence is the healthy state.** These jobs always exit 0, because a non-zero exit on a script-only job fires an engine error *on top of* the report — the same problem delivered twice.

**Keep "was it used" and "should it have been used" as separate instruments.** They're different measurements, and merging them means one failure looks like both.

## What I haven't pulled yet

Three levers, all still on the table:

- **Hiding skills that can never apply.** One tree has 100 index rows for skills that will never fire in that context. They're not just clutter — they're candidates the model can pick wrongly.
- **Pinning the two or three that must never be missed**, which the platform supports explicitly, at a token cost on every session.
- **A task-to-skill routing map inside the always-loaded session brief**, so the common paths don't depend on the index at all.

And one maintenance fact worth writing down: descriptions that ship bundled with the platform **revert on update**. The retitle pass is a recurring step, not a one-off cleanup.
