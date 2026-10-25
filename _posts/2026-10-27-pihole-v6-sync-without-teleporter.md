---
layout: post
title: "Syncing Two Pi-hole v6 Instances When Teleporter Doesn't Work"
subtitle: "Teleporter is broken in v6 and wouldn't have carried your blocklists anyway. Here's the API-based method that does — and the one config section that will silently break your sync forever if you copy it."
date: 2026-10-27 09:00:00 -04:00
tags: [pihole, self-hosting, homelab, dns, networking, adblocking]
---

I run two Pi-hole instances. I did that for redundancy — if the first one is down, DNS still resolves and the house still works.

Then I noticed they had different blocklists.

That's the failure mode nobody warns you about. A second Pi-hole that isn't carrying the same deny list isn't a redundant filter, it's just a second DNS server. Half my clients were pointed at an instance that would happily resolve everything I thought I was blocking.

So I went to sync them. The obvious tool is Teleporter, Pi-hole's built-in export/import. It doesn't work. And the reason it doesn't work turned out to be more interesting than the sync itself.

## Teleporter fails twice, for two unrelated reasons

**First, it's broken in v6.** In the web UI the export never finishes — the download sits at an absurd "99 days remaining" estimate and never streams a byte. Doing it through the API is more honest about the problem:

```
compression_error: "Failed to create FTL database for heap ZIP archive"
```

The export is trying to build a ZIP of the FTL database and failing. This is a known v6 regression, not something I misconfigured.

**Second — and this is the part that actually matters — Teleporter doesn't contain `gravity.db`.**

That surprised me, because "export my Pi-hole" sounds like it includes the blocklists. It doesn't. Teleporter is a *settings* backup. It carries your configuration, not your gravity database — which is to say, not the lists, not the domains, not the groups. Not the thing I was trying to sync.

So even if the export worked, I'd have moved my settings and none of my filtering. That's worth knowing before you spend an evening debugging the ZIP error.

## What actually works: the API, in two halves

Pi-hole v6 replaced the old API with a session-based one. Authentication is a `POST /api/auth` with your password, which returns a session ID you pass as an `X-FTL-SID` header. Sessions expire in about five minutes, so re-authenticate per run rather than trying to cache one.

With that working, the sync is two separate jobs:

**Settings** — `GET /api/config` from the source, `POST /api/config` to the replica.

**Gravity, the part that actually filters** — three endpoints:

- `/api/lists` for adlists
- `/api/domains` for allow/deny domains
- `/api/groups` for groups and client assignments

Both halves matter. Settings alone gives you two instances with identical configuration and different blocklists, which is exactly the state I was trying to fix.

If you'd rather not maintain a script, `nebula-sync` is the community tool built for this same job. I went with a script because I wanted the diff logic below.

## The footgun: never sync the whole config

This is the one that will cost you an evening if you don't know it.

The instinct is to `GET /api/config`, then `POST` that same response to the replica. Don't.

**The `webserver` section contains `api.pwhash` and `api.app_pwhash`** — the login password and the app password. If you copy that section to the replica, you overwrite the replica's credentials *with the credentials you're authenticating as*. The next run of the sync fails to authenticate, and it looks like an auth bug rather than a sync bug. You'll be debugging the wrong thing.

I hit this exactly once, in the sense that I read the config response carefully and noticed what was in it before writing the code. That was luck more than judgement.

**So: sync named sections only.** `dns`, `resolver`, and `ntp` are the useful ones. `dhcp`, `database`, and `files` are machine-specific and should stay local. And never, ever `webserver`.

The general lesson generalises past Pi-hole: an additive sync that copies a whole config object will carry identity and credentials along with it. Any service, any protocol. If a config dump contains a password hash, it is not a config dump — it's a credential.

## An app password can't write settings by default

This one is a silent failure, which makes it worse than a loud one.

App passwords are **read-only for configuration** in Pi-hole v6. A `POST` or `PATCH` to `/api/config` using an app password gets refused. In an automated flow this is invisible: the read succeeds, the write doesn't, and nothing tells you why. You get a sync that reports success and changes nothing.

Writes need `webserver.api.app_sudo` enabled on the target:

```
sudo pihole-FTL --config webserver.api.app_sudo true
```

**Only the write target needs it.** The source doesn't.

Worth being clear about what you're granting: with `app_sudo` on, the app password has the same power as the main login. That's a real privilege escalation, not a read-only convenience. Grant it to the replica and nowhere else.

While I'm here — the control for creating an app password is hidden behind a visibility toggle. **Settings → Web interface / API**, then switch the view from **Basic** to **Advanced** (labelled *Expert* in some builds). On the default view the app-password section isn't there. That toggle is the step that's missing from most descriptions of this, including the ones I read.

## Two bugs in the write loop

Both of these bit me, and both produce a working sync that lies to you.

**Success returns `201 Created`, not `200 OK`.** My first version tested `if status == 200`. Every successful write was counted as a failure. That's worse than a loud error, because the run reports a problem that didn't happen *and* under-reports the work that did — my summary said `changed: 1` when 37 items had landed. Test for any 2xx, not for 200 specifically.

**Diff before writing, or every run is noisy.** The batch endpoints reject duplicates with `400 … "The item is already present"`. If you don't compute what the replica already has, your sync can't be a no-op, which means a cron wrapper on top of it can never distinguish "nothing to do" from "something is wrong." Key your comparison by `(domain, type, kind)` for domains, `address` for lists, and `name` for groups.

With the diff in place, a second run does nothing and stays silent — which is what makes it safe to schedule.

## Verify per instance, not from the source

The last trap is assuming the replica matches because the source side reported success.

A sync that wrote to one instance and silently failed on the other looks identical to a successful one from the source's perspective. So after a run, `GET` the relevant endpoint on **both** instances and compare the actual counts. Don't infer one from the other; that's the whole reason you're syncing in the first place.

## The result

`.191`, the newer instance, ended up with **37 domains** synced across. The second run reported **0 changes** — a genuine no-op, which is what I wanted and what makes it safe to put on a schedule.

Teleporter is still broken. I don't need it, and knowing it wouldn't have carried the blocklists anyway means I'm not waiting for the fix.

The thing I keep coming back to is that the credential leak was one line of code away. Copying the config wholesale is the obvious implementation, and it works — right up until the next run. It's the kind of bug that looks like something else entirely, in a place you wouldn't think to look.
