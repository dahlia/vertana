---
description: >-
  Overview of Vertana's goals, workflow, and package structure.
---

What is Vertana?
================

Vertana[^1] is an LLM-powered agentic translation library for TypeScript.
It goes beyond a single “prompt in, text out” translation call by
orchestrating multiple steps—gathering context, enforcing terminology,
evaluating quality, and iteratively refining output.

Vertana is designed for applications where translation is part of a product or a
workflow: documentation sites, developer tools, localization pipelines, customer
support tooling, or internal knowledge bases.

[^1]: The name *Vertana* is derived from the Sanskrit word *वर्तन* (*vartana*),
      meaning *turning*, *moving*, or *abiding*.


Why an agentic workflow?
------------------------

A single-pass translation is often good enough for short, generic text.
It becomes fragile when you need:

 -  *Consistent terminology* across a document or project
 -  *Domain-aware accuracy* in technical, legal, or medical content
 -  *Style consistency* (tone, voice, formatting)
 -  *Quality control* beyond “sounds okay”

Vertana treats translation as a process.  It can gather supporting information,
use it during translation, and improve the result until it is acceptable.


How Vertana works
-----------------

Vertana composes a translation from multiple stages:

1.  *Chunking*: Split long input into manageable pieces while preserving
    formatting and structure.
2.  *Context gathering*: Collect relevant information from configured sources
    (required sources run up front; passive sources are exposed as tools).
3.  *Translation*: Generate a draft translation with the available context.
4.  *Evaluation*: Score and critique the translation against explicit criteria.
5.  *Refinement*: Iteratively apply feedback to improve weak spots.
6.  *Selection*: Optionally compare multiple candidates and pick the best.

Not every workflow uses every stage, but the building blocks are there when you
need tighter control.


Key concepts
------------

`context sources`
:   Pluggable functions that provide additional information.
    They can inject style guides, background context, glossary databases, or
    anything else that helps a model make better translation decisions.

`glossaries`
:   Term mappings used to enforce consistent translations.
    Vertana can apply a predefined glossary and can also accumulate terminology
    as it translates.

`refinement`
:   An iterative loop that evaluates quality and improves the translation until
    it meets configured thresholds.

`best-of-N selection`
:   A workflow that generates multiple candidates (potentially from different
    models) and chooses the most suitable result via comparative evaluation.


Package overview
----------------

Vertana is a monorepo with several packages:

*@vertana/facade*
:   The high-level API.
    Use this if you want a single `translate()` entry point and sensible
    defaults.

*@vertana/core*
:   The underlying translation pipeline.
    Use this if you need lower-level building blocks or custom orchestration.

*@vertana/context-web*
:   Helpers for web-based context gathering.
    Use this to fetch and extract context from linked pages.

*@vertana/cli*
:   A command-line interface for translation without writing code.


What Vertana is not
-------------------

Vertana is intentionally focused on high-quality, product-grade translation.
It is not:

 -  A replacement for full localization platforms (string extraction,
    translation memory, review workflows, etc.)
 -  A guarantee of factual correctness (LLMs can still make mistakes)
 -  A single “magic prompt” that works for every domain without configuration


Next steps
----------

 -  Start with the [*Getting started*](./start.md) guide.
 -  Follow the [*Tutorial*](./tutorial.md) for an end-to-end walkthrough.
 -  Dive deeper in the [*Manuals*](./manuals/context.md) section.
