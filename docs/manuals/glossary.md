---
description: >-
  Guide to using glossaries in Vertana for consistent terminology across
  translations.
---

Glossary deep dive
==================

Glossaries ensure consistent translation of specific terms throughout your
documents.  This guide covers all glossary features, from basic usage to
dynamic extraction.


Why use glossaries?
-------------------

Without glossaries, the same term might be translated differently in different
parts of a document:

 -  “chunk” might become “청크” in one paragraph and “덩어리” in another
 -  Product names might be inconsistently transliterated
 -  Technical terms might lose their precise meaning

Glossaries solve this by defining explicit term mappings that Vertana applies
consistently throughout the translation.


Basic usage
-----------

Provide a glossary through the `glossary` option:

~~~~ typescript twoslash
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "Vertana uses an agentic workflow to improve translation quality.",
  {
    glossary: [
      { original: "Vertana", translated: "버타나" },
      { original: "agentic", translated: "에이전틱" },
    ],
  }
);
~~~~


Glossary entry structure
------------------------

Each glossary entry has three fields:

~~~~ typescript twoslash
import type { GlossaryEntry } from "@vertana/core/glossary";

const entry: GlossaryEntry = {
  original: "chunk",
  translated: "청크",
  context: "In the context of text processing",
};
~~~~

`original`
:   The term in the source language to match.

`translated`
:   The translation to use in the target language.

`context`
:   Optional description of when this translation applies.  This helps
    disambiguate terms with multiple meanings.


Preserving terms with `keep()`
------------------------------

Some terms should remain untranslated—brand names, product names, and certain
technical terms often need to stay in their original form.  Instead of writing
`{ original: "React", translated: "React" }`, use the `keep()` helper:

~~~~ typescript twoslash
import { keep } from "@vertana/core/glossary";
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "The React component uses hooks for state management.",
  {
    glossary: [
      keep("React"),
      keep("hook", { context: "React programming concept" }),
    ],
  }
);
~~~~

The `properNoun()` function is an alias for `keep()` that provides semantic
clarity when preserving proper nouns:

~~~~ typescript twoslash
import { properNoun } from "@vertana/core/glossary";
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "TypeScript was developed by Microsoft.",
  {
    glossary: [
      properNoun("TypeScript"),
      properNoun("Microsoft"),
    ],
  }
);
~~~~

Both functions accept an optional `context` parameter for disambiguation, just
like regular glossary entries.


Context-aware entries
---------------------

The `context` field helps when a term has multiple valid translations depending
on usage:

~~~~ typescript twoslash
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "The bank processes transactions. We walked along the river bank.",
  {
    glossary: [
      {
        original: "bank",
        translated: "은행",
        context: "Financial institution",
      },
      {
        original: "bank",
        translated: "둑",
        context: "Edge of a river",
      },
    ],
  }
);
~~~~

The LLM uses the context to choose the appropriate translation based on how
the term is used in each sentence.


Dynamic glossary
----------------

For long documents, manually defining every term can be impractical.  The
dynamic glossary feature automatically extracts and accumulates terminology
as translation progresses.

Enable it with the `dynamicGlossary` option:

~~~~ typescript twoslash
const longDocument: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  longDocument,
  { dynamicGlossary: true }
);

// Access the accumulated glossary
console.log(result.accumulatedGlossary);
// [
//   { original: "Vertana", translated: "버타나" },
//   { original: "chunk", translated: "청크" },
//   ...
// ]
~~~~

### How it works

1.  After translating each chunk, Vertana extracts key terminology pairs
2.  Extracted terms are added to a running glossary
3.  Subsequent chunks receive the accumulated glossary, ensuring consistency
4.  The final glossary is returned in `result.accumulatedGlossary`

### Customizing dynamic glossary

Fine-tune the extraction with `DynamicGlossaryOptions`:

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
const extractorModel: LanguageModel = {} as LanguageModel;
const longDocument: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  longDocument,
  {
    dynamicGlossary: {
      maxTermsPerChunk: 15,          // Extract more terms per chunk
      extractorModel: extractorModel, // Use a different model for extraction
    },
  }
);
~~~~

`maxTermsPerChunk`
:   Maximum terms to extract from each chunk (default: `10`).

`extractorModel`
:   The model to use for term extraction.  If not specified, uses the same
    model as translation.

### Combining static and dynamic glossaries

You can provide an initial glossary while also enabling dynamic accumulation:

~~~~ typescript twoslash
const longDocument: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  longDocument,
  {
    glossary: [
      { original: "Vertana", translated: "버타나" },
    ],
    dynamicGlossary: true,
  }
);

// result.accumulatedGlossary includes both the initial entry
// and any new terms extracted during translation
~~~~


Glossary file format
--------------------

For the CLI and reusable glossaries, store entries in a JSON file:

~~~~ json
[
  {
    "original": "Vertana",
    "translated": "버타나"
  },
  {
    "original": "agentic workflow",
    "translated": "에이전틱 워크플로우"
  },
  {
    "original": "chunk",
    "translated": "청크",
    "context": "A segment of text for processing"
  }
]
~~~~

Use with the CLI:

~~~~ bash
vertana translate -t ko --glossary-file glossary.json document.md
~~~~

Or load and use programmatically:

~~~~ typescript twoslash
import { readFileSync } from "node:fs";
import type { Glossary } from "@vertana/core/glossary";

const glossary: Glossary = JSON.parse(
  readFileSync("glossary.json", "utf-8")
);
~~~~


Best practices
--------------

### Focus on important terms

Don't include every word.  Focus on:

 -  Product names and brand terms
 -  Technical vocabulary specific to your domain
 -  Terms with multiple possible translations
 -  Proper nouns that need consistent transliteration

### Use helpers for untranslated terms

When a term should remain in its original form, use `keep()` or `properNoun()`
for readability instead of writing `{ original: "X", translated: "X" }`:

~~~~ typescript twoslash
import { type Glossary, keep, properNoun } from "@vertana/core/glossary";

const glossary: Glossary = [
  properNoun("React"),
  properNoun("TypeScript"),
  keep("API"),
  keep("LLM", { context: "Large Language Model" }),
];
~~~~

### Provide context for ambiguous terms

When a term can mean different things, add context:

~~~~ typescript twoslash
import type { Glossary } from "@vertana/core/glossary";

const glossary: Glossary = [
  {
    original: "model",
    translated: "모델",
    context: "Machine learning model",
  },
  {
    original: "model",
    translated: "모형",
    context: "Physical or conceptual representation",
  },
];
~~~~

### Use dynamic glossary for long documents

For documents with many chunks, enable dynamic glossary to automatically
maintain consistency without manually defining every term.

### Reuse glossaries across projects

Save your domain-specific glossaries as JSON files and reuse them across
related projects to maintain consistent terminology.
