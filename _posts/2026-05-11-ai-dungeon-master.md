---
layout: post
title: "I Built an AI Dungeon Master That Runs D&D Over Telegram"
subtitle: "Full D&D 5e SRD, persistent campaigns, dice rolling, and a character sheet web app — all driven by an LLM agent."
---

I play D&D with friends, but we're adults now. Jobs, kids, time zones. Getting four people in the same room for four hours is a scheduling miracle.

So I built something else.

An AI-powered Dungeon Master that runs D&D 5e campaigns over a Telegram group chat. It knows the full rulebook, remembers what happened last session, rolls real dice, and narrates the action. Players just open Telegram and play — no apps, no accounts, no scheduling.

## How It Works

The DM runs on [OpenClaw](https://docs.openclaw.ai), an open-source AI agent platform I've been working with. Here's the stack:

```
Players (Telegram Group Chat) ←→ OpenClaw Gateway ←→ DM Agent
                                  ↕
                            Campaign Memory (wiki)
                            D&D 5e SRD + Homebrew
                            Dice Roller + Tools
```

The agent has a defined persona — narrative-first, fair rulings, rule of cool. It reads the actual SRD files when you ask about a spell or monster. It rolls dice deterministically (no fudging). And it writes campaign state to a wiki that persists between sessions.

## What It Can Do

**Run combat.** It tracks initiative, describes monster actions, announces whose turn it is. The dice are real — `2d20+5`, advantage, disadvantage, damage rolls. I never make up a result.

**Remember everything.** Characters, NPCs, quests, loot — it all goes into a campaign file. Come back a week later and the DM remembers what happened.

**Answer rules questions.** Full 2024 SRD loaded — 500+ spells, 400+ monsters, all 12 classes. If a player asks how Fireball works, the DM reads the spell description and answers.

**Handle homebrew.** Custom monsters, magic items, variant rules — drop a markdown file in the homebrew directory and the DM uses it.

**Character sheets.** I built a companion web app — a single HTML file, zero dependencies. Players open it in their browser, build their character, and export a markdown file straight into the Telegram chat. The DM reads it and logs the character into the campaign.

## The Tech

The agent instructions define the DM's behavior: describe scenes vividly, keep combat moving, reward creative thinking, fail forward. The SRD reference material sits in the agent's workspace as markdown files. The dice roller is a Python script. Campaign state lives in a wiki vault.

The whole thing ships as a zip — agent files, SRD, dice tool, web app, templates, and a step-by-step install guide. Drop it into your OpenClaw workspace, configure a Telegram bot, and it works.

## Why This Matters

D&D is a social game. Nothing replaces a good human DM. But for groups that can't meet regularly, or for players who want to explore between sessions, this fills a real gap. The campaign doesn't die when someone has to cancel.

And honestly? Watching an LLM describe a goblin ambush or narrate a critical hit is surprisingly fun.

---

*The DM agent is [available on Gumroad](https://gumroad.com/products/maeahs) as a self-contained package. Requires OpenClaw, a Telegram bot token, and an LLM API key. Full install guide included.*