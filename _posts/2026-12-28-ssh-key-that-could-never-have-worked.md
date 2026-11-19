---
layout: post
title: "The SSH Key That Could Never Have Worked"
subtitle: "The file was perfect, the perms were right, and the server was never going to accept it."
date: 2026-12-28 00:01:00 -05:00
tags: [ssh, embedded-linux, dropbear, troubleshooting, homelab]
devto: true
bsky: |
  The key file was byte-perfect and the permissions were right. The server still said no.

  The key was ed25519 — and that tiny embedded build had ed25519 compiled out entirely. No correct paste could ever have worked. One line of `ssh -vvv` settles it.

  Link in bio.
---

I was setting up key-based SSH on a small embedded Linux device — the controller board of a 3D printer, a MIPS chip with a quarter gig of RAM running a Buildroot image from 2020. It's the kind of box where the whole userspace is BusyBox and the SSH server is Dropbear, not OpenSSH.

I generated a key the way you always generate a key now:

```
ssh-keygen -t ed25519
```

Then I handed over the exact paste commands to drop the public half into `authorized_keys` on the device. Correct directory, correct mode on both the directory and the file. This is the boring part, normally.

It didn't work.

## It looks exactly like a permissions bug

Dropbear is unforgiving about file modes. Put a key in a world-readable `authorized_keys`, or leave `~/.ssh` as `755`, and it ignores the file entirely and falls straight back to the password prompt. Which is precisely what I saw: password prompt, key never tried.

So the first hour went where you'd expect — checking the mode bits, checking for a stray carriage return from a Windows paste, checking that the line hadn't wrapped, checking whether the server was even reading the path I thought it was. Every one of those was a real failure mode and every one of them was clean.

That's the trap. The symptom has a dozen innocent explanations and all of them live in the file. The file has nothing to do with it.

## The one command that ends the argument

`ssh -vvv` prints the algorithm negotiation. Buried in the debug output is a line you almost never need to read:

```
debug2: host key algorithms: ecdsa-sha2-nistp256,ssh-rsa
```

That's the *server's* list. The client prints its own list first — a long, modern one with `ssh-ed25519` in it — and then the server's. Two lines, same prefix, and the second one is the one that matters.

There is no `ssh-ed25519` in the server's list. Not as a host key, not anywhere.

That Dropbear build had ed25519 compiled out. Not disabled by config, not a version thing — the code simply wasn't in the binary. A server that can't present an ed25519 *host* key has no ed25519 verifier to check a client's signature either. My key was the wrong type, and no amount of correct pasting would have made it work. The server kept advertising `publickey,password` and answered every offer with the same generic auth failure packet — which is indistinguishable, on the client side, from a file with the wrong permissions.

The failure mode is genuinely misleading: a rejected key with a clean file is not a permissions problem, it is a *type* problem, and they look identical from the outside.

## Why a minimal build ships without it

This is the part worth internalising. On a full OpenSSH server on a normal distro, ed25519 is always there and it's the sensible default. On a constrained device it isn't a default at all — crypto algorithms are compiled in one by one, and every one you include costs code size on a flash-constrained board. Vendors drop what they think nobody will use. ed25519 is smaller and faster than RSA, which makes it a strange thing to leave out, but the point is that the decision was made years ago against a device that had to fit in a few megabytes, and it's baked into the firmware you're standing in front of.

The defaults you carry in your fingers are the defaults of the big server you last touched. The device in front of you may have had a completely different set of constraints.

## Pick from the server's list, not from habit

The fix is to stop guessing and read the list:

```
ssh -vvv you@device 2>&1 | grep 'host key algorithms'
```

The first hit is your client. The second is the server. Whatever the server offers, you generate.

Here, `ecdsa-sha2-nistp256` was in the list and worked first try:

```
ssh-keygen -t ecdsa -b 256 -f ~/.ssh/device-key-ecdsa
```

RSA was also offered, but with a footnote: this build predates `rsa-sha2-256`, so a modern OpenSSH client refuses plain `ssh-rsa` unless you explicitly opt back in with `-o PubkeyAcceptedAlgorithms=+ssh-rsa`. That's fine as a backup key, and not fine as your primary, because you're now depending on a client-side flag staying in whatever config file carries it.

For older or more locked-down builds, `ssh-keyscan -t ed25519 device` is a quick second opinion — if it comes back empty, the server has no ed25519 host key and there's no point offering an ed25519 client key.

## What I'd do differently

The whole detour happened because I picked the key type before I looked at the server. Generating a key takes two seconds; recovering an evening of chasing file permissions doesn't. If the target is anything other than a normal Linux server — an appliance, a router, an embedded board, a NAS — read the algorithm list first and choose second.

The general rule that came out of it is the useful bit, and it isn't really about SSH: **when a minimal system rejects the modern default, the default is the suspect, not your setup.** The device told me what it wanted. I just wasn't reading the line where it said so.
