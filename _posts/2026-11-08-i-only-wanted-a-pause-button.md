---
layout: post
title: "I Only Wanted a Pause Button"
subtitle: "My Pi-hole app started as one small convenience and stayed exactly that for ages — I was happy with it. Then I got curious about what vibe coding could actually do, wired an agentic IDE into Android Studio, and found out."
date: 2026-11-08 00:01:00 -05:00
tags: [android, pi-hole, self-hosting, ai-agents, developer-tools, side-projects]
devto: true
bsky: |
  I wanted one thing: pause ad blocking from my phone without logging into the web UI on each Pi-hole instance.

  I built that. I was happy with it. Then I got curious about what vibe coding could actually do — and the app turned into a lot more than a pause button.

  Link in bio.
---

I run Pi-hole for DNS at home, and I had one specific annoyance: to pause ad blocking I had to open a browser and log into the web UI — and I run more than one Pi-hole, so that's the same walk, twice.

I didn't want a dashboard. I didn't want a project. I wanted a button on my phone that pauses blocking, on whichever instance, without the browser.

So a while back I had my agent build me that. Add your Pi-holes, see whether blocking is on, toggle it.

It worked. And I was genuinely satisfied with it — that's the part worth saying plainly, because it's the part that usually gets written up as a struggle. It wasn't one. It did the thing I wanted, I used it, and it sat there being fine.

## Then I got curious

What got me back into it wasn't frustration. It was curiosity about how far this whole approach actually goes now.

I wired [Antigravity](https://antigravity.google) directly into Android Studio — the agent working inside the IDE the app is built in, rather than me carrying changes back and forth. And what I found is that tweaking the app got *much* easier. Not marginally easier. The kind of easier where "I wonder if it could also…" stops being a question you don't bother asking.

So I asked it a few.

Two things came out of that:

**Seeing what's being blocked.** The original app told me whether blocking was on and showed counters. It didn't show me *what* was being blocked or asked. Now there's a query log — time, domain, which client asked, and what happened to it.

**Adding block lists.** Pi-hole keeps its blocklists as lists, and managing them meant going back to the web UI. That's now in the app: view them, add one, edit one, remove one.

That's the whole change. No rebuild, no rescue. I poked at an app I already liked and it turned out the tooling had quietly gotten good enough to make poking cheap.

## What the app has to get right, which is more than it sounds

The interesting parts aren't the screens. They're the three things any client for a self-hosted service on your own network has to solve, and none of them are obvious.

### The certificate problem

A Pi-hole serves its admin over HTTPS with a self-signed certificate. Mine is issued for the name `pi.hole`, and I reach it by its LAN address. So a normal HTTPS client fails twice over: it doesn't trust the issuer, and the hostname doesn't match either.

Certificate pinning is the answer, but the shape matters. Trust the system certificate store **first**, and only fall back to a pinned fingerprint when that fails. Get the order backwards and you've built something that accepts a self-signed certificate *instead of* validating a good one — which is worse than doing nothing at all.

Then there's the hostname. A pinned certificate still fails the hostname check, because the certificate says `pi.hole` and I'm connecting to an address. So the app allows that mismatch **only** when the fingerprint matches one that was explicitly trusted, for that one Pi-hole. Not app-wide, not "any self-signed certificate" — one fingerprint, one host.

And since the certificate is self-signed, there's no way to know the fingerprint in advance. So on first connect it reports an untrusted certificate *along with the fingerprint*, asks whether to trust that exact one, and pins it if you say yes. Trust on first use.

If the Pi-hole ever regenerates its certificate, the pin stops matching and you have to re-pin. That's correct behaviour, and the first time it happens it will look exactly like an outage.

### The encryption detail that's easy to get backwards

Your Pi-hole password shouldn't sit in plain text in the app's preferences. So it's encrypted with AES-256-GCM using a key held in the Android Keystore — generated on the device, never exported.

The part I wouldn't have thought of: **that key can't be backed up.** It's hardware-backed; there's no way to get it off the device. So if the app's preferences end up in a cloud backup or a phone-to-phone transfer, they restore as ciphertext that nothing can open — the key that could decrypt them didn't come along for the ride.

The fix is to explicitly exclude those preferences from both cloud backup and device transfer. Which means writing a small amount of configuration whose entire purpose is to *not* move data, and whose absence produces a bug that only shows up after someone upgrades their phone.

### One Pi-hole, one app password

Pi-hole v6 authenticates with a **session**: post the password to `/api/auth`, get a session id back, send that id on every later call. There's no static API key.

It also holds **one app password per instance at a time**. Generate a new one and the old one stops working. So if two things are talking to the same Pi-hole and only one of them has the current password, the other one just silently stops authenticating.

The app's side of that is more careful than it strictly needs to be: it caches the session in memory, re-authenticates automatically when a session expires, and logs out explicitly when it's done — because on v6 sessions are a limited resource, not something that gets cleaned up behind you.

## Where it stands

The app does what I wanted and a fair bit more now, and it's on my phone doing it. It isn't on the Play Store yet.

There are two real blockers in front of that, and both are the kind you want to deal with before rather than after: the application ID is still the default `com.example.…` placeholder, which Play rejects outright and which you can't change once you've published, and the target SDK is a version behind what new apps have to ship with. Neither is difficult. They're just easy to leave until they're permanent.

## What I actually learned

I didn't set out to build a Pi-hole dashboard. I set out to stop walking to a computer to pause ads.

The thing that changed wasn't the code, or my patience, or the idea. It was how cheap the next experiment got. I liked the app the whole time — I just had no particular reason to touch it. Give someone a cheap way to try the next small idea and they'll try it, and the difference between "this does the one thing I wanted" and "this does four things" turns out to be nothing more than that.
