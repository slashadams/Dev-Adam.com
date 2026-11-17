---
layout: post
title: "Your Watchdog Pages on a Blip Because Its Grace Is Shorter Than Its Interval"
subtitle: "A dead-man's switch has two numbers per check: how often the job runs, and how long a miss is forgiven. Set the second one below the first and the monitor alarms on every single dropped cycle — which is the one thing a retry already handles."
date: 2026-12-24 00:01:00 -05:00
tags: [self-hosting, monitoring, homelab, ai-agents, developer-tools]
devto: true
bsky: |
  A 15-minute monitor paged me "overdue by 5m" at 00:35. The 00:45 run was fine — one dropped cycle, cleared eleven minutes later.

  Its grace window was 5 minutes. Grace has to EXCEED the cadence, or the alert fires before the next run can clear it. One number.

  Link in bio.
---

I run about a dozen jobs on a box at home — backups, a drive-health check, a network monitor, a couple of scrapers, a nightly recap. Each one pings a small HTTP endpoint when it finishes successfully. A watcher loop runs every 60 seconds, works out the most recent scheduled slot for every registered job, and alerts my phone if that slot went by without a ping. Nine checks are registered with it today.

That's the design, and it's a good one. The part I got wrong is what "went by without a ping" is allowed to mean — and it comes down to one number per check that almost nobody sets deliberately.

## How the watcher decides you missed something

For each check, the config carries its cron schedule and a **grace window** in minutes. The watcher walks the schedule with `croniter` to find the most recent slot in the past, then alerts when:

```
now > slot + grace_minutes
```

It anchors that walk on the **last ping**. So a fresh ping moves the anchor forward and the failed slot stops mattering. That detail is the whole game, and it's the bit I skipped when I first sized the number.

## Attempt #1: a grace shorter than the cadence

My first instinct was to keep grace small. Five minutes on a job that runs every fifteen. The reasoning felt obvious at the time — *"a tight window catches a dead job faster."*

That reasoning is wrong, and the arithmetic is the proof. The job runs every fifteen minutes. A missed cycle at 00:30 cannot be healed until the next run at 00:45. An alert fires at `00:30 + 5` — **00:35**. That is ten minutes before the run that would have cleared it had a chance to start.

So the "sensitive" setting wasn't sensitivity. It was a monitor that pages on any single dropped cycle, no matter why, and reports a healthy system as broken.

Here's the actual sequence from the journal on November 15th:

```
00:00:06  [ping] social-monitor
00:15:07  [ping] social-monitor
          (00:30 run did not ping)
00:35:54  [watcher] alerted: social-monitor overdue by 5m
00:45:07  [ping] social-monitor
```

One missed cycle. Cleared by the next run eleven minutes after the alert. Nothing was wrong — not the job, not the network, not the box. The monitor was describing its own configuration.

## Attempt #2: 14 minutes, which is still under 15

The obvious correction is to make grace *just* under the interval — 14 minutes on a 15-minute job. That reads like it "absorbs one miss and still catches a dead job in the same cycle."

It doesn't. `slot + 14m` is one minute **before** `slot + 15m`, which is the next run. The alert still fires first. I verified that against the actual anchor logic: a 05:45 miss whose 06:00 run completed cleanly still paged at **05:59** — one minute early, for a gap that closed itself 60 seconds later.

**The anchor logic is what makes or breaks this, so check it before you write a rationale into a comment.** The watcher doesn't ask "how many cycles have you missed." It asks "is now past the last slot plus grace." With the anchor on the last ping, one missed cycle only stays visible until the next run resets the anchor — so the alert has to be timed for *after* that point, not before it.

## Attempt #3: grace just over the cadence

The number that works: **just over the interval.** Twenty minutes for a fifteen-minute job.

Now a single miss is invisible, and that's correct behaviour rather than a blind spot. The retry is the first line of defence, and a dead-man's switch is not supposed to duplicate it. What the switch is for is the case the retry *can't* fix — the job that has stopped entirely.

The bounds are:

- **Grace must exceed the interval.** Below it, the alert fires before the next run can clear the gap, so one dropped cycle pages every time.
- **Keep grace below twice the interval.** At or beyond 2×, even a genuinely dead job stops paging, because every cycle you skip is still inside the window.
- **Same reason, from the other side:** between one and two intervals, a *single* miss is forgiven and *two in a row* page. That's the behaviour you actually want — page on a pattern, not on a hiccup.

For a 15-minute job, that's a number between 15 and 30. I picked 20.

## The embarrassing half: I fixed one check and left the sibling alone

Setting the grace is the small lesson. The bigger one is how it took a second page to learn.

I made this change on one check in early November. I wrote the reasoning into that check's config comment — *"grace must exceed the cadence to absorb one miss"* — with the verified case and the date. Done, documented, moving on.

Ten days later, a *different* check paged on a single missed cycle at 00:35:54, healed by its own next run at 00:45. Same shape. Same wrong number. It ran on the identical fifteen-minute cadence as the one I'd just fixed, and it lived about forty lines further down the same config file.

**I had written the rule down. I had not applied it across the set.** A rationale in a comment on the check that paged is documentation of a fix, not a fix — the next check with the same cadence never read it. The change that actually stuck was sweeping the whole file: every registered check, its grace against its own schedule, one at a time. Two checks running the same cadence should not be able to disagree about this.

## Why "tighter is better" is the default mistake

Two instincts push you toward a small grace window:

- **"Smaller looks stricter."** A five-minute window *sounds* more sensitive than a twenty-minute one. It isn't. Both catch a dead job; only one of them also cries wolf on a healthy one.
- **"A missed run is a failure."** For a one-shot job, maybe. For a recurring job, a missed cycle is the exact case its own retry exists for. Counting one missed run as a fault is counting the retry as broken.

The cost isn't one bad alert. It's that a daily false alarm trains you to swipe past the notification — and a monitor you've learned to ignore is worse than no monitor, because you still believe it's watching. The failure points toward *"everything is fine,"* which is the direction you can't afford.

Three rules I'd write on the box now:

- **Grace must exceed the cadence.** Check the number against the schedule, not against a feeling about sensitivity.
- **Cap it below twice the cadence.** Over that, dead jobs stop paging entirely.
- **Audit every check against its own schedule, not just the one that paged.** Same cadence, same grace. A rule fixed in one place isn't applied anywhere else.

## What I'd still change

The alert text is the weak part now. It says:

```
🚨 social-monitor is overdue
Late by: 5 minutes (grace 5m)
Last ping: 2026-11-15T00:15:07
```

Five minutes late, one cycle missed, self-healing in ten — and nothing in that message says so. It reads identically to a job that has been dead for a day. The fix is to have the alert reason about cycles instead of minutes: *"1 cycle missed, next run expected 00:45"* is a blip; *"3 cycles missed, last ping 00:00"* is an outage. One line, and it changes whether you look at it now or in the morning.

The other thing I'd change is the comment. My rationale for the wrong number was persuasive enough that I trusted it instead of doing the subtraction — and once it was corrected, it sat in one check's config for ten days without reaching the one below it on the same schedule. If the check derived its own grace from the schedule — or at least refused to start when grace was under the interval — the number couldn't have been wrong in the first place, and there'd be nothing to sweep.
