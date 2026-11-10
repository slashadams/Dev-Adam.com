---
layout: post
title: "Your Secret Scanner Said \"Clean.\" That Isn't Proof."
subtitle: "A scanner is wrong in two directions, and \"no findings\" is the one output it should never get credit for."
date: 2026-12-18 00:01:00 -05:00
tags: [self-hosting, security, ai-agents, homelab, developer-tools]
devto: true
bsky: |
  A secret scanner told me my setup was clean. It was wrong in both directions — and "no findings" is the least trustworthy thing a scanner can say.

  The test that actually earns trust: plant a fake key and prove it gets caught.

  Link in bio.
---

I keep API keys on a box that runs a few agents. The keys live in `.env` files, the agents read them, and — this is the part that matters — every conversation those agents have gets written to a SQLite chat database on the same disk. So a key that appears in a chat once is a key sitting at rest, in plaintext, in a file I rarely think about. And in every backup copy of it.

I went looking for something that would check that. Someone had posted a read-only key-leak scanner that specifically knows the layout of a Hermes/OpenClaw home directory — the `memories/` folder, `SOUL.md`, `logs/`, `sessions/`, `cron/`, `skills/`, and the chat database itself. That layout awareness is the whole value. A generic secret scanner looks in your repo and your shell history; it has no idea that your agent's conversations are a place secrets collect.

I read the source before running it. No `socket`, no `urllib`, no `requests`, no `subprocess`, no `eval`. It shows only the first four characters of anything it matches. The safety claims held up. So I ran it read-only against the profiles.

## Wrong in both directions

The report was not useless, but it was not correct either, and it was wrong on both ends at once.

**False positives first.** It flagged a "Google API key, `AIza…`, 39 characters." That key was not mine. It's Google's own documentation example key — the placeholder printed in the developer docs — which got pulled into a cached tool result when a session fetched a page from `developers.google.com`. The scanner found a real string, in a real file, that has never been a credential of mine.

It also reported "two OpenAI keys." That was one key, from a different vendor entirely, matched because it happened to start with `sk-`. One key, wrong count, wrong company.

Here's why that's worse than noise. A scanner that cries wolf trains you to skim. The first few hits look like junk, you start scrolling past them, and the one real finding is sitting in the middle of the pile looking exactly like the rest.

**Then the misses.** The scanner did point at the right *class* of problem — credential-shaped strings sitting in the chat database — but it named the wrong ones. The strings it printed were the placeholders and the mis-matched keys. The ones that actually mattered, I found later, on a second pass.

## Building our own, and the bug that made it lie

Since the vendor tool couldn't tell a docs placeholder from a real key, I had the agent build a sweep of our own. Standard library only, no network, read-only, and scoped to the profile it belongs to — it does not read another profile's chat database.

The first version had two false positives of its own, and both taught me something. It flagged the `.env` file — which is the *intended* credential store, not a leak — so the rule became: never flag the store itself, check its file permissions instead. It flagged a plugin's test fixtures, which are fake keys by design, so those get skipped.

Then I ran it and it came back clean. Silent. Nothing to report.

It was wrong. `state.db` — the chat database, the single file most likely to hold a leaked key — was never actually in the scan list. The branch logic in the script *referred* to the database, so the code read as though it covered it. The list of files it actually walked never included it. So the sweep marched past the one file it was built to check and reported "clean."

That's the failure mode. Not a crash. Not a warning. A green light on a file that was never opened.

## The test that earns trust

Once we matched against the *real* values from `.env` — not just the shapes keys tend to have — the second pass found three live credentials sitting in that chat database. An API key for my network controller, an app password for a social account, and a token for my DNS provider. All three real, all three at rest on disk.

The lesson I keep coming back to: a silent watchdog that has never once fired is not a working watchdog. It's an untested one. So before I trusted the sweep, I planted a fake key in a throwaway profile directory and ran it. It fired. Then I tested each category of file — memory, logs, database — separately, because a generic pass doesn't tell you *which* branch is broken.

That test found a smaller bug too. One of my test strings was 36 identical characters, which has essentially zero entropy, so the sweep's entropy filter correctly dropped it. A real key looks random; my fake one didn't. I had to make the planted secret look like an actual secret before the test meant anything. If your test input doesn't resemble the real thing, a passing test proves nothing.

## A short checklist for trusting any audit tool

- **Don't trust a tool's "clean." Trust its "found."** Plant a fake secret deliberately and confirm the tool catches it. If it can't detect what you put in front of it, its silence means nothing.
- **Check the file list, not the branch logic.** Our bug was code that referenced a path without walking it. Read what the tool actually opens.
- **Read the false positives.** They're not just noise — they're the thing that teaches you to ignore the true positive.
- **Test each location on its own.** A pass across everything hides a failure in one branch.
- **Match real values, not just shapes.** Format-matching finds `AIza…` in the docs. Value-matching finds the key that's actually yours.
- **A read-only tool that shows four characters is worth more than a helpful one that shows the key.** Verify that yourself before you run it.

The scanner I started with wasn't malicious and it wasn't useless — it knew *where* to look, which is genuinely hard to get right. But a green light is a claim, and the only way to trust a claim is to test the thing making it. The first sweep said clean. The file that mattered had never been opened.
