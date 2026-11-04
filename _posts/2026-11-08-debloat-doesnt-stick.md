---
layout: post
title: "Debloat Doesn't Stick. That's the Entire Product."
subtitle: "Windows keeps every bundled app in two places, and most scripts only remove one of them. That's why the apps come back — and why removal is the easy half of the job."
date: 2026-11-08 00:01:00 -05:00
tags: [windows, debloat, privacy, ai-agents, developer-tools, side-projects]
---

Last month I wrote about [debloating my Google TV Streamer over ADB](/blog/debloating-android-tv-over-adb/). The lesson there was *disable, don't uninstall* — keep the road back.

This is the same problem on Windows, except Windows has a second failure mode the streaming devices don't, and it's the one that makes people say "I removed that already."

## Windows keeps every app in two places

This is the fact the whole design hangs on.

```
Get-AppxPackage              # the per-user install
Remove-AppxPackage           # deletes that one
Get-AppxProvisionedPackage   # what installs for NEW user accounts
```

**Remove only the per-user package and it comes back.** Not immediately — for the *next* account created on that machine, and sometimes after an update. The system image still carries the package, so the per-user copy you deleted was never the real copy.

That's the whole reason this turns out to be a product rather than a one-liner. The internet is full of "run this and reboot" PowerShell, and nearly all of it does the first half. Then the person reports the app returned, and the internet concludes Windows is hopeless.

## The numbers, from a real machine

Before writing anything, I inventoried a real machine: **my own Samsung Galaxy Book, running Windows 11 Home**.

**108 provisioned packages.** A hundred and eight things Windows will install for every new account on that machine, forever.

- **69 Microsoft** — including the Store, the runtime libraries, the codecs, the GPU and audio drivers
- **28 Samsung OEM** — including the S Pen and continuity stack
- **11 third-party**

That inventory is the evidence base. The keep/caution/remove tiers are derived from it rather than hand-written, because guessing which of 108 packages is safe to remove is how you break someone's laptop.

## Removal was never the hard part

The second problem is reversibility, and it's worse than the first.

`Remove-AppxPackage` is not cheaply undoable. Restoring a package often means going through the Store, and for some of them that means a Microsoft account and a working network connection. On a device you can't easily reflash, that's a one-way door.

So the shape has to be **back up → remove → verify → one-command restore.** The backup isn't a nice-to-have bolted on at the end. It's the product. The removal is the easy half.

## The OEM trap

Here's the one that would have shipped a broken tool.

A blanket "OEM apps are junk" list is wrong, and on this machine it's expensively wrong. `AirCommand2`, `PENUP`, `SamsungNotes`, `QuickShare`, `SecondScreen` — those aren't bloat. They're **the S Pen and continuity features the laptop was bought for.** Strip them and the hardware stops doing what it was sold to do.

**OEM tiering has to be per-model, not per-brand.** Which turns rules into data that has to be maintained per device family, and that's a real design constraint, not a footnote.

## What I'm deliberately not touching

Defender. The firewall. Windows Update. Anything security-relevant.

Non-negotiable, for two reasons. Those are the parts Microsoft actively fights back on, and they're the parts where a wrong removal is a genuine security problem rather than an inconvenience. An app the user never opens is a nuisance. A disabled firewall is an incident.

## The same problem on the other screen

The scope isn't Windows only — that's just the biggest surface. The interesting half is media devices, because that's where the ads are and where the platforms fight hardest.

On Fire OS, for example:

```
pm disable-user com.amazon.tv.launcher
Cannot disable a protected package
```

Amazon protects its own launcher outright. So on Fire TV you're largely limited to disabling, not removing — and the protected set grows with each OS release. The `pm disable-user` mechanics are the same ones from the ADB post; the lockout is new.

Which is where the design lands: one engine, per-device rule sets. Windows and Android-based streaming devices share the same shape — inventory, tier, back up, apply, verify, restore. The collectors and the rule sets change. The machinery doesn't.

## Status: nothing is built

This is a design capture, and I want to be precise about that. There's a repository with a README, a design document, and one fixture — that 108-package inventory. There's no code yet.

That's deliberate. The two findings above changed the shape of the thing before I wrote a line of it. If I'd started with the script — remove the packages, print success — I'd have shipped something that comes back, and a restore path that doesn't exist.

## What I'm still working out

- **Elevation.** Removal of provisioned packages needs admin, which the network tool I've been building never does. Different trust posture, different support burden, and I haven't decided how much of that to take on.
- **Per-model tiering as a maintenance problem.** Per-model is correct and it also means a maintained list per OEM. Getting the model detection wrong has to fail toward *never touch* rather than toward removing something.
- **Whether it ships before or after the other thing.** The network checker is built and tested. This is a document. Sequencing those two is a real decision and I keep moving it.

No price and nothing to buy. Writing it up because the per-user-versus-provisioned distinction is the kind of thing that's obvious once you've seen it and invisible until then — and it's the difference between a debloat that works and one that quietly undoes itself.
