---
layout: post
title: "Putting My Xfinity Set-Top Boxes on Their Own VLAN"
subtitle: "Xfinity's gateway is in bridge mode and their web UI is gone, so every bit of this happens on your own router. Including the DNS trap that made the first box report no internet."
date: 2026-10-25 12:00:00 -04:00
tags: [homelab, networking, vlan, unifi, xfinity, pihole, self-hosting]
---

I have five Xfinity set-top boxes. One is the main box, wired over coax. The other four are Wi-Fi minis — and until today, all four were sitting on my main LAN alongside my servers, my NAS, and everything else I care about.

These boxes are black boxes. I can't shell into them, can't audit what they send, can't install anything on them. They're the largest unexamined telemetry source on my network, and the only tool I have against them is where they sit and what they're allowed to reach.

So I moved them onto their own VLAN. This is how, and it's worth writing down because the interesting parts aren't in any Xfinity documentation.

## The setup this applies to

This is specifically for the case where **you do not use the Xfinity gateway as your router**. Mine is in bridge mode, and a UniFi Express 7 handles routing. If you're using the Xfinity gateway as your router, most of this doesn't apply to you — you'd be configuring VLANs on the Xfinity side, which is a different (and more limited) conversation.

Two things about that setup are worth knowing before you start:

**The Xfinity web UI is gone.** You used to be able to log into the gateway at its LAN address and change settings. You can't anymore. It redirects you to the Xfinity app, and the app doesn't expose the settings the web UI did. I went looking for the MoCA settings and simply couldn't get to them.

That sounds like a problem. In practice it makes the whole job easier, because **everything below happens on your own router**, where you have real API access and real control. Nothing here requires touching the gateway.

**The gateway still does one thing you can't take over:** it hands out the TV signal over coax to the main box. That's fine. It's one-way broadcast — no data path into your network. Leave it alone.

## Why bother at all

Three reasons, in the order they actually matter to me:

**Containment.** A set-top box runs someone else's firmware with someone else's update cadence. If one gets compromised, I don't want it on the same segment as my NAS. On its own VLAN with isolation on, it can't initiate anything into my main network.

**Visibility.** Once they're behind their own VLAN, I know exactly what that segment can reach, and I can log it. Before, they were just four more devices mixed in with everything else.

**Containment against each other.** These boxes don't need to talk to each other. With L2 isolation on, one compromised box can't pivot to the other three.

What this deliberately does **not** do is reduce telemetry. That's a DNS filtering job, and it's separate. If you want the boxes to stop phoning home, that's Pi-hole, not VLANs. Think of this as the boundary; filtering is the fence.

## The build

On the UniFi side, create a new network:

- **Subnet:** `192.168.30.1/24`
- **VLAN:** 30
- **DHCP pool:** `.6` through `.254`
- **Isolation:** `network_isolation_enabled: true`
- **mDNS:** on
- **DNS:** point it at your Pi-holes

Then a new SSID mapped to that VLAN:

- **Band:** both
- **L2 isolation:** `true`
- **Security:** WPA2

A few notes on those choices.

**Point the DNS at Pi-hole.** It's what gives you the visibility, which is half the point. It also sets up the trap I'll get to in a second.

**Turn L2 isolation on.** There's a common assumption that set-top boxes need to talk to each other for multi-room DVR. That assumption was the thing I got wrong twice — see the section below. On my setup it turned out not to matter, and isolation is a real containment win.

**Leave `internet_access_enabled` on.** Isolation blocks client-to-client traffic. It does not block the internet, and you need the internet for these boxes to function at all.

## The trap: isolation and DNS are in direct conflict

This is the part worth the whole post.

I moved the first box over. It associated to the new SSID, landed on VLAN 30, and pulled a DHCP address. And then it told me it had no internet.

I spent a while on the wrong causes. It wasn't the cable. It wasn't the radio. It was this:

**`network_isolation: true` blocks the VLAN from reaching anything on your other subnets — including the Pi-holes I'd just told it to use for DNS.**

The box could resolve nothing. No DNS means no internet as far as any device is concerned, even with a perfectly good DHCP lease and a working gateway.

This is a genuinely easy trap to fall into, because every individual setting looks correct. You enable isolation for good security reasons. You point DNS at your Pi-hole for good filtering reasons. And those two correct decisions are mutually exclusive by default.

**The fix is a firewall rule that permits exactly one thing:** traffic from the isolated VLAN to the Pi-holes.

Create an address group containing your Pi-hole addresses — I called mine `pi-holes`, with two entries. Then a `LAN_IN` accept rule:

```
name:                    Xfinity DNS to pi-holes
ruleset:                 LAN_IN
action:                  accept
protocol:                all
src_networkconf_id:      <the Xfinity VLAN>
dst_firewallgroup_ids:   [pi-holes]
enabled:                 true
logging:                 true
```

The important discovery: **a firewall rule does override `network_isolation`.** The box came back the moment that rule landed. You don't have to choose between isolation and filtered DNS — you just have to write the exception deliberately.

**Set `logging: true` on it.** You want to see what those boxes actually ask for.

## The gotcha nobody documents: changing the Wi-Fi on an Xi6

