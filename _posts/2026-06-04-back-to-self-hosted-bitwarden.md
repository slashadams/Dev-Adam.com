---
layout: post
title: "Back to Self-Hosted Bitwarden: Why I Spun Vaultwarden Back Up"
subtitle: "After a year on Chrome's built-in password manager, I remembered why I self-host in the first place. Here's the rebuild — and the parts that broke along the way."
date: 2026-06-04 18:46:00 -04:00
tags: [self-hosting, security, vaultwarden, bitwarden, proxmox, side-projects]
---

A confession: I have not been great about password hygiene.

For most of my career, my "strategy" was a single complex password that I'd rotate slightly between sites, plus browser-saved passwords for the rest. I knew it was bad. I had the tools to fix it. I just… didn't, because the easier path was always there.

This weekend, I finally brought Vaultwarden — the self-hosted Bitwarden-compatible server — back online after a year of using Chrome's built-in password manager instead. The whole experience reminded me how much I value running my own infrastructure, even when the popular choice is "just use the browser's built-in." Here's what I learned, what broke, and why I'm staying self-hosted this time.

## The Password Hygiene Problem (the part I kept avoiding)

Password hygiene is the boring cousin of cybersecurity. It doesn't have a cool logo, you can't demo it at a conference, and the failure mode is silent — until it isn't.

The core rules are simple, and most security guides get them right:

- **Use a unique password for every site.** When (not if) one site gets breached, the attacker shouldn't be able to reuse your password on the other 47 services you have accounts on.
- **Make them long, not weird.** Length beats complexity. A 16-character passphrase is dramatically harder to crack than a 10-character jumble of symbols, and it's easier to type.
- **Use a password manager.** You can't realistically remember 200 unique 16+ character passphrases. The manager remembers them; you remember one master password.
- **Turn on two-factor authentication wherever it's available.** SMS-based 2FA is better than nothing; an authenticator app is better; a physical security key is best.
- **Rotate compromised credentials immediately**, not "next time I remember to."

I knew all this. I'd been writing about it for years — including a long post on [physical security keys]({{ site.baseurl }}/blog/why-physical-security-keys-are-the-future-of-mfa) that I still believe. But knowing and doing are different things, and for a long time I was doing the bare minimum.

## Why I Stopped Using Vaultwarden the First Time (and what I switched to)

About a year ago, I had Vaultwarden running on a Proxmox LXC with:

- Vaultwarden in Docker
- nginx as a reverse proxy, terminating TLS with a Let's Encrypt cert
- A free DDNS hostname
- The official Bitwarden Android app pointed at the DDNS URL

It worked fine. But somewhere in the last year, I got lazy. The cert renewal started feeling like a chore. The free DDNS provider changed their API and the certbot plugin broke. I never got around to fixing it. The cert lapsed. The mobile app stopped syncing. I let it.

The drift was gradual. First I went back to my old "one complex password I rotate slightly" pattern for a few critical sites. Then I started letting Chrome's built-in password manager save everything else. Within a few months, I was effectively a Chrome password manager user — same browser, same device, but the manager was a Google product and my vault was in Google's cloud. Not encrypted in a way I controlled. Not portable. Not mine.

It was easier. That's the whole reason.

Easier isn't always better, but it's a powerful force. It took me most of a year to remember that.

## Why Self-Hosting Is Worth the Effort

If you're a developer with a homelab, a side-project server, or even just a Raspberry Pi sitting in a closet, self-hosting Vaultwarden is one of the highest-leverage things you can do with your existing infrastructure. Here's why I keep coming back to it:

### 1. The security model is genuinely better

With Bitwarden or Vaultwarden, your vault is encrypted on your device with your master password before it ever leaves. The server sees only ciphertext. Even if the server is fully compromised — full disk access, database dump, the works — the attacker gets encrypted blobs they can't read.

This is "zero-knowledge encryption" in the marketing, but the technical reality is what matters: **the server cannot decrypt your vault.** Vaultwarden's server-side code is small enough to audit (it's a single Rust binary plus a SQL database), and the encryption uses the same primitives as the official Bitwarden clients.

Chrome's built-in password manager is encrypted too, but with a key Google controls as part of your Google account. If your Google account is compromised — or you lose access to it — your password vault goes with it. Self-hosting removes that single point of failure.

### 2. The recurring cost is zero

