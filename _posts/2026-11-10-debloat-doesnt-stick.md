---
layout: post
devto: true
title: "Debloat Doesn't Stick. That's the Entire Product."
subtitle: "Windows keeps every bundled app in two places, and most scripts only remove one of them. That's why the apps come back — and why removal is the easy half of the job."
date: 2026-11-10 00:01:00 -05:00
tags: [windows, debloat, privacy, ai-agents, developer-tools, side-projects]
bsky: |
  Most Windows debloat scripts remove the per-user app package. Windows keeps every bundled app in TWO places.
  
  Remove only one and it comes back for the next account, and sometimes after an update. That's why people say "it came back."
  
  Link in bio.
---

Last month I wrote about [debloating my Google TV Streamer over ADB](/blog/debloating-android-tv-over-adb/). The lesson there was *disable, don't uninstall* — keep the road back.

This is the same problem on Windows, except Windows has a second failure mode the streaming devices don't, and it's the one that makes people say "I removed that already."

## Windows keeps every app in two places

This is the fact the whole design hangs on.

Windows keeps two copies of any app that ships with the OS: the copy installed into your user account, and the copy baked into the system image that gets installed for **new** user accounts. They're separate things with separate removal commands, and the command that lists them isn't the one that deletes them.

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

On Fire OS, for example, the command that disables an app comes straight back with "Cannot disable a protected package."

Amazon protects its own launcher outright. So on Fire TV you're largely limited to disabling, not removing — and the protected set grows with each OS release. The `pm disable-user` mechanics are the same ones from the ADB post; the lockout is new.

Which is where the design lands: one engine, per-device rule sets. Windows and Android-based streaming devices share the same shape — inventory, tier, back up, apply, verify, restore. The collectors and the rule sets change. The machinery doesn't.

## Where it actually stands

A first build exists, and it's past the design it started from. One 4,784-line Python file, standard library only, carrying two collectors — Windows AppX and Android media devices — over the same machinery: snapshot, tier, plan, apply, verify, restore, and a scheduled `run`.

`--selftest` runs 22 offline checks with no device attached. Both execution seams are injectable — PowerShell *and* `adb` — so the parsers and the tier logic get tested without a Windows box or a plugged-in TV. It runs in CI, it's tagged `v0.2.0`, and the release ships a checksum you can verify the download against.

Then I had the spec reviewed before going further, and the review plus a pass over the code turned up four things the document hadn't. Three worth naming:

**The health check was running and its result was thrown away.** The write path probed the device after every change and then logged `APPLIED` regardless. That probe was the main protection against a bad disable taking the device off the network — and a device that's off the network can't be rolled back, because rollback needs ADB to work. A check whose output nobody reads is worse than no check: it looks like coverage.

**Unreachable was being recorded as "everything is fine."** The snapshot function ignored every `adb` return code, so a sleeping TV produced a *successful empty snapshot* that read as "all the bloat is gone" — and replaced the real baseline. A device being asleep isn't an incident. Silently overwriting your good baseline with nothing very much is.

**Drift got misattributed.** Any package that came back enabled was blamed on a firmware update. Snapshot state can't tell an OTA from the owner deliberately re-enabling an app. It's now attributed from a change ledger, and only blamed on an update when Sisyphus is what disabled it.

**One thing the review didn't close, and I haven't either:** `com.google.android.tvrecommendations` is still on the removable list. There's enough reporting of it taking the home screen down that it needs testing on the device before it ships as safe. The tier list came from one real machine, and one real machine can only tell you so much.

## What I'm still working out

- **Elevation.** Removal of provisioned packages needs admin, which the network tool I've been building never does. Different trust posture, different support burden, and I haven't decided how much of that to take on.
- **Per-model tiering as a maintenance problem.** Per-model is correct and it also means a maintained list per OEM. Getting the model detection wrong has to fail toward *never touch* rather than toward removing something.
- **Which one gets a price first.** Both are built and both pass their tests now. Sequencing two finished things is a different problem than sequencing one, and it's the one I keep deferring.

No price and nothing to buy. Writing it up because the per-user-versus-provisioned distinction is the kind of thing that's obvious once you've seen it and invisible until then — and it's the difference between a debloat that works and one that quietly undoes itself.
