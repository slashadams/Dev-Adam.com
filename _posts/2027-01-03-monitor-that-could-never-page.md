---
layout: post
title: "The Monitor That Could Never Page"
subtitle: "My dead-man's switch reasoned about the *next* scheduled run and then coded the *last* one. For every check whose grace window was at least its interval, that made the deadline permanently in the future — so silence read as health."
date: 2027-01-03 00:01:00 -05:00
tags: [self-hosting, monitoring, homelab, ai-agents, developer-tools]
devto: true
bsky: |
  My dead-man's switch could never fire. I only found out by building a status card on top of it.

  It anchored "overdue" on the latest slot, not the last ping — so a 15-minute check with a 20-minute grace had a deadline always in the future. A job silent three hours read healthy.

  Link in bio.
---

I run about a dozen cron jobs on a box at home: backups, a drive-health check, a weather pull, a couple of scrapers, a nightly recap. None of them are precious on their own. The failure mode that actually costs you is a job that stops running and tells no one — you discover it weeks later, from the consequence, when you needed the thing it was supposed to produce.

So I run a dead-man's switch. Each job pings a small HTTP endpoint when it finishes successfully. A watcher loop scans every sixty seconds, works out for each registered check whether a ping is overdue against its cron schedule and a grace window in minutes, and posts an alert if it is.

That's the design, and it's correct. The bug I'm writing about lived inside one function of it, and it had been there long enough to matter.

## The card is what made me read the logic

The way I found it was sideways. I wanted the job health on the wall — a small card on the dashboard I keep running, one row per check, showing a status word and how long ago it last pinged. Nothing exotic.

To build that card honestly, the dashboard needed a machine-readable version of the same judgement the alerter makes: *is this check overdue, yes or no.* The clean way to do that is not to reimplement the rule in the second place — that's how a dashboard and an alert start disagreeing about what "overdue" means, which is its own bug. Reuse the function. So the new endpoint calls the same `is_overdue()` the watcher calls, and a check can never be green on the wall while an alarm is firing in the room.

Reusing it meant reading it closely. And reading it closely is the entire reason I found what was underneath.

## The seductive wrong anchor

Here's what the function was doing. For a given check it walked the cron schedule forward to find the **most recent slot that was already in the past**, and handed that slot back to the caller, which then decided overdue as:

```
now > slot + grace_minutes
```

Read that as English and it sounds right: *find the last time this was supposed to run, add the grace, and if we're past that, there was no ping.* That is exactly how I'd describe the behaviour I wanted, and it's exactly what the docstring promised.

The code did something subtly different. The anchor — the point it measured *from* — was the schedule, not the last ping. And the most recent past slot is, by definition, **at most one interval old.** So `slot + grace`, when grace is at least the interval, lands *after* now. Every time. On every scan.

Do the arithmetic on a real check. Runs every fifteen minutes. Grace window of twenty minutes. The job dies completely — no ping for three hours. The watcher scans, finds the most recent scheduled slot, which is somewhere between a hair and fifteen minutes in the past, adds twenty minutes, and reports the check healthy with slack to spare. At one instant that reads *"OK, 7 minutes of slack left."* On the next scan the slot has advanced and the deadline has advanced with it, still in the future, still healthy — for a job that stopped pinging before lunch.

**A monitor that computes its deadline from a window that slides forward as fast as the thing it's watching can never disagree with it.** The deadline isn't measuring the job at all. It's measuring the calendar.

This is the part that stings: it happened on precisely the checks that were set up carefully. The grace window of twenty minutes on a fifteen-minute job was a deliberate number — I wrote a comment next to it saying *grace must exceed the cadence*, because a grace below the cadence pages on a single dropped cycle and trains you to ignore alerts. That reasoning was right. But the rule and the bug were complementary: the *only* checks that could ever fire were the ones whose grace was smaller than their interval — the exact configuration the comment told me never to use. Every check I'd tuned according to the rule had been effectively unmonitored. Only the daily ones, where a stale slot is many hours old, could ever trip.

Two checks ran on a fifteen-minute cadence. Both of them had been silent-as-far-as-the-switch-was-concerned for as long as the current grace values had been in place.

## Why nothing caught it

A bug in a health check is unusually hard to notice, because its healthy state and its broken state look identical from the outside. A dead-man's switch is *supposed* to be silent when things are fine. So a check that fires correctly on a real outage and a check that can never fire at all both produce the same output — nothing — for as long as there is no outage.

The failure only becomes visible in the one situation you can't schedule: something actually dies, and you wait to be told. If you never get told and you never needed to be, there's no signal. You don't find this by watching the monitor. You find it by reading the monitor.

The reason I was reading it was the card. Which is the transferable point, and it isn't really about dashboards: **reusing one rule in two places forced me to state the rule clearly enough to be wrong.** Writing the second consumer of `is_overdue()` — one that had to render a literal OK/OVERDUE *word* rather than just stay quiet — made me trace the anchor instead of trusting the sentence in the docstring.

## The fix is one line, and the test is the point

The correct anchor is the **first scheduled slot after the last ping** — the run whose ping is missing. That's the slot the docstring always described. `croniter` gives it in one call; the whole walk-forward-to-the-latest-past-slot block comes out.

It's worth being clear about why this doesn't re-introduce the thing the grace window exists to prevent. The overdue test is still `now > slot + grace`. With the anchor on the first missed slot, a job that drops a single cycle still can't page — grace has to be exceeded before anything fires, so one late run is forgiven exactly as before. What changes is that a job that *keeps* missing slots now accumulates: the anchor stays put at the first missed slot, `slot + grace` falls into the past, and the alert fires. Silence becomes detectable without making one dropped cycle noisy.

The part I'd defend hardest is how it got verified. I didn't wait for a real outage to see whether the fix worked — that's the same trap again, trusting the monitor to tell me the monitor is fine. I replayed synthetic state against the function: feed it a check that last pinged three hours ago and confirm it flips to OVERDUE, feed it one that pinged a minute ago and confirm it stays OK, and check a deliberately stale slot crosses the line in the right direction. **A check has to be tested against the state it exists to catch, not merely against its own green path.** Testing it while everything is healthy proves it stays quiet; it says nothing about whether it can speak.

And the generalisable shape of the bug — reasoning about the next slot but coding the last one — is worth naming because it's a whole family. Any logic that anchors a deadline on a *recurring* event rather than on the last *observed* one will slide forward forever and never trip. Heartbeats, lease renewals, watchdogs: same failure. The comment that made it look intentional is part of how it survived — a rationale sitting next to the code that reads as though someone checked it.

## What I'd still change

Two things, and one of them is honest unfinished business.

The alert text still reasons in minutes — *"overdue by 5 minutes"* — which reads identically whether a job missed one cycle and self-healed or has been dead since yesterday. It should count cycles: *"1 cycle missed, next run expected at 00:45"* is a blip; *"3 cycles missed, last ping 00:00"* is an outage. One line of formatting, and it changes whether you look at the alert now or in the morning.

And the ping endpoint itself is still unauthenticated on the local network. Anyone who can reach the port can forge a ping for any check and mask a dead job — the switch's whole job, defeated by a curl. Closing that means rolling a shared token into every ping URL across every host that runs a job, which is a coordinated change rather than a one-line edit, so it's documented and not yet done. A dead-man's switch that can be lied to by anything on the LAN is a monitor with a known hole in it, and I'd rather write the hole down than pretend the green is real.
