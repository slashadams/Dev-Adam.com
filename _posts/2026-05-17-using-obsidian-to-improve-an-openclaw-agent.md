---
layout: post
title: "Using Obsidian to Improve an OpenClaw Agent"
subtitle: "Boosting memory, recall, and workflow with a markdown vault"
date: 2026-05-17 08:00:00 -04:00
tags: [openclaw, obsidian, agent, productivity]
---

## Why Obsidian?
Obsidian is a plain‑markdown knowledge base that lets you link notes, tag content, and browse a graph of ideas. For an OpenClaw agent like **Felix** or **Cameron**, the vault becomes a *human‑readable* mirror of the agent’s durable memory. Instead of only storing facts in hidden JSON blobs, everything ends up as nicely formatted `.md` files you can open, search, and even edit manually.

## Concrete Benefits

1. **Clear recall** – When you ask the agent *"Do you remember when we discussed the self‑configuration feature for Cameron?"* the answer is fetched from a markdown note that includes the original phrasing, timestamps, and any follow‑up decisions.
2. **Versioned knowledge** – Because the vault lives inside your OpenClaw workspace, every change is committed to Git. You get a full history of how the agent’s understanding evolved over time.
3. **Cross‑agent visibility** – Both Felix and Cameron write to the same vault (`~/obsidian‑vault`). This makes it easy to share context between agents without duplicating data.
4. **Human editing** – Need to correct a fact or add a nuance? Open the relevant note in Obsidian, edit it, and the next agent run will pick up the change automatically.
5. **Time‑zone consistency** – All timestamps are stored using your preferred zone (US/Eastern). OpenClaw now respects the `timezone` setting you configured, so every entry appears with `‑04:00` offset instead of UTC.

## Quick Setup (no server needed)

```bash
# 1️⃣ Enable the Obsidian plugin (already done) – it writes to ~/.openclaw/workspace/obsidian-vault
# 2️⃣ Create the vault folder if it doesn't exist
mkdir -p ~/.openclaw/workspace/obsidian-vault

# 3️⃣ Tell OpenClaw where the vault lives (in openclaw.json)
#    (the configuration was added automatically in the previous step)

# 4️⃣ Restart the gateway so the plugin loads
openclaw restart
```

That’s it. From now on, any agent that calls `memory.write` or the built‑in `memory-wiki` hook will drop a markdown file into the vault.

## Example Note
Below is a snippet of what a typical entry looks like after a conversation about Cameron’s self‑configuration feature:

```markdown
# Self‑configuration feature (2026‑05‑14)
- **Description:** CAMs can onboard new users, add properties, and update records through conversation. No file editing required.
- **Outcome:** Added to `cameron-agent/AGENTS.md` and `README.md`.
- **Tags:** #cameron #feature #automation
- **Timestamp:** 2026‑05‑14 09:32:00 -04:00
```

Open the same file in Obsidian, add a comment, or link it to a broader project note – the next run of Felix will see the updated content automatically.

## TL;DR
- **Enable** the Obsidian memory‑wiki (already done).
- **All timestamps** now use US/Eastern (`‑04:00`).
- **Both agents** write to the same vault, giving you a searchable, version‑controlled knowledge base.
- **No extra server** – just a folder on your machine.

Give it a spin and ask Felix something like:

> *"Hey Felix, what did we decide about the self‑configuration feature on May 14?"*

You’ll get a crisp answer drawn straight from the markdown note.

---
*Published on* {{ site.time | date: "%B %d, %Y" }}
