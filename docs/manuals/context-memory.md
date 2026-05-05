---
description: >-
  Guide to using @vertana/context-memory to look up previous translations as
  translation memory context.
---

Memory context
==============

The *@vertana/context-memory* package provides translation memory lookup for
Vertana.  A translation memory stores previously validated source/target
segment pairs, then returns similar prior translations while a new document is
being translated.

Use it when consistency matters: product UI strings, recurring documentation
phrases, support macros, legal boilerplate, or any project where a previous
translation should guide the next one.


Installation
------------

::: code-group

~~~~ bash [Deno]
deno add jsr:@vertana/context-memory
~~~~

~~~~ bash [npm]
npm add @vertana/context-memory
~~~~

~~~~ bash [pnpm]
pnpm add @vertana/context-memory
~~~~

~~~~ bash [Yarn]
yarn add @vertana/context-memory
~~~~

~~~~ bash [Bun]
bun add @vertana/context-memory
~~~~

:::


Overview
--------

This package provides three main pieces:

`TranslationMemoryStore`
:   A pluggable storage interface for adding and searching memory entries.
    Future SQLite, Postgres, hosted, or vector-backed stores can implement
    this interface without changing translation code.

`InMemoryTranslationMemoryStore`
:   A deterministic in-memory backend for tests, examples, and small local
    memories.

`lookupMemory`
:   A passive context source factory that exposes memory lookup as the
    `lookup-memory` tool.  The translator can call it only when it needs prior
    examples.


Using `lookupMemory`
--------------------

Create a store, add previous translations, then pass `lookupMemory(memory)` to
`translate()` as a passive context source:

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
declare const model: LanguageModel;
// ---cut-before---
import {
  InMemoryTranslationMemoryStore,
  lookupMemory,
} from "@vertana/context-memory";
import { translate } from "@vertana/facade";

const memory = new InMemoryTranslationMemoryStore([
  {
    source: "Save changes",
    target: "변경 사항 저장",
    sourceLanguage: "en",
    targetLanguage: "ko",
    domain: "ui",
    namespace: "product-docs",
    sourceId: "buttons",
    notes: "Use for primary action buttons.",
  },
]);

const result = await translate(model, "ko", "Save your changes before exit.", {
  contextSources: [
    lookupMemory(memory),
  ],
});
~~~~

The source is passive.  It does not add the whole memory to every prompt.
Instead, Vertana exposes a compact lookup tool and the translator asks for
matches when useful.


Filtering memory
----------------

Memory entries and lookup parameters can include language, domain, and
namespace filters:

`sourceLanguage`
:   Optional BCP 47 source language tag.  Language filters are matched
    case-insensitively.

`targetLanguage`
:   Optional BCP 47 target language tag.  Language filters are matched
    case-insensitively.

`domain`
:   Optional domain label such as `"ui"`, `"legal"`, or `"docs"`.

`namespace`
:   Optional logical partition such as a project, product, customer, or user.

Use `domain` and `namespace` to avoid leaking unrelated memory into a
translation task:

~~~~ typescript twoslash
import {
  InMemoryTranslationMemoryStore,
  lookupMemory,
} from "@vertana/context-memory";

const memory = new InMemoryTranslationMemoryStore([
  {
    source: "Archive project",
    target: "프로젝트 보관",
    sourceLanguage: "en",
    targetLanguage: "ko",
    domain: "ui",
    namespace: "admin-console",
  },
]);

const source = lookupMemory(memory, {
  maxHits: 3,
  minScore: 0.35,
});

const context = await source.gather({
  query: "Archive this project",
  sourceLanguage: "en",
  targetLanguage: "ko",
  domain: "ui",
  namespace: "admin-console",
});
~~~~


Controlling output size
-----------------------

`lookupMemory()` keeps tool output compact by default:

`maxHits`
:   Default maximum number of matches.  Defaults to `5` and cannot exceed
    `50`.

`minScore`
:   Default minimum similarity score.  Defaults to `0.2`.

`maxContentChars`
:   Maximum formatted tool output size.  Defaults to `4000` characters.

The LLM can request a smaller or larger `maxHits` and a different `minScore`
within the supported range, but `maxContentChars` is controlled by your
application:

~~~~ typescript twoslash
import {
  InMemoryTranslationMemoryStore,
  lookupMemory,
} from "@vertana/context-memory";

const memory = new InMemoryTranslationMemoryStore();

const source = lookupMemory(memory, {
  maxHits: 5,
  minScore: 0.3,
  maxContentChars: 2000,
});
~~~~


Adding entries over time
------------------------

The in-memory store supports single inserts and batches:

~~~~ typescript twoslash
import { InMemoryTranslationMemoryStore } from "@vertana/context-memory";

const memory = new InMemoryTranslationMemoryStore();

await memory.add({
  source: "Discard changes",
  target: "변경 사항 버리기",
  sourceLanguage: "en",
  targetLanguage: "ko",
});

await memory.addMany([
  {
    source: "Close without saving",
    target: "저장하지 않고 닫기",
    sourceLanguage: "en",
    targetLanguage: "ko",
  },
]);
~~~~

For larger or shared memories, implement `TranslationMemoryStore` with your own
database.  The lookup source only depends on the store interface, so storage can
move from memory to SQLite, Postgres, or a vector service without changing the
translation call site.
