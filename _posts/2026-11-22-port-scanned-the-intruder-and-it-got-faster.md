---
layout: post
title: "I Port-Scanned the Intruder and It Got Faster"
subtitle: "An unknown device on my network, a model name nobody owns, and a latency reading that was lying to me the entire time."
date: 2026-11-22 00:01:00 -05:00
tags: [networking, homelab, unifi, security, troubleshooting]
---

My network app showed a device I couldn't account for: a **Galaxy Z Fold 7**, sitting at `192.168.30.124` on my main network, with a randomized MAC address and 300–500 ms of latency reported in Wi-FiMan.

Nobody in this house owns a Galaxy Z Fold 7.

That combination is not nothing. A randomized MAC means there's no vendor OUI to look up — no shortcut to "oh, that's the printer." High latency on a local client is the kind of number you'd expect from something relaying traffic, not something sitting on a couch two rooms away. And it was flaky in a specific way: sometimes it answered a ping, sometimes the ARP entry came back incomplete, as though it kept stepping out of the room whenever it was addressed.

So I went looking. Most of the legwork went to my agent — DNS queries out of Pi-hole, the ARP cache between ping attempts, the UniFi monitor state, direct port probes. I did the one thing it couldn't do for me: scanned the thing from my phone.

## What the digging found

Not much, and that was the interesting part. DNS queries for that address were unremarkable. Nothing in the monitor state looked like an excursion. The port probes came back inconsistent in a way that felt deliberate — reachable one minute, gone the next.

The TTL came back **64**, which places a device in the Unix family. That felt like a clue at the time. It isn't one. Every Android phone and every Linux box on the planet answers 64. It was noise that happened to agree with the boring answer, and I half-read it as evidence for a while.

## The thing that actually cracked it

Not a clever probe. A port scan.

Four readings, in order:

- first ping: **37 ms**
- next two: **505 ms**, **539 ms**
- immediately after starting a port scan from my phone: **10–20 ms**

The device didn't get faster because I found the right angle. It got faster because I woke it up.

That is what Wi-Fi power-save looks like from the outside. An idle radio parks itself and answers slowly, or not at all, until traffic brings it back. The "suspicious latency" was an idle device being measured from across the house. The act of investigating was what made it look innocent.

The flaky ARP is the same phenomenon described differently. A device that answers sometimes and not others isn't evading you. It's asleep.

## What it was

Two phones in this house are Galaxy S26s. In the same client list, a second **Galaxy S26** was sitting there marked disconnected.

UniFi's device database had matched the wrong model string and labelled an S26 as a Z Fold 7. The randomized MAC was Samsung's default privacy behaviour, which is on by default on essentially every modern phone, per network — not a signal that someone was hiding.

There was no intruder. The phone was my uncle's — one of the two S26s already sitting in that client list, and the same one the app had shown as disconnected. A string in a device database was wrong.

## What I'd take from it

**A label is a hint, never a fact.** Your network app is guessing at a model from a database of identifiers. When it shows you a device nobody owns, that label is the least trustworthy thing on the screen — and it is the thing you're most likely to build a story around.

**A randomized MAC is not a threat signature.** It's the default. If your mental model of "suspicious client" is built on unknown OUIs, that model stopped applying to phones a while ago.

**Latency is a state, not a property.** An idle wireless client measured from a distance looks slow. That is evidence that you measured an idle client, and nothing else.

**The real tell was a missing device, not a strange one.** A second S26 sat in the same list marked disconnected. I was looking at the wrong anomaly entirely — I had an unexplained device when I should have been looking for an unaccounted-for one.

## The loose end, and how I closed it

Randomized MACs are stable per SSID, so the phone behind all of this was still holding the same address. Matching the flagged address against a named phone in the client list took about five seconds, and it settled it: the address is my uncle's phone, one of the two S26s in the house. "Almost certainly that phone" became "confirmed."

That's the part worth keeping. A plausible explanation and a confirmed one look identical until you run the check, and I had a story ready long before I had an answer. Confirming it was the cheapest step in the whole investigation and the last one I took — which is an argument for running it first.
