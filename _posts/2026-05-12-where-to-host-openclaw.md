---
layout: post
title: "Where Should You Run OpenClaw? (Please Don't Say Your Laptop)"
subtitle: "VPS vs. repurposed hardware vs. Proxmox LXC vs. the daily driver — a practical breakdown of the four options."
tags: [OpenClaw, self-hosting, infrastructure, Proxmox, VPS]
---

When you first hear about [OpenClaw](https://docs.openclaw.ai) — an open-source AI agent platform that runs your own agents on your own hardware — the natural instinct is to `git clone` it onto whatever machine is in front of you and hit `openclaw start`.

I get it. I did it too.

But running a 24/7 AI agent gateway on your personal computer is like running a web server on your phone. It *works* until it doesn't, and when it breaks, it breaks your whole day.

Here's a practical breakdown of the four real options, based on things I've actually tried.

## Option 1: Your Daily Driver PC (The "Don't")

This is the path of least resistance. You install OpenClaw on your main laptop or desktop, start it up, and everything works. For a while.

**The problems show up fast:**

- **Your computer needs to stay on.** Every reboot, every sleep cycle, every time you close the lid to go to a coffee shop — your agents go offline. Telegram messages queue up. Scheduled tasks miss their window. If you're running heartbeats or cron jobs, they just don't fire.

- **Resource contention.** LLM inference is hungry. Even just proxying API calls and running agent logic, OpenClaw chews through CPU and RAM. If you're compiling code, rendering video, or playing a game, something's getting starved.

- **Security exposure.** Your agent gateway is a network-accessible service. If you expose it to the internet (to connect Telegram, Signal, or a web app), you're now running a production-adjacent service on your personal machine. One misconfigured endpoint and your local files are reachable.

- **Uptime is a joke.** Your personal computer is not a server. It reboots for updates. It goes to sleep. It travels with you. Your agents should be running while you're asleep, on a plane, or in a meeting.

**Verdict:** Fine for testing. Bad for anything real. Don't do it.

## Option 2: A Repurposed Old Laptop or PC

This one has sentimental appeal. That old ThinkPad in the closet? The desktop you replaced last year? It can be a server now.

I ran OpenClaw on an old Intel NUC for a month. Here's the reality:

**Pros:**
- It's free if you already have it
- Dedicated hardware — nothing else fighting for resources
- You can leave it on 24/7
- Full control over the machine

**Cons:**
- **Power draw.** An old desktop idling can pull 50-100W. Running 24/7/365, that's $50-150/year in electricity alone. A VPS is cheaper.
- **Heat and noise.** Old hardware wasn't built for silent operation. If it's in your living space, you'll hear it.
- **Reliability.** Old hardware fails. Hard drives die. Power supplies die. Fans seize. You're one component failure away from your agents going dark until you notice and fix it.
- **No redundancy.** If the machine goes down, you're rebuilding from scratch or restoring a backup. There's no vendor handling the hardware layer.
- **Remote management is painful.** No IPMI, no out-of-band console. If the OS hangs, you need physical access or a creative workaround.

**Best for:** Hobbyists who enjoy tinkering and already have suitable hardware collecting dust. Worst case, you break even on cost vs. a VPS after a year or two.

## Option 3: Proxmox LXC (How I Run It)

This is my current setup. I have a Proxmox hypervisor running a few LXCs, and OpenClaw lives in its own lightweight container.

**Why this works well:**

- **Minimal overhead.** An LXC is not a VM — it shares the host kernel. The resource cost is negligible. OpenClaw runs with the system resources it needs and nothing more.
- **Snapshots and backups.** Proxmox can snapshot an LXC in seconds. Before any upgrade or config change, I snapshot. If something breaks, I roll back in ten seconds. This alone is worth the setup effort.
- **Resource isolation.** I give the OpenClaw container 2 cores and 4GB RAM. It can't OOM the rest of my services. It can't eat CPU that my Pi-hole or NAS needs.
- **Network isolation.** The container lives on its own VLAN. The gateway can reach the internet (for LLM APIs), but I can restrict what it can reach on my local network.
- **24/7 uptime.** The Proxmox host stays on. The LXC auto-starts. I reboot the host once a quarter for kernel updates and plan it. My agents don't go down because I closed my laptop.

**Cons:**
- **You need Proxmox first.** This assumes you already run or are willing to set up a hypervisor. It's free, but it's a learning curve.
- **Single point of failure.** The Proxmox host is still one machine. If it dies, all your LXCs die with it. This is fine for a homelab; it's not fine for production.
- **No external access without setup.** If your agents need to be reachable from the internet (Telegram webhooks, web apps), you need a reverse proxy, DNS, and probably a Cloudflare tunnel or VPN. This isn't hard, but it's additional config.

**Verdict:** The sweet spot for homelab setups. If you already run Proxmox, this is the obvious choice. If you don't, a VPS is simpler.

## Option 4: A VPS (The "Just Works" Option)

A $5-15/month VPS from any provider — DigitalOcean, Hetzner, Linode, Vultr — running Ubuntu, OpenClaw installed, agents configured.

**Pros:**
- **True 24/7 uptime.** The provider handles hardware, power, networking. Your agents run while you sleep.
- **Static IP / DNS.** Easy to configure webhooks. Easy to point a domain at it. No dynamic DNS, no NAT traversal.
- **Snapshots for backup.** Most providers offer VM snapshots. Easy rollback.
- **No hardware to babysit.** No fans to clean, no drives to replace, no power bills.
- **Scales trivially.** Need more RAM? Click a button. Need a bigger disk? Click a button.

**Cons:**
- **Monthly cost.** $5-15/month adds up. $60-180/year. It's cheap, but it's not free.
- **You don't own the hardware.** Data leaves your home network. For sensitive agent memory (personal info, business data), you're trusting the provider.
- **Latency.** If you're running agents that need to act locally (smart home, local file system), a remote VPS adds latency and complexity.
- **Less fun.** A VPS is boring. You SSH in, install, configure, and it just works. Tinkerers may prefer the homelab route.

**Verdict:** The safest recommendation for most people. It's the default for good reason.

## The Comparison

| Factor | Daily Driver | Old Hardware | Proxmox LXC | VPS |
|--------|-------------|-------------|-------------|-----|
| Cost | Free | Free (+ power) | Free (if you have Proxmox) | $5-15/mo |
| Uptime | Terrible | Good | Great | Best |
| Security | Risky | Good | Great | Good |
| Setup effort | None | Medium | High | Low |
| Maintenance | None | High | Medium | None |
| Remote access | Bad | Bad | Medium | Built-in |
| Fun factor | Low | High | High | Low |

## My Recommendation

**If you're just starting:** Get a $6 Hetzner VPS. Install Ubuntu. Install OpenClaw. Go. It'll take 20 minutes and you'll never think about it again.

**If you already have a homelab:** Use a Proxmox LXC. Snapshot before every change. Sleep well.

**If you have old hardware and enjoy the hobby:** Go for it. Just track your power draw and have a backup plan for when the hardware dies.

**Don't use your daily driver.** Seriously. Your agents should be running right now, not when you're at your desk.

---

*OpenClaw is [open source on GitHub](https://github.com/openclaw/openclaw). If you want pre-configured agents that work out of the box — an AI Dungeon Master, a fitness coach, a business assistant — they're [available on Gumroad](https://gumroad.com/products/maeahs) as self-contained packages.*
