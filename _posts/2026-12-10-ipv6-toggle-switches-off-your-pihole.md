---
layout: post
devto: true
title: "The IPv6 Toggle That Quietly Switches Off Your Pi-hole"
subtitle: "A router prompt that reads like a free upgrade, on a network whose DNS filtering is written entirely in IPv4."
date: 2026-12-10 00:01:00 -05:00
tags: [networking, ipv6, dns, pi-hole, self-hosting, homelab]
bsky: |
  My router popped up a friendly box: "We detected IPv6 from your ISP. Enable it?"

  Looks like a free upgrade. On a network where the ad-blocking rules are all written in IPv4, turning it on can hand your devices a DNS server that resolves straight past Pi-hole.

  Nobody gets an alert when that happens. It just quietly stops filtering.

  Writeup: link in bio.
---

A box appeared at the top of my router's admin page: **"We detected IPv6 from your ISP — enable it?"**

It reads like a free upgrade. A protocol your ISP already supports, one toggle away, and the router is offering to wire it up for you. I'd been curious about IPv6 for a while, and this was the prompt that finally made me ask whether I should say yes.

The answer was no — not because IPv6 is bad, but because of what that one toggle would quietly undo on a network that filters DNS.

## What the toggle actually does

Say yes and three things happen.

The WAN side pulls a delegated prefix from your ISP. Each network behind it gets a globally routable `/64` carved out of that prefix. And your devices configure their own addresses from it, usually via **SLAAC** — stateless autoconfiguration, where the router announces a prefix and the device builds its own address. There's no server handing out leases.

That last part matters more than it sounds. **IPv6 has no NAT.** The thing that makes "it just works" behind IPv4 — everything behind one address, the router tracking the connections out — doesn't exist here. Every device gets a real, routable address of its own, and the only thing standing between the internet and that device is your firewall.

That's not a reason to avoid it. It's a reason to know exactly what your firewall and your DNS are going to do with a second address family, before you have one.

## The bypass: your DNS rules are probably written in IPv4

Ad and malware filtering on my network is Pi-hole. Every rule that enforces it is written **for IPv4**.

Concretely, the rules that matter are two shapes:

- **Allow rules that steer DNS to the Pi-holes** — "DNS from this network goes to these addresses, and only these." Those addresses are IPv4 addresses.
- **Drop rules blocking public encrypted-DNS resolvers** — the point being that a device can't just decide to use a public resolver and skip the filter. Those rules name public **IPv4** resolvers.

Now turn IPv6 on. A device on your network can pick up an IPv6 DNS server from a **router advertisement** — the same mechanism that gave it an address also advertises who to ask for DNS (that's RDNSS: Recursive DNS Server). Nothing in that path is Pi-hole. The device resolves over IPv6, and the allow rule that pins DNS to the Pi-holes doesn't describe that path at all, because it was written against `10.x`-style addresses.

Same story with the resolver block. If the block names public IPv4 resolvers, it says nothing about their IPv6 addresses. A device reaching a public resolver over v6 walks straight past a rule that is doing exactly what you told it to do.

**The result is a filtering bypass that arrives without an alert.** Nothing errors. Nothing logs a failure. Your DNS filtering just stops applying to whatever device takes the v6 path, and the dashboard still says Pi-hole is up and healthy.

## The second problem: segmentation you never verified

I've segmented my network — IoT things and a couple of device groups each sit on their own network, isolated from the main one. That isolation was set up and **verified in IPv4**. It works because the firewall rules say what crosses between networks and what doesn't.

IPv6 is a second, parallel path between the same devices. Enabling it adds an address family that none of those rules describe. The rules aren't wrong — they're just incomplete, and the incompleteness is invisible until something uses it.

Segmentation you haven't proven isn't segmentation. It's a hope.

## What my setup actually looked like

Before deciding anything, I had the router's live configuration read back — not the marketing page, the actual fields.

It confirmed the obvious in hindsight: IPv6 was **completely off**. The WAN's IPv6 delegation was set to none, and every one of my networks had its IPv6 interface type set to none.

So nothing was broken. The router had simply noticed my ISP advertising a prefix and offered to connect it. The prompt is a convenience check, not a recommendation — it has no idea what you've built on top of IPv4.

## What doing it properly would take

If I genuinely wanted IPv6, it isn't a checkbox. It's a project, and roughly this shape:

1. **Pin a `/64` per network** instead of letting the ISP's delegation move around.
2. **Advertise the Pi-holes' IPv6 addresses via RDNSS**, so devices keep using them for DNS instead of whatever the router offers by default.
3. **Write the IPv6 equivalents of the DNS and resolver-block rules** — the same intent, described for a second address family.
4. **Then prove it.** From an isolated network, confirm the device still can't reach the main one. Test it, don't assume it.

That's ongoing maintenance for a capability I don't need, which is why I left it off.

## What I'd actually gain: nothing

This is the part that settles it. IPv6 gives me nothing I'm missing:

- I host **nothing inbound** — no server anyone reaches from outside.
- Remote access is a mesh VPN, not a port forward, so there's no NAT traversal problem to solve.
- I'm not behind carrier-grade NAT, so there's no workaround to gain.

There is exactly one genuine consumer upside, and it's honest to name it: a better **NAT type for game consoles**. If you're fighting strict NAT on an Xbox or PlayStation and everything else fails, IPv6 is a real fix for that specific problem. If that's not your problem, the toggle is a cost with no benefit.

## IPv6 isn't the villain here

I want to be clear, because this reads like an argument against IPv6 and it isn't. IPv6 is the better protocol. It removes NAT — a hack that outlived its purpose — and gives every device an honest address. This is a post about **ordering**, not about the protocol.

The mistake isn't enabling IPv6. The mistake is treating it as a toggle when your filtering and your segmentation were both designed, tested, and written down in IPv4. Answering the prompt takes a second; migrating the rules that depend on the old answer takes an afternoon and a test network.

If you want to learn IPv6 — and it's worth learning — spin up a throwaway network and study how your firewall actually behaves with it. Don't flip it on across the production network to find out. And expect the prompt to keep coming back, because as long as your ISP advertises a prefix, your router will keep offering.

The general lesson is bigger than IPv6: **when a router offers to turn on a protocol it says it detected, the question isn't "do I want this protocol." It's "what are my existing rules written against?"** A configuration that's correct for IPv4 is not automatically correct for IPv6 — and the gap between those two facts doesn't announce itself.
