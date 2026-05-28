---
layout: post
title: "Why LLM Wiki Beats RAG for Your AI Agent's Long-Term Memory"
subtitle: "Plain markdown files, cross-linked knowledge, and zero vector database required"
date: 2026-05-27 22:30:00 -04:00
tags: [llm-wiki, knowledge-base, agents, rag, memory, markdown]
---

## The RAG Trap

When I first started building AI agents, I assumed they'd need Retrieval-Augmented Generation (RAG) for any serious knowledge work. Vector embeddings, a Pinecone index, chunking strategies — the whole stack. It's what everyone talks about.

But the more I actually use agents day-to-day, the more I've come to believe RAG is overkill for most personal and small-business agent use cases. Not because it doesn't work — but because there's a simpler alternative that's often better.

## Enter the LLM Wiki

Andrej Karpathy posted about this pattern a while back: instead of embedding everything into a vector store, keep your agent's knowledge in a directory of plain markdown files. Cross-link them with `[[wikilinks]]`. Tag them with YAML frontmatter. Maintain an index. The agent reads, writes, and updates these files as it learns.

It's not a new idea — it's basically how humans have kept notebooks for centuries. But applied to AI agents, it changes the game.

## Why I Switched

### 1. Exact Recall > Fuzzy Search

RAG is probabilistic. You ask about "the Davie gate call" and it might return something about "Dave's gate" or a completely unrelated document that happens to have similar vector coordinates. With a wiki, the agent knows exactly where things are. `grep -r "Davie"` returns exactly what you'd expect every time.

### 2. Compounding Knowledge

RAG starts from scratch on every query — it retrieves chunks, synthesizes, and forgets. A wiki accumulates. Every time the agent learns something new, it updates the relevant page. After a month of use, the wiki has years of synthesized knowledge ready to go. The agent doesn't re-derive — it reads.

### 3. No Infrastructure

A vector database is another service to run, another credential to manage, another thing that breaks. A wiki is a folder of `.md` files. Open it in any text editor. Grep it. Sync it to GitHub. Email a single file to someone. There's nothing to deploy, no schema migrations, no embedding API costs.

### 4. Obsidian-Native

Because the wiki is just markdown files, it works as an Obsidian vault out of the box. I can open the same knowledge base my agent maintains, browse it visually, see the graph view, edit pages, and the agent picks up those edits on its next cycle. The human and the agent share a knowledge base.

### 5. Audit Trail

Every wiki update is logged. You can see exactly when a page was created, what sources it drew from, and when it was last updated. With RAG, you get opaque chunks with similarity scores. With a wiki, you get a maintainable document.

## Where I'm Using It

I integrated LLM Wiki into my **Cameron** agent — a tailored assistant for Florida Community Association Managers. Instead of RAG-ing through Florida statutes on every question, Cameron maintains wiki pages for each statute, each managed property, and each compliance pattern. When a deadline changes, Cameron updates the page. When a new property comes on, Cameron creates an entity page. Over months, it builds an intelligence layer that doesn't fade.

For my own service call notes, I use a simpler version — daily markdown files in a monthly directory. No RAG, no vectors. When my boss asks about a gate repair from three weeks ago, I ask my agent, it greps the files, and I have the answer in seconds.

## When You'd Still Want RAG

To be fair: RAG makes sense when you're searching across millions of documents you don't control — think enterprise document dumps, legal discovery, or open-web search. When the corpus is huge and you need to find things by *vibe* rather than by *name*, vector search wins.

But for agent memory — the knowledge your personal AI accumulates about your work, your tools, your clients — plain markdown is often the better answer. It's simpler, cheaper, more reliable, and more transparent.

The best stack is the one that gets out of your way. For me, that's been a folder of markdown files and an agent that knows how to read them.
