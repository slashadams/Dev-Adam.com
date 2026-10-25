---
layout: post
title: "I Added a Syncthing Relay to Solve a Problem That Did Not Exist"
subtitle: "And then spent a while tuning it, before discovering that the two devices could already talk to each other directly. Plus the debounce race that generates conflict files out of perfectly normal write bursts."
date: 2026-11-06 00:01:00 -05:00
tags: [syncthing, homelab, file-sync, self-hosting, networking, debugging]
---

I have a small file-sync mesh: my phone, an LXC running my agent, and a dedicated Syncthing container. Nothing exotic.

At some point I added a relay — a dedicated Syncthing instance in the middle — because I was working from the assumption that **my phone couldn't reach the agent's container over Twingate.** The relay would bridge it.

That assumption was wrong, and I never checked it before building around it.

## The check that would have prevented it

```bash
ip route
```

Phone at `10.0.100.15`. Agent container at `10.0.100.102`. Same subnet. **Direct path, no relay required.**

The two devices could always talk to each other. I'd added a stateful middleman to solve a connectivity problem that didn't exist, and then spent time tuning the middleman when things misbehaved.

## What a relay actually costs

It's worth being concrete, because "add a relay" sounds free and isn't. A relay is a **real Syncthing instance**, which means:

- **It holds local copies of every file in every folder it's a peer of.** For my wiki and service-call logs, that's a full second copy of data I was trying to sync, not protect.
- **It becomes a state-divergence point.** Its `index-v0.14.0.db` can disagree with the source, and now you have three devices whose state must reconcile instead of two.
- **It's a new failure surface.** Its disk fills, its config drifts, its process dies — and each of those presents as a *sync* problem, sending you to debug the wrong layer entirely.

The design question to ask before adding one:

> Can device A and device B both reach device C reliably, but not each other?

If yes, that's a real reason for a relay. If they can each reach C, the chance they can't reach each other is small — and you should verify it rather than assume it.

**The symptoms that the relay is the problem rather than the fix:**

- Local deletes on device A appearing on device B without an explicit sync
- Conflict files appearing **on the relay** that don't exist on the source
- The relay's local state diverging from the source after every scan cycle
- Cluster-state counts (GlobalFiles/GlobalDeleted) disagreeing with what's actually on the source's disk

If you see those, the fix is almost always **"remove the relay from this folder's peer list,"** not "tune the relay's config." I did the second one for a while before doing the first.

My dedicated Syncthing container does still exist — but for one folder only, the one whose data lives on a disk bind-mounted from the NAS. It's a peer for that folder because it *has* to be, not a general-purpose relay. That's the distinction I should have drawn at the start.

## The other problem: conflict files from normal write bursts

Separately, and more interestingly, I had `.sync-conflict-<timestamp>-<device-id>.md` files appearing in a folder, timestamped within seconds of the source writing files.

The mechanism is a debounce race, and it needs two things to happen:

**The receiving peer has `fsWatcherEnabled="true"` with `fsWatcherDelayS="5"`.** The watcher fires on the first write, debounces five seconds, then starts a scan.

**The source writes a burst shorter than the debounce window.** If three to five files land within thirty seconds — which is exactly what a script doing rapid edits produces — then:

1. The watcher fires on file one and starts its 5-second countdown
2. The scan begins
3. The source pushes file two mid-scan
4. The receiver's local copy is in flux — the watcher just saw a change, and the scan is reading it
5. The upstream version diverges from what the scan is looking at

Syncthing's safe move at that point is to preserve a snapshot of what it just saw locally as a conflict file. Which is correct behaviour, and completely spurious from the user's perspective — nothing conflicted, the timing just overlapped.

**The fix is on the receiver:**

```
fsWatcherEnabled="false"
```

With the watcher off, `rescanIntervalS="60"` catches up on its own. Source-side idle gaps between bursts are usually 30+ minutes, so sixty seconds of detection latency is invisible in practice.

**The caveat that makes this worth writing down:** this is a **receiving-peer** config change. The source, the device doing the writing, can keep its watcher enabled without affecting the race — because the race is about the receiver's local state diverging mid-scan, not about the sender's outgoing events.

If you're seeing conflict files and you go tweaking the writer's config, you'll change nothing and conclude the fix doesn't work.

## What both problems have in common

Neither was a Syncthing bug. Both were **assumptions I hadn't tested.**

The relay assumed a reachability problem. `ip route` would have disproved it in one command. The conflict files assumed a genuine data conflict; reading the timing showed it was a scan window.

In both cases the tool behaved correctly given what I'd set up, and the debugging time went into making the setup more elaborate rather than checking whether the premise held.

If you're about to add a component to a sync topology, the first question is still whether the two endpoints can see each other. Run `ip route` on both. It takes ten seconds and it would have saved me an entire detour.
