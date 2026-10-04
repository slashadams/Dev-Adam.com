---
layout: post
title: "I Built My Personal AI Agent Into a Product Other Techs Can Buy"
subtitle: "The Field Service Sidekick — a Telegram bot that remembers every job you've done"
date: 2026-10-03 10:00:00 -04:00
tags: [ai-agents, side-projects, hermes, self-hosting, field-service, product-launch]
---

I manage about four to six service calls a day, sometimes more. Gate operators, access control, barrier arms — if it opens and closes, I've probably worked on it. And for years, I had the same problem every field service tech has: *where did I write that down?*

You finish a call. You tell yourself you'll remember that it was a Liftmaster MA001 with a bad logic board, or an MATDCBB3 that needed a new transformer. Three weeks later, you're back at the same property and you're rooting through a notebook, scrolling through old texts, or — let's be honest — just hoping the same fix works again.

I tried a lot of ways to solve this before I found one that stuck.

## Attempt #1: Analog

Notebook in the truck. Write down the address, the equipment model, what you did. It's simple. It's reliable. And it's completely useless the moment you need to search.

"What did I do at Harbour Pointe the last two times?" Good luck finding that with a pocket notebook and a pen. I'd have to flip through months of entries hoping something jogged my memory. If I was lucky, I'd recognize the name. If I wasn't, I'd guess.

I also tried phone notes. Same problem, different medium. Notes app doesn't have a "show me everything related to this property" feature.

## Attempt #2: Prometheus — The Agent I Built For Myself

I've been running self-hosted AI agents (Hermes Agent) on a Proxmox LXC in my house for a while now. It runs on a repurposed laptop, no cloud subscription, total cost is about $8 a month in API usage. I have a few agents for different things, but my field service agent — Prometheus — is the one I use the most.

I set it up as a Telegram bot. I'd finish a call, pull out my phone, and dictate something like:

> *"Did a gate at Harbour Pointe. Bad loop detector on a Liftmaster. Swapped the detector, tuned the sensitivity, all good."*

Prometheus would log it — date, property, equipment model, diagnosis, parts used — and add it to my wiki. If I needed to remember what I did six months ago, I'd ask:

> *"What did we do at Harbour Pointe last time?"*

And it would tell me. Not just the address — the specific board revision, what I tried before, what parts I ordered, whether it held.

Over time, something happened I didn't plan for. It started building a knowledge base. First time I worked on a new board model, it created an equipment page. The second time I saw one, it already had notes from the first encounter. The third time, it had compiled everything I'd learned across multiple sites.

I stopped losing my notes. I stopped guessing. The information I needed was in my Telegram chat history.

## Attempt #3: Can I Sell This?

The problem was Prometheus wasn't designed to be handed to someone else. It had my config, my Telegram setup, my homelab. Other techs don't have a Proxmox server in their garage. But they have the exact same problem I did.

I started thinking about what a stripped-down, shippable version would look like.

First, the interface: Telegram. Every service tech has a smartphone. Most of them already use Telegram. No dashboard to check, no weekly email to read, no new app to install. You talk to it like you'd talk to a partner on site.

Second, the setup: I'd run a 30-minute discovery call to understand what equipment they see, how they track notes now, what they forget the most. Then I spin up their agent — a Telegram bot with their name, tuned to their trade. Their equipment gets built into the wiki as they work.

Third, the hosting: It runs on a cheap VPS ($5-10/month). They set up an OpenRouter account with a $25 deposit that covers months of usage. That's it. No monthly license fees, no per-seat pricing, no "contact sales" page.

## How It Works Day-to-Day

A tech pulls up to a job. They open Telegram, hit the voice button on their bot, and say:

> *"Did a gate at 123 Main, Liftmaster MA001, bad capacitor on the logic board, swapped the board, gate running smooth."*

They're done. That's the whole note. The agent logs the date, property, equipment, diagnosis, resolution, and parts. It saves it to a running log and updates the equipment page for that board model.

Later that week, they're at a different site with the same board. They ask:

> *"What did we learn about the MA001?"*

The agent pulls up the compiled knowledge — the capacitor failure pattern, what to check first, how many hours the fix took last time. They solve the call faster because they're not re-learning the board from scratch.

End of the week, they ask for a recap and get a clean list of calls closed, properties serviced, parts used. Ready for billing.

## Why This Works For Field Techs

The buttoned-up Silicon Valley pitch would call this "AI-assisted field service documentation with persistent knowledge graph integration." I call it "a notepad that doesn't get lost under the passenger seat."

The difference between this and every other AI agent product is:

**It does one thing.** It logs your calls and remembers your equipment. It doesn't browse the web for you, write your emails, or generate spreadsheets. A field tech doesn't need an AI employee. They need a digital partner who remembers what happened at the last call.

**It learns your trade.** You work on Liftmaster boards all day? The agent builds a Liftmaster knowledge base. You work on DoorKing and Chamberlain? Same thing. It adapts to whatever equipment you encounter, not the other way around.

**It's owned by you.** Your data is on your VPS. Your API key is yours. If you stop paying me for setup support, the agent keeps working. No rug to pull.

## What I'm Still Figuring Out

The core loop is solid — log, lookup, remember. A few things I want to add:

**Invoicing.** The agent sits on your complete call log already. Drafting an invoice or work order from it is the obvious next step. Some clients want it, some have their own system. I'm making it optional.

**Multi-tech crews.** The agent supports multiple techs out of the box — just add each person's Telegram ID to the approved list. Everyone logs calls and lookups to the same shared wiki, so the whole crew benefits from what each tech learns on site. One agent per company, not one per person.

**Voice. It matters more than I thought.** I switched from Gboard dictation to Wispr Flow a few weeks ago and the accuracy jump was dramatic. No more garbled messages from the agent mishearing "Liftmaster" five times in a row. I include that recommendation in the onboarding now.

## If This Resonates

I wrote this post for a specific audience: service techs who have a drawer full of half-used notebooks and a vague sense that they've solved this exact problem before.

The Field Service Sidekick is $149 to set up and $40/month for hosting, plus your own API costs (about $5-25/month per user depending on how much you use it). Or $299 one-time if you have your own hardware and want to self-host.

But honestly, the pricing doesn't matter if the workflow doesn't fit. I'd rather talk to you about how you track your calls now and see if this would actually help.

If that sounds useful, shoot me a message. I'm happy to walk through it.