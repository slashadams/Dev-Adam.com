---
layout: post
title: "Three Tokens in the Portal, and Only One of Them Is the Right One"
subtitle: "A vendor API where the obvious credential expires in an hour and the correct one is buried at the bottom of the list. Plus why you should fetch the OpenAPI spec before writing a single line against it."
date: 2026-11-12 00:01:00 -05:00
tags: [api, automation, security, homelab, tooling, lessons-learned]
---

I was wiring up an external attack-surface monitoring service so it could run on a schedule. It has a public API, the docs are reasonable, and getting a credential should have been the easy part.

It wasn't, because the portal offers **three** values and the one you want is not the one that looks like it.

## What the portal gives you

Three things, and they present as roughly interchangeable:

- An **organisation ID**
- A **bearer token**
- A **refresh token**

Here's the thing that isn't obvious:

**The organisation ID isn't a secret.** It's an identifier — you can put it in a config file, log it, paste it in a ticket. Treating it as sensitive is wasted effort.

**The bearer token expires in one hour.** It's a short-lived JWT, minted on demand. It is not a credential you store, and any integration built around it is an integration that will stop working within the hour.

**The refresh token is the actual credential.** It's long-lived, it's what you keep, and it's what mints bearers.

So if someone hands you access and you pick the option that says "token," you get something that works beautifully for exactly one hour and then produces 401s forever.

**The exchange looks like this:**

```
POST https://api.roboshadow.com/identity/bearertoken

{"refreshToken": "<the long-lived one>"}
```

...which returns:

```json
{"accessToken": "<JWT>", "expiresIn": 3600}
```

Note there's **no auth header on that call** — the refresh token in the body *is* the authentication. That's easy to get wrong if you've internalised "every call needs a bearer," and adding an `Authorization` header here does nothing useful.

Then every other request carries `Authorization: Bearer <accessToken>`. And because it lasts an hour: **re-mint per run.** Don't cache a bearer across runs. It's disposable by design and storing it just guarantees a confusing failure on the next scheduled execution.

## The pattern worth generalising

This isn't specific to one vendor. It's a shape that shows up constantly:

**When an API offers several credential-looking values, the names won't tell you which is durable.** Look for which one is described as expiring, and treat that as derived rather than primary. Anything with an `expiresIn` is not something you store.

If you're ever requesting access from someone, ask for the value that **mints** the other one. That's the request that produces a working integration.

## Fetch the spec before writing code

The other thing I'd do differently: read the OpenAPI document first.

```
https://cdn.development.roboshadow.com/publicapi/openapi.yaml
```

Roughly 115 KB, OpenAPI 3.0.3. Fetch it and read it locally.

I'd been assuming capabilities based on what the product's marketing describes. The spec said something much clearer, and worth knowing before designing anything:

**The public API is read-only. Forty GET paths. No write or mutate endpoints at all.**

That's a genuinely useful boundary. It means anything I build against this can *observe* — pull findings, read scan results, list assets — but can never change the state of the account. Which in turn means the blast radius of a leaked refresh token is bounded: someone could read my monitoring data, and could not reconfigure anything, trigger scans, or delete history.

I'd have guessed the opposite, because most "connect your infrastructure" products are read-write. Reading the spec turned a vague assumption into a fact I could reason about, and it's the difference between writing a security note that says "this credential is dangerous" and one that says "this credential grants read access to monitoring data and nothing else" — the second being far more useful and far more accurate.

**Read the spec, don't infer the surface from the marketing.** They describe different things, and only one of them is a contract.

## What I'd keep

**Don't store derived credentials.** If a value expires in an hour, it's a runtime artefact. Store the thing that mints it.

**Sort credentials by duration, not by name.** "Bearer" and "refresh" are just words; `expiresIn: 3600` versus long-lived is the actual distinction.

**Read the API surface before designing.** Read-only versus read-write changes what your integration can do, what your error handling needs to cover, and how you write about the risk.

**Know which value is actually sensitive.** An org ID that looks like a UUID is not a secret. Treating it as one produces friction — secret managers, handover scripts, redaction — for something that's just an identifier. And while you're doing that, the refresh token sitting next to it needs all of that attention.

That last one cuts both ways, which is the real point. Being indiscriminately careful about every value in a config file is a way of being careless about the one that matters.
