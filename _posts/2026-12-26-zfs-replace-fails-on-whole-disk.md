---
layout: post
title: "\"Device or Resource Busy\": The ZFS Replace That Fails on the Whole Disk"
subtitle: "ZFS told me a disk was busy. Nothing held it. The real answer was inside the kernel module."
date: 2026-12-26 00:01:00 -05:00
tags: [zfs, self-hosting, storage, homelab, linux]
devto: true
bsky: |
  ZFS refused to swap a failed drive: "cannot open '/dev/sda1': Device or resource busy."

  Nothing held the disk — fuser, lsof and the holders tree were all empty.

  The fix was one character of the command. Link in bio.
---

A disk in my four-drive raidz1 pool started throwing current-pending sectors at around 1,100 power-on hours. Not a wear-out — a young drive failing early. I bought a replacement, powered the NAS down, and swapped it.

Bringing the new drive into the pool should have been a five-minute job. It cost the evening instead, because of an error message that pointed at the wrong thing.

## The swap

I pulled the wrong drive first. The replacement went into the `sda` slot, but on the way in I disconnected `sdd` instead of `sda` for a moment. It showed up as a SATA link flap — link down, then reattached. ZFS handled it the way it should: a 268 KB mini-resilver, 0 errors, `sdd` back online. Annoying, but not damage.

The real work started when the new drive was physically seated and I asked ZFS to use it.

`dmesg` showed the old drive dropping off the bus and the new one attaching cleanly a few minutes later. `lsblk` showed a blank disk with no ZFS label. SMART said PASSED. So: swap the pool member.

```
sudo zpool replace tank <guid> /dev/sda
```

And it failed. Every time.

```
cannot open '/dev/sda1': Device or resource busy
```

## Chasing a lock that didn't exist

`Device or resource busy` reads like a stale lock. Something is holding the device, find it, kill it, move on. That's the path I went down first.

My first guess was a udev/partition-table race — the classic one when you hand ZFS a freshly partitioned disk. The first attempt had already created the ZFS partitions (`sda1` and `sda9`) but died before writing the label, so I waited for things to settle and retried. Same error.

So I went looking for the holder:

- `fuser` on the device: empty.
- `lsof`: empty.
- The sysfs holders tree: empty.
- `/proc/mdstat`: no md devices at all.
- Nothing mounted from it.

Everything said the disk was free. Then I checked whether it was genuinely locked at all — writing a megabyte to both the whole disk and the partition:

```
dd if=/dev/zero of=/dev/sda  bs=1M count=1   # rc=0
dd if=/dev/zero of=/dev/sda1 bs=1M count=1   # rc=0
```

Both succeeded. So the device wasn't busy in any sense userspace can see. The `-f` flag didn't change anything either, which is the tell: `-f` overrides ZFS's own "is this device in use" safety check, and it still refused, because the failure was happening somewhere else entirely.

## What's actually going on

ZFS opens the replacement disk **exclusively** — `O_EXCL` — as a safety measure, so no other process can grab the disk you're about to hand to a vdev. Then, in the middle of the replace, it partitions the disk and tries to re-read the partition table to reach the new partition.

Re-reading a partition table is a `BLKRRPART` ioctl. And you can't re-read the partition table of a device you're already holding open `O_EXCL` — the kernel returns `EBUSY`.

So the sequence is:

1. ZFS opens `/dev/sda` exclusively. Fine.
2. ZFS writes a new partition table and asks the kernel to re-read it. Blocked, because ZFS itself holds the disk.
3. ZFS tries to open `/dev/sda1` to start the copy. That open fails.
4. The error you get names the **partition** — `cannot open '/dev/sda1': Device or resource busy` — and not the thing that's actually holding it: ZFS's own exclusive handle on the whole disk.

(This is a long-standing OpenZFS quirk, not something specific to my setup. It's in the tracker; it just reads like a lock and sends you hunting for one.)

## The fix

Hand ZFS the **partition** instead of the whole disk:

```
sudo zpool replace tank <guid> /dev/sda1
```

The replace cared about one character. Giving it `/dev/sda1` skips the partition-create-and-re-read step entirely — the partition already exists from the failed attempt — so there's nothing to re-read, nothing to get `EBUSY` on, and the replace starts immediately.

## The part that actually annoyed me

Once the command ran, the copy took **45.6 GB in 5:36, 0 errors**. Five and a half minutes. The pool stayed online the whole way and came back to `ONLINE` with all four members healthy.

So the resilver — the part I expected to be slow — was the fastest part of the night. The command that ate the time was the *replace*, and it ate it purely because the error string pointed at a lock that didn't exist. `fuser`, `lsof`, `udevadm settle` and `-f` were all dead ends, each of which looked reasonable from the error text.

The lesson I took: when a "device is busy" error survives every userspace check for a holder, stop looking for a holder. The holder can be inside a kernel module, invisible to `lsof` by construction.

## What I'd flag

- **The replacement drive is used, not new.** SMART reports **61,208 power-on hours** — about seven years. Its counters are clean at replace time (0 reallocated, 0 pending, 0 offline-uncorrectable, ~31 °C), so it works, but it's now the oldest thing in a pool whose other three members are at roughly 1,100 hours. That's backwards from what you want, and it's on the watch list.
- **No capacity gain.** raidz1 is limited by its smallest member, so a 6 TB drive in a 4×4 TB vdev adds nothing — usable stays ~10.4 TB. It only counts once all four are upsized, and `autoexpand` is off, so I'd have to turn that on at that point.
- **A version detail worth noting:** userspace `zfs` and the kernel module reported slightly different versions on this box (2.2.2 vs 2.3.4). I didn't chase it, because the fix above made it irrelevant and the pool is healthy — but it's the kind of mismatch I'd look at first if something odd shows up later.

Redundancy is back, the pool is clean, and next time I swap a member I'll hand `zpool replace` the partition on the first try.
