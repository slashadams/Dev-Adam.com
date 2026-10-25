---
layout: post
title: "Stripe Checkout Needs a Server. My Site Doesn't Have One."
subtitle: "Stripe's own setup assistant told me to add an endpoint to my server framework. I have neither. Here's what actually works when your site is static files and a CDN."
date: 2026-11-14 00:01:00 -05:00
tags: [stripe, payments, static-site, jekyll, github-pages, side-projects]
---

I sell a small software product. I needed a way to take money for it. My website is static Jekyll on GitHub Pages — files and a CDN, nothing else.

That combination is more of a problem than it sounds, and the way I found out was instructive.

## The prompt that didn't apply

Stripe offers an AI-assisted setup prompt for adding embedded Checkout. I pasted it in and followed it, and the first thing it asked me to do was **update my existing Checkout Session call.**

I don't have one.

The fallback was to **add a minimal endpoint to my existing server framework.**

I don't have one of those either.

I went and verified that properly rather than assuming, because "surely there's a `package.json` somewhere" is exactly the kind of assumption worth checking. The repository contains:

- No `package.json`, no `Gemfile`, no `requirements.txt`, no `go.mod`
- No `server.js`, no `app.py`
- No `.env`, no `Dockerfile`
- No `vercel.json`, no `netlify.toml`, no `wrangler.toml`
- No Stripe code of any kind

The only config file is `_config.yml`. That's what a static site looks like from the inside, and it means both of the prompt's paths are unavailable.

Worth noticing what the second instruction actually asks for. "Add a minimal endpoint to your existing server framework" — with no framework, following it literally means **creating an application**: a runtime, a host, a secret store, a deploy pipeline, and a permanent maintenance surface you now own forever. The prompt's own stated constraint was that the change should be surgical and minimal. The instruction refutes itself, and you only see that if you check whether its premises hold for your site.

## The actual blocker, which is about secrets

Here's the real reason this isn't a matter of writing a few more lines.

**Creating a Checkout Session requires the Stripe secret key, and that call has to happen server-side.** A static site has nowhere to put a server-side secret.

Think about what "static" means: every file in the repository is served to anyone who requests it. There's no code path that runs where a user can't look. So the only way to reference a secret key in a static site is client-side — which is to say, **public.**

A leaked `sk_live_` key is complete control of the Stripe account. Not "read your balance" — everything: create charges, issue refunds, change payout destinations, read every customer record.

So there's no clever workaround to find here. The constraint isn't a limitation of your tooling; it's that the architecture you chose has no room for the thing being asked for. If you want embedded checkout, you need to add a server (or a serverless function) *first*, and then the key has somewhere to live.

I'd rather state that plainly than have someone spend an evening looking for the clever trick.

## What actually works

**Payment Links.** You create them in the Stripe dashboard — they're just URLs — and Stripe hosts the entire checkout flow. No code, no key, no server. A link is a link; your static site can point at it.

Set the **"After payment" redirect** to a thank-you page on your own domain, so a paying customer gets handed off the same way your contact form does. That's the whole integration.

**Invoices** cover everything a Payment Link can't, and also need no code.

## The limitation you'll hit, and where

This is worth knowing before you design pricing around Payment Links.

**A Payment Link carries exactly one price.** No quantity ladder, no add-ons, no conditional pricing.

My product is per-seat: a base setup fee plus a monthly rate for the first technician, with a lower rate for each additional one. That's a two-dimensional price — a fixed component and a per-unit component — and a Payment Link simply can't express it.

It handles the single-user case cleanly. Everything else wants invoices, which is why I use both: Payment Links for the straightforward self-serve option, invoices for anything with a ladder.

**The general lesson:** decide your payment mechanism *after* you've decided your pricing model, because the model can rule out the mechanism. Discovering "our pricing can't be expressed by the tool we just wired up" is a bad way to find out.

## Don't build on a beta, especially here

One more thing that the prompt didn't flag.

The embedded Checkout flow it was guiding me toward is **preview functionality** — it referenced a beta flag, a `betas:` array in the API call, and a preview build of the JavaScript library. Betas change shape. Sometimes they never ship.

Taking your first paying customer's money through a preview feature is a bad trade. The upside is a slightly nicer checkout form; the downside is that your revenue path depends on an unfinished API that nobody has committed to supporting.

If embedded checkout is genuinely wanted later, it needs a serverless function plus secret storage plus a deploy step. That's a real project, and it's worth doing when volume justifies it — not before the feature is generally available.

## The part that surprised me most

The setup instructions told me to write a file called `STRIPE_INTEGRATION_TODO.md` **into my repository.**

My repository is served publicly. Following that instruction would have published my internal payment-setup notes — including where API keys live — to the open web, on a site that's already indexed.

That's not a subtle failure. It's an instruction that treats "the repo" as a private working directory when for a static site it is the live website. And it's the kind of mistake that's easy to make when you're following a guide written for a different architecture: the steps are right for the stack they assume, and silently wrong for yours.

I keep those notes in a private wiki instead.

## What I'd tell someone in the same position

**Check what your site actually is before following any integration guide.** Not what you think it is — list the files and see. The absence of a `package.json` is a load-bearing fact about your options.

**Never put a secret key in a static site's code.** Not in a JS file, not in a template, not temporarily. Everything there is public by definition.

**Reach for hosted checkout before you reach for an API.** If you're selling a small number of things at fixed prices, Payment Links are the entire integration.

**Then match the tool to the pricing.** One price per link is a real constraint, and per-seat or usage-based pricing will push you to invoices.

And when a setup assistant hands you steps, check that its assumptions are yours. Mine wanted a server, a framework, and a private repo. I had none of the three.
