/**
 * Translation memory context sources for Vertana.
 *
 * @module
 * @since 0.2.0
 */

export { InMemoryTranslationMemoryStore } from "./in-memory.ts";
export {
  lookupMemory,
  type LookupMemoryHitMetadata,
  type LookupMemoryOptions,
  type LookupMemoryParams,
} from "./lookup.ts";
export type {
  TranslationMemoryEntry,
  TranslationMemoryHit,
  TranslationMemoryOperationOptions,
  TranslationMemorySearchOptions,
  TranslationMemoryStore,
} from "./store.ts";
