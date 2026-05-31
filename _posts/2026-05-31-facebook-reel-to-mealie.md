---
layout: post
title: "I Built a Pipeline That Extracts Recipes from Facebook Reels"
subtitle: "From a custom Android app to sharing a link — the evolution of a recipe hoarder's side project"
date: 2026-05-31 16:50:00 -04:00
tags: [self-hosting, mealie, recipes, promedia, llm, whisper, side-projects]
---

I have a problem. I scroll Facebook, I see a video of someone making something incredible — say, a honey garlic chicken that's been marinating for 24 hours — and I want to make it. But the video is 47 seconds of fast cuts and background music. The recipe text? Nowhere. Maybe buried in the comments. Maybe not.

For years my solution was manual: watch the video twice, jot down ingredients, guess the quantities, try to reconstruct the technique from memory. Sometimes it worked. Most times I got something edible but wrong.

So I tried to solve it properly. Twice.

## Attempt #1: Tandoor + A Custom Android App

I self-hosted a [Tandoor Recipes](https://github.com/TandoorRecipes/recipes) server — a solid open-source recipe manager with a web UI, meal planning, and sharing. Problem was, getting recipes *into* it was all manual typing. So I did what any developer with a problem does: I built an app.

**[Tandoor-Scanner](https://github.com/slashadams/Tandoor-Scanner)** was my first Android app. Kotlin, Android Studio, ML Kit OCR, the whole deal. The idea was simple — snap a photo of a physical recipe card or a cookbook page, OCR extracts the ingredients and instructions, and it auto-uploads to Tandoor.

It *kind of* worked. OCR on printed text was decent. Handwritten recipes, not so much. Ingredient splitting was brittle. There was no review screen — it was one-tap upload and hope for the best. And the biggest problem: it only worked for recipes I had physical access to. What about the endless scroll of recipe videos on my phone?

Plus, maintaining a custom Android app is a whole second job. I'm a field tech who hosts side projects on a Proxmox server in my garage. I don't have bandwidth to ship APK updates.

## Attempt #2: A Plain Markdown Cookbook

I simplified. I created a [cookbook repo](https://github.com/slashadams/cookbook) — just markdown files organized into folders (main-courses/, desserts/, sides/). Recipes were structured with YAML frontmatter, measured out, and checked into git. Version-controlled recipes. Clean, simple, zero infrastructure.

But it was still manual. Every recipe I added meant typing the whole thing out by hand. Great for family recipes I cook regularly. Terrible for the firehose of video content I was scrolling past every day.

## Attempt #3: The One That Stuck

The breakthrough came when I realized I was solving the wrong problem. I didn't need a better way to *type* recipes. I needed a way to skip the typing entirely.

Here's the pipeline I built:

1. **Share the link** — From Facebook, Instagram, or wherever, I send a reel URL to my chat
2. **yt-dlp grabs the audio** — Downloads the video's audio track. Works on basically every platform
3. **Faster-Whisper transcribes it locally** — Runs on my Proxmox LXC, free, no API costs, no data leaving my house. ~30 seconds for a 60-second reel
4. **An LLM structures it** — Takes the raw transcript, extracts ingredients with quantities, writes clean numbered instructions, infers cooking times and servings
5. **Mealie API ingests it** — The structured recipe gets pushed to [Mealie](https://mealie.io/), the self-hosted recipe manager I switched to from Tandoor

End to end: about 60 seconds. From "oh that looks good" to a fully structured, searchable recipe in Mealie.

### Why Mealie over Tandoor?

Mealie won on the family side. It has a better mobile UI, works great as a standalone web app for non-technical users, and handles the "send a link to Mom" use case natively. Shared meal plans, automatic nutritional estimates, and a clean shopping list view — it's a better experience for everyone, not just me.

### Why this works where the app didn't

The custom Android app required:
- Device-specific build tooling
- Permission management
- App store distribution (even sideloading)
- Physical access to the recipe source
- OCR that choked on anything non-standard

This pipeline requires:
- A link
- That's it

I can be on my phone, on my laptop, at my desk, or on-site at a job. Share the link, the agent handles the rest. No app to open, no photo to take, no fields to fill.

## The Infrastructure Side

The whole thing sits on a Proxmox LXC running Docker Compose. Mealie, the Whisper inference, and the agent that orchestrates the pipeline are all containers on the same host. Remote access is through Twingate — no exposed ports, no Cloudflare tunnels, just point-to-point encrypted tunnels to my devices.

The total recurring cost for the AI piece: $0. Whisper runs locally on my GPUless LXC (CPU-only, which is slower but still under a minute per reel). The LLM call costs pennies through an API provider and structures way better than any OCR engine I've ever used.

## What I'd Change

The pipeline could be smoother. Right now the LLM sometimes hallucinates quantities (no, that sauce does *not* need 2 cups of soy sauce for 4 chicken thighs). I need a validation layer — maybe cross-reference ingredient amounts against known norms. Also, the Mealie API fields aren't 1:1 with what the LLM naturally outputs, so there's some mapping logic that's still rough around the edges.

But the core loop works. And more importantly, *I actually use it*. It's been a week and my Mealie instance has grown more than the Tandoor server did in six months. Because the friction is gone.

## The Takeaway

If you're building tools for yourself, the best solution is the one that removes the friction you personally feel. For me, that meant stopping at "good enough" instead of trying to build a perfect OCR-powered Android app. The cascade approach — dumb downloader, free transcriber, cheap LLM, existing API — wins over a custom app every time.

The custom Android app was a fun project and I learned a ton about Kotlin development. But the "share a link and forget it" pipeline is what actually gets used. That's the difference between a project and a tool.