I'm running Vaultwarden on an LXC with 1GB of RAM, alongside a few other services. The actual load from a single user with a few hundred vault entries is negligible. The LXC was already there running other things. The cert is self-signed, so there's no renewal dance. The DDNS isn't even needed in this setup because I'm only accessing it from inside my home network or via Twingate.

Compare to any subscription: even at the cheapest tier, that's $X/year, forever, for something I'm fully capable of running myself. The cost isn't just money — it's also the cognitive overhead of "do I really want to keep paying for this, or can I just own it?"

### 3. You own your data

When I sign in to a managed service, I have a relationship with the company. They can change pricing, change features, change terms of service, or shut down entirely. With a self-hosted service, I have source code (open source) and my own infrastructure. If Bitwarden Inc. disappeared tomorrow, my Vaultwarden instance would keep working. My vault would still be there.

That's a meaningful difference, especially for the kind of credentials I store in there — gate access codes, security camera passwords, network device admin credentials, all the things that don't belong in someone else's database.

### 4. The official clients work

The big surprise for me was how well the official Bitwarden clients (browser extension, mobile app, desktop app) work with Vaultwarden. The API surface is fully compatible — Vaultwarden is a drop-in replacement. The mobile app on my phone right now is the official Bitwarden Android app from the Play Store, talking to a Vaultwarden server I run in my garage. Same UX as a paid subscription, just with my own infrastructure on the backend.

(With the caveat that the 2026.x clients have some compatibility issues with older Vaultwarden versions. Stay on 1.35.x or newer, and it works.)

### 5. The setup is genuinely easy

I expected self-hosting a password manager to be a multi-day project with cert management, nginx config, and a half-dozen YAML files. It wasn't. The current Vaultwarden is:

```yaml
# compose.yml
services:
  vaultwarden:
    image: vaultwarden/server:1.35.8
    container_name: vault.warden
    restart: unless-stopped
    environment:
      - DOMAIN=https://vault.warden
      - ADMIN_TOKEN=<your-token>
      - ROCKET_PORT=443
    volumes:
      - ./vw-data:/data/
      - ./vw-data/Rocket.toml:/Rocket.toml:ro
    ports:
      - 443:443
```

Plus a `Rocket.toml` for TLS, plus a self-signed cert generated with one `openssl` command. That's the whole thing. The data is preserved across container restarts because of the bind mount. Backups are a single `tar` of the `vw-data` directory.

## The Rebuild: What Broke (and How I Fixed It)

This time, I went a different route on the cert. No nginx, no Let's Encrypt, no DDNS. Just:

1. **A self-signed TLS cert** generated with `openssl req -x509 -newkey rsa:2048 -nodes -days 3650` covering the hostname and the LAN IP.
2. **Vaultwarden running natively with TLS** — the underlying Rocket framework reads a `Rocket.toml` config file, and Vaultwarden supports `[default.tls]` with cert + key paths. One config file, no proxy.
3. **Port 443** bound to the LXC directly.
4. **A local DNS entry** for `vault.warden → 10.0.100.107` on my home network.

The whole thing came up in about 20 minutes, including the cert generation, the `compose.yml` update, and the `docker compose up -d`. The data dir from the previous install — `db.sqlite3`, `rsa_key.pem`, `config.json` — was backed up before the rebuild, just in case.

### Why TLS matters even on a private LAN

Here's a thing I learned the hard way: **the Bitwarden web vault will not load over plain HTTP.**

The page renders, the logo shows up, the spinner spins forever. No login form, no error message, just an infinite loading state.

The reason: Bitwarden's web vault is built in Angular, and during initialization it requires `window.crypto.subtle` — the browser's Web Crypto API. **Browsers do not expose `crypto.subtle` over plain HTTP to non-localhost hostnames.** It's a security restriction, and it's the right one.

So plain HTTP on a private LAN doesn't work, even though everything is reachable. You need HTTPS, and the simplest way to get HTTPS on a private hostname is a self-signed cert.

### What broke: the Bitwarden Android app and Vaultwarden 1.34.3

Here's where it got interesting. After getting Vaultwarden up with HTTPS, the web vault worked perfectly — login form rendered, autofill in the browser worked, my old vault entries were all still there. So far, so good.

