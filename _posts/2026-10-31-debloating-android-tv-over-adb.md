---
layout: post
title: "Debloating an Android TV Device Over ADB, and the Four Things That Waste an Evening"
subtitle: "adb connect with an IP and port will never work on a TV. Debian's adb package is from 2019 and has no pairing command at all. And the error that looks like a bad pairing code is actually a stale server from a binary you already deleted."
date: 2026-10-31 00:01:00 -04:00
tags: [android-tv, adb, debloat, homelab, google-tv, privacy, howto]
---

I wanted the advertising and telemetry packages off my Google TV Streamer. It's an Android device, so `adb` is the way — the actual tooling is fine, the device is cooperative, and the whole job should take fifteen minutes.

It took considerably longer, because four separate things about Android TV differ from Android phones, and every one of them produces an error message that points somewhere else.

Writing them down so the next person loses fifteen minutes instead of an evening.

## 1. `adb connect <ip>:<port>` will never work. Use mDNS.

This is the first thing that sends you off track, because it's what you do on a phone.

```
adb connect 192.168.1.50:5555
```

On a TV, this sits at `offline` **forever**. The port is open. It's reachable. It just never completes, and you end up chasing port numbers that were never the problem.

These devices advertise an `_adb-tls-connect._tcp` service and `adb` discovers them by itself:

```bash
adb devices -l
# adb-<deviceid>-<suffix>._adb-tls-connect._tcp   device   product:... model:...
```

**That serial is what you address the device with.** It's stable across reconnects.

```bash
S='adb-<deviceid>-<suffix>._adb-tls-connect._tcp'
adb -s "$S" shell getprop ro.product.model
```

**The tell that you took the wrong route:** the mDNS entry shows `device` while a manual IP entry for the same device shows `offline`. If you see both, ignore the IP one and delete it.

The three states, and what they mean:

- **`device`** — working, use it
- **`unauthorized`** — the device is asking for approval; your host key isn't trusted yet
- **`offline`** — transport is up but the handshake never finished. Pairing didn't take

## 2. Debian's `adb` package is from 2019 and cannot pair

If you `apt install adb` on Debian, you get **28.0.2**, released in 2019. It has **no `pair` subcommand at all**:

```
adb: unknown command pair
```

That reads like a device problem. It isn't — it's a six-year-old binary. Android 11+ requires pairing, so the distro package simply cannot do the job.

Install the official platform-tools instead:

```bash
curl -sSL -o /tmp/platform-tools.zip \
  https://dl.google.com/android/repository/platform-tools-latest-linux.zip
unzip -q -o /tmp/platform-tools.zip -d /opt
ln -sf /opt/platform-tools/adb /usr/local/bin/adb
```

Check `adb --version` reports a current build before you touch the device.

## 3. `Unknown host service` is a stale *server*, not a bad code

This one cost me the most time, because it looks like an authentication failure.

```
adb pair <ip>:<port>
Unknown host service
```

It means **the running adb server is older than the client**, so the server has no `pair` service to offer. The tell is that it happens **instantly and repeatedly** — a bad pairing code or an expired port would behave differently.

Here's what makes it nasty: **it survives `adb kill-server`**. If you issue that from the *old* client, you're asking the broken binary to clean up after itself. And a server started from a binary that's since been **deleted** keeps running happily — removing the package doesn't stop the process.

Find out what's actually listening:

```bash
ls -l /proc/$(ss -ltnp | grep 5037 | grep -oP 'pid=\K[0-9]+' | head -1)/exe
```

A trailing **`(deleted)`** in that output means you're talking to a server left over from a binary that no longer exists. Kill it by PID — not by trusting the client's `kill-server`, since the entire problem is that client and server disagree about which binary is current:

```bash
kill -9 <pid>
/usr/local/bin/adb start-server
```

## 4. Android TV pairing is not the phone pairing flow

Four differences, and assuming the phone model costs hours:

**One port, not two.** Phones show a separate pairing port and connect port. Android TV shows a **single** port used for both. If you're hunting for a second number, you've imported the phone model by mistake.

**The port rotates.** Close the Wireless debugging screen and reopen it, and the port has changed. Read it fresh every attempt — it is not stable across screen visits.

**The screen must stay visible for the whole operation.** Switching TV inputs tears the connection down. If your TV doubles as a monitor, put the pairing screen on the *other* display and leave the TV on its own input.

**No "Allow debugging?" dialog appears.** Phones show one; TVs don't. The confirmation arrives as a *"Wireless debugging is connected"* notification instead. Don't go looking for a dialog that will never appear.

The pairing code is single-use and expires in about two minutes. Enter it at ADB's own prompt, not as a command argument — that keeps it out of your shell history.

## The actual debloat

**Inventory first.** The bloat is in the system packages, not third-party ones:

```bash
S='adb-<deviceid>-<suffix>._adb-tls-connect._tcp'
adb -s "$S" shell pm list packages -s | tr -d '\r' | sed 's/^package://' | sort > system.txt
```

Filter against advertising and telemetry patterns: `adservices`, `feedback`, `logging`, `analytics`, `tvos`, `partnersetup`, `recommendations`, `play.games`.

**Match whole tokens, not substrings.** A naive `ads` pattern matches `com.android.providers.downloads` — the download provider, entirely innocent. Check your pattern against the list before you act on it.

**Disable, don't uninstall.**

```bash
adb -s "$S" shell pm disable-user --user 0 <package>   # -> 'new state: disabled-user'
adb -s "$S" shell pm list packages -d                   # what's disabled
```

`pm disable-user` is reversible with `pm enable <package>`. Uninstalling a system package on a device you can't easily reflash is a one-way door, and the difference in outcome is usually nothing. Keep the road back.

**One error that isn't an error:**

```
Shell cannot change component state for null to 3
```

That means the package was *already disabled*. Check the `-d` list rather than reading the message as a failure.

## Never touch these

- **The launcher** (`...tv.launcherx`, `...tvlauncher`) — disabling it breaks the home screen
- **Anything named `chromecast`** — on a Chromecast or Google TV device, that *is* the platform
- **`mediashell`, `networkstack`**

## Verify the device still works before you walk away

Don't report a debloat as done without checking. If you disabled the wrong thing, the home screen is broken and the user finds out before you do.

```bash
adb -s "$S" shell pidof com.google.android.apps.tv.launcherx   # launcher running?
adb -s "$S" shell getprop sys.boot_completed                    # 1?
adb -s "$S" shell dumpsys window | grep -m1 mCurrentFocus       # launcher focused?
```

## The thing I actually learned

Every one of those four problems came from the same source: **I was reasoning about a screen I couldn't see.**

The port count and the port rotation — I got both wrong, twice, by extrapolating from Android phones. Each wrong guess cost a full round trip, and the correct answer was sitting in front of a device someone else was holding.

**When the blocker is a device's on-screen UI, your model of that UI is not evidence.** Ask for a photo of the screen, or a literal reading of every label and number on it, and stop iterating until you have it. One photograph would have replaced several rounds of confident inference.

That applies well beyond ADB, and it's the most useful thing I took out of this.
