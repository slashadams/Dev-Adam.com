---
layout: post
title: "I Built My Personal AI Agent Into a Product Other Techs Can Buy"
subtitle: "The Field Service Sidekick — a Telegram bot that remembers every job you've done"
date: 2026-10-02 20:45:00 -04:00
tags: [ai-agents, side-projects, hermes, self-hosting, field-service, product-launch]
---

I spend my days in the field fixing gate operators. Access control, barrier arms, swing gates — if it opens and closes, I've probably worked on it. And for years, I had the same problem every service tech has: *where did I write that down?*

You finish a call, you think you'll remember what board was on that gate, what the fix was, whether that property has the same model as the one you saw last month. Then three weeks later you're back at the same site and you're rooting through a notebook, or scrolling through months of text messages, trying to find it.

I tried notebooks. I tried phone notes. I tried "I'll just remember." None of them worked.

I manage about 4-6 service calls a day on average. That's a lot of equipment models, a lot of serial numbers, a lot of "didn't I fix this exact problem two months ago?" moments. And I was losing that knowledge every time I put down the wrench.

## The Agent That Stuck

I already ran a self-hosted AI agent stack (Hermes Agent, on a Proxmox LXC in my garage) for my own notes, under a profile I called Prometheus. It worked for me — I'd dictate a note after a call, and it would log the date, the property, the equipment model, the diagnosis, and the parts used. If I needed to remember what I did at a site six months ago, I'd ask and it would tell me.

The problem was, it was *mine*. Custom config, my Telegram setup, my homelab, my API keys. Other techs don't have any of that. But they have the exact same problem.

I started thinking about what it would take to package this for someone else.

## What the Sidekick Actually Does

It's a Telegram bot. That's the whole interface — nothing new to install, no dashboard to check, no weekly email. You talk to it like you'd talk to a partner on site:

> *"Did a gate at Harbour Pointe, bad loop detector, swapped it."*

It logs the call. Equipment model, parts used, what you did. Later you ask:

> *"What did we do at Harbour Pointe last time?"*

And it tells you. Not just the address — the specific board, the fix notes, the parts you used.

Over time, it builds a knowledge base of every piece of equipment you encounter. First time you see a new board model, it creates an entry. Next time you see it, it already knows what you learned about it.

The whole thing runs on a $5/month VPS with a $25 OpenRouter deposit that lasts months. No subscription per-seat licensing, no "contact sales" page.

## The Parts I'm Still Figuring Out

This is version one. The core loop works — log, lookup, remember. But there are a few things I want to improve:

- **Invoicing.** The agent sits on your call logs already. Drafting an invoice from them is the obvious next step.
- **Multi-tech crews.** Right now it's one agent per person. For a shop with multiple techs, each one needs their own profile.
- **GitHub Pages:** https://www.dev-adam.com/blog/field-service-sidekick/

... wait, that last one is just how the blog post gets found.

If you're a service tech reading this and the "I know I've seen that board before but I can't remember what I did" feeling hits a little too close to home — I built the thing I wish I'd had five years ago. Happy to walk you through it.

*— Adam*