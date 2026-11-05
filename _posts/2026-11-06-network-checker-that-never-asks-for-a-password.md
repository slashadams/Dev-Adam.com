---
layout: post
title: "My Network Checker Never Asks for Your Router Password"
subtitle: "Every tool in this space wants admin credentials or a vendor cloud account. The useful half of the job needs neither — and building it that way is the reason it works on any router."
date: 2026-11-06 00:01:00 -05:00
tags: [networking, security, homelab, ai-agents, developer-tools, side-projects]
bsky: |
  Every network security tool I looked at wants your router's admin password or a vendor cloud account.
  
  Built one that wants neither. The machine running the check is already inside the network — the ARP table, what's listening, which cert expires when.
  
  Writeup: link in bio.
---

I've been building a network checker, and the design constraint came before any code: **it never asks for a router username or password.**

That sounds like a limitation. It's actually the whole design.

Every tool I looked at that monitors a home or small-office network wants one of two things — your router's admin credentials, or an account with the vendor's cloud. Both are reasonable asks. Both are also the exact reason those tools only work well on the router they were built around.

## What the machine already knows

The insight that unlocked this: **the box running the check is already inside the network, and it already knows most of what matters.**

Not through the router — through the vantage point.

- The neighbour table tells you what's on the LAN and by which MAC (`/proc/net/arp`, `ip neigh`, or `Get-NetNeighbor` on Windows)
- `ss -H -lnt` shows what's listening locally
- A TCP connect tells you what's answering on which port
- `ssl` + `getpeercert()` tells you when a certificate expires
- A plain HTTP request shows whether the security headers are there
- `dig` shows the DNS records

None of that needs a credential. I'd been thinking of a network monitor as something that asks the router what it thinks. It works much better as something that observes the network from inside it.

## Two tiers, one data model

The tool is built around two collectors feeding a single normalized model.

**Tier 1 is the `local` collector. Always on, zero credentials, Linux/macOS/Windows, any router.** Everything in the list above. This is the tier that runs whether or not you own anything supported.

**Tier 2 is an optional adapter for UniFi consoles.** Turn it on and it adds VLANs, SSIDs, the controller's client inventory, firmware versions, firewall rules and groups, port forwards, and IPS settings. Turn it off and you lose exactly those checks, nothing else.

The decision that made this possible was separating **collectors** (how state gets gathered) from **checks** (what gets evaluated), with a fixed data shape between them. Adding a vendor is now adding a collector. It is not rewriting the checks.

That's the difference between a tool that supports one vendor and a tool that has one vendor's support bolted on.

## Being loud about what it can't check

The design choice I'm happiest with is the one most tools get wrong.

When the UniFi adapter isn't enabled, a check that needs it doesn't quietly pass. It reports itself as skipped, names the check, and names the collector that was missing — rather than returning a clean result for a check it never ran.

A monitor that stays silent about a gap trains you to trust it about everything. I'd rather it announce the hole every run than let me assume a clean report means a complete one.

Same reasoning behind the scheduled entry point. `orthrus run` snapshots if the last one is stale, evaluates everything, and — if nothing crosses the severity threshold — **prints nothing and exits 0.**

Silence is the healthy state. That's what makes it safe to sit in cron and run every fifteen minutes. A monitor that reports "all clear" on a schedule is a monitor you stop reading within a week.

## The part I was most careful about

Reads are always safe. Writes are the dangerous half, and there's only one of them.

`orthrus apply <REC_ID>` will change a firewall rule — and only when you pass `--yes` explicitly. Then it re-verifies the preconditions live, writes a timestamped backup, makes a field-preserving `PUT`, **re-reads the object to confirm the change actually landed**, and rolls back from the backup if it didn't.

Before building any of that, I verified the write path live with a **no-op** — a `PUT` of a byte-identical object body. It came back `HTTP 200 {"rc":"ok"}` with zero field drift across every rule on the console.

You want to know the API echoes back exactly what you sent before you let it change anything for real. That's a five-minute test that decides whether the whole `apply` feature is safe to ship.

## How it got built

I wrote the intent and the constraints. Hermes — the agent I run on a box in my house — turned them into detailed specifications, and then worked alongside Google's Antigravity CLI to implement them across eight spec stages: `onboard` and `check` first, the UniFi firewall audit and the guarded write path later.

The result is one 11,222-line Python file using nothing but the standard library. No `pip install`, no virtualenv, no third-party packages. `--selftest` runs 28 offline checks.

It's been tested live on a Windows 11 25H2 laptop and a UniFi Express 7, which is where most of the interesting bugs came from — Windows needed its own entire collection path (`Get-NetNeighbor`, `Get-NetTCPConnection`, `Get-NetFirewallRule`), and the firewall cmdlets can fail with an access error on a locked-down host. That failure is now reported rather than swallowed.

## What's still missing

This is a product in progress, and the gaps are unglamorous:

- **There's no version number.** No `__version__`, no `--version`, no release tags. A tool that ships a rule set has to be able to tell you which rule set you're running. I haven't done that yet and it's the first thing on the list.
- **There's no CI.** 28 self-tests, and nothing runs them but me.
- **There's no support path.** No `--diagnose`, no log bundle. If `apply` fails on someone else's firewall, the whole report so far is "it didn't work."

The last one matters more than it looks. For a tool whose only write touches someone's firewall, the difference between a five-minute fix and a lost user is whether you can see what it saw.

## Where this is going

I built it for my own network first, because I wanted to know when something changed without handing my router's admin login to a script or a cloud service. It turned out the credential-free vantage gets you most of the way, and the two-tier split means the answer scales to whoever's router it is.

No price, no signup page, nothing to buy yet. I'm writing it down now because the interesting part isn't the code — it's that the constraint everyone treats as a limitation turned out to be the feature.
