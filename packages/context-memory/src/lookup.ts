import type {
  ContextSourceGatherOptions,
  PassiveContextSource,
} from "@vertana/core/context";
import { z } from "zod";
import type {
  TranslationMemoryEntry,
  TranslationMemoryHit,
  TranslationMemoryStore,
} from "./store.ts";

const DEFAULT_MAX_HITS = 5;
const MAX_HITS_LIMIT = 50;
const DEFAULT_MIN_SCORE = 0.2;
const DEFAULT_MAX_CONTENT_CHARS = 4000;

/**
 * Parameters accepted by the `lookup-memory` passive context source.
 *
 * @since 0.2.0
 */
export interface LookupMemoryParams {
  /**
   * The source-language segment to look up in translation memory.
   */
  readonly query: string;

  /**
   * Optional BCP 47 source language filter.
   */
  readonly sourceLanguage?: string;

  /**
   * Optional BCP 47 target language filter.
   */
  readonly targetLanguage?: string;

  /**
   * Optional domain filter.
   */
  readonly domain?: string;

  /**
   * Optional namespace filter.
   */
  readonly namespace?: string;

  /**
   * Maximum number of hits to return.
   */
  readonly maxHits?: number;

  /**
   * Minimum score in the inclusive range `[0, 1]`.
   */
  readonly minScore?: number;
}

/**
 * Options for creating a `lookup-memory` passive context source.
 *
 * @since 0.2.0
 */
export interface LookupMemoryOptions {
  /**
   * Default maximum number of hits to return.
   *
   * @default 5
   */
  readonly maxHits?: number;

  /**
   * Default minimum score in the inclusive range `[0, 1]`.
   *
   * @default 0.2
   */
  readonly minScore?: number;

  /**
   * Maximum number of characters to return in the formatted tool output.
   *
   * @default 4000
   */
  readonly maxContentChars?: number;
}

/**
 * Structured metadata for one formatted translation memory hit.
 *
 * @since 0.2.0
 */
export interface LookupMemoryHitMetadata {
  /**
   * The matched source segment.
   */
  readonly source: string;

  /**
   * The historical target translation.
   */
  readonly target: string;

  /**
   * Similarity score in the inclusive range `[0, 1]`.
   */
  readonly score: number;

  /**
   * Optional BCP 47 source language tag.
   */
  readonly sourceLanguage?: string;

  /**
   * Optional BCP 47 target language tag.
   */
  readonly targetLanguage?: string;

  /**
   * Optional domain label.
   */
  readonly domain?: string;

  /**
   * Optional logical partition.
   */
  readonly namespace?: string;

  /**
   * Optional document or source identifier.
   */
  readonly sourceId?: string;

  /**
   * Optional ISO 8601 creation timestamp.
   */
  readonly createdAt?: string;

  /**
   * Optional translator or project notes.
   */
  readonly notes?: string;

