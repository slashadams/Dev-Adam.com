---
layout: post
title: "Your Dead-Man's Switch Is Lying to You"
subtitle: "A watchdog only knows what its record says. Mine kept that record in one file that two processes both rewrote — so it reported healthy jobs as dead, and quietly buried the ones that only run weekly."
date: 2026-12-22 00:01:00 -05:00
tags: [self-hosting, ai-agents, monitoring, homelab, developer-tools]
devto: true
bsky: |
  My watchdog reported healthy jobs as overdue seven times in one morning, because its state file had two writers.

  The weekly checks went quiet instead — which is worse, and took two days to notice.

  Link in bio.
---

I run about a dozen cron jobs on a box at home. Backups, a drive-health check, a weather pull, a couple of scrapers, the nightly session recap. None of them are precious individually, but a job that silently stops running is the failure mode that actually costs you — you find out weeks later, from the consequence.

So I have a dead-man's switch. Each job pings a small HTTP endpoint when it finishes successfully. A watcher loop runs every 60 seconds, works out the most recent scheduled slot for each check, and alerts my phone if that slot has passed without a ping. The alert says the check is overdue, how late it is, and when it last pinged.

That's the design. Here's how it lied to me twice in one week.

## The switch had two writers and one file

The state lived in a single JSON file: for each check, the last ping timestamp and the last slot I'd already alerted on. The ping handler read the file, updated one check, and wrote the whole thing back. The watcher thread, in the same process, did the same thing — read the file once at the top of its scan, evaluated every check, and wrote the whole file back.

Two read-modify-write cycles over one file. If a ping landed while the watcher was mid-scan, the watcher's stale in-memory copy went back over it. The ping was gone.

On the morning of November 11th, five daily checks lost their pings this way and the watcher fired **seven false "overdue" alerts in a single scan**. My phone got a burst of alarms telling me that backups, the weather check, and three others had all died at once. None of them had. They'd all run and pinged on time. The file just hadn't kept it.

The thing that made it diagnosable was the journal. `journalctl` had every ping, timestamped, for every one of those checks. The state file had `last_ping: null` for the same checks, at the same timestamps. **A ping and a *stored* ping are two different claims.** The job pinging is a fact about the job. The file containing the ping is a fact about my bookkeeping — and only the first one is true by definition.

Fix for that half: the watcher reloads the state per check instead of once per scan, merges its alert write onto a fresh read, and saves via a temp file plus an atomic rename so a concurrent read can never catch a half-written file. Straightforward, and I felt good about it.

That feeling was the second bug.

## Fixing the writer doesn't restore the record it already ate

Two days later I was looking at the status endpoint and two checks showed `last_ping: null`. Both of them — a weekly intel scrape and a weekly site-header check — looked dead.

They weren't. The journal held their pings from November 9th, `08:50:15` and `09:00:04`. What their entries contained instead was `last_alerted_slot` — only the field the buggy write path had preserved when it replaced the whole per-check dictionary. That residue is a fingerprint: a check that *was* pinged, by a writer that then threw the ping away.

And here's the trap, stated plainly: **every check that re-ran after the fix had silently healed itself.** The 15-minute and daily jobs pinged again within hours and looked perfectly healthy, which is exactly what I checked to confirm the fix had worked. The weekly ones had no reason to run for days, so they sat at `null` — reading as dead while their jobs were fine. "Everything's pinging again" was a true statement about the fast checks and a false one about the slow ones, and I'd reported it as the former.

A fix to a write path fixes future writes. It does not repair the data the bug already destroyed. Those are separate jobs, and I'd only done one.

## The journal is the only ground truth

The repair is a backfill: for every check, compare what the journal holds against what the state file holds, and write the missing timestamps back from the journal. Then verify the restored check by reading it through the live status endpoint — not by reading the file I just wrote, which is the same mistake in miniature.

But the backfill is the smaller half of the lesson. The bigger one is that a cache and a record are not the same thing, and I'd been treating a cache as the record. The journal is written by the kernel, one line per event, append-only, nothing to clobber. The JSON file is a convenience view of it that I was trusting as the source of truth. Once I framed it that way, the right relationship was obvious: the file is derived, the journal is authoritative, and any check that *only* exists in the file is a claim I can't back up.

So the verification step is now the journal, run against **every** registered check — not the subset that happens to re-run:

```bash
journalctl -u cron-healthcheck --since "-14 days" \
  | grep -o '\[ping\] [a-z0-9-]*' | sort -u
```

Anything in the journal that isn't in the state file is a lost ping to backfill. And there's a second comparison worth having, which catches the opposite failure — a check that exists on paper and nothing ever runs:

```bash
# every name registered with the switch
python3 -c "import re,pathlib;print('\n'.join(re.findall(r'^  ([a-z0-9-]+):',pathlib.Path('checks.yaml').read_text(),re.M)))" | sort > /tmp/registered
# ...and every name something actually invokes
{ crontab -l; systemctl list-timers --all --no-legend; } 2>/dev/null | grep -o '/ping/[a-z0-9-]*' | cut -d/ -f3 | sort -u > /tmp/spoken
comm -23 /tmp/registered /tmp/spoken
```

The left column is a monitor that will never ping, will page me every cycle once its grace expires, and will make "monitors healthy" false in every summary that only counts arriving pings. One of mine sat in exactly that state for four and a half months while I described it as a live weekly check.

## Why this is the shape of every "is my automation alive?" check

The uncomfortable part is that the failure is silent **in the exact direction that matters**. A watchdog that breaks loudly is an inconvenience. A watchdog that breaks quietly is worse than no watchdog, because you stop looking. And it fails toward "everything is fine" — the record says the jobs are healthy, the summary says the jobs are healthy, and the jobs are the only thing that disagree.

Three rules I'd write on the box now:

- **Store the ping where it can't be clobbered.** Append-only beats read-modify-write every time. If two things touch the same state, one of them is going to lose.
- **A check that could not run must never look like a check that passed.** Absence of a ping and absence of a *record* of a ping are different states, and the second one is a bug in the monitor, not the job.
- **Verify a monitor fix against the slowest thing it watches.** Fast checks heal themselves and will tell you the fix worked. The weekly ones are where the damage shows up.

## What I'd still change

The state file still exists, and I still like having it — it's a fast, readable snapshot of where everything stands. But it should be rebuildable from the journal at any time, and I don't want to be in a position where I can't tell whether a `null` means "never ran" or "ran and the record was lost." Those are the two states the whole thing hinges on, and right now the file can't distinguish them. A record of *when* the file was last reconciled from the journal would close that gap, and it's the next thing I'll add.

The other thing I'd change is the first alert. Seven alarms in one scan meant the monitor was describing its own bookkeeping problem as a dozen independent infrastructure failures. A check that goes overdue at the same moment as four others is almost never four separate faults — it's one shared cause, and the alert should say so instead of making me triage a storm.
