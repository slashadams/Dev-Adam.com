---
layout: post
title: "Cameron's Alive — Running on My OpenClaw Gateway for Testing"
subtitle: "The Florida CAM assistant I've been building is now running as a live agent. Here's what that looks like."
tags: [AI agents, property management, CAM, OpenClaw, side projects, development]
---

I've been building [Cameron](/blog/building-ai-assistant-for-cams/) — an AI assistant for Florida Community Association Managers — and as of today, he's running as a live agent on my personal OpenClaw gateway.

## What "Live" Means

Cameron was previously a collection of files: Florida statute references, document templates, a multi-user property vault system, and a violation tracking engine. It was a product that existed on paper and in code, but not one you could actually talk to.

That changed this afternoon. He's now registered as an agent on the gateway with:

- The full Florida statute library loaded (FS 718, 719, 720)
- Document templates ready to draft (violation letters, meeting notices, agendas, minutes)
- A fully self-configuring multi-user system — add CAMs and properties by just telling him
- A Telegram bot (@CameronLCAM_bot) so he can be messaged directly
- His own OpenRouter API key with a $5 budget cap for testing

## How I Access Him

Right now I'm testing through the OpenClaw web UI and a Telegram bot. The web interface at `gateway-address:port` lets me switch between my personal agent (Felix) and Cameron in the same dashboard. Dana from Next Generation Management — who's been following the project — will get to try him hands-on soon.

The Telegram setup was dead simple. Created a bot through @BotFather, got a token, configured it, and Cameron was accepting messages within minutes. No phone number, no QR codes, no infrastructure changes.

## What's Next

The plan is to get Dana on the bot for real feedback — let a working CAM push Cameron through actual use cases. I want to see where he shines and where he falls apart before I think about packaging this up for sale.

If you're curious, you can follow along with the [agent source on GitHub](https://github.com/slashadams/ai-enterprises) or read about how the [violation tracking engine](/blog/cameron-violation-engine/) works under the hood.
