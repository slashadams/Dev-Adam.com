---
layout: post
title: "Two Bots in One Room, and Neither Could Hear the Other"
subtitle: "Both agents were in the chat, both had posted there, and nothing errored. One of them had never received a single message from the other — and a ✅ reaction nearly convinced me it was working."
date: 2026-12-08 00:01:00 -05:00
tags: [ai-agents, matrix, self-hosting, hermes, monitoring]
devto: true
bsky: |
  Two agents were in the same chat room. Both had posted there. Nothing errored.

  One had never received a single message from the other — and a checkmark reaction nearly convinced me it was working.

  Link in bio.
---

One of my agents posts a steady stream of alerts into a room on my self-hosted Matrix homeserver. Another agent sits in that same room. When I finally looked closely, the second one had never reacted to a single alert. Not once.

There was no error. No warning. The room looked completely normal — three joined members, everything two agents and a human should need to talk to each other.

I'd been assuming it worked. That assumption is the whole post.

## The room wasn't the problem

My first instinct was the obvious one: check the membership. It's a group room, so maybe the invites never completed, or one account had left a long time ago and nobody noticed.

I queried the homeserver directly instead of trusting what the client showed me. Three joined members: the two bot accounts and mine. Both bots had posted messages in there, so the room was clearly accepting sends from both. The barrier wasn't the room, and it wasn't delivery.

At that point the honest move is to stop guessing and go read the code that decides whether an incoming message gets processed. So I did.

## One line, in the receiving agent's config

Every message that arrives has to pass a short chain of checks before the agent's model sees it: is this a room I'm allowed to respond in, do I need an @mention here, and — the one that mattered — is the *sender* on my allowlist.

That last check is a per-profile config value. On the receiving agent it read:

```
ALLOWED_USERS = <my personal account>
```

Just me. One entry, the human.

Its room allowlist was unrestricted. Its mention requirement was off. So the message from the other bot came in, passed the room check, passed the mention check, and was then discarded because the sender wasn't in that set. Discarded as an unauthorized sender — which is a normal, expected outcome for the gateway, not a fault. Nothing to log at a level anyone reads, nothing to surface.

**The receiving agent was not broken. It was doing exactly what it was told to do.** It had been told to talk to one human and nobody else.

The distinction that cost me the most time is this: being *in* the room is not the same as *ingesting* from it. The second agent is a joined member, so it can always fetch the room's history on demand and read anything it wants — that works fine, and it's why the setup looked healthy every time I poked at it. Ambient delivery is the thing that was blocked. A member with an allowlist of one.

## The ✅ that lies to you

Here's the part I want anyone building this to know, because it nearly ended the investigation in the wrong place.

Every message the first agent posted in that room was followed, within about a second, by a ✅ reaction from the second agent's account. Then the reaction was redacted a few seconds later.

That looks exactly like acknowledgement. Something is reading the messages. If I'd stopped there, I'd have concluded the pipeline was healthy and gone off to debug the second agent's *prompt* instead — why isn't it acting on the alerts it's clearly seeing?

So I read what that reaction actually means in the adapter:

```
# ✅ in this adapter is the exec-approval reaction ("approve once"),
# and it's removed once the prompt is resolved.
```

It isn't a read receipt. It's an approval-flow artifact attached to the first agent's own outbound request, and it gets cleaned up when that request resolves. The receiving agent was never involved. **A reaction is not evidence of ingestion**, and this one was actively misleading: fast, consistent, and meaningless.

## Prove it from the store, not the room

The only question that mattered was whether the second agent had ever *received* one of those messages as input. The room can't answer that, because the room shows what was sent. That's the trap — I'd been staring at the sender-side view the whole time.

The receiving agent keeps its own message store, so I queried it for messages authored by the other bot:

- Messages authored by the other bot, stored as inbound input: **zero**.
- Every string from the other bot that existed in that database sat inside **tool output** — from the receiving agent's own on-demand fetch of the room, or from me quoting an alert to it in a separate conversation.

That's the general lesson, and it applies to Slack, Telegram, and Matrix alike: **when two bots can't talk, check the receiving agent's own message store, not the chat room.** The room tells you the message was sent. Only the receiver's store tells you whether it arrived. One is the sender's view of the truth; the other is the only view that matters.

## The fix, and why I stopped before applying it

The change is one line: add the other bot's account to the receiving agent's sender allowlist. It's naturally one-way, too — the sending agent's allowlist stays human-only, so it won't start ingesting replies.

That last property is the one worth checking rather than assuming, because bot-to-bot messaging is exactly the shape that produces an infinite reply loop. Two agents, both permitted to respond to each other, both treating the other's message as something to answer — that's a loop until something interrupts it.

There *is* a built-in guard for this in the gateway: an admitted bot-authored message is still subject to a per-conversation budget, and once it's exceeded the chat cools down. It's the right design, and it's on by default. But it keys off a flag that says "this sender is a bot" — and I found that on Matrix, nothing ever sets that flag. The platforms that report a bot flag from their own API get the guard. Matrix doesn't, so a Matrix bot's messages arrive looking exactly like a human's, and the guard has nothing to key on.

So on Matrix there is no safety net, and the one-way shape isn't a nicety — it's the only thing standing between you and two agents cheerfully answering each other forever. Worth knowing before you widen the allowlist, not after.

The change also only takes effect on a gateway restart, which on a single multiplexed gateway interrupts every profile at once — including the session you're in. And it widens what the receiving agent treats as instructions. That's a real trust change, and it deserves to be a deliberate decision rather than an obvious one.

## What I'd fix next

The failure isn't the filter. Filters are fine. The failure is that a dropped message and a healthy message look identical from the outside.

A sender that's refused because it isn't on the allowlist is worth one line in the log and, better, a counter you can read: *N messages dropped from this sender this week*. Cheap to add, and it turns a silent no into a visible one. I'd rather see "12 messages discarded" and go looking, than see a clean room and assume it's working.

Everything here was diagnosed by reading the adapter rather than reasoning about it, and the two facts that actually mattered — the meaning of that ✅ and the missing bot flag — were both invisible from the chat client. If you run more than one agent in a shared room, the assumption to attack first is "if it's in the room, it's getting the messages." It isn't, and nothing will tell you.
