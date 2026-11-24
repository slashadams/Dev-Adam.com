---
layout: post
title: "Your Agent's Page-Fetch Can Be Dead While Search Still Works"
subtitle: "A working search hides a broken fetch — and on multi-profile setups, one of them is probably sitting in this exact state."
date: 2027-01-01 00:01:00 -05:00
tags: [AI agents, hermes, self-hosting, debugging, configuration]
devto: true
bsky: |
  One agent profile could search the web fine. Every URL fetch came back "search-only backend cannot extract."

  Search and extraction are separate capabilities, and per-profile config doesn't inherit the main profile's — so it had fallen back to a search-only backend.

  The one-line fix.
---

I run a handful of AI agent profiles off one machine — a main one I use every day, plus smaller ones with their own personalities and tool access: an ops agent, a project one, a gaming companion I talk to about whatever I'm playing.

One of them told me, almost in passing, that it couldn't fetch web pages. Its search worked fine. The fetch-a-URL tool just didn't. So when it needed to read a specific page, it had been pulling text out of search snippets and writing *those* to disk instead — slower, lossy, and it didn't know it had any other option.

That last part is the interesting bit. The tool wasn't broken. It was misconfigured, and the misconfiguration is the kind that hides behind a working neighbour.

## Search and fetch are two different capabilities

It's easy to think of "web access" as one thing. In the agent framework I use (Hermes), it's two: a **search** backend and an **extract** backend. Separate settings, separate providers.

The reason is that not every provider does both. Some are search-only — the free tiers especially. A free search backend, ddgs, a self-hosted SearXNG instance: all of them will find you URLs, and none of them will fetch the page behind one.

So the config carries two knobs:

```yaml
web:
  search_backend: <who finds URLs>
  extract_backend: <who fetches pages>
```

And here's the deliberate design choice that made this findable: when the extract backend can't extract, the tool returns a *typed error* rather than quietly falling back to something else. The exact message was:

```
Brave Search (Free) is a search-only backend and cannot extract URL content.
Set web.extract_backend to firecrawl, tavily, keenable, exa, or parallel.
```

That error is the whole diagnosis, if you read it. It names the wrong capability, and it names the fix.

## Why only one of them broke

The profile that reported the problem was pinned to a search-only backend for *both* capabilities. Search worked — the backend does search. Extract failed — the backend can't extract. Two settings, one provider, one alive and one dead.

The insidious part is the asymmetry: **a working search makes a dead fetch invisible.** You ask the agent a question, it answers, everything looks healthy. Nothing in normal use tells you the second capability is dark. The agent only notices when it needs to read one specific page — and when it can't, it improvises with search snippets instead of failing loudly.

## Where the config went wrong: profiles don't inherit it

This is the part worth writing down. I have several profiles on the box. They share defaults for most things. They do **not** share the `web:` section.

- The main profile was configured correctly — both capabilities on a provider that does both.
- Two other profiles were pinned to a search-only backend outright.
- The one that complained had *no* `web:` block at all, so it auto-detected, and the auto-detect ladder landed on a search-only fallback.

That last case is the quietest. An empty config doesn't look wrong. It looks like defaults. But "default" here resolved to the last rung of the ladder, and nothing anywhere said so.

The check is the same resolver the agent uses, run once per profile against that profile's home:

```bash
hermes -p <profile> config get web
```

Anything on `extract_backend` other than a provider that actually extracts is a dark capability.

## The fix is one line per profile

```bash
hermes -p <profile> config set web.extract_backend keenable
```

Keenable supports extraction and is keyless on its free tier, so there's no key and no cost. Search is left untouched — it was already working, and the per-capability keys are explicitly isolated: setting `extract_backend` does not reroute `search_backend` and vice versa. Config hot-reloads, so the profile picks the change up on its next turn; no restart.

## Prove it end-to-end, don't trust the config file

I read the config back and checked the resolver per profile. Then I actually fetched pages: a long Wikipedia article came back as ~20,000 characters of real page text, plus a couple of wiki guide pages at ~6,700 and ~28,700 characters — the same calls that had errored an hour earlier.

A green config file and a working fetch are two different claims. Only one of them is the thing you actually care about, so make the tool do the thing and look at the body text.

## Two things I'd still fix

**The toolset gap.** The profile that hit this had no terminal and no browser — just web, memory, and a couple of others. So when fetch died it had *no* fallback at all, which is exactly why it reached for search snippets. A profile with terminal access would have just curled the page. Worth knowing which of your agents are that dependent on a single tool; a capability with no fallback should be the one you verify most often.

**Content pulled from snippets is damaged content.** The file the agent built while fetch was broken had been assembled from search-result fragments. Snippets are stitched and truncated; exact step order and numbers can get mangled. Now that fetching works, anything authored from snippets should be re-pulled from the real page and diffed. Lossy input that still reads as fluent output is its own class of bug — and it's one you'll only catch by going back to the source.

## If you run more than one agent, check them all

The lesson isn't that any particular provider is bad. It's that **a capability can fail silently while its sibling keeps working**, and if you run several agent instances, the odds that one is sitting in exactly this state go up with every profile you add — especially the ones you configured once and never thought about again.

Two commands: list your profiles, then read the `web` section of each. If `extract_backend` isn't a provider that extracts, that agent has been quietly improvising every time it needed to read a page. You won't see it until you go looking.
