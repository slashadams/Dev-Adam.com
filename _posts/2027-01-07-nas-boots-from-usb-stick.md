---
layout: post
title: "Your NAS Boots From a USB Stick. The Fix Is $25, Not a Pile of Tweaks"
subtitle: "Every guide tells you to move logs to RAM and enable zram. On a small ZFS box that's the wrong lever entirely."
date: 2027-01-07 00:01:00 -05:00
tags: [self-hosting, zfs, homelab, storage, linux]
devto: true
bsky: |
  Your NAS boots from a USB stick. Every guide says log2ram, zram, noatime.

  On a 4 GB box running ZFS those steal RAM from the read cache — and they only treat the symptom. Thumb drives have no wear-levelling.

  The real fix is the medium, and it's $25. New post.
---

My NAS boots from a USB stick. Not by choice, and not for a clever reason — by arithmetic.

The box is a four-bay unit with a low-power Intel chip and 4 GB of RAM. All four SATA bays are the ZFS pool. The base model has no M.2 slot; the NVMe slots live on the more expensive variants. So when the OS went on, there was nowhere for it to live except a USB flash drive hanging off the back.

That was fine for a weekend. It's less fine a year later, because the cheap flash stick my operating system is on has no wear-levelling and no controller worth the name, and it's quietly consuming its own write endurance every minute the box is up.

So I went looking for how to make it survive. The answer was the same everywhere, and it turned out to be the wrong answer for this machine.

## The standard advice, and why it's aimed at a different box

Search "extend USB stick lifespan Linux" and you get a fixed set of moves:

- **Move `/var/log` to RAM** with `log2ram` so log writes stop hammering the stick
- **Use `zram` instead of disk swap**, keeping swapped pages compressed in memory
- **Mount with `noatime`** so the filesystem stops writing access timestamps on every read
- **Move container data** (Docker, LXC) off the boot device

That is textbook boot-media hygiene, and on a Raspberry Pi it's exactly right. On this box most of it is either pointless or actively counterproductive.

**`log2ram` and `zram` both take memory, and on this machine memory is the product.** The entire reason for running ZFS here is ARC — the read cache — which is what makes reads off spinning disks feel fast. Every megabyte `log2ram` claims for logs is a megabyte pulled out of ARC to hold data that doesn't need caching. On a node with 32 GB that's a rounding error. On a 4 GB storage box it's a real bite out of the one thing the machine is for. You're robbing the read cache to protect the boot stick, which is a strange trade when the pool is the point.

There's a second problem with `zram` specifically: it's a kernel feature, and it isn't universally well-behaved. The Proxmox project documents it causing soft lockups on some hardware and explicitly warns against mixing it with a real swap device. I'm not running Proxmox on this box, but the kernel doesn't care whose wiki the warning came from. Adding a compressor and a second swap target to a 4 GB machine that exists to hold disks is adding moving parts to buy back a few writes.

**`noatime` is free but nearly pointless here.** It's a genuinely good flag and costs nothing. But `relatime` has been the default mount option for years, which already cuts access-time writes down to roughly once a day per inode. `noatime` saves you the difference between "rarely" and "never" — real, but not the thing that's killing the stick.

**And the deeper problem: all of these treat a symptom.** `log2ram` reduces how often you write to a bad medium. It does nothing about the medium being bad. You can cut the write rate by 80% and you've still got a device with no wear-levelling that will fail, and — the part that actually hurts — fail *quietly*.

## The real fix is the medium, not the tuning

A flash thumb drive and a SATA SSD are the same shape and completely different devices. The SSD has a controller that does wear-levelling and garbage collection; the stick has neither. That controller is the entire reason an SSD survives years of writes and a cheap stick doesn't survive months.

You don't need capacity. The OS takes maybe 16 GB on a good day. You are buying the controller and the wear-levelling, and the capacity is whatever comes attached to them.

So the fix is two parts, and it's about $25:

