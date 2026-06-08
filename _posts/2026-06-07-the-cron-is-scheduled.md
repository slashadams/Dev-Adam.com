---
layout: post
title: "The Cron Is Scheduled. The Cron Is Not Working."
subtitle: "Three monitors I thought were running — and the routine I now use to actually check."
date: 2026-06-07 22:30:00 -04:00
tags: [agents, automation, devops, homelab, hermes, ai-agents, lessons-learned]
---

A few nights ago I asked my AI agent a simple question: "What cron jobs are running?" It listed five of them. Every one of them looked healthy in the schedule. Three of them were broken in ways I didn't catch until I went and looked.

This is a post about those three failures, why the schedule lied to me, and the routine I now use to actually verify that something I set up is still working.

## The failure mode I keep hitting

Here's the pattern. I (or my agent) set up a recurring task — a cron job, a scheduled script, a background service. It runs. It produces output. I move on to the next thing. A week later, I assume it's still running because the schedule is still there. It's not running, or it's running and crashing, or it's running and producing noise. From my perspective, nothing has changed, because I haven't looked.

I do this with human-managed stuff too — meeting reminders I trust because they show up on my calendar, server health checks I trust because the dashboard hasn't changed color, backups I trust because the script is in cron. **Trusting the existence of a schedule is a habit of mind, not a verification.** The schedule is a hope, not a measurement.

When an agent does this for me, the failure is the same but worse. The agent sets up the cron, reports "done," and moves on. There's no follow-up check unless I explicitly ask for one. The agent trusts the schedule the same way I do, and we both end up surprised.

## What actually happened this week

I'm going to walk through all three, because each one broke in a different way and they taught me different things.

### 1. The bsky monitor that ran every 15 minutes and did nothing

I have a small agent that polls my Bluesky account for new engagement (likes, replies, follows) and posts a digest to a Matrix alert room every 15 minutes. It's been in my crontab since June 1. The crontab entry is right there:

```
*/15 * * * * /usr/bin/python3 /root/felix/scripts/bsky_monitor.py
```

That's every 15 minutes. Always. Reliably.

What actually happened: every 15 minutes, the script started, hit `from atproto import Client`, got a `ModuleNotFoundError`, and exited. **No log line, no error email, no output.** The script wrote nothing to its log file because the failure happened before the `try` block that catches errors. The log file's last entry was from June 3 — four days before I noticed.

The bsky monitor had been silently dead for four days. Comments on my posts were not being aggregated. I was getting "engagement digest" pings from a script that had crashed on its very first import. I only found out because I asked the agent "are all those cron jobs actually running?" and it went and looked at the log files instead of just trusting the schedule.

**The lesson:** a script that crashes before it can write to its own log file is invisible. There's no signal that anything is wrong. The schedule is still firing on time. The process is still starting on time. It's just doing nothing.

### 2. The session-recap flag pile nobody told me about

My agent has a workflow for session handoffs. At 3am every day, a cron job scans the session database and writes "pending" flag files for any ended conversation that doesn't have a matching recap. Then, at the start of the next live session, the agent is *supposed* to read those flag files and surface them: "There are 6 sessions from last week that need recaps. Want me to generate them?"

The cron was working. The flag files were being written. **The agent was not surfacing them.** I had nine pending flag files sitting in `/root/felix/session-recaps/` for four days, covering 1,651 messages of conversation, and every new session I started began with zero handoff context. I had been operating "cold start" every morning for almost a week.

The fix turned out to be one line: at session start, glob the directory and surface the list. I added it to the agent's memory rules. The next session, the agent found the flags, generated the most recent four, and we moved on. The five older ones I left alone — they're for sessions I can reconstruct from the database if I ever need to.

**The lesson:** the cron worked, the skill existed, the documentation was clear. What was missing was the trigger. The agent has to *remember* to do the thing at session start. A documented workflow is not the same as an executed one.

### 3. The weekly intel digest that hadn't fired in five days

There's a weekly digest of Hermes Agent news, ecosystem changes, and adjacent tools. It runs Mondays at 9am Eastern. It's been in my crontab since the end of May. The last log entry is from June 2 at 23:20 UTC, which is the day after Memorial Day weekend. Today is Sunday, June 7. The next scheduled run is Monday, June 8 at 9am Eastern — about 15 hours from now.

This one isn't technically broken. The cron is correct. The script works (I verified by running it manually). The system is just... waiting. Five days is a long gap, and if I hadn't asked the question, I would have assumed the digest was firing every Monday as designed.

**The lesson:** silent gaps look like the system is fine. A weekly job that hasn't run in five days is a system that may not be working — but it might also be a system that just hasn't been triggered yet. You can't tell the difference from the schedule alone. You have to look at the log timestamps, not the cron syntax.

## The pattern across all three

Here's what every failure had in common:

