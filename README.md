<img src="docs/public/vertana.svg" width="128" height="73" align="right">

Vertana: LLM-powered agentic translation library for TypeScript
===============================================================

[![JSR][JSR badge]][JSR]
[![npm][npm badge]][npm]
[![GitHub Actions][GitHub Actions badge]][GitHub Actions]

> [!CAUTION]
> Vertana is currently in early development for proof of concept purposes,
> and is not yet ready for production use.  The API is subject to change,
> and there may be bugs or missing features.

Vertana[^1] is an LLM-powered agentic translation library for
TypeScript/JavaScript.  It goes beyond simple LLM prompting by using autonomous
agent workflows to gather rich contextual information, ensuring high-quality
translations that preserve meaning, tone, and formatting.

[^1]: The name *Vertana* is derived from the Sanskrit word *वर्तन* (*vartana*),
      meaning *turning*, *moving*, or *abiding*.

[JSR badge]: https://jsr.io/badges/@vertana
[JSR]: https://jsr.io/@vertana
[npm badge]: https://img.shields.io/npm/v/@vertana/facade?logo=npm
[npm]: https://www.npmjs.com/package/@vertana/facade
[GitHub Actions badge]: https://github.com/dahlia/vertana/actions/workflows/main.yaml/badge.svg
[GitHub Actions]: https://github.com/dahlia/vertana/actions/workflows/main.yaml


Features
--------

 -  *Agentic context gathering*: Automatically invoke external sources before
    translation, or let the LLM query passive sources as needed via tools
 -  *Smart chunking*: Content-aware chunkers for plain text, Markdown, and HTML
    that respect structural boundaries while staying within token limits
 -  *Glossary support*: Static glossaries for consistent terminology, plus
    dynamic glossary accumulation across chunks
 -  *Quality evaluation*: Assess translations on accuracy, fluency, terminology,
    and style dimensions
 -  *Iterative refinement*: Re-translate low-scoring chunks with boundary
    evaluation until quality thresholds are met
 -  *Best-of-N selection*: Generate translations with multiple models and
    select the best result via parallel per-chunk evaluation
 -  *Progress reporting*: Track translation stages via callbacks
 -  *Multi-runtime support*: Works seamlessly with Deno, Node.js, and Bun


Quick example
-------------

~~~~ typescript
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "Hello, world!  Welcome to Vertana.",
);

console.log(result.text);
~~~~


Docs
----

Vertana provides comprehensive documentation to help you get started quickly:
<https://vertana.org/>.

API reference documentation for each package is available on JSR (see below).


Packages
--------

Vertana is a monorepo which contains multiple packages.  If you are looking for
one package to start with, check out *@vertana/facade*.  The following is a list
of the available packages:

| Package                                              | JSR                                | npm                                | Description                                   |
| ---------------------------------------------------- | ---------------------------------- | ---------------------------------- | --------------------------------------------- |
| [@vertana/core](/packages/core/)                     | [JSR][jsr:@vertana/core]           | [npm][npm:@vertana/core]           | Core translation logic and utilities          |
| [@vertana/facade](/packages/facade/)                 | [JSR][jsr:@vertana/facade]         | [npm][npm:@vertana/facade]         | High-level facade for easy translation tasks  |
| [@vertana/context-web](/packages/context-web/)       | [JSR][jsr:@vertana/context-web]    | [npm][npm:@vertana/context-web]    | Web page fetch/search for translation context |
| [@vertana/context-memory](/packages/context-memory/) | [JSR][jsr:@vertana/context-memory] | [npm][npm:@vertana/context-memory] | Translation memory lookup for consistency     |
| [@vertana/cli](/packages/cli/)                       | [JSR][jsr:@vertana/cli]            | [npm][npm:@vertana/cli]            | Command-line interface for translation        |

[jsr:@vertana/core]: https://jsr.io/@vertana/core
[npm:@vertana/core]: https://www.npmjs.com/package/@vertana/core
[jsr:@vertana/facade]: https://jsr.io/@vertana/facade
[npm:@vertana/facade]: https://www.npmjs.com/package/@vertana/facade
[jsr:@vertana/context-web]: https://jsr.io/@vertana/context-web
[npm:@vertana/context-web]: https://www.npmjs.com/package/@vertana/context-web
[jsr:@vertana/context-memory]: https://jsr.io/@vertana/context-memory
[npm:@vertana/context-memory]: https://www.npmjs.com/package/@vertana/context-memory
[jsr:@vertana/cli]: https://jsr.io/@vertana/cli
[npm:@vertana/cli]: https://www.npmjs.com/package/@vertana/cli