1. **A small 2.5" SATA SSD** — brand-name, ~$20–25, whatever size is cheapest. A known controller on a 24/7 box beats a $14 no-name gamble.
2. **A USB 3.0 → SATA enclosure with UASP** — ~$9–10, sometimes less.

Total: roughly $23–30. That's the whole project. It is not a tuning exercise.

## The part nobody mentions: TRIM is off by default over USB

Here's the detail that separates "I put an SSD in a USB enclosure" from "I put an SSD in a USB enclosure and it will last."

Over USB, TRIM is the SCSI **UNMAP** command, and the Linux kernel only sends it when the disk reports it can accept it. USB bridges ship with that switched **off** — the bridge negotiates the connection fine, the drive mounts fine, files copy fine, and nothing anywhere tells you that deleted blocks are never being reclaimed. The SSD's garbage collection still runs, but it can't know which blocks are free, so the drive fills with stale data and its performance and endurance quietly degrade.

You can check the state of this in three commands. First, confirm the enclosure actually bound to the UASP driver rather than the old one-command-at-a-time Bulk-Only Transport:

```bash
lsusb -t | grep -i uas
```

`Driver=uas` means UASP is in play. Then check whether the kernel thinks the device can be trimmed:

```bash
cat /sys/block/sdX/device/provisioning_mode
```

`unmap` means TRIM works with no extra setup. `full` — or worse, no support at all — means it doesn't, and you're in the "mounts fine, silently degrading" state. You can confirm from the other direction with `lsblk -D` (a non-zero `DISC-MAX` means discards are supported) and with `sg_vpd -p lbpv /dev/sdX` from the `sg3-utils` package, which reads the drive's logical block provisioning page directly.

If it says `full`, the fix is one line — a udev rule that tells the kernel to enable UNMAP for that specific bridge, matched on the enclosure's vendor and product IDs:

```
ACTION=="add|change", KERNEL=="sd[a-z]", \
  ATTRS{idVendor}=="<bridge vendor>", ATTRS{idProduct}=="<bridge product>", \
  ATTR{provisioning_mode}="unmap"
```

Drop it in `/etc/udev/rules.d/`, reload the rules, replug, and `provisioning_mode` flips to `unmap`. Then `fstrim -v /` works, and you can schedule it from `fstrim.timer` like any other SSD.

Two notes on that. **The SATA-over-UASP path is more reliable for TRIM than an NVMe enclosure** — several NVMe bridge chips handle UNMAP inconsistently, so if you're buying an enclosure anyway, buy the SATA one for a boot drive. And **some enclosures advertise TRIM and SMART passthrough outright**, which saves you the guessing if you'd rather not pay for a rule you might not need.

## Cloning: from a live USB, never from the running stick

One step will corrupt your data if you get it wrong. You cannot `dd` the running root filesystem from the running system — that's like photocopying a page while someone is still writing on it. You'd get an image that looks complete and isn't.

The procedure is:

1. Boot a **separate live USB**.
2. `dd` (or Clonezilla) the OS stick onto the new SSD from there.
3. Expand the partition to fill the drive — `growpart` then `resize2fs` for ext4.
4. Swap the devices, confirm it boots, and *then* add the TRIM rule.

Some boxes have an internal USB header rather than only rear ports. If yours does, mount the new drive internally — a boot device that can't be knocked out of the back of the case is worth the extra five minutes.

## What I'd still change

The honest state of this box is that the current stick is still booting it while the SSD sits on a shopping list. The plan above is the plan; it isn't a retrospective.

The bit I'd flag to anyone following along: the `log2ram` crowd isn't wrong, they're just answering a different question. If your boot device is the only thing you can change, cutting its write rate is all you've got. But if you *can* change the medium — and for a fixed $25, you almost always can — the tweaks are a way of living with a bad decision instead of replacing it. Buying the right device beats tuning the wrong one every time.
