---
layout: post
title: "My Drive Health Check Never Ran Once. For Four Months."
subtitle: "The cron file looked perfect. Cron was refusing to load it the entire time, and the health check that exists to catch a failing drive was caught by a different tool instead."
date: 2026-11-02 00:01:00 -05:00
tags: [homelab, cron, nas, zfs, monitoring, smart, lessons-learned]
---

My NAS runs a daily health check. It walks the ZFS pool, pulls SMART counters off every data drive, and posts a summary to Matrix. I wrote it because I wanted to know about a failing drive *before* it failed, rather than after.

It had never run. Not once. For four months.

The way I found out is the part that stings. Not from an alert, not from a log, not from the digest failing to appear — from a drive throwing real SMART errors, flagged by `smartd`, which was correctly configured and doing its job.

So the tool I built specifically to catch that did nothing, and the tool I'd more or less forgotten about caught it instead.

## The failure

I created the cron file as the `felix` user. It ended up owned `felix:felix`.

**Cron will not execute any file in `/etc/cron.d/` that isn't owned by root.** It doesn't warn loudly, doesn't disable gracefully, doesn't tell you at boot. It logs this:

```
cron[1410]: (*system*nas-drive-health) WRONG FILE OWNER (/etc/cron.d/nas-drive-health)
```

**Once a minute. Forever.**

That's the whole failure. The file was syntactically valid, the script existed, the schedule was right, the paths were right. It was simply never executed, and had been telling me so every sixty seconds for four months, into a log nobody was reading because nothing appeared to be broken.

The consequences:

- No `/var/log/nas-drive-health.log` was ever created
- The `✅ NAS daily check` digest had never once been posted
- The drive check had never inspected a single drive

And because a *missing* digest looks exactly like a digest nobody sent yet, nothing seemed wrong. Silence from a monitoring system reads as "no problems," not "not running." That's the design flaw underneath this, and it's more important than the permissions bug.

## The fix is one line

```bash
sudo chown root:root /etc/cron.d/nas-drive-health
sudo chmod 644 /etc/cron.d/nas-drive-health
```

Then confirm cron actually picked it up:

```bash
journalctl -u cron -n 20 | grep -i nas-drive-health
# 'RELOAD (/etc/cron.d/nas-drive-health)' means it loaded
```

**Always `chown root:root` after writing a file into `/etc/cron.d/`.** If you write those files as a non-root user — which is easy to do when you're generating them from a script or a tool running as your normal account — you get a file that looks correct in every listing and is silently inert.

## The second trap: cron's timezone is not yours

While fixing this I found the companion bug. The cron entry needed to fire at 6 AM local. Cron determines the **fire time** using its own timezone, and on a stock Ubuntu install that's UTC — regardless of what the system clock or a script reports.

So the schedule has to carry the timezone explicitly:

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
TZ=America/New_York
0 6 * * * root /usr/local/sbin/nas-drive-health-check >> /var/log/nas-drive-health.log 2>&1
```

A script can compute local time for itself, but it can't change when it gets invoked. `TZ=` in the cron file is what sets the fire time — and it handles EST/EDT automatically, so you don't need to touch it twice a year.

## The third trap: `set -e` in an alert script

I'd written the script with `set -e` out of habit. That was wrong here, and for a subtle reason.

If any part of the alert path fails — a rate limit, a network blip, the Matrix homeserver being briefly unreachable — `set -e` aborts the whole run. The cron job then exits non-zero having done *nothing*, including the local logging that would have told you it ran.

**For an alert-only script, let it run to completion and log even when the alert path fails.** Losing the alert should not lose the check, because the check is the part that matters. Log locally, attempt the notification, and let the notification failure be visible in the log rather than fatal.

## What the check actually does

Two design decisions worth stealing, both about not having to maintain lists.

**Discover drives from the pool, don't hardcode them.**

```bash
zpool status tank -L   # parse this for the drive list
```

Hardcoding `/dev/sda`, `/dev/sdb` breaks the first time a device renames — which happens on reboot, on cable swaps, on controller changes. Reading the pool membership gives you the right list every time, and it's self-correcting.

It also gives you a free denylist. My NAS has a 250 MB internal flash module holding the vendor's OS and a USB boot stick, neither of which is in the pool, so they're excluded automatically. No list to maintain, no chance of the check poking a drive it shouldn't.

**Per drive, the four counters worth reading:**

- `smartctl -H` — overall health, `PASSED` or not
- **Reallocated sector count** — any increase means the drive is starting to fail
- **Current pending sector count** — sectors the drive couldn't read and hasn't been able to remap. Greater than zero means it's about to try
- **Offline uncorrectable** — surface errors the remap couldn't fix

Plus temperature, alerting above 50°C.

Then check the pool itself: `zpool list -H -o health tank` should be `ONLINE`. Anything else is an immediate alert.

The distinction that matters: **`PASSED` on the overall health line does not mean the drive is healthy.** A drive with a growing reallocated count still reports `PASSED`. The counters are where the early warning lives; the headline is the last thing to change.

## The lesson I'd actually generalise

A monitoring job that is silently not running is worse than no monitoring, because it manufactures confidence. I believed I'd know about a failing drive. I would not have known.

Three habits fall out of that:

**Read the cron journal, not just the cron file.** The file being correct tells you nothing about whether it ran. `/etc/cron.d/` reload messages and `WRONG FILE OWNER` errors are both in the journal, and one of them was there once a minute for four months.

**Make absence visible.** A health check that posts a digest when things are fine means silence is ambiguous. Consider the inverse: have the check write a heartbeat somewhere you'd notice, so a *missing* run is itself an alarm. If the only signal is "I heard nothing," you cannot distinguish success from death.

**Verify a scheduled job after you create it.** Wait for the first run and confirm the artefact exists — the log file, the posted message, whatever the job is supposed to produce. Not "the cron file is in place." The first execution.

I did none of those three, and I got four months of not knowing. The ownership line took one command to fix; the confidence took longer to earn back.
