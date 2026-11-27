---
layout: post
title: "The Optimization That Was \"Do Nothing\""
subtitle: "I asked my agent to apply the Proxmox CPU tuning to my NAS. It came back with two answers: the knobs exist but buy nothing, and spinning the pool down would cost me wear, not save it."
date: 2027-01-05 00:01:00 -05:00
tags: [homelab, zfs, self-hosting, storage, linux, power-management]
devto: true
bsky: |
  I asked my agent to apply the same CPU power-tuning I'd used on my Proxmox nodes to my NAS.

  The honest answer: the knobs exist but buy nothing at idle — and spinning the pool's disks down is the one thing that actually wears them out.

  Link in bio.
---

I'd just finished tuning the CPU power behaviour on my two Proxmox nodes — governor to `powersave`, energy/performance preference to `balance_power` on every core, made persistent with a small systemd oneshot. It saved on the order of a watt per node at idle and kept the boost behaviour intact. Small, but free and reversible.

So the obvious follow-up: same trick on the NAS?

The box is a TerraMaster F4-425 with an Intel Celeron N5095 — four cores, the same `intel_pstate` driver as the nodes. The governor is already `powersave`. The one knob left to move is the EPP, sitting at `balance_performance`, which could go to `balance_power`.

I didn't move it, and the reason is that the two machines have opposite shapes.

## A laptop under load is not a file server at idle

The node change mattered because those are laptops running guest workloads continuously, with heat as the real constraint. Biasing the hardware's frequency hint downward cut clock residency and dropped the package temperature.

The NAS is the inverse. When I looked, the load average was 0.08 — it idles about 99% of the time, package temperature at 46 °C, chassis at 28 °C, fan nowhere near working. And EPP only biases the hardware's frequency *hint under load*; at idle the HWP driver parks the cores regardless of the preference. So the idle saving is approximately nothing.

When the NAS isn't idle, it's doing the job I bought it for: serving SMB and NFS, running a ZFS scrub, checksumming. `balance_power` deliberately ramps slower and holds lower clocks. The trade is a throughput tax at exactly the moment throughput matters, to save maybe a watt on a box with no thermal problem to solve. That's a worse trade than the nodes, not a better one.

## The disk question is the one with a trap in it

The next obvious instinct — can I make the drives spin down when they're idle? — is where you *do* something, and it's the wrong something.

The pool is a single `raidz1` vdev across four drives: one 6 TB 5700 rpm surveillance-class drive and three 4 TB 7200 rpm enterprise drives. There is no spindown configured anywhere — no `hd-idle`, no hdparm timer. APM on the enterprise drives sits at 128, which disables spindown by design, and the surveillance drive doesn't support APM at all.

Here's why that's the correct state and not a gap:

In a `raidz1`, **every read or write touches every member of the vdev.** ZFS also commits transaction groups and rewrites metadata constantly, and one of the datasets is carrying Syncthing traffic. There is no configuration where three of the four disks sleep and the pool keeps serving.

So if I forced it with `hdparm -S`, I wouldn't get sleeping disks. I'd get disks that spin down and get yanked back up minutes later, over and over, forever. **Start/stop cycles are the actual wear mechanism on a spinning hard drive** — far more than continuous rotation. Forcing spindown here would manufacture the exact failure I'm trying to avoid, and save roughly nothing in return. The drives are built to run continuously, and that's what mine are doing.

The counters back it up. Start/stop counts across the four drives: **92 / 21 / 25 / 34**. That's about 92 power cycles between all four of them over years of uptime. Nothing is cycling these disks, and nothing should.

## The one change that's actually worth making

`smartd.conf` uses `DEVICESCAN` with no `-n standby` directive. That means **every 30-minute SMART poll spins up any sleeping device.** The pool drives never sleep, so it doesn't touch them — but the box's USB devices, the boot stick and a small flash DOM, do sit in standby, and they get needlessly woken four times an hour.

Adding `-n standby,q` tells smartd to skip a sleeping device instead of waking it. One line, and it's the only disk change I'd make here.

## What to watch instead of what to tune

Two things matter more than spin behaviour on this box:

- **The oldest drive.** The 6 TB is a 5700 rpm surveillance-class disk with roughly **61,000 power-on hours** (~7 years), sitting in a pool of 7200 rpm enterprise drives. It's the slowest member of the vdev and by far the oldest silicon in the chassis. Its counters are clean — zero reallocated, zero pending — but it's the drive to watch.
- **The boot device.** The OS boots from a consumer USB flash stick rather than the on-board DOM, so a cheap drive is taking the constant root-device writes.

## Same tuning, different box, opposite answer

The optimization was "do nothing," and that was the right answer twice on the same machine. The CPU knobs existed and bought nothing. The disk knobs existed and would have cost wear. What both questions actually needed wasn't a setting — it was reading the shape of the hardware first.

A laptop under sustained load is not a file server at idle. A single-vdev pool is not a pile of independent disks. Copy the tuning from one box to another and you skip the part that mattered: understanding why it helped the first one.