- **The schedule was correct.** In all three cases, `crontab -l` showed exactly what I expected. None of these were misconfigurations of the cron itself.
- **The failure was downstream of the schedule.** The bsky monitor was crashing inside the script. The session-recap skill wasn't being triggered by the agent. The intel monitor had simply not been reached yet.
- **None of them produced a top-level error signal.** No emails. No Matrix alerts. No "this job failed" notifications. Each one was silent in a different way.
- **I trusted the existence of the schedule as evidence the thing was working.** That's the bug.

The trap is: when you set up a recurring task, the moment of setup has high energy. You verify it works, you move on, and your brain downgrades the task from "actively maintained" to "running." The schedule becomes a stand-in for the thing itself.

It isn't. The schedule is the *intent* to run the thing. The log is the *evidence* the thing ran. Schedule and evidence are different categories, and only the evidence tells you what's actually happening.

## The routine I now use

After finding all three, I changed two things:

**1. Verify the log, not just the schedule.** When I (or the agent) set up a new scheduled task, the follow-up step is to actually look at the log file a few days later and confirm there are recent entries. Not "the cron is in the crontab" — "the last log line is from yesterday and the format looks right." Five minutes of verification saves days of broken assumption.

**2. Build a heartbeat monitor — a self-hosted dead man's switch.** I built a small Python service (`server.py` + `watcher.py`) that runs on the Felix LXC at `http://0.0.0.0:9999`. Every monitored cron job, when it succeeds, hits a per-job endpoint:

```
*/15 * * * * /usr/bin/python3 /root/felix/scripts/bsky_monitor.py && curl -X POST http://127.0.0.1:9999/ping/bsky-monitor
```

The watcher keeps a `checks.yaml` schedule (cron expression, expected cadence) and a `state.json` of the last successful ping per job. A separate watcher process walks the schedule continuously, and when a job's last ping is more than one slot overdue, it posts a Matrix alert to `#nas-alerts`: "🚨 `intel-monitor` missed its 2026-06-04 09:00 slot — 9267m overdue." Debounce via `last_alerted_slot` prevents the same missed slot from re-firing on every check.

The cron-healthcheck is the change I'm most interested in. The agent wrote it, deployed it, and *also* added itself to the list of checks it has to verify. A meta-monitor. **It caught two real bugs in its own first run:**

- **Bug A:** the watcher's slot-walker walked one step too far and returned the next *future* slot instead of the most recent past one. Result: missed slots never triggered alerts — the watcher thought it was always "not yet due." Fixed by tracking `prev_slot` in the walk loop.
- **Bug B:** the server was bound to `127.0.0.1:9999` only. A canary script on the NAS that pings the healthcheck from another host timed out. Fixed by changing `host: "0.0.0.0"` in `checks.yaml` and restarting the service.

A monitor-of-monitors that can't see the things it's monitoring is just another silent failure waiting to happen. Both bugs would have been invisible without an end-to-end test that forced a missed slot. Schedule + endpoint + alert + test-that-the-test-actually-tests.

The second one is the real fix. You can't scale the habit of "remember to check every cron job" — humans (and agents) forget. A script that watches the other scripts is the only thing that scales.

## What this means for agentic workflows specifically

I talk a lot on this blog about building with AI agents. Most of my posts are about what works. This one is about what doesn't, and I think it's the more important kind of post to write.

An agent that sets up a cron job and reports "done" is doing exactly what a human would do — the minimum work to consider the task complete. The agent has no internal pressure to come back tomorrow and check. The human is the one with that pressure, and most of the time the human doesn't apply it either.

This is the "set and forget" failure mode applied to automation. It works for things that are obvious when they fail (a service is down, a page doesn't load, a deploy doesn't ship). It fails for things that are silent when they fail — a script that crashes on import, a skill that's not being triggered, a weekly job that hasn't been reached yet.

The honest version of "I have an agent that does X for me" is "I have an agent that does X for me, plus a follow-up routine that verifies X is still happening, plus a meta-monitor that alerts me when X has gone silent." Three layers, not one. The first layer is the work. The second and third are what make the work trustworthy.

If you're building agentic workflows and you don't have all three layers, you don't have an automated system. You have a schedule and a hope.

## The actual fix this week

In case you want the technical detail: the bsky monitor was a one-line fix (`pip install atproto`, which I should have done at setup time and didn't). The session-recap surface is a behavior rule added to the agent's persistent memory. The intel monitor will catch itself up Monday morning.

The cron-healthcheck is up and running. Six jobs are wired to it, the watcher has already fired real alerts for missed slots, and it caught two bugs in its own code on first run. It is itself in the list of checks it verifies, which is exactly the recursive structure I wanted. The skill is at `~/.hermes/skills/cron-healthcheck/SKILL.md` if you want the implementation details — what was built, what failed, what was fixed.

For now, the lesson stands on its own: **the cron is scheduled. The cron is not working. Check the logs.**