Once the network exists, you have to get the boxes onto it. This turned out to be the least documented part of the whole project.

The Xi6 set-tops **have no network settings menu.** Let me repeat that, because it's the thing that costs you an hour: there is no Wi-Fi configuration screen. All you can do is view the status of the network it's currently on.

The actual procedure:

1. **Press the WPS button on the underside of the box.** That puts it into WPS mode.
2. **Wait out a two-minute timer.** Don't mash the remote. There's no button combination and no hidden service menu. After roughly two minutes the box times out of WPS mode and offers you the manual network settings on its own.
3. Enter the SSID and passphrase by hand.

If you're the kind of person who starts pressing buttons when something doesn't respond immediately — and I am — you will conclude the box is broken. It isn't. It's waiting.

## The stale lease that looks like a broken box

After moving a box, it will associate to the new SSID, get tagged onto the new VLAN, and **keep its old IP address from the previous network.**

I watched a box sit on `192.168.1.204` — an address from my main LAN — while its UniFi client record said it was on the new VLAN.

Here's why it still mostly works: my router is multi-homed, so its main-LAN address is reachable from the new VLAN, and it answers. Internet works. Apps work. Live TV works.

A DHCP client renews at 50% of its lease. Mine is 24 hours, so the box doesn't ask for a new address for about twelve hours. Disconnecting and reconnecting the Wi-Fi does not clear it.

**Just wait.** Mine corrected itself — one box sat stale for a while, then quietly picked up `192.168.30.203` and never looked back. Don't power-cycle, don't factory-reset, don't chase it. It resolves on its own.

If you're watching the UniFi client list and a box shows no IP at all, that's also not a fault — the controller's view lags what the device is actually doing. Test the service on the device rather than trusting the field.

## The thing I got wrong twice

While moving the first box, DVR playback broke. Live TV worked, apps worked, cloud DVR would not open a recording.

I added a second firewall rule letting the isolated VLAN reach the other set-tops still on the main LAN, on the theory that cloud DVR needed box-to-box communication. DVR started working. I wrote it up as the cause.

Then I moved a second box and it worked with that rule pointed at addresses the box no longer had. And a third box worked fine after I deleted the rule entirely.

**The box-to-box rule was never doing anything.** What actually fixed DVR was the DNS allowance rule. The reason I got it wrong is that I changed several things at once — the DNS rule, the box-to-box rule, the VLAN move, and a power cycle all landed in the same window — and then credited whichever change I'd made most recently.

If you're debugging your own version of this: **change one thing at a time, even when you're confident.** I cost myself two confident wrong conclusions by not doing that.

The correct answer for a moved set-top is simpler than what I built: **it needs the DNS allowance rule and nothing else.** No box-to-box reachability. The final state on my network is one-way isolation — the VLAN can reach the internet and the Pi-holes, and nothing on my main LAN, in either direction.

## Where this didn't work

Not everything landed. Worth being honest about the failure.

I built a second VLAN the same day for my Chromecasts and Google TV streamers, reasoning they were a different trust tier from the cable boxes — I own them, they're not cloud-locked, and I actively cast to them.

**Casting broke.** The device appeared in the cast list — discovery worked, because mDNS was passing — but the connection never completed.

The reason is that casting is inherently two-way. Your phone reaches the device to start playback, and the device connects back. `network_isolation` is a one-way block, and no rule I write bridges that without removing the isolation entirely, at which point the VLAN isn't doing anything.

So that VLAN exists and is correctly built, and it can't do the job I designed it for. If your goal is isolating cast targets, the honest answer is: **you can't isolate a device you need to cast to.** Segment the things that only consume — your cable boxes, your smart TV's built-in apps — and leave the cast targets where they are.

I'd rather write that down than pretend the second VLAN worked.

## What I'd still improve

**Both my allowances are `protocol: all`.** The legacy UniFi firewall API has no port field, so I can't scope the DNS rule to port 53. In practice that means the isolated VLAN can reach the Pi-holes on every port they listen on, not just DNS — including their web admin interfaces. Both need credentials, so it's not an open door, but it's wider than it should be. Newer UniFi firmware has a zone-based firewall API that does support ports; moving to it is a project, not an edit.

**The same trap hit three networks.** I hit the DNS/isolation conflict on the set-top VLAN, then again on the casting VLAN, then a third time on my IoT VLAN — where it looked like a sudden failure the next morning, because the devices held live connections until the lease renewed and forced a fresh DNS lookup. Every isolated network that uses Pi-hole for DNS needs its own allowance rule, and you should create it at the same time you create the network. Learn from my three trips around that loop.

## The short version

- Bridge mode means this is all your router's job, and that's a good thing
- **`network_isolation` blocks access to your Pi-holes if they're on another VLAN.** This is the trap
- A single `LAN_IN` accept rule to the Pi-holes fixes it, and it does override isolation
- Changing Wi-Fi on an Xi6: WPS button, wait two minutes, don't press anything
- A stale IP after moving is normal and resolves itself
- Change one variable at a time, or you'll credit the wrong fix like I did
- You can't isolate a device you need to cast to
