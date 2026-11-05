---
layout: post
title: "The 90-Second Firewall Audit One netsh Line Fixes"
subtitle: "A PowerShell one-liner that looks like a single query was quietly running one query per rule. The fix wasn't a bigger timeout — it was a native command that does the whole job in a second."
date: 2026-12-08 00:01:00 -05:00
tags: [windows, powershell, networking, troubleshooting, self-hosting]
bsky: |
  My Windows firewall check kept timing out at 90 seconds. The cmdlet that looked like one query was running one query per rule — about 280 of them.

  The fix does the same job in 1.0 second, natively.

  Link in bio.
---

I run a small network checker that watches my homelab for drift — devices that appear or vanish, ports that open, certs that expire, and the firewall posture on the boxes it can reach. It's deliberately dumb: no LLM at runtime, just collectors and comparisons, so a finding is reproducible rather than a story a model made up that morning.

One of those collectors reads Windows firewall rules. On a stock Windows machine that matters, because there's no vendor API and no API key — the structured firewall cmdlets are the only way to see the rules at all. A generic checker can read firewall posture on a plain Windows box that a vendor-specific tool can't touch.

So it was annoying when that check started reporting `SKIPPED` with:

```
Get-NetFirewallRule timed out after 90s
```

Ninety seconds is a long time to wait for a rule list.

## Attempt 1: raise the timeout

The first timeout was 15 seconds, which was obviously too short for a rule walk. Raising it to 90 was the reasonable first move, and it didn't help. The check still came back skipped — with the same number, just a bigger one.

That should have been the tell. When a query is bounded, a bigger timeout sometimes finishes it. When it doesn't finish at 90 seconds instead of 15, you're not looking at a slow query. You're looking at an unbounded one.

## Attempt 2: pipeline the filters

`Get-NetFirewallRule` gives you rules. To get the addresses and ports a rule applies to, you have to ask the filter cmdlets — `Get-NetFirewallAddressFilter` and `Get-NetFirewallPortFilter`. My next version pipelined the whole rule set into each of those two cmdlets once, collected the results into a hashtable keyed by `InstanceID`, and correlated afterwards.

That's the idiom you see everywhere, and the assumption under it is wrong: pipelining a cmdlet does not batch it. The pipeline hands the cmdlet one object at a time, and each object triggers its own internal query. I had ~280 enabled inbound-allow rules, so "one call each" was really 280 calls each.

Still skipped at 90 seconds. Two wrong explanations, both stated with more confidence than they deserved.

## Stop guessing, measure the parts

The useful question wasn't "why is it slow" — it was "which step is slow." One paste, four timings, each isolating a different suspect:

```powershell
$r = Get-NetFirewallRule -Enabled True -Direction Inbound -Action Allow
"port filters : {0:N1}s" -f (Measure-Command { $r | Get-NetFirewallPortFilter | Out-Null }).TotalSeconds
"addr filters : {0:N1}s" -f (Measure-Command { $r | Get-NetFirewallAddressFilter | Out-Null }).TotalSeconds
$sw=[Diagnostics.Stopwatch]::StartNew(); $n = netsh advfirewall firewall show rule name=all verbose; $sw.Stop()
"netsh        : {0:N1}s" -f $sw.Elapsed.TotalSeconds
```

Results on a Windows 11 laptop with ~280 enabled inbound-allow rules:

```
Get-NetFirewallRule (enumeration)       ~3s
$rules | Get-NetFirewallPortFilter      69.0s
$rules | Get-NetFirewallAddressFilter   69.4s
netsh ... show rule name=all verbose     1.0s
```

There it is. **138 seconds of filter lookups against a 90-second timeout** — and that also kills the "just raise the timeout again" answer for good. A 200-second timeout would have made every snapshot take two and a half minutes and still sat on the same per-rule lookups. The cost scales with rule count; the timeout doesn't fix scaling, it only hides the symptom until the rule count grows.

Roughly 0.25 seconds per rule, times 280, twice. And a genuinely useful side measurement from the same round: the enumeration itself is ~3 seconds interactively, ~4 cold, ~2.5 called from Python. So the subprocess wrapper, the cold PowerShell start, and the module load were all innocent. It was only ever the two filter cmdlets.

## The fix

One native call, and the parsing done in Python:

```powershell
[Console]::OutputEncoding = [Text.Encoding]::UTF8
netsh advfirewall firewall show rule name=all verbose
```

`netsh` returns every rule, in every direction, in every action, as labelled text. PowerShell runs it and hands the **raw text** to Python, which parses it in a function that takes a string and returns rules — so the parser is unit-testable against a saved transcript instead of shipping PowerShell I can't run from here. The output shape is identical to the old collector's, so nothing downstream changed.

Two details that matter in the parse:

- **Filter to the rules you actually care about.** `netsh` gives you everything; I keep only `Enabled=Yes`, `Direction=In`, `Action=Allow`, because the check is about inbound allow rules whose remote address is `Any`.
- **Fail loudly on an empty parse.** This one is the whole reason the check was ever trustworthy: `netsh`'s field labels are **localized**. On a German or Japanese Windows, my English label matching finds nothing — and a parser that returns zero rules from a non-empty transcript is indistinguishable from a machine with no open rules. That's exactly the silent-zero failure mode that cost me two rounds of guessing, so a non-empty transcript yielding zero rules is now a hard error with a visible `SKIPPED` line, never a clean empty result. There's a test for it.

If language neutrality matters more than speed to you, the structured path is the CIM classes — `MSFT_NetFirewallRuleFilterByProtocolPort` and `MSFT_NetFirewallRuleFilterByAddress` — one query each, correlated by `InstanceID`. I didn't take it, because I'd already guessed a class name wrong once and had no measurement saying it was fast. The netsh path is tested; the CIM path is a hypothesis. When both are on the table, ship the measured one.

## What I'd take from it

**Don't raise a timeout until you know the query is bounded.** A timeout is a guess about how long something takes. If the answer doesn't come back at 90 seconds, the useful information is that the work is proportional to your data, not that you picked the wrong number.

**Pipelining is not batching.** This is the one that cost the most time, because the code *looks* like one call. `$rules | Get-SomeFilter` reads as "do this once over the set." It doesn't. If a cmdlet's cost is per-object, the pipeline multiplies it by your object count while the signature stays reassuringly short.

**Measure the parts, not the whole.** I had three explanations for a 90-second timeout before I had one measurement. The moment the timings were split by step, the answer was in the list and there was nothing left to argue about. Two of my three hypotheses were wrong, which is an argument for reaching for the stopwatch earlier rather than for thinking harder.

**A silent zero is worse than an error.** Every check here reports `SKIPPED` with a reason rather than quietly returning nothing, and that's not politeness — an empty result that looks like a clean result will have you debugging the wrong layer. The localized-labels case is where it would have bitten, and it's caught in code now rather than in a bad afternoon later.

The honest status: the parser is verified offline against a real `netsh` transcript, and the live call can only be proven on the machine itself — so the re-test is still pending, and I'll believe the one-second figure on hardware when I see it there. Everything in the table above, though, is measured rather than reasoned.