  /**
   * Additional backend- or application-specific metadata.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Creates a passive context source that looks up translation memory matches.
 *
 * @param store Translation memory store to query.
 * @param options Optional lookup source settings.
 * @returns A passive context source named `lookup-memory`.
 * @throws {RangeError} If a numeric option is out of range.
 *
 * @since 0.2.0
 */
export function lookupMemory(
  store: TranslationMemoryStore,
  options: LookupMemoryOptions = {},
): PassiveContextSource<LookupMemoryParams> {
  const defaultMaxHits = validateMaxHits(options.maxHits);
  const defaultMinScore = validateMinScore(options.minScore);
  const maxContentChars = validateMaxContentChars(options.maxContentChars);

  return {
    name: "lookup-memory",
    description: "Looks up similar source segments in translation memory " +
      "and returns previous translations for consistency.",
    mode: "passive",
    parameters: z.object({
      query: z.string().trim().min(1).describe(
        "The source-language segment to look up in translation memory.",
      ),
      sourceLanguage: z.string().optional().describe(
        "Optional BCP 47 source language filter.",
      ),
      targetLanguage: z.string().optional().describe(
        "Optional BCP 47 target language filter.",
      ),
      domain: z.string().optional().describe("Optional domain filter."),
      namespace: z.string().optional().describe("Optional namespace filter."),
      maxHits: z.number().int().positive().max(MAX_HITS_LIMIT).optional()
        .describe("Maximum number of hits to return."),
      minScore: z.number().min(0).max(1).optional().describe(
        "Minimum similarity score from 0 to 1.",
      ),
    }),

    async gather(
      params: LookupMemoryParams,
      gatherOptions?: ContextSourceGatherOptions,
    ) {
      const query = params.query.trim();
      const maxHits = validateMaxHits(params.maxHits ?? defaultMaxHits);
      const minScore = validateMinScore(params.minScore ?? defaultMinScore);
      if (query.length === 0) {
        return {
          content: "No translation memory matches found for an empty query.",
          metadata: {
            query,
            hitCount: 0,
            hits: [],
          },
        };
      }

      const hits = await store.search(query, {
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        domain: params.domain,
        namespace: params.namespace,
        maxHits,
        minScore,
        signal: gatherOptions?.signal,
      });
      const hitMetadata = hits.map(toHitMetadata);

      if (hits.length === 0) {
        return {
          content: limitText(
            "No translation memory matches found for: " +
              neutralizePromptTags(query),
            maxContentChars,
          ),
          metadata: {
            query,
            hitCount: 0,
            hits: [],
          },
        };
      }

      return {
        content: limitText(
          formatMemoryHits(query, hits),
          maxContentChars,
        ),
        metadata: {
          query,
          hitCount: hits.length,
          hits: hitMetadata,
        },
      };
    },
  };
}

function validateMaxHits(value: number | undefined): number {
  const maxHits = value ?? DEFAULT_MAX_HITS;
  if (
    !Number.isInteger(maxHits) || maxHits <= 0 || maxHits > MAX_HITS_LIMIT
  ) {
    throw new RangeError(
      `maxHits must be a positive integer no greater than ${MAX_HITS_LIMIT}.`,
    );
  }
  return maxHits;
}

function validateMinScore(value: number | undefined): number {
  const minScore = value ?? DEFAULT_MIN_SCORE;
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
    throw new RangeError("minScore must be between 0 and 1.");
  }
  return minScore;
}

function validateMaxContentChars(value: number | undefined): number {
  const maxContentChars = value ?? DEFAULT_MAX_CONTENT_CHARS;
  if (!Number.isInteger(maxContentChars) || maxContentChars <= 0) {
    throw new RangeError("maxContentChars must be a positive integer.");
  }
  return maxContentChars;
}

function formatMemoryHits(
  query: string,
  hits: readonly TranslationMemoryHit[],
): string {
  const lines: string[] = [
    `# Translation memory matches: ${neutralizePromptTags(query)}`,
    "",
  ];

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    const entry = hit.entry;

    lines.push(`## ${i + 1}. Score: ${hit.score.toFixed(2)}`);
    appendField(lines, "Source", entry.source);
    appendField(lines, "Target", entry.target);
    appendField(lines, "Source language", entry.sourceLanguage);
    appendField(lines, "Target language", entry.targetLanguage);
    appendField(lines, "Domain", entry.domain);
    appendField(lines, "Namespace", entry.namespace);
    appendField(lines, "Source id", entry.sourceId);
    appendField(lines, "Created at", entry.createdAt);
    appendField(lines, "Notes", entry.notes);

    if (i < hits.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

function appendField(
  lines: string[],
  name: string,
  value: string | undefined,
): void {
  if (value != null && value.length > 0) {
    lines.push(`${name}: ${neutralizePromptTags(value)}`);
  }
}

function toHitMetadata(hit: TranslationMemoryHit): LookupMemoryHitMetadata {
  const entry: TranslationMemoryEntry = hit.entry;
  return {
    source: entry.source,
    target: entry.target,
    score: hit.score,
    sourceLanguage: entry.sourceLanguage,
    targetLanguage: entry.targetLanguage,
    domain: entry.domain,
    namespace: entry.namespace,
    sourceId: entry.sourceId,
    createdAt: entry.createdAt,
    notes: entry.notes,
    metadata: entry.metadata,
  };
}

function limitText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const suffix = "...";
  if (maxChars <= suffix.length) {
    return suffix.slice(0, maxChars);
  }

  return trimDanglingHighSurrogate(text.slice(0, maxChars - suffix.length)) +
    suffix;
}

function trimDanglingHighSurrogate(text: string): string {
  if (/[\uD800-\uDBFF]$/.test(text)) {
    return text.slice(0, -1);
  }
  return text;
}

function neutralizePromptTags(text: string): string {
  return text.replace(
    /<\s*\/?\s*[a-z_][a-z0-9_:-]*(?:\s+[a-z0-9_:-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!\s*[a-z_][\s\S]*?>|<\?[\s\S]*?\?>/gi,
    (tag) => tag.replaceAll("<", "‹").replaceAll(">", "›"),
  );
}
