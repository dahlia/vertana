---
description: >-
  Complete reference for the Vertana command-line interface, including
  installation, configuration, and all available options.
---

CLI reference
=============

Vertana provides a command-line interface for quick translations without
writing code.  This guide covers installation, configuration, and all
available commands.


Installation
------------

::: code-group

~~~~ bash [Deno]
deno install -g --name vertana --allow-all jsr:@vertana/cli
~~~~

~~~~ bash [npm]
npm install -g @vertana/cli
~~~~

~~~~ bash [pnpm]
pnpm add -g @vertana/cli
~~~~

~~~~ bash [Bun]
bun add -g @vertana/cli
~~~~

:::


Configuration
-------------

Before using the CLI, you need to configure a language model and API key.

### Setting the model

Use the `config model` command to set the default language model:

~~~~ bash
vertana config model openai:gpt-4.1
~~~~

The model code format is `PROVIDER:MODEL`.  Supported providers:

`openai`
:   OpenAI models (e.g., `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`)

`anthropic`
:   Anthropic models (e.g., `claude-sonnet-4-5-20250929`,
    `claude-opus-4-5-20251124`, `haiku-4-5-20251015`)

`google`
:   Google Generative AI models (e.g., `gemini-3-flash`, `gemini-3-pro`)

To view the current model:

~~~~ bash
vertana config model
~~~~

### Setting API keys

Use the `config api-key` command to store API keys securely in your system
keyring:

~~~~ bash
vertana config api-key openai sk-...
vertana config api-key anthropic sk-ant-...
vertana config api-key google AIza...
~~~~

To view a masked version of the current API key:

~~~~ bash
vertana config api-key openai
~~~~

> [!TIP]
> API keys are stored in your system's secure keyring (Keychain on macOS,
> Secret Service on Linux, Credential Manager on Windows).  You can also
> set API keys via environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
> or `GOOGLE_GENERATIVE_AI_API_KEY`.


Translating text
----------------

The `translate` command performs translation.  The basic syntax is:

~~~~ bash
vertana translate -t TARGET [OPTIONS] [FILE]
~~~~

### Target language

The `-t` or `--target` option specifies the target language (required):

~~~~ bash
vertana translate -t ko document.md
vertana translate --target ja README.md
~~~~

Language codes should be [BCP 47] language tags (e.g., `ko`, `ja`, `zh-Hans`,
`pt-BR`).

[BCP 47]: https://www.rfc-editor.org/info/bcp47

### Source language

The `-s` or `--source` option specifies the source language.  If omitted,
Vertana auto-detects the source language:

~~~~ bash
vertana translate -s en -t ko document.md
~~~~

### Input sources

You can provide input in three ways:

~~~~ bash
# From a file
vertana translate -t ko document.md

# From stdin
echo "Hello, world!" | vertana translate -t ko

# Interactive input (type text, then Ctrl+D)
vertana translate -t ko
~~~~

### Output options

By default, translated text goes to stdout.  Use `-o` or `--output` to save
to a file:

~~~~ bash
vertana translate -t ko -o output.md input.md
~~~~

### Media type

The `-T` or `--type` option specifies the input format.  This affects how
the text is chunked for translation:

~~~~ bash
vertana translate -t ko -T text/markdown document.md
vertana translate -t ko -T text/html page.html
vertana translate -t ko -T text/plain notes.txt
~~~~

Supported media types:

`text/plain`
:   Plain text (default).  Splits on paragraphs and sentences.

`text/markdown`
:   Markdown documents.  Preserves headings, code blocks, and formatting.

`text/html`
:   HTML documents.  Preserves tags and structure.

### Tone

The `--tone` option sets the translation tone:

~~~~ bash
vertana translate -t ko --tone formal document.md
~~~~

Available tones: `formal`, `informal`, `technical`, `casual`, `professional`,
`literary`, `journalistic`.

### Domain

The `--domain` option provides domain context for specialized terminology:

~~~~ bash
vertana translate -t ko --domain medical report.md
vertana translate -t ja --domain legal contract.md
~~~~

### Fetching linked pages

The `-L`/`--fetch-links` flag automatically fetches content from URLs
found in the source text and provides them as additional context:

~~~~ bash
vertana translate -t ko -L document.md
~~~~

This is useful when translating short documents that reference a small,
trusted set of external articles or resources.  The fetched content helps
the LLM understand the context of the references and translate them more
accurately.

> [!WARNING]
> Use `-L` deliberately, not as a default.  When the source document
> contains many links to large pages, the fetched material can dominate the
> prompt and cause the translator to echo a fetched page back as the
> translation, instead of translating the actual input.  For long documents
> or untrusted link sets, leave `-L` off so the CLI translates the input
> without any web context.  If you need finer-grained control (for example,
> the passive `fetchWebPage` source so the model fetches only specific URLs
> on demand), use the programmatic API documented in the
> [*Web context*](./context-web.md) guide instead.

See the [*Web context*](./context-web.md) guide for more details on how
web context fetching works.


Glossaries
----------

Glossaries ensure consistent translation of specific terms.

### Inline glossary entries

Use `-g` or `--glossary` to define term mappings inline:

~~~~ bash
vertana translate -t ko -g "Vertana=버타나" -g "agentic=에이전틱" document.md
~~~~

### Glossary files

Use `--glossary-file` to load a glossary from a JSON file:

~~~~ bash
vertana translate -t ko --glossary-file glossary.json document.md
~~~~

The glossary file format:

~~~~ json
[
  { "original": "Vertana", "translated": "버타나" },
  { "original": "agentic", "translated": "에이전틱" },
  {
    "original": "chunk",
    "translated": "청크",
    "context": "In the context of text processing"
  }
]
~~~~

Each entry has:

`original`
:   The source term to match.

`translated`
:   The target translation to use.

`context`
:   Optional context to clarify when this translation applies.

> [!TIP]
> CLI glossary entries (`-g`) take precedence over file entries when the
> same term appears in both.


Verbosity
---------

Use `-v` or `--verbose` for more detailed output during translation:

~~~~ bash
vertana translate -t ko -v document.md
~~~~

Add more `-v` flags for increased verbosity:

~~~~ bash
vertana translate -t ko -vv document.md   # Debug level
vertana translate -t ko -vvv document.md  # Trace level
~~~~


Examples
--------

Translate a Markdown file to Korean:

~~~~ bash
vertana translate -t ko -T text/markdown README.md -o README.ko.md
~~~~

Translate with domain context and glossary:

~~~~ bash
vertana translate -t ja \
  --domain medical \
  -g "patient=患者" \
  -g "diagnosis=診断" \
  report.md
~~~~

Translate from stdin with formal tone:

~~~~ bash
cat document.txt | vertana translate -t ko --tone formal
~~~~

Translate HTML while preserving structure:

~~~~ bash
vertana translate -t zh-Hans -T text/html page.html -o page.zh.html
~~~~
