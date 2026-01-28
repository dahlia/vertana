---
description: >-
  This tutorial walks you through Vertana's features, from basic translation
  to advanced techniques like glossaries, refinement, and best-of-N selection.
---

Tutorial
========

Vertana is an LLM-powered agentic translation library that goes beyond simple
text translation.  It uses autonomous agent workflows to gather contextual
information, maintain terminology consistency, and iteratively improve
translation quality.

This tutorial will guide you through Vertana's features progressively,
starting from basic translation and building up to advanced techniques.


What makes Vertana different?
-----------------------------

Most translation libraries treat translation as a simple input-output operation:
you provide text, and get translated text back.  This works for simple cases,
but falls short when you need:

 -  *Consistent terminology* across a document or project
 -  *Domain-specific accuracy* for technical, legal, or medical content
 -  *Quality assurance* with iterative improvement
 -  *Contextual awareness* from external sources like style guides or glossaries

Vertana addresses these challenges through an agentic approach.  Instead of
a single translation pass, Vertana orchestrates multiple steps:

1.  *Chunking*: Splitting long documents into manageable pieces
2.  *Context gathering*: Collecting relevant information from external sources
3.  *Translation*: Generating translations with full context awareness
4.  *Evaluation*: Assessing translation quality with specific criteria
5.  *Refinement*: Iteratively improving translations based on feedback
6.  *Selection*: Choosing the best result from multiple candidates


Basic translation
-----------------

Let's start with a simple translation.  The `translate()` function is your
main entry point:

~~~~ typescript twoslash
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "The quick brown fox jumps over the lazy dog."
);

console.log(result.text);
// => "빠른 갈색 여우가 게으른 개를 뛰어넘습니다."
console.log(result.tokenUsed);
// => 142
console.log(result.processingTime);
// => 1523
~~~~

The result object contains:

`text`
:   The translated text

`tokenUsed`
:   Total tokens consumed during translation

`processingTime`
:   Time taken in milliseconds

### Translation options

You can provide additional options to improve translation quality:

~~~~ typescript twoslash
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ja",
  "The patient exhibited signs of acute respiratory distress syndrome.",
  {
    // Specify source language (auto-detected if omitted)
    sourceLanguage: "en",

    // Provide domain context for accurate terminology
    domain: "medical",

    // Set the desired tone
    tone: "formal",

    // Add background information
    context: "This is from a clinical case report for a peer-reviewed journal.",

    // Include a title (will also be translated)
    title: "Case Study: ARDS Management"
  }
);

console.log(result.title);
// => "症例研究：ARDS管理"
console.log(result.text);
// => "患者は急性呼吸窮迫症候群の兆候を示した。"
~~~~

Available tone options include:

| Tone           | Description                                  |
| -------------- | -------------------------------------------- |
| `formal`       | Professional, academic, or official contexts |
| `informal`     | Casual, conversational style                 |
| `technical`    | Precise, specialized terminology             |
| `casual`       | Friendly, easy-going language                |
| `professional` | Business-like, polished communication        |
| `literary`     | Artistic, expressive writing                 |
| `journalistic` | News and media style                         |

### Media types

Vertana can preserve formatting when translating structured content:

~~~~ typescript twoslash
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const markdown = `
# Getting Started

Welcome to our **documentation**. Here's what you'll learn:

- Installation steps
- Basic configuration
- Advanced features

> Note: Make sure you have Node.js 18+ installed.
`;

const result = await translate(
  openai("gpt-4o"),
  "ko",
  markdown,
  {
    mediaType: "text/markdown"
  }
);
~~~~

Supported media types:

`text/plain` (default)
:   Plain text

`text/markdown`
:   Markdown documents

`text/html`
:   HTML content


Using glossaries
----------------

Glossaries ensure consistent translation of specific terms throughout your
document.  This is essential for technical documentation, legal texts, and
any content with domain-specific vocabulary.

### Basic glossary

A glossary is an array of term mappings:

~~~~ typescript twoslash
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "The React component uses hooks for state management. Each hook follows the rules of hooks.",
  {
    glossary: [
      { original: "React", translated: "React" },  // Keep as-is
      { original: "component", translated: "컴포넌트" },
      { original: "hook", translated: "훅" },
      { original: "state", translated: "상태" }
    ]
  }
);

console.log(result.text);
// => "React 컴포넌트는 상태 관리를 위해 훅을 사용합니다. 각 훅은 훅의 규칙을 따릅니다."
~~~~

For terms that should remain untranslated (like “React” above), you can use the
`keep()` or `properNoun()` helper functions instead of repeating the same value:

