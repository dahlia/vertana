@vertana/context-memory
=======================

[![JSR][JSR badge]][JSR]
[![npm][npm badge]][npm]

Translation memory context sources for [Vertana].

[JSR badge]: https://jsr.io/badges/@vertana/context-memory
[JSR]: https://jsr.io/@vertana/context-memory
[npm badge]: https://img.shields.io/npm/v/@vertana/context-memory
[npm]: https://www.npmjs.com/package/@vertana/context-memory
[Vertana]: https://vertana.org/


Features
--------

This package provides a pluggable translation memory store interface, an
in-memory reference implementation, and a passive context source for looking
up prior translations during translation.

 -  `TranslationMemoryStore`: A storage interface for adding and searching
    translation memory entries.
 -  `InMemoryTranslationMemoryStore`: A deterministic in-memory backend for
    tests, examples, and small local memories.
 -  `lookupMemory`: A passive context source factory that exposes translation
    memory lookup as a tool.


Installation
------------

### Deno

~~~~ bash
deno add jsr:@vertana/context-memory
~~~~

### npm

~~~~ bash
npm add @vertana/context-memory
~~~~

### pnpm

~~~~ bash
pnpm add @vertana/context-memory
~~~~


Usage
-----

~~~~ typescript
import {
  InMemoryTranslationMemoryStore,
  lookupMemory,
} from "@vertana/context-memory";
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const memory = new InMemoryTranslationMemoryStore([
  {
    source: "Save changes",
    target: "변경 사항 저장",
    sourceLanguage: "en",
    targetLanguage: "ko",
    domain: "ui",
  },
]);

const result = await translate(openai("gpt-4o"), "ko", "Save your changes.", {
  contextSources: [
    lookupMemory(memory, {
      maxHits: 5,
      maxContentChars: 2000,
    }),
  ],
});
~~~~


License
-------

[MIT License](../../LICENSE)
