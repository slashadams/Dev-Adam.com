---
layout: post
title: "Moving a Container Between Two Unclustered Proxmox Nodes"
subtitle: "No live migration, so it's stop, dump, restore. Five things that bite you on the way — including an exit code that reports success while the job is still running, and a check that matched its own command line."
date: 2026-11-04 00:01:00 -05:00
tags: [proxmox, homelab, lxc, migration, zfs, nfs, devops]
---

I run two Proxmox nodes. They are deliberately **not clustered**, and the consequence is that moving a container between them is never a live migration.

This is the procedure, and more usefully, the five places it goes wrong.

## Why there's no live migration

Clustering two nodes looks like the obvious answer, and it isn't one here.

A two-node cluster needs a **third host running a QDevice** to break a split-brain vote when the two can't see each other. Without it, a network partition means neither node can be sure it's the surviving one, and the cluster's behaviour in that state is worse than the problem clustering solves. I don't have a third always-on box, so the tradeoff is accepted:

**`pct migrate` is unavailable, and every move is stop → dump → restore.**

That means planning for downtime across the transfer, not just the copy. Schedule it when a second instance — or nothing — can absorb the load.

## The procedure

**1. Inventory the container before assuming the move is easy.**

```bash
pct config <ctid>
```

Read for host coupling: `mp0` and friends (bind mounts), NFS mounts, a `rootfs:` on storage the target doesn't have, unusual `features:`, or a hostname the service depends on.

**This one step decides whether the move is a fifteen-minute job or an afternoon.** A container with no bind mounts moves cleanly. A container whose data path is an NFS bind-mount established *on the Proxmox host* is a different exercise entirely — you have to recreate that mount and its fstab entry on the target before the container's data exists at all, and the failure mode of forgetting is an empty mountpoint that the container will happily write into.

**2. Confirm the target can hold an LXC rootfs.**

```bash
pvesm status --content rootdir
```

Both `local` (dir) and `local-lvm` (lvmthin) qualify, but they are **not interchangeable** — Proxmox converts an image-on-thinpool into a file on dir storage during restore. My two nodes differ: one has only `local` (dir), the other has both. So restoring from one to the other always changes the storage backend, and the restore command has to say so explicitly.

**3. Back up to the source node's local disk, then copy the one finished file.**

```bash
# on the source node — its own disk, fast
vzdump <ctid> --mode suspend --storage local --compress zstd

# then move the single finished archive
ssh root@<source> 'cat /var/lib/vz/dump/vzdump-lxc-<ctid>-*.tar.zst' > /tmp/x.tar.zst
ssh root@<target> 'cat > /var/lib/vz/dump/vzdump-lxc-<ctid>-*.tar.zst' < /tmp/x.tar.zst
sha256sum /tmp/x.tar.zst
```

**Do not dump straight to the NAS**, even though both nodes mount it and it looks like it saves a step. On this hardware the same 1.1 GB container took **11 seconds** to local disk and **about 30 minutes** to the NAS. Same data, same compression, same node — the storage backend was the only difference, and the reason is that `vzdump` writes a tar stream of thousands of small synchronous commits rather than one sequential file.

`--mode suspend` is the right default: a brief pause rather than a full shutdown, safe for a small container. Use `--mode stop` only if the container doesn't respond to suspend.

**4. Stop the source before starting the restored copy.** This is load-bearing, and the reason is below.

**5. Restore on the target, overriding storage when it differs.**

```bash
pct restore <ctid> /var/lib/vz/dump/vzdump-lxc-<ctid>-*.tar.zst --storage local
```

Restoring to the **same CTID** is usually correct when the original is about to be destroyed — it keeps hostnames, config cross-references, cron entries, and monitoring pointed at the right thing.

**6. Verify before destroying the original.** Start the restored container, confirm the **service actually answers** — not merely that the container is `running` — and only then destroy the old one.

---

## Pitfall 1 — a DHCP reservation is keyed to the MAC, so the ORDER matters

A container configured `ip=dhcp` gets its address from the router's reservation against `net0`'s **hardware address**, and `pct restore` preserves that MAC. That's the feature that lets the address follow the container across nodes with no reconfiguration.

It's also what makes the sequence load-bearing: **if both containers run at once, they both claim the same reserved address.**

The symptom is not a clean conflict. It's **intermittent reachability for both** — some requests work, some don't, and it looks like a flaky network or a service problem rather than two hosts fighting over one IP. Much harder to diagnose than a straightforward failure.

Read the MAC off the running container rather than trusting a stale note, and confirm the reservation exists before the move:

```bash
cat /sys/class/net/eth0/address
```

## Pitfall 2 — an SSH wrapper's exit code describes the wrapper, not the remote job

This one is a genuine trap.

```bash
timeout 500 ssh host 'vzdump ...'
```

That returns **0 when the timeout kills the client.** The remote `vzdump` keeps running, detached and orphaned, and there is nothing in that exit status to tell you.

Read the `0` as "the backup finished" and you'll report a job as complete that has barely started.

- **Confirm completion from the remote side** — the archive exists, its size matches the source volume, or read the task log. Never from the local exit code.
- **A wrapper exiting 0 after a timeout means "I stopped waiting," not "it succeeded."**

Same family of bug, and it caught me immediately after: **`pgrep -f <pattern>` matches your own command line.** I ran a count of `vzdump` processes, got `1`, and no `vzdump` was running — the pattern had matched an `rm -rf .../vzdump-lxc-...` command sitting in the same shell.

Read the full command line before concluding anything is alive:

```bash
ps -eo pid,stat,etime,cmd
```

## Pitfall 3 — the nodes have no SSH trust between them

`scp` node-to-node fails with `Permission denied (publickey,password)`. Relay the archive through a third host (the two-command form in step 3 above). 400 MB over 1 GbE takes seconds, so the extra hop costs nothing and avoids setting up key trust between machines that don't otherwise need it.

## Pitfall 4 — "no bind mounts" is exactly what makes a container movable

A container with no `mp0`, no NFS, and no host references moves cleanly. That's not a coincidence — it's the property to check for.

The opposite case: a container whose data is an NFS bind-mount established on the **Proxmox host** via fstab plus `pct set --mp0`. Moving it means recreating that host-side mount *and its fstab entry* on the target before the container starts. Forget, and the container comes up with an empty mountpoint and writes into it — data silently going somewhere you didn't intend, on a path that looks correct.

**Read `pct config` before telling anyone a move is simple.** Mine differs container to container.

## Pitfall 5 — closing a host-kernel gap is a separate, larger decision

The two nodes sit at different kernel levels, visible from inside any container on them because `uname -r` reports the **host's** kernel.

Closing that gap requires a host reboot. A host reboot takes every container on that node down at once — on one of my nodes that includes the Matrix homeserver that carries my own conversation with the agent reporting the failure.

**Never fold a host reboot into a container-move task, and never start one without saying plainly that it removes the channel you'd use to report a problem.** Those are two separate jobs with two separate risk profiles, and doing them together means a failure in one is invisible in the other.

---

## The short version

Inventory first, because the config decides everything.

Dump to local disk, then copy one file.

Stop before you start.

Verify the **service**, not the container status.

And don't trust an exit code that came from a wrapper — the code describes the wrapper. Ask the remote machine whether it finished.
