---
layout: post
title: "The Directory That Made the Bug Look Canonical"
subtitle: "A wrong-path bug recurred five times because a stale directory kept presenting itself as the right one. Deleting it fixed the bug — and broke the check that was supposed to catch it."
date: 2026-11-16 00:01:00 -05:00
tags: [debugging, root-cause, self-hosting, knowledge-base, agents, obsidian]
---

For months, my field-service agent kept writing its daily logs to the wrong directory.

Not once. Five separate times. Each time I found out later — a monthly rollup missing a day, or a file sitting somewhere I never looked. Each time I added another rule to stop it.

The rules never worked. The reason why is the part worth writing down.

## The wrong fixes

Every fix I tried had the same shape: add a check.

- Check where the other logs live before writing.
- Check the skill's stated path.
- Check that the target directory already has files in it.

Each one was reasonable. Each one failed. And the failure wasn't that the checks were wrong — it's that they were all pointed at the symptom.

## What was actually happening

At session start, the agent discovers the file tree. That discovery is the moment the path gets chosen — long before anything writes.

And sitting in that tree was a directory that shouldn't have existed:

```
~/.hermes/wiki/service-calls/
```

It looked legitimate. It had the right shape, the right naming convention, and files in it. A session that found it reasonably concluded that was where the daily logs went, and wrote there.

Here's the part that made it stick: **every wrong write left behind in that directory made it look more canonical to the next session.** The evidence compounded in favour of the bug. By the time I found it, it held four orphaned daily logs — every one byte-identical to its correct copy elsewhere. They were my own agent's writes, from recurrences one through five.

**The stale directory wasn't the symptom of the bug. It was the mechanism.**

That distinction changes the fix. A gate helps only if it runs *before* the path is chosen. Path selection happens during discovery, at session start. There is no write-time check that can fire early enough.

## Deleting it broke the detector

So I deleted the directory.

Then I checked what that did to the safeguard, and found something I hadn't thought through at all.

The strongest rule in place was a hard gate that compared file counts:

```bash
ls .hermes/wiki/YYYY/YYYY-MM-*.md | wc -l            # canonical
ls .hermes/wiki/service-calls/YYYY/YYYY-MM-*.md | wc -l   # other
```

> If the canonical path has more files, or the other path has ANY files, the canonical path is correct.

Read that second clause again. **The gate's detection method was the trap directory's existence.**

With the directory gone, that check now reads *"no trap present"* on every single run — including a day the agent writes to a path that no longer exists. It doesn't fail loudly. It doesn't fail at all. **It fails open**, and reports that everything is fine, forever.

I removed the mechanism and silently disarmed the thing watching for it, in the same action.

## The fix that holds

A rule written as a comparison needs both terms to survive. Clean up one location and the comparison loses its second term — and a check that can't find a problem looks exactly like a check that found none.

So the replacement is not a better comparison. It's an absolute statement:

> The daily log is `~/.hermes/wiki/YYYY/YYYY-MM-DD.md`. Full stop, regardless of what `find`, `ls`, or a session-start directory discovery returns.

That version can't be disarmed, because it doesn't depend on the wrong location existing to detect it.

I had the live rules rewritten that way, and verified it by reading them back rather than trusting the report. The old count-comparison now survives in exactly one place — an archive file that documents the trap as a historical record. That's fine, as long as nothing loads it as a live instruction.

## What I'd watch

The cheap signal for whether this actually stuck is whether the directory comes back.

If something recreates it, the underlying habit isn't fixed and I'll see it. If it stays gone, the mechanism is gone with it.

## The general version

This wasn't a file-sync bug or an agent bug. It was a **stale artifact that made the wrong place look like the right one** — and that pattern is not specific to my setup.

It shows up as the old `dist/` folder, the superseded config directory, the legacy endpoint still documented as current, the deprecated path in a README that nobody updated. Anything that invites a decision before the right answer is known.

Two things are true every time:

**The artifact is usually the cause, not the symptom.** Something that gets read at discovery time will win over a rule the reader hasn't consulted yet.

**Deleting it removes the mechanism. Adding a gate does not.** And when you do delete it, go find every check that detected it by comparison — because you just removed one of their terms.
