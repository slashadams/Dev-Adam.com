---
layout: post
title: "My Sessions Stopped Ending, and Nothing Told Me for 43 Days"
subtitle: "Hermes retired timer-based conversation rotation. My config still declared it, the setting still parsed, and every new turn re-billed the entire conversation it was supposed to have ended."
date: 2026-11-20 00:01:00 -05:00
tags: [ai-agents, hermes, self-hosting, debugging, cost, context]
---

I have a setting in my agent config that should reset our conversation every day at 4 AM, or after 12 hours of quiet:

```yaml
session_reset:
  mode: both
  idle_minutes: 720
  at_hour: 4
```

It's been there for months. It parses, it validates, and it does nothing at all.

Not because I got it wrong — because Hermes **retired timer-based conversation rotation** and stopped reading the setting entirely. Conversations now end only when you type `/new` or `/reset`.

The code says it plainly:

> *Core stopped rotating gateway conversations on timers and reads nothing under `session_reset`. A household that relied on it silently gets conversations that never end and a bill that grows with them.*

That's exactly what happened.

## How I found out

Not from the config. I found out by asking why my token usage had spiked, and tracing it back to a single session that had been running for **42 days**.

Everything else followed from that.

## The pivot wasn't the update

Here's the part I'd have gotten wrong by guessing. I assumed I lost the feature when I updated. I pulled the commit on **September 11**, and the warning appeared on **October 12**.

Neither is when it broke.

A running gateway serves the code it loaded, not the code on disk — so the removal sat inert in memory after the pull. My previous session kept rotating correctly for another day. I can prove it from the record: that session's last message was at 16:16 on September 11, and it ended with `session_reset` on September 12 at 13:14 — an **idle gap of 1,258 minutes** against a threshold of 720. It fired because the timer was still working. A manual reset would have shown a gap near zero.

**The actual moment was a gateway restart at 16:21 on September 12.** That's when the new code loaded and the feature died. The next session started the following afternoon and never rotated again.

So the timeline is:

- **Sep 7** — rotation removed upstream, deliberately, with no user-facing warning
- **Sep 11** — I pulled it. Nothing changed yet.
- **Sep 12, 13:14** — last correct rotation, from code still in memory
- **Sep 12, 16:21** — restart. Feature dead.
- **Sep 13 → Oct 25** — one session, 42 days, never ended
- **Sep 28** — upstream adds the warning
- **Oct 12** — I pull again and restart, and the warnings finally start

Two weeks of that were completely silent, because the release I was running didn't contain the warning yet. Nothing could have told me. Then 13 more days of warnings that went to a log file I don't read.

## What it cost

The mechanism is context × turns, and a session that never ends inflates both.

**My bloated session averaged 308,093 input tokens per API call.** A fresh session on the same day averaged 50,604. Six times the context, on every single turn, forever.

Over one day that session took **622 API calls and 191.6 million prompt tokens**. Broken down:

- cache reads: **$2.82 — 70% of the session's cost**
- output: $1.13
- fresh input: $0.08

That first line is the one that surprised me. I'd assumed cache reads are nearly free. They aren't, on this model: the cache-read rate is **$0.015/M against $0.02/M fresh — a 25% discount, not a 90% one.** My cache hit rate was 98%, and it was working perfectly the entire time.

**A warm cache was never protecting me.** At a 25% discount, the only thing that was ever going to matter was token volume — and volume is exactly what an immortal session maximizes.

## The fix

Two parts, and only one of them was what I expected.

**Restoring the rotation** took a plugin: `hermes-session-reset-policy`, which reads that same config block and starts a fresh session on the first message past the boundary.

The trap is that **plugins are per-profile.** There's no `--profile` flag, and installing it once does not cover the other profiles. I proved this the hard way — the second profile's plugin list came back empty until I installed it there too. And because the "is the plugin enabled" check runs once for the whole gateway process, a single-profile install silences the startup warning for *every* profile while the hooks are still missing. Silent again, still broken.

**Retiring the runaway session now** — the plugin only fires at a boundary. My other agent's session had been active *after* that day's 4 AM mark, so neither the daily nor the idle rule applied, and it would have run another full day. I ended it through the same API `/new` uses, which also advances a conversation generation — that's what stops the recovery logic from resurrecting the session you just closed.

## What I'd tell you to check

Run `hermes doctor`. If you see this, the setting in your config is decoration:

```
⚠ session_reset.mode: both is no longer applied
```

Then confirm a session *actually* ended, rather than assuming:

```sql
select id, started_at, ended_at, end_reason
from sessions order by last_activity_at desc limit 5;
```

`ended_at is null` on a session you've been talking in for weeks is the whole story.

## The part that generalizes

I trusted a config value as evidence that behavior was happening. It was valid YAML, it was in the right section, and it had a sensible value — everything you'd check to confirm it was working, and none of it was evidence.

**A setting that parses is not a setting that runs.** Configuration describes intent. Only the system tells you what it does — and when a feature is removed behind a config key that still parses, the config becomes a very convincing lie.
