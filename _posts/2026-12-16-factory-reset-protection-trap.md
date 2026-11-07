---
layout: post
title: "The Google Account That Can Lock You Out of Your Own Tablet"
subtitle: "Factory Reset Protection is an anti-theft feature. It cannot tell the difference between a thief and the person who actually owns the device."
date: 2026-12-16 00:01:00 -05:00
tags: [android, lineageos, self-hosting, security, side-projects]
devto: true
bsky: |
  Factory Reset Protection is an anti-theft feature. It also can't tell the difference between a thief and the person who owns the device.

  The tablet I pulled out of a drawer could have locked me out of itself. Here's what to do at that screen.

  Link in bio.
---

An old Galaxy Tab S7 had been sitting in a drawer for about a year. I pulled it out thinking about a wall dashboard, then realized the deeper answer: I wanted a device I could actually do whatever I wanted with. For a tablet that Samsung stopped patching in 2024, the useful path is LineageOS.

Unlocking the bootloader wipes the tablet. That part is expected — the install guide says so up front. What caught me off guard was the screen right after: the tablet reboots into Samsung's stock setup wizard, and one of the first things it offers is to set the whole device up automatically. Scan a code with my Galaxy phone, and it copies my accounts and settings across.

It's a friendly offer. Taking it is a mistake, and not a small one.

## What Factory Reset Protection actually does

Factory Reset Protection — FRP, sometimes just "Google account lock" — is the mechanism that stops a thief from stealing a phone and selling it. The idea: if a device was signed into a Google account, and someone then wipes it, the device still demands that account's credentials before it will finish setup. A stolen phone that's been reset is a brick to whoever stole it.

That's a reasonable feature. The problem is what it assumes about whoever is holding the device — and the failure mode when that assumption is wrong.

Here's the part that matters: **a reset from inside Android signs you out of your accounts first.** Settings → System → Reset → Erase all data removes them cleanly, so FRP doesn't fire. But a wipe from *recovery* — the one you use when flashing a custom ROM, or when you can't get into the device at all — doesn't sign you out of anything first. That's precisely the case FRP exists to catch.

So the sequence that bites you is: put a Google account on the device, then wipe it from recovery. The device comes back up asking for the credentials of an account you just erased. If that's your own account, fine, you type the password. If it isn't — or if you can't get the code, or the account is gone — you're holding hardware you can't get back into.

## Why "just sign in for now" is the wrong instinct

The instinct on a setup wizard is to complete it. Get past the screens, get to the home screen, sort out the accounts later. Scanning the code from my phone would have done exactly that, faster than tapping through by hand.

It's wrong here for two separate reasons.

**It creates the FRP condition.** The whole point of the scan-from-phone flow is to pull accounts and settings onto the device. The Google account is the one that matters, and it's the one that arms the lock.

**It's erased anyway.** The flash wipes userdata and internal storage. Every account, every setting, every app the wizard restores gets deleted a few minutes later. The auto-setup flow is doing work that gets thrown away — it's not conveniences you keep, it's a liability you keep and a convenience you don't.

The LineageOS install guide is blunt about this: remove all Google accounts before flashing. Signing in during setup is the exact opposite.

## What to do at that screen instead

Skip everything the wizard offers. No account scan, no Google, no Samsung, no restore from a previous device.

Wi-Fi is the one thing you actually need — the flashing steps require it later, and a network connection is harmless. Everything else can wait.

Then, from the home screen:

- Re-enable Developer Options (tap **Build number** seven times)
- Confirm **OEM Unlock** is still enabled — the wipe can reset it
- Power off and go back to download mode

That's it. You'll sign into Google later, after the ROM is booted, if you want Google services at all. On the second pass the device is in a state you *want* to keep, so the account is genuinely useful instead of a countdown timer.

## This isn't only about flashing custom ROMs

Flashing is where it bit me, but the same mechanism decides whether a hand-me-down or a resale is a gift or a locked brick.

Android, at some point, removed the "just factory reset it and hand it over" path. If you reset a phone that still has a Google account on it — without signing out first — the next person gets a device that asks for *your* credentials and won't go further. That's a very common way to unintentionally brick a perfectly good phone you were trying to give away.

The order matters, and it's counterintuitive: **sign out of the account first, then reset.** Don't reset and assume the account comes along with it. On Samsung devices there's a second lock in the same family — a Samsung account or Find My Mobile reactivation lock — which behaves the same way. Remove both before you wipe.

If you're selling or handing down a device, the check is the same one I had to do in download mode: confirm no account is attached, then wipe.

## The thing I'd still get wrong

The reason this is easy to miss is that the safe move is to leave the device *less* set up, not more. Everything about a setup wizard pushes toward "finish it, get it working." The correct response to an offer to copy your accounts onto a device you're about to erase is to say no to the convenience.

The rule I'd carry forward is short: **never put an account on a device you're about to wipe, and never wipe a device without removing the account first.** Both directions of the same problem, and both are one screen away from a device you can't get back into.
