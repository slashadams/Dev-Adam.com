---
layout: post
title: "SMART Said PASSED. The Drive Was at 102% of Its Rated Life."
subtitle: "One of my agents stopped answering while the other kept working — and underneath both of them was a disk reporting itself healthy while it corrupted its database."
date: 2026-11-24 00:01:00 -05:00
tags: [homelab, proxmox, storage, matrix, self-hosting, monitoring]
---

One of my agents stopped answering me. The other one kept working.

That's where this starts, and the asymmetry is the part that cost me time. I run several agents on one box, and they all talk to me through the same Matrix homeserver — a container on one of my two Proxmox nodes that holds every message between us. When a single agent goes quiet you don't conclude "the homeserver is damaged." You conclude something is wrong with *that* agent, because the evidence in front of you is that the other one is fine.

So I dug into the agent, and the agent's developer — who could still reach me — started digging too. What we found wasn't in the agent at all. It was underneath everything.

## The drive I already knew about

I'd pulled this disk's numbers a few days earlier, in an audit I ran for an unrelated reason:

```
SMART overall-health self-assessment test result: PASSED
Percentage Used:                    102%
Data Units Written:                 157,611,706 [80.6 TB]
Media and Data Integrity Errors:    3,120
Error Information Log Entries:      34,375
Power On Hours:                     10,173
```

Health: passed. Endurance: exceeded. That's the whole post, really, and it's the reason this took a disk *audit* rather than a disk *check* to find.

`SMART overall-health self-assessment` is a tripwire that fires when a drive is essentially already dead. It stays green while a drive is past its rated write endurance and throwing media errors on the way down. Nobody reads it as "not dead yet," including me — it reads as a verdict, and it's the field a health check is most likely to look at.

The numbers that mattered were sitting in the same output, above the fold, in plain text: `Percentage Used` and `Media and Data Integrity Errors`. They also *trend*, which is the useful property. One reading is a fact. A daily reading of them is a curve, and the curve is what tells you how much time you have.

So I knew the disk was on its way out. What I didn't know was the shape of the failure, and that's the part that got me.

## What a failing disk does to an open database

The failure I expected was loud. I/O errors, service stops, replace the drive.

What I got was quieter, and much less like a disk problem:

```
nvme0n1: I/O Cmd(0x2) @ LBA 181562496, 128 blocks, I/O Error (sct 0x2 / sc 0x81) MORE DNR
critical medium error, dev nvme0n1, sector 181562496 op 0x0:(READ) flags 0x0 phys_seg 1 prio class 2
```

A `critical medium error` means the drive physically could not read back a sector it had written. On a filesystem with parity that's survivable. On an append-heavy embedded database it is not, and the homeserver's store is exactly that: RocksDB, with a write-ahead log that assumes every append it acknowledges survives.

The write-ahead log had already been destroyed once by that drive. What made it hard to notice is that the *symptom* looked like software. A log write failing, a service that starts fine on the next attempt, an intermittent fault correlating with nothing — that reads as misconfiguration. The actual evidence was in the kernel ring buffer, one `journalctl -k` away, and I was reading the application's log instead, because the application seemed like the plausible thing to be broken.

That's the lesson I'd keep: **a failing disk and a buggy service present the same symptoms, and the service is the more interesting thing to investigate.** When something intermittent is happening above a database, check the layer underneath before you start reading config files.

## Standing it back up is the easy part

Once we understood what we were looking at, the move was straightforward: stand a fresh homeserver up on the *other* node with a clean database, and leave the original container stopped in place so there was a rollback.

That worked. The new server came up clean, synced, and served requests with no errors.

The swap itself is one-way — the new container takes over the original address and the old one gets shut down — so it ends with a chat client holding a session on a server that no longer exists, and a manual login to the new one.

Then I couldn't reach my agents at all.

It's an obvious-in-hindsight consequence of starting fresh: **a new homeserver invalidates every access token the old one ever issued.** Every agent process still holding a previous token got this back instead of a message stream:

```
Matrix: permanent auth error, stopping sync: M_UNKNOWN_TOKEN: Unknown access token.
Matrix: failed to send to !<room-id>: M_UNKNOWN_TOKEN: Unknown access token.
```

The framework read that as a permanent authentication failure and tore the Matrix connection down, and only a restart brought it back. It could still *send*. It could no longer *receive*.

So for a stretch, the chat looked healthy from my side. Replies kept arriving, because outbound was fine. Everything I sent went nowhere. A dead channel that still looks alive is worse than one that's obviously down, because you keep talking into it and the silence reads as the agent thinking.

## The recovery ended with a step the automation couldn't take

There's a second thing that broke, and it's the more interesting one.

Bringing the agents back needed a restart of the gateway on my box — and a gateway can't restart itself. The restart tears down the process that would be issuing the command, so it doesn't survive its own restart. That guard is deliberate and correct, and it means the last step of this recovery was structurally out of reach of the thing doing the recovering.

It ended the way it started: with a person at a terminal, running one command. The agents came back a minute later.

I'm not going to call that a design flaw. I'd rather have a process that can't shotgun its own supervisor than one that can. But it does mean any recovery that ends in "restart the service" ends with a human — and everything upstream of that human has to still work at the moment the thing they're recovering doesn't.

That's the part I'd keep from this episode, more than the disk. The last mile of a recovery is usually a person. The interesting question is what still reaches them when the system doesn't.

## What I changed

**Read the counters, not the verdict.** A health check that reads `SMART Health Status` and stops is a check that tells you everything is fine until the day it doesn't. `Percentage Used`, `Media and Data Integrity Errors` and `Available Spare` are the signals, and they grow — so a stored daily reading gives you a trend instead of a single green word.

**Don't host the thing you talk through on the disk you're least sure about.** The chat server was on the one node with no redundancy, and it was the worst possible service to lose, because losing it removes the channel I'd use to hear about losing it. It lives on the other node now. That's an unglamorous mitigation, and it's the one that would have saved me the most time.

**Verify the receive path, not just the send path.** After a credential change, the thing that gets tested is outbound: you send, you get a reply, you conclude you're connected. The agents kept replying the whole time they couldn't hear me. Nothing in that view tells you the difference between working and deaf.

## What I'd still fix

The drive is still in the machine. Still reporting `PASSED`. Still at 102%, and it threw another `critical medium error` seven minutes before the replacement homeserver came up on the other node — a nicely timed reminder that "nothing important runs on it anymore" is not the same as "safe to leave in."

Nothing else on that node matters as much as the chat server did. But "nothing else matters much" is exactly how a known-failing drive stays in service, so it gets replaced rather than demoted to a job nobody watches.

The bigger gap is interpretation. I had the telemetry and I didn't have a written answer to *what a bad number looks like*. That's the difference between collecting data and having an alert, and I had the cheap half of it for longer than I'd like to admit.
