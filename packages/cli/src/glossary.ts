import { readFileSync } from "node:fs";
import { message, metavar, text } from "@optique/core/message";
import type { ValueParser, ValueParserResult } from "@optique/core/valueparser";
import type { Glossary, GlossaryEntry } from "@vertana/core/glossary";

export type { Glossary, GlossaryEntry };

/**
 * Creates a ValueParser for glossary entries in "TERM=TRANSLATION" format.
 *
 * @returns A ValueParser that parses glossary entry strings.
 *
 * @example
 * ```typescript
 * const parser = glossaryEntry();
 * const result = parser.parse("LLM=Large Language Model");
 * // result.value === { original: "LLM", translated: "Large Language Model" }
 * ```
 */
export function glossaryEntry(): ValueParser<"sync", GlossaryEntry> {
  return {
    mode: "sync",
    metavar: "TERM=TRANSLATION",
    placeholder: { original: "TERM", translated: "TRANSLATION" },

    parse(input: string): ValueParserResult<GlossaryEntry> {
      const index = input.indexOf("=");
      if (index === -1) {
        return {
          success: false,
          error: message`Invalid format. Expected ${metavar("TERM")}${
            text("=")
          }${metavar("TRANSLATION")}.`,
        };
      }
      if (index === 0) {
        return {
          success: false,
          error: message`${metavar("TERM")} cannot be empty.`,
        };
      }

      const original = input.slice(0, index);
      const translated = input.slice(index + 1);

      if (translated === "") {
        return {
          success: false,
          error: message`${metavar("TRANSLATION")} cannot be empty.`,
        };
      }

      return {
        success: true,
        value: { original, translated },
      };
    },

    format(value: GlossaryEntry): string {
      return `${value.original}=${value.translated}`;
    },
  };
}

/**
 * Loads a glossary from a JSON file.
 *
 * @param filePath The path to the glossary JSON file.
 * @returns The parsed glossary.
 * @throws {SyntaxError} If the file is not valid JSON.
 * @throws {TypeError} If the JSON structure is invalid.
 */
export function loadGlossaryFile(filePath: string): Glossary {
  const content = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new TypeError(
      `Invalid glossary file: expected an array, got ${typeof parsed}.`,
    );
  }

  const entries: GlossaryEntry[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as unknown;

    if (typeof item !== "object" || item === null) {
      throw new TypeError(
        `Invalid glossary entry at index ${i}: expected an object.`,
      );
    }

    const entry = item as Record<string, unknown>;

    if (typeof entry.original !== "string" || entry.original === "") {
      throw new TypeError(
        `Invalid glossary entry at index ${i}: "original" must be a non-empty string.`,
      );
    }

    if (typeof entry.translated !== "string" || entry.translated === "") {
      throw new TypeError(
        `Invalid glossary entry at index ${i}: "translated" must be a non-empty string.`,
      );
    }

    const glossaryEntry: GlossaryEntry = {
      original: entry.original,
      translated: entry.translated,
    };

    if (typeof entry.context === "string" && entry.context !== "") {
      (glossaryEntry as { context: string }).context = entry.context;
    }

    entries.push(glossaryEntry);
  }

  return entries;
}

/**
 * Merges multiple glossaries into one.
 * Later entries take precedence over earlier ones for the same original term.
 *
 * @param glossaries The glossaries to merge.
 * @returns The merged glossary.
 */
export function mergeGlossaries(...glossaries: Glossary[]): Glossary {
  const merged = new Map<string, GlossaryEntry>();

  for (const glossary of glossaries) {
    for (const entry of glossary) {
      merged.set(entry.original, entry);
    }
  }

  return Array.from(merged.values());
}
