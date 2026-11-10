---
layout: post
title: "I Wanted to Run a 750B Model at Home. My Hardware Said No"
subtitle: "The interesting part of the WiCi video wasn't the $2,600 box. It was the free software underneath — and the one number on my motherboard that rules it out."
description: "The interesting part of that 750B model demo was not the $2,600 box. It was the free software underneath, and the one spec on my board that rules it out."
date: 2026-11-10 00:01:00 -05:00
tags: [local-llm, homelab, proxmox, moe, self-hosting]
devto: true
bsky: |
  A video showed a $2,600 box running a 750-billion-parameter model on 32 GB of VRAM. My first reaction: that shouldn't work.

  It does work. So I checked whether I could run it — and found the one number on my motherboard that rules it out entirely.

  Link in bio.
---

NetworkChuck put out [a video about it](https://youtu.be/cFdoXn6yvE4) — a box called the WiCi One that runs a 750-billion-parameter model on 32 GB of VRAM. Normally that model wants over 500 GB of memory. My first reaction was the same as everyone's: that shouldn't work.

It does work. But the box isn't the story.

Why it's worth caring about even if you never buy one: a frontier-class model ran on consumer hardware, locally, with no cloud and no meter running. Two years ago that sentence wasn't true at any speed. The threshold for "what a normal person can run at home" just moved, and it moved a lot.

I went in expecting to be sold a $2,600 appliance and came out wanting to run the software underneath it on hardware I already own. Then I actually measured my hardware, and it turned out to be a hard no.

Here's the whole thought process, because the reason it fails is more useful than the product.

## What's actually new

The box is a GPU on your Wi-Fi. An RTX 5090 in an enclosure with its own mini PC and a 4 TB NVMe, presenting itself to any laptop, Mac, or phone on the network as a local GPU. Not remote desktop, not cloud gaming — applications on your machine see a local device. That's genuinely impressive engineering, and it's also $2,599 for the 16 GB edition and $9,999 for the 32 GB one.

The video is sponsored by WiCi and says so in the first minute. Someone did an independent claim-check on it afterwards and found 12 of 21 claims hold exactly as stated, six hold with caveats, three were untestable, and none were false. So the numbers are honest. The framing is just optimistic, which is what sponsorship buys.

The part that made me sit up is further in: [**InferSSD**](https://github.com/wici-ai/inferssd), Apache-2.0, open source, built on llama.cpp. It runs mixture-of-experts models that are larger than your RAM or VRAM by streaming expert weights off an SSD, and it serves them behind a plain OpenAI-compatible API on `localhost`. You can install it with one command on Linux with an NVIDIA GPU or Apple Silicon macOS.

That's the actual technology. The box is one way to run it.

## Why a 750B model can fit in 32 GB

Two things have to be true.

First, the model has to be a **mixture of experts**. DeepSeek V4.1 Flash has around 763B parameters total but only routes a small slice of them per token — a router picks a handful of experts out of hundreds for each word. So you never need all the weights at once, you need the *right* weights, fast.

Second, you need somewhere to keep the rest. That's the SSD. The whole model lives on disk, and the runtime pulls the experts it needs into RAM and VRAM as it goes.

The catch is that SSDs are slow, and they're much slower than their spec sheet when you're doing millions of tiny 4 KiB reads instead of one big file copy. That's the problem InferSSD actually solves: it rewrites the model files so every expert is the same size and aligned, reads them in batches, caches the popular experts in RAM, and splits the math between CPU and GPU based on where the weights came from.

On a fast PCIe 4.0/5.0 NVMe it gets DeepSeek V4.1 Flash to about **7.3 tokens/sec** on an RTX 5090, and **2.5 tokens/sec** on an RTX 5060 Ti. Slow, but real. A frontier-class model, on your desk, with no API bill.

## Why this is a bigger deal than one box

A few years ago "local AI" meant a 7B model that could answer simple questions and fall apart on anything hard. The interesting thing about this video is which models it names as the local options: DeepSeek V4.1, Kimi K3, GLM 5.3. Those aren't toys. They're the open-weight models people describe as *close* to the closed frontier — the ones you'd actually choose to use if you had somewhere to run them.

The gap between "the model everyone uses" and "the model I can run myself" has been shrinking for a while. The thing that's been stuck is the last mile: the good ones are huge, and huge has meant a data centre. This is one of the first credible answers to that last mile, and the answer is a trade — you swap speed for capacity, and you use the SSD you already have instead of memory you'd have to mortgage a house to buy.

I think the consumer version of this matters more than the enterprise version, for a few reasons.

**It's a subscription that turns into a purchase.** Right now, using a good model means a monthly bill and a per-token meter, forever. If the frontier-class open models get runnable at home, that stops being a rent payment and starts being a piece of hardware — like buying a printer instead of paying per page. The economics flip from recurring to one-time, and one-time is a much better deal for a household.

**Nobody's account can be turned off.** No provider deprecating the model you built your workflow on, no policy change, no rate limit, no outage. Your agent keeps working when the internet doesn't.

**The data doesn't leave the house.** Not a privacy slogan — it's just arithmetic. The tokens never cross the network.

**And the "family GPU" idea is a genuinely new shape.** One GPU on the network that a laptop, a tablet, and a phone all share, instead of a graphics card locked inside one gaming rig. That's the family computer pattern from the nineties, applied to compute. For a household with three people, three laptops, and no gaming desktop each, it's a much better fit than the way we buy this today.

None of that is here yet. It's slow, the hardware floor is real, and the box in the video is expensive. But the direction is unmistakable, and I'd rather track it honestly than either dismiss it or pretend I already own it.

## So I checked my own hardware

I have a spare machine sitting in the rack running Proxmox. It has an NVIDIA GPU in it. My thought was simple: swap the small boot NVMe for a 4 TB drive and run InferSSD on it.

Here's what's actually in there.

```
$ dmidecode -s chassis-type
Notebook

$ lspci | grep -i vga
01:00.0 VGA compatible controller: NVIDIA Corporation TU116M [GeForce GTX 1660 Ti Mobile]

$ lscpu | grep "Model name"
Model name:  Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
```

It's a laptop. An OMEN 17 from 2019, and it's been running as a server node for about eight months now.

**6 GB of VRAM.** **15 GB of RAM.** No tensor cores — it's Turing, from before they were standard.

The weakest machine in WiCi's own benchmark table has **16 GB of VRAM**. I'm at a third of that.

## The number that actually kills it

VRAM I could work around. Experts that don't fit in VRAM run on the CPU, and the CPU here is a 6-core i7, which isn't nothing.

The disk is the problem, and I only found it because I checked the link, not the drive:

```
$ lspci -vv -s 3b:00.0 | grep -E "LnkCap:|LnkSta:"
    LnkCap:  Port #0, Speed 8GT/s, Width x2
    LnkSta:  Speed 8GT/s, Width x2
```

**Width x2.**

That M.2 slot is wired for two PCIe lanes, not four. The drive in it is a DRAM-less Toshiba BG3 on a Gen3 ×2 link, which means the slot's ceiling is roughly **1.7 GB/s** — and putting a brand new Gen4 drive in it doesn't move that ceiling, because the ceiling is the motherboard, not the drive.

InferSSD's entire speedup comes from shovelling expert weights off the SSD. The benchmark rigs used PCIe 4.0 and 5.0 ×4 drives and pulled around **11.5 GB/s**. I'd be running the core of the technique at roughly **one-seventh** of the speed that produced 2.5 tokens/sec on the slow rig.

Do the arithmetic on that and I'm somewhere under a token per second. A word every two to four seconds.

That's not slow. That's broken.

## Two more reasons it doesn't work

**RAM is the expert cache.** The "hot experts stay in RAM" trick is what makes the whole thing usable. I have 15 GB total on a box that's also running a Pi-hole container. The benchmark host had 32 GB. There's no cache to speak of.

**InferSSD only supports 750B-class models right now.** There are two entries in its compatibility table. So there's no "fine, I'll run a smaller one instead" fallback — that's a different tool doing a different thing.

And one practical detail: there's a single M.2 slot. "Replace the NVMe" means losing the boot drive, so it's a clone-and-reinstall, not a swap.

## What it would actually take

If I did want to do this properly, the floor is:

- **16 GB of VRAM** minimum, 24 GB to be comfortable — an RTX 5060 Ti or a used 3090
- **32–64 GB of system RAM**, because that's the cache
- **A PCIe 4.0 ×4 NVMe**, at least 2 TB, ideally 4 TB — the model download alone is around 470 GiB
- A desktop, because this is a sustained load, not a burst

That's roughly **$1,000–1,500** building it myself. Cheaper than the WiCi box, but still real money, and I'd be buying it to solve a problem I don't currently have.

## Would I actually run it?

Not yet. Two reasons.

**The cost argument is weak for me.** I pay for inference per session through an API right now. It's pennies. Local inference saves that money and costs me a thousand dollars and a weekend, so the payback period is measured in years — if it ever arrives.

**More importantly, 2.5 tokens/sec is the wrong number for what I'd use it for.** Chuck calls 8 tokens/sec "good," and for a chat window where you're reading along, it is. But I don't run chat windows. I run an agent that does multi-turn tool calling — it reads a file, decides, calls something, reads the result, decides again. One task can be twenty round-trips and tens of thousands of tokens. At 2.5 tokens/sec that task goes from seconds to most of an hour.

The demo is impressive because it's a human watching text appear. The workload I actually have is a machine talking to itself, and it needs throughput, not a pretty stream.

## What I'm watching

The thing I'll keep an eye on isn't the box — it's whether the smaller-model path gets faster. Most of the interesting open models are already mixture-of-experts, and if SSD streaming gets good enough that a 30B or 70B model runs at comfortable speed on a mid-range GPU, that changes the math for a homelab completely.

Right now the technique works and the hardware floor is real. I just don't clear it.