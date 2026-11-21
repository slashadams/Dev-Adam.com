---
layout: post
title: "The Cloudflare Permission the Docs Say You Already Granted"
subtitle: "The list endpoint showed me the ruleset. The ruleset itself told me I wasn't allowed to see it."
date: 2026-12-30 00:01:00 -05:00
tags: [cloudflare, api, permissions, search-console, static-site]
devto: true
bsky: |
  The API listed the ruleset, so I assumed I could read it. Reading it returned "request is not authorized."

  Same token, same zone, working for weeks — redirect rules just live behind a different permission, and the docs imply otherwise.

  Link in bio.
---

Search Console had a message I'd been ignoring on purpose: two URLs on my homepage listed as **"Alternate page with proper canonical tag."**

That category is informational, not an error. All three of these return the same 200 page, byte for byte, and all three carry the same canonical tag pointing at `/`:

```
https://www.dev-adam.com/
https://www.dev-adam.com/index.html
https://www.dev-adam.com/index
```

Google reads the canonical, picks `/`, and files the other two under "not indexed" — which is where they belong. The tag is already correct; you can't clear the message by editing tags, because the URLs still resolve. Validation keeps failing because there keeps being something to validate.

The only way to make it go away for good is to stop serving those two paths at all. Turn them into redirects and they drop out of the report entirely.

## The redirect has to live at the edge

The site is static Jekyll on GitHub Pages. There's no `.htaccess`, no rewrite rule, no origin config I can touch. GitHub Pages serves what's in the repo and that's the whole story.

Cloudflare sits in front of it, and Cloudflare can answer before the origin is ever consulted. One redirect rule on the zone — path equals `/index.html` → 301 to `/`, path equals `/index` → same target — and the two alternates become redirects. That's the fix.

I've been managing this zone through the API for weeks: HSTS on the edge, plus a set of response-header transform rules. Same scoped token, same zone, dozens of successful calls. So redirect rules looked like a solved problem I just hadn't gotten to yet.

## Step one was a backup, and it failed

I don't overwrite a ruleset I haven't read. It's live configuration serving traffic; if I'm about to replace its contents, I want the current contents on disk first.

So the first call was a GET on the ruleset:

```json
{
  "result": null,
  "success": false,
  "errors": [
    { "message": "request is not authorized" }
  ]
}
```

That's the read failing. Which means it's also the backup failing — and it's worth sitting with that for a second, because the instinct is to assume the write would have been fine. It wouldn't. If I can't read it, I can't replace it safely, and I shouldn't be near a `PUT` on it at all.

## The list endpoint acts like you have access

Here's what made this take longer than it should have. This call succeeds:

```
GET /zones/{zone}/rulesets?phase=http_request_dynamic_redirect
```

It comes back with the redirect ruleset's metadata — its ID, its kind, its phase, its version, when it was last updated. You can enumerate the thing you're not allowed to open.

That is a genuinely misleading signal, and it's the one I'd warn anyone about. Seeing an object in a list response reads as "this is mine to work with." Tooling built on that assumption will happily construct a write it has no permission to send — and the failure arrives one layer later, at the point where you've already decided what to do.

Visibility of an ID is not permission on the object.

## Same endpoint, different phase, different answer

The part that narrowed it down was running the identical call against the ruleset I know I can manage:

```
GET /zones/{zone}/rulesets/{headers-ruleset-id}
→ success: true | rules: 1
```

Same zone, same token, same endpoint shape. One ruleset opens, the other doesn't. That kills the "bad token" theory and the "wrong zone" theory in a single comparison, and leaves exactly one explanation: the token has a permission for one phase and not for the other.

Cloudflare's ruleset engine is per-phase. Response-header transforms live in `http_response_headers_transform`. Redirect rules live in `http_request_dynamic_redirect`. They are different phases, and phase access is a separate grant. A token that can edit headers has told you nothing about redirects.

## Page Rules are not the fallback

Older Cloudflare guidance lands on Page Rules for exactly this kind of path redirect, so I tried it:

```
GET /zones/{zone}/pagerules
→ 1011: Page Rules endpoint does not support account owned tokens.
```

Closed. If the credential is scoped to a zone, that whole endpoint is out of reach — no way in, not even read.

## "At least one of these permissions"

The part that bothers me is the documentation.

Cloudflare's redirect-rules docs list the permissions that grant access, and they're presented as an alternatives list — *any one of these*. One of the entries is the transform-rules permission I already had, because I'd been using it for the header work.

Follow the docs literally and you conclude you're covered. You're not. The access that actually opens the `http_request_dynamic_redirect` phase is **Single Redirect — Edit**, scoped to the zone (the API-side names are a variation on Dynamic URL Redirects). The transform-rules grant in that list does not substitute for it.

I don't think the list is lying so much as describing the dashboard's blunter notion of "rules" — but the effect is the same for anyone driving the API: an authorization error that points at the wrong thing, in a product where you cannot see your token's grants from the API to check.

If you take one thing from this: **an authorization failure is a claim about a credential, not about the thing you were trying to configure.** Nothing was wrong with the redirect ruleset. Nothing was wrong with the site. The token was missing a grant, and the only way to establish that was to stop treating the error as "the config won't take."

## The probe that proves scope without writing anything

Once I suspected a scope gap, I wanted proof without risking a live rule. The trick is that a write endpoint tells you *which* kind of failure it is:

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"rules":[{"action":"redirect"}]}' \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/$RULESET_ID"
```

That body is deliberately invalid — the rule has no expression and no target. If the credential is authorized, validation rejects it and you get a **400** describing what's missing. If the credential isn't authorized, you never reach validation and you get the authorization error instead.

I got the authorization error. Which is the answer I wanted and the one that costs nothing: the request died before touching anything.

Blind-writing the ruleset instead would have been the expensive mistake. The apex → www 301 on this zone is served by Cloudflare, not by GitHub — you can tell from outside, because that response carries `server: cloudflare` and no origin request ID, while the pages do. That redirect almost certainly lives in the ruleset I was trying to reach. A `PUT` that replaces a ruleset's contents would have deleted it, and I'd have found out by sharing a link that stopped working.

The read failing was the protective outcome. Two failed calls before a live rule was touched is the good version of this story.

## What I'd do differently

Two things, and both are small.

Read the permission table for the *specific phase* before assuming an existing zone token covers a new ruleset type. Phases are the unit of access here, and I was pattern-matching "I can drive the Cloudflare API on this zone" when the accurate version is "I can drive these two phases on this zone."

And put the backup call first, every time. It costs one request and it's the difference between "this didn't work" and "this would have broken something." Here it happened to be the failing call — which meant the first thing I learned about the job was that I wasn't allowed to do it, rather than the last.

The unblock is a one-minute token edit — add the Single Redirect permission, scoped to this one zone, same blast radius as everything else on the token. The redirect rules themselves write in seconds after that, and the Search Console alternates go away on the next crawl.

The site was never broken. The canonical tags were doing their job the entire time. This was tidying up a report I could have left alone — and it still taught me more about Cloudflare's permission model than any of the calls that succeeded.