Then I tried the Bitwarden Android app. The cert installed fine (Android 16's cert import flow is just a single "Import certificate" button that figures out the type). The app accepted the self-signed cert after a one-time "proceed anyway" tap. The login form rendered, and the app accepted my email and master password.

Then came the unlock — and it failed with a `MissingPropertyException: Missing the required MasterPasswordUnlock data property`.

I tried the obvious things first: cleared app data, reinstalled the app, re-imported the cert. Same error. It wasn't a network issue (the app was clearly talking to my server), it wasn't a cert issue (it got past the cert trust check), and it wasn't a state-corruption issue (cleared data didn't help).

I started digging. Found this on the Bitwarden Android GitHub:

> *"This issue seems to be a regression in the new Kotlin Multiplatform architecture. I tested the same environment with version 2024.12.0 (19597) and it works perfectly. The error only appears in 2026.x versions."*

The newer Bitwarden Android client (2026.4.2) has a known incompatibility with self-hosted Vaultwarden 1.34.3. The fix is on the **server side** — Vaultwarden 1.35.x ships a server-side workaround. I was running 1.34.3 because that's what `vaultwarden/server:latest` resolved to a year ago when I'd last built the container. The fix was a one-line compose change: `image: vaultwarden/server:1.35.8`. Pulled, redeployed, data dir preserved.

After the update, the error changed:

```
java.net.UnknownHostException: Unable to resolve host "vault.warden"
```

The server-side fix worked. Now it was a DNS issue — my phone couldn't resolve `vault.warden` because the local DNS entry I'd added on my home network was on the router, and the phone wasn't picking it up the same way my computer was.

The fix: change the Bitwarden app's server URL from `https://vault.warden` to `https://10.0.100.107`. The cert's SAN list includes both the hostname and the IP, so it validates either way. DNS bypassed, problem solved.

I'm in. Vault is unlocked on the phone.

## What I'd Change

A few things still bug me:

- **The cert install dance on the phone.** Every new device I add to my network has to go through the "import the cert, get the warning, proceed anyway" flow. For my own devices, that's fine. If I ever want to share a vault entry with a family member who isn't technical, the friction would be too much. A real cert (from Let's Encrypt via DNS-01 challenge) would solve this — but I don't want to expose my Vaultwarden server to the public internet, and DNS-01 is the only way to get a real cert on a private hostname.
- **The app/server version drift.** Vaultwarden 1.34.3 was working fine for me a year ago, and I had no reason to upgrade. The Bitwarden Android client had a reason to upgrade (security patches, new features), and that broke compatibility. Now I have to keep the two versions roughly in sync, which is a small ongoing maintenance burden. **Lesson learned: check for Vaultwarden updates at least quarterly, even if nothing is visibly broken.**
- **The "official client caveat"** is real. Bitwarden Inc. does not officially support Vaultwarden. The clients work most of the time, but there's no commitment from Bitwarden to maintain compatibility, and issues like the 2026.4.2 regression I hit may not get fixed promptly because the fix is on the Vaultwarden side. If you want a fully-supported experience, use the official Bitwarden cloud. If you want self-hosted, accept that you may occasionally need to roll up your sleeves.

## The Takeaway

If you're a developer with even minimal homelab experience, you can run your own password manager. The setup is small, the security model is strong, the cost is zero, and the data is yours.

If you're not a developer, or you don't want to maintain infrastructure, the managed services are excellent. The Chrome built-in manager is honestly fine for a lot of people — it's encrypted, it syncs across your devices, and it works. Don't let anyone guilt-trip you into self-hosting things you don't have time to maintain. The goal is good password hygiene, not maximum self-hosting.

Either way, the point is: **use a password manager, use unique passwords, turn on 2FA.** I spent a year on the easier path and almost forgot why I set up the harder one in the first place. The cost of that drift wasn't dramatic — no accounts got breached, nothing was lost — but it was real. I stopped using the tool I'd built because maintaining it was a chore, and I paid for it in reduced security posture and reduced ownership of my own data.

This time, I'm staying on Vaultwarden. The cert is self-signed, so there's nothing to renew. The data dir is on a bind mount, so backups are trivial. The compose file is six lines, so upgrades are one image pull. The mobile app works (now that I'm on 1.35.8). The friction I was running from doesn't actually exist anymore — I was avoiding a problem I'd already solved.

If you've been putting it off, this is your sign. The hardest part is the first entry. After that, it's muscle memory.
