---
layout: post
title: "Backing Up a Container to a NAS Ran at 10 MB/min. Local Disk Ran at 183 MiB/s."
subtitle: "Same data, same compression, same machine. The difference was the storage backend — and the reason is a lesson about every backup job you've ever pointed at a network share."
date: 2026-10-29 00:01:00 -04:00
tags: [proxmox, homelab, zfs, nfs, backups, storage, performance]
---

I needed to move a container from one Proxmox node to the other. The nodes aren't clustered, so there's no live migration — it's stop, dump, restore. Fine. The dump is the part I expected to be quick.

A 1.1 GB container. I ran the backup with the archive landing on the NAS, because both nodes mount it and it looked like it would save me a copy step.

It took about **thirty minutes**.

The same container, same command, same compression, written to the source node's local disk, took **eleven seconds**.

That's not a small gap. That's two and a half orders of magnitude, and it's worth understanding because the same trap is waiting in every backup job aimed at a network share.

## The numbers

- **Local disk:** 1.1 GB in 11 seconds — about **183 MiB/s**
- **NAS over NFS:** 1.1 GB in ~30 minutes — about **10 MB/min**

Same data. Same `vzdump`, same `zstd` compression, same node. Only the destination changed.

The obvious suspect is the network, and the obvious suspect is wrong.

## Why it's slow, and why it isn't the network

`vzdump` writes a **tar stream**. That's not one big sequential write — it's thousands of small ones. Every one of those small writes goes over NFS, and NFS commits each to stable storage. The NAS runs ZFS at `sync=standard`, so every commit also has to land in the ZIL before returning.

That converts the transfer from **bandwidth-bound to latency-bound**. Link speed stops mattering, because you're never waiting on throughput — you're waiting on a round trip per write.

The diagnosis is in request size, not in feelings. On the receiving host:

```bash
iostat -x 1 2 | tail -25      # wareq-sz = avg write size, f/s = fsyncs/sec
cat /sys/class/net/<iface>/speed   # the NIC's real link speed
```

What came back: an average write of **1.4 KB**, with **126 fsyncs per second**.

1.4 KB writes are metadata churn. One seek per commit, and the spinning disks are the bottleneck — they can only seek so many times per second, and 126 times a second is roughly what they're capable of.

Meanwhile the NIC reported **1000 Mb/s**, and the transfer was using **1.3 Mbps**.

**The network was carrying one-thousandth of what it could handle.** It was never involved. A saturated link with large requests looks completely different — you'd see the interface pinned and the disks idle.

If you want the general rule: **if the wire is idle and the disks are busy, it's a commit-per-write problem, not a network problem.** And it will not be fixed by a faster link, because a faster link shortens a wait that isn't happening.

## The fix, and the fix that looks tempting

The fix is boring: **write the dump to local disk, then copy the finished archive.**

```bash
# on the source node — its own disk, fast
vzdump <ctid> --mode suspend --storage local --compress zstd

# then move the single finished file
ssh root@<source> 'cat /var/lib/vz/dump/vzdump-lxc-<ctid>-*.tar.zst' > /tmp/x.tar.zst
ssh root@<target> 'cat > /var/lib/vz/dump/vzdump-lxc-<ctid>-*.tar.zst' < /tmp/x.tar.zst
sha256sum /tmp/x.tar.zst
```

One large sequential file over the same NFS mount moves at normal speed, because it's a single stream instead of thousands of tiny commits. The thing that was slow was never "using the NAS" — it was writing many small files to it, synchronously.

**The tempting fix is `async` on the NFS mount.** Don't. That trades the latency for data loss on crash — on the share that holds your backups. You'd be trading durability for speed on precisely the data you can least afford to lose.

## The same cause makes `rm -rf` hang forever

Once you understand the commit-per-file behaviour, this one stops being mysterious.

Deleting a dump tree over NFS costs one commit per file, exactly like writing it did. So a recursive delete is as slow as the backup was — and worse, the process parks in **`D` state**, uninterruptible I/O wait. You can't kill it. It holds the parent shell. It will not respond to Ctrl-C.

**Delete from the server side instead**, where unlinks are local and immediate:

```bash
ssh <nas> 'sudo rm -rf /tank/backup/dump/vzdump-lxc-<ctid>-*.tmp'
```

The client-side `rm` then releases on its own.

## A related trap: an exit code that describes the wrapper

While I was in here I got bitten by something that generalises well beyond backups.

`timeout 500 ssh host 'vzdump …'` returns **0** when the timeout kills the *client*. The remote `vzdump` keeps running, orphaned and detached, and nothing in that exit status says so.

If you read the `0` as "the backup finished," you report a job as done that had barely started. **Confirm completion from the remote side** — check that the archive exists and its size matches the source volume, or read the task log. Never from the local exit code.

Same family of bug: `pgrep -f <pattern>` matches your own command line. I ran something like `pgrep -c vzdump`, got `1`, and there was no `vzdump` running at all — the pattern had matched an `rm -rf …/vzdump-lxc-…` command sitting in the same shell. Read the full command line (`ps -eo pid,stat,etime,cmd`) before concluding a process is alive.

## What I took from it

The instinct when something network-attached is slow is to blame the network. Here the interface was at 0.13% utilisation while the disks were at their seek limit.

Writing locally and copying one finished file is a small amount of extra scripting to avoid a problem that looks like a bandwidth issue and is actually a latency one. The NAS isn't slow — it's slow at *synchronous small writes*, which is a much narrower and more fixable statement.

And the backup job you have pointed at a network share right now, the same way mine was, is probably paying the same tax. Worth measuring before you assume it's fine.
