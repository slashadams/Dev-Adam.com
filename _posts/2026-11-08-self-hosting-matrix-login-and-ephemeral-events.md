---
layout: post
title: "Self-Hosting Matrix: The Logout You Didn't Ask For, and Why Your Read Receipts Vanish"
subtitle: "A fresh login silently invalidates the token your other client is using. And typing indicators aren't broken — they're ephemeral by design, which is why they never come back."
date: 2026-11-08 00:01:00 -05:00
tags: [matrix, conduit, self-hosting, homelab, proxmox, chat]
---

I self-host my Matrix homeserver. It's Conduit on a Proxmox container, reachable only over a VPN, no federation. That's the easy part — Conduit installs cleanly and mostly gets out of the way.

What took me longer were two behaviours that look like bugs and are not, plus one diagnostic mistake that made a healthy server look dead.

## The unit name is not the process name

This one cost a full diagnostic detour.

The Conduit **process** is `/usr/local/bin/matrix-conduit`. The **systemd unit** is `conduit.service`.

They don't match, and if you check the obvious-looking one:

```bash
systemctl status matrix-conduit
# inactive (dead)
```

You get `inactive`, and you start diagnosing a homeserver that is running perfectly well.

```bash
systemctl status conduit.service    # this is the unit
```

Worth internalising for any self-hosted service where the process name and the unit name diverge — check how the *packaging* named it, not how the *upstream project* names it. The binary can be `matrix-conduit` while the unit is `conduit`, and nothing warns you.

While I'm here on access: on my container **only `root` has an SSH key.** `felix@`, `adam@`, and `conduit@` are all refused. If you're scripting against a service account that doesn't exist, you'll conclude the box is unreachable rather than that you picked the wrong user.

## Logging in invalidates your other session's token

This is the one that actually bit me, and it's silent.

I wanted a token so I could probe the API — check that ephemeral events worked, that sort of thing. The obvious way to get one is to log in as myself. I'd already be authenticated somewhere else, but a fresh login is a fresh login, right?

**No. A new `/login` invalidates the existing access token for that account.**

The consequence: the live client that was already connected — in my case the messaging gateway I use to talk to my own agent, which is how the whole thing is useful — **gets dropped.** You've logged yourself out of your own working session to run a probe.

And nothing tells you. The login succeeds, returns a perfectly good token, and somewhere else a connection quietly dies. You find out when messages stop arriving.

**The fix is to never probe with the account that's in use.** Register a throwaway account with the `registration_token`, or use an existing bot account that isn't carrying a live connection. Both give you a token without touching the session you depend on.

If you're running any agent or bot infrastructure against a self-hosted Matrix, this is worth writing down where you'll see it, because the instinct — "I'll just log in and check" — is exactly the wrong move.

Registration, if you need a disposable account:

```bash
curl -s -X POST "http://localhost:6167/_matrix/client/v3/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "throwaway",
    "password": "<strong-password>",
    "auth": {
      "type": "m.login.registration_token",
      "token": "<registration_token_from_config>"
    }
  }'
```

That needs `allow_registration = true` in `conduit.toml` at the time. **Turn it back off afterwards** — an open registration endpoint on a box that anything on your network can reach is how you get accounts you didn't create.

## Your typing indicators and read receipts are gone. That's correct.

I spent time assuming this was a server capability problem. It isn't.

I probed it directly on Conduit 0.10.12:

```
PUT  /rooms/{id}/typing/{uid}            -> 200
POST /rooms/{id}/receipt/m.read/{eid}    -> 200
```

And observed `m.typing` arriving in a live sync window. **Ephemeral events work.**

So why did I keep seeing missing typing dots and stuck read receipts?

**Because those events are ephemeral — Matrix neither stores nor replays them.**

If the client misses the sync window, that event is **gone permanently.** There is nothing to catch up on, because there's nothing left to send. Messages, by contrast, are **persisted**, so they arrive late once connectivity returns.

That produces a very specific and confusing signature:

> The chat catches up and the message lands, but the typing dots and the ticks never showed.

Which reads like a bug in the indicator system, and is actually the persistence model working exactly as designed. The message survived the gap because messages are durable; the typing notification didn't because it never was.

Practical upshot: **expect this on a mobile connection** — a dead zone between towers is enough to lose the sync window. Don't chase it. The only case worth investigating is a repeat on solid wifi at home, and even then start at the client, not the server.

One related trap if you're debugging this: my agent's typing/receipt failure logging only takes effect **after a gateway restart**. A silent log means *nothing was recorded*, not that nothing failed. I read the absence of entries as "no failures" for a while, which is backwards.

## Hardening a homeserver that isn't reachable from the internet

Two settings, both worth setting deliberately rather than leaving at defaults.

**Federation.** I had `allow_federation = true` and no listener on 8448, 443, or 80. It could never have worked — federation requires inbound HTTPS from other servers, and there is none. Leaving it enabled is a false belief about your own exposure. If your homeserver is only reachable over a VPN, **set `allow_federation = false`** and be accurate about what the box does.

**Registration.** This is the one that mattered. `allow_registration = true` means anyone who can reach the endpoint can create an account — and "can reach the endpoint" includes any device on your own network, not just you. My IoT VLAN had a path to it.

```toml
allow_registration = false
allow_federation = false
```

Set `address = "0.0.0.0"` only if something proxies to it. Otherwise bind to what you actually need.

## What I'd tell someone starting this

The install is the easy 20%. The operational surprises are the rest:

**Check how the package named things**, not how the project named them — the unit and the binary can disagree, and only one of them responds to `systemctl`.

**Never log in as an account that has a live connection.** Get a token from a bot or a throwaway. The failure mode is silent and it breaks the thing you were using.

**Ephemeral means ephemeral.** Typing and read receipts are not persisted by design; a missed sync window loses them forever. Only messages are durable. If you're building anything that depends on those events, you need to know that going in.

**Turn registration off when you're done**, and check whether your "not internet-facing" server is actually not internet-facing.
