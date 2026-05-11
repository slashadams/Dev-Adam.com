---
layout: post
title: "Building a Zero-Dependency Character Sheet Web App"
subtitle: "A single HTML file that lets D&D players build characters and export them to their AI Dungeon Master."
---

When I built the AI Dungeon Master, I hit a question: how do players get their character sheets into the game?

The obvious answer was building a web server — logins, databases, accounts. The wrong answer. The players already had Telegram. They didn't need another place to sign in.

## The Solution

A single HTML file. Open it in any browser, build your character, click Export, paste into Telegram.

No install. No server. No accounts. No dependencies.

## What It Does

The sheet covers all the standard D&D 5e fields:

- **Ability scores** — modifiers auto-calculate as you type
- **Skills** — tap to toggle proficiency, bonus updates live
- **Saving throws** — same deal, proficiency toggle + auto-calc
- **Combat stats** — HP, AC, initiative, speed, proficiency bonus
- **Attacks and equipment** — add/remove items dynamically
- **Spellcasting** — pick your ability, slots per level, save DC auto-calculates
- **Features, backstory, notes** — free text areas for everything else

## Export Flow

Player builds character → clicks **Export** → gets a markdown file → drops it in the Telegram chat → DM reads it and logs it into the campaign wiki.

The import works both ways — if the DM updates your sheet mid-campaign, you can download the updated markdown and import it back into the app.

## The Design Choice

Zero dependencies means it works offline, on any device (phone, tablet, desktop), with no infrastructure. Host it anywhere — GitHub Pages, a USB drive, an email attachment. The file is ~22KB.

It auto-saves to browser localStorage, so closing the tab doesn't lose progress. And you can download full JSON backups whenever you want.

## Why This Matters for Selling AI Products

The character sheet web app taught me something about packaging AI agents as products: the agent is the core feature, but the *tooling around it* is what makes it usable.

A DM that can read character sheets is useful. A DM plus a dead-simple way for players to create and share those sheets? That's a product.

When you're building AI products, think about **the full workflow** — not just what the agent does, but how people interact with it before, during, and after the session.