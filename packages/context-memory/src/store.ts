/**
 * A source-target segment pair stored in a translation memory.
 *
 * @since 0.2.0
 */
export interface TranslationMemoryEntry {
  /**
   * The original source-language segment.
   */
  readonly source: string;

  /**
   * The previously validated target-language translation.
   */
  readonly target: string;

  /**
   * Optional BCP 47 source language tag.
   */
  readonly sourceLanguage?: string;

  /**
   * Optional BCP 47 target language tag.
   */
  readonly targetLanguage?: string;

  /**
   * Optional domain label, such as `"legal"` or `"product-docs"`.
   */
  readonly domain?: string;

  /**
   * Optional logical partition, such as a project or customer id.
   */
  readonly namespace?: string;

  /**
   * Optional identifier for the document or source this entry came from.
   */
  readonly sourceId?: string;

  /**
   * Optional ISO 8601 timestamp for when this entry was created.
   */
  readonly createdAt?: string;

  /**
   * Optional translator or project notes about the entry.
   */
  readonly notes?: string;

  /**
   * Additional backend- or application-specific metadata.
   *
   * Store implementations may clone entries before saving or returning them.
   * Use structured-cloneable values when the entry needs to work with the
   * built-in in-memory store.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * A scored translation memory search result.
 *
 * @since 0.2.0
 */
export interface TranslationMemoryHit {
  /**
   * The matched translation memory entry.
   */
  readonly entry: TranslationMemoryEntry;

  /**
   * Similarity score in the inclusive range `[0, 1]`.
   */
  readonly score: number;
}

/**
 * Shared options for translation memory store operations.
 *
 * @since 0.2.0
 */
export interface TranslationMemoryOperationOptions {
  /**
   * Optional signal for cancelling the operation.
   */
  readonly signal?: AbortSignal;
}

/**
 * Options for searching translation memory.
 *
 * @since 0.2.0
 */
export interface TranslationMemorySearchOptions
  extends TranslationMemoryOperationOptions {
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
   *
   * @default 5
   */
  readonly maxHits?: number;

  /**
   * Minimum score in the inclusive range `[0, 1]`.
   *
   * @default 0.2
   */
  readonly minScore?: number;
}

/**
 * Pluggable storage interface for translation memory backends.
 *
 * @since 0.2.0
 */
export interface TranslationMemoryStore {
  /**
   * Adds a single translation memory entry.
   *
   * @param entry The entry to add.
   * @param options Optional operation settings.
   * @returns A promise that resolves when the entry has been stored.
   * @throws {TypeError} If the entry is invalid.
   */
  add(
    entry: TranslationMemoryEntry,
    options?: TranslationMemoryOperationOptions,
  ): Promise<void>;

  /**
   * Adds multiple translation memory entries.
   *
   * @param entries The entries to add.
   * @param options Optional operation settings.
   * @returns A promise that resolves when all entries have been stored.
   * @throws {TypeError} If any entry is invalid.
   */
  addMany(
    entries: readonly TranslationMemoryEntry[],
    options?: TranslationMemoryOperationOptions,
  ): Promise<void>;

  /**
   * Searches for memory entries related to a query segment.
   *
   * @param query The source-language segment to search for.
   * @param options Optional search settings.
   * @returns Ranked hits ordered from best to worst.
   * @throws {RangeError} If a numeric search option is out of range.
   */
  search(
    query: string,
    options?: TranslationMemorySearchOptions,
  ): Promise<readonly TranslationMemoryHit[]>;
}
