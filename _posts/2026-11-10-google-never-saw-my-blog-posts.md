---
layout: post
title: "Google Had Never Seen a Single One of My Blog Posts"
subtitle: "Every check I knew to run came back green. robots.txt allowed everything, the sitemap returned 200, a search for my domain returned twenty of my pages. Google had the homepage and nothing else."
date: 2026-11-10 00:01:00 -05:00
tags: [seo, search-console, google, cloudflare, blog, troubleshooting]
bsky: |
  Google had never seen a single one of my blog posts. Not ranked badly — never discovered.
  
  robots.txt allowed everything. The sitemap returned 200. Both true, both irrelevant.
  
  One stale sitemap record, left over from the domain's previous owner.
---

I've published six posts in ten days, after a four-month silence on this site. So I asked my agent the obvious question: is any of it actually showing up in search?

Getting to a real answer took three instruments, two of which were measuring the wrong thing, and one wrong assumption about why I was seeing what I was seeing.

## Attempt #1: the analytics dashboard

The Cloudflare dashboard reported **174 unique visitors and 845 requests in 24 hours**.

That is not a visitor count. It's **zone-level** — every HTTP request to the domain, including crawlers and scanners. And it looks *healthy* while being wrong: 845 ÷ 174 is about 4.9 requests per visitor, which is exactly the ratio you'd expect from real page loads. A number that reads as plausible is harder to distrust than one that doesn't.

The honest figure lives in Cloudflare's **RUM dataset**, which counts only browsers that actually executed the analytics beacon. Over 41 days it returned **five rows, fifty page loads**.

Every one of those rows was **exactly 10 loads and 10 visits** — a 1:1 ratio, on five different URLs, on five different dates. A normal static site runs about **5 requests per visitor** (HTML, CSS, favicon). A 1:1 ratio on many requests means something is hitting single URLs, and the same fixed number every time is not a behaviour any audience has.

So: zero real readers. Disappointing, but not surprising for a site this young.

## Attempt #2: Search Console

Cloudflare can tell you that nobody arrives from search. It can't tell you *why*. Search Console is what separates the two possibilities that matter:

- **impressions with few or no clicks** — you're ranking on page 2 or 3, and the snippet isn't earning the click
- **zero impressions** — you aren't ranking for anything, which is a different problem with a different fix

Nothing on this box had Search Console access, so my agent set it up. That turned into its own small saga — the Google Cloud org policy blocks service-account keys outright, and Search Console separately *silently rejects* service accounts added as users, sometimes for days. The OAuth user flow sidesteps both, so that's what we used.

**The result: 19 impressions, 0 clicks, over 28 days.**

And all 19 were the **homepage**, at an average position of **45.7**. The query rows that Google didn't withhold were brand names and loose matches, sitting at positions 41 through 98.

Page five to page ten. Nobody clicks those.

That reads like the "ranking badly" branch, and I was ready to conclude that. It isn't. It's something else entirely.

## Attempt #3: the per-URL check

The URL Inspection API answers for one URL at a time, and it distinguishes states that the aggregate numbers flatten together. I ran it on four:

- **the homepage** — `PASS`, *Submitted and indexed*, last crawled October 25
- **`/blog/`** — **URL is unknown to Google**
- **a post published last week** — **URL is unknown to Google**
- **a post published in June** — **URL is unknown to Google**

*Unknown to Google* does not mean crawled and rejected. It means **never discovered**. Google had my homepage and had never seen a single one of my posts.

## The wrong turn I took first

Before any of that, I'd checked indexing the way I'd always done it: searched `site:dev-adam.com`. It returned **twenty-plus of my pages**, with real excerpts, including posts that URL Inspection was calling unknown in the same session.

I read that as proof Google had them. It wasn't proof of anything about Google.

**The search backend my tooling calls isn't Google.** It's a third-party index. It was telling me *some* crawler had read those pages — which is genuinely useful if that's the question you're asking. It is not an answer to "is Google indexing me," and I'd been treating it as one for months.

## The cause

Search Console keeps a record of every sitemap submitted for a property. Mine said:

- **submitted: 2022-01-19**
- **last downloaded by Google: 2024-12-15**
- **errors: 1**
- **13 URLs submitted, 0 indexed**

I picked this domain up this year. It had belonged to someone else until around 2024, and then lapsed. **The sitemap record survived the change of owner.** Google hadn't fetched it since December 2024, and it still described someone else's thirteen URLs.

With no inbound links pointing at the blog, that record was the only path by which Google could have learned my pages existed. And it was nearly two years stale.

## What didn't matter at all

Every check I knew to run:

- `robots.txt` allows all crawlers and declares the sitemap
- there's no `robots` meta tag
- the canonical link is present and correct
- `sitemap.xml` returns **200** and lists all 24 URLs
- the apex domain correctly redirects to `www`, and Google knows it does

All true. All irrelevant. **A sitemap URL returning 200 is not the same thing as a healthy sitemap record**, and only the record controls discovery. I'd been verifying the file and assuming that verified the relationship.

## The fix, and how fast it moved

One field. Search Console → Sitemaps → `sitemap.xml` → Submit. (My API token is deliberately read-only, so this had to be a human click — that's the right trade, and I'll take it again.)

- submitted **2026-11-04 15:54:30 UTC**
- Google downloaded it at **15:54:31** — one second later
- **0 errors**, **24 URLs** submitted, up from 13

And immediately, in the same session: one post went from *URL is unknown to Google* to **Discovered — currently not indexed**. By the end of the day, **eight of my twelve newest posts** were discovered.

Zero clicks, still. But Google now knows the pages exist, which is the first thing in this entire exercise with a mechanism behind it.

## What I'd keep

**Two dashboards can report two different populations and both be right.** Zone-level counts requests; RUM counts browsers. If one number is 20× the other, you're not looking at noise, you're looking at two different questions.

**A search hit is not an index check.** "Some crawler has read my page" and "Google has indexed my page" are different claims, and the tool that answers one may not be able to answer the other.

**Register a per-URL check before you trust an aggregate.** 19 impressions and 0 clicks had a single obvious reading that was wrong. The per-URL verdict cost nothing and said something completely different.

**Never report "the plumbing is fine" as "the site is indexed."** Everything about this site's plumbing was, and Google had one page.

**And the thing that finally made it legible:** publishing cadence was never the problem. I'd been publishing, consistently, into a place Google didn't know existed.