~~~~ typescript twoslash
import { properNoun } from "@vertana/core/glossary";
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "The React component uses hooks for state management. Each hook follows the rules of hooks.",
  {
    glossary: [
      properNoun("React"),              // Same as { original: "React", translated: "React" }
      { original: "component", translated: "컴포넌트" },
      { original: "hook", translated: "훅" },
      { original: "state", translated: "상태" }
    ]
  }
);
~~~~

### Glossary with context

Some terms have different translations depending on context.  You can provide
disambiguation hints:

~~~~ typescript twoslash
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  "The bank approved the loan. We walked along the river bank.",
  {
    glossary: [
      {
        original: "bank",
        translated: "은행",
        context: "financial institution"
      },
      {
        original: "bank",
        translated: "강둑",
        context: "side of a river"
      }
    ]
  }
);

console.log(result.text);
// => "은행이 대출을 승인했습니다. 우리는 강둑을 따라 걸었습니다."
~~~~

### Dynamic glossary

For long documents, Vertana can automatically extract and accumulate
terminology as it translates.  This ensures consistency even without
a predefined glossary:

~~~~ typescript twoslash
const longDocument: string = "";  // A long technical document
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ja",
  longDocument,
  {
    dynamicGlossary: true
  }
);

// View the automatically extracted terms
console.log(result.accumulatedGlossary);
// => [
//   { original: "machine learning", translated: "機械学習" },
//   { original: "neural network", translated: "ニューラルネットワーク" },
//   ...
// ]
~~~~

You can customize dynamic glossary behavior:

~~~~ typescript twoslash
const longDocument: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ja",
  longDocument,
  {
    dynamicGlossary: {
      maxTermsPerChunk: 15,  // Extract up to 15 terms per chunk
      extractorModel: openai("gpt-4o-mini")  // Use a faster model for extraction
    }
  }
);
~~~~


Document chunking
-----------------

Long documents are automatically split into chunks for processing.  This
ensures that each chunk fits within the model's context window and allows
for progress tracking.

### Default chunking

By default, Vertana selects an appropriate chunker based on the media type:

 -  **Markdown**: Splits at headings and preserves document structure
 -  **Plain text/HTML**: Splits at paragraph boundaries

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
    mediaType: "text/markdown",
    onProgress: (progress) => {
      if (progress.stage === "translating") {
        console.log(`Chunk ${progress.chunkIndex! + 1}/${progress.totalChunks}`);
      }
    }
  }
);
~~~~

### Custom context window

You can control the maximum tokens per chunk:

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
    contextWindow: {
      type: "explicit",
      maxTokens: 8192  // Larger chunks for models with big context windows
    }
  }
);
~~~~

### Disabling chunking

For short texts where you want to ensure single-pass translation:

~~~~ typescript twoslash
const shortText: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  shortText,
  {
    chunker: null  // Disable chunking entirely
  }
);
~~~~


Quality refinement
------------------

Refinement is an iterative process where Vertana evaluates the translation
and improves it based on identified issues.  This is particularly valuable
for high-stakes content where quality is critical.

### Enabling refinement

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  text,
  {
    refinement: true
  }
);

console.log(result.qualityScore);
// => 0.92
console.log(result.refinementIterations);
// => 2
~~~~

When refinement is enabled, the result includes:

`qualityScore`
:   Final quality score (0 to 1)

`refinementIterations`
:   Number of improvement iterations performed

### Customizing refinement

You can control the refinement process:

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  text,
  {
    refinement: {
      maxIterations: 5,       // Up to 5 refinement passes
      qualityThreshold: 0.95  // Stop early if quality exceeds 95%
    }
  }
);
~~~~

### Tracking refinement progress

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  text,
  {
    refinement: true,
    onProgress: (progress) => {
      if (progress.stage === "refining") {
        console.log(
          `Refinement iteration ${progress.iteration}/${progress.maxIterations}`
        );
      }
    }
  }
);
~~~~


Best-of-N selection
-------------------

When you need the highest quality translation, you can use multiple models
and let Vertana select the best result.  Each model generates a translation,
and an evaluator model scores them to pick the winner.

### Using multiple models

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await translate(
  [
    openai("gpt-4o"),
    anthropic("claude-sonnet-4-20250514"),
    openai("gpt-4o-mini")
  ],
  "ko",
  text,
  {
    bestOfN: true
  }
);

console.log(result.selectedModel);
// => { modelId: "gpt-4o", ... }
~~~~

### Custom evaluator

By default, the first model in the array is used for evaluation.  You can
specify a different evaluator:

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await translate(
  [
    openai("gpt-4o"),
    anthropic("claude-sonnet-4-20250514")
  ],
  "ko",
  text,
  {
    bestOfN: {
      evaluatorModel: anthropic("claude-sonnet-4-20250514")  // Use Claude to judge
    }
  }
);
~~~~


Context sources
---------------

Context sources allow you to provide additional information to the translation
process.  They come in two modes:

`"required"`
:   Always executed before translation begins

`"passive"`
:   Available as tools that the LLM can invoke when needed

### Required context sources

Use required sources for information that's always relevant:

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import type {
  ContextResult,
  RequiredContextSource,
} from "@vertana/core";
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

// Create a context source that fetches author information
const authorBioSource: RequiredContextSource = {
  name: "author-bio",
  description: "Author biography and writing style",
  mode: "required",
  async gather(): Promise<ContextResult> {
    // In practice, this might fetch from a database or API
    return {
      content: `
        Author: Jane Smith
        Style: Academic, formal tone
        Specialization: Environmental science
      `
    };
  }
};

const result = await translate(
  openai("gpt-4o"),
  "ko",
  text,
  {
    contextSources: [authorBioSource]
  }
);
~~~~

### Passive context sources

Passive sources are exposed as tools that the LLM agent can invoke when it
determines they would be helpful:

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import type { ContextResult, PassiveContextSource } from "@vertana/core";
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// A source that looks up technical terms
const termLookupSource: PassiveContextSource<{ term: string }> = {
  name: "term-lookup",
  description: "Looks up technical terms in the company glossary",
  mode: "passive",
  parameters: z.object({
    term: z.string().describe("The technical term to look up")
  }),
  async gather(params): Promise<ContextResult> {
    // Look up the term in your glossary database
    const definition = await lookupTerm(params.term);
    return { content: definition };
  }
};

const result = await translate(
  openai("gpt-4o"),
  "ko",
  text,
  {
    contextSources: [termLookupSource]
  }
);

declare function lookupTerm(term: string): Promise<string>;
~~~~

> [!NOTE]
> Passive context sources require a schema definition using a library that
> implements the [Standard Schema] specification, such as [Zod], [Valibot],
> or [ArkType].

[Standard Schema]: https://standardschema.dev/
[Zod]: https://zod.dev/
[Valibot]: https://valibot.dev/
[ArkType]: https://arktype.io/


Cancellation
------------

All translation operations support cancellation through [`AbortSignal`]:

~~~~ typescript twoslash
const text: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const controller = new AbortController();

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000);

try {
  const result = await translate(
    openai("gpt-4o"),
    "ko",
    text,
    {
      signal: controller.signal
    }
  );
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.log("Translation was cancelled");
  }
}
~~~~

[`AbortSignal`]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal


Putting it all together
-----------------------

Here's a comprehensive example using multiple Vertana features:

~~~~ typescript twoslash
const longTechnicalDocument: string = "";
declare function fetchStyleGuide(): Promise<string>;
// ---cut-before---
import type { RequiredContextSource } from "@vertana/core";
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

// Style guide context source
const styleGuideSource: RequiredContextSource = {
  name: "style-guide",
  description: "Company translation style guide",
  mode: "required",
  async gather() {
    const guide = await fetchStyleGuide();
    return { content: guide };
  }
};

const result = await translate(
  // Use multiple models for best-of-N selection
  [
    openai("gpt-4o"),
    anthropic("claude-sonnet-4-20250514")
  ],
  "ja",
  longTechnicalDocument,
  {
    // Basic options
    sourceLanguage: "en",
    domain: "software engineering",
    tone: "technical",
    mediaType: "text/markdown",

    // Predefined glossary
    glossary: [
      { original: "dependency injection", translated: "依存性注入" },
      { original: "middleware", translated: "ミドルウェア" },
      { original: "callback", translated: "コールバック" }
    ],

    // Enable dynamic glossary for additional terms
    dynamicGlossary: true,

    // Enable iterative refinement
    refinement: {
      maxIterations: 3,
      qualityThreshold: 0.9
    },

    // Enable best-of-N selection
    bestOfN: true,

    // Add context from style guide
    contextSources: [styleGuideSource],

    // Track progress
    onProgress: (progress) => {
      switch (progress.stage) {
        case "gatheringContext":
          console.log("Gathering context...");
          break;
        case "chunking":
          console.log("Splitting document...");
          break;
        case "translating":
          console.log(
            `Translating chunk ${progress.chunkIndex! + 1}/${progress.totalChunks}`
          );
          break;
        case "selecting":
          console.log("Selecting best translation...");
          break;
        case "refining":
          console.log(
            `Refining (iteration ${progress.iteration}/${progress.maxIterations})`
          );
          break;
      }
    }
  }
);

console.log("Translation complete!");
console.log(`Quality score: ${result.qualityScore}`);
console.log(`Selected model: ${result.selectedModel}`);
console.log(`Terms extracted: ${result.accumulatedGlossary?.length}`);
~~~~
