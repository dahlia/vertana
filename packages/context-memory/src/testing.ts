import process from "node:process";
import type { LanguageModel } from "ai";

/**
 * Supported provider names for testing.
 */
export type ProviderName = "openai" | "anthropic" | "google";

/**
 * Creates a language model from a model string in the format "provider:model".
 *
 * @param modelString The model string, e.g. `"google:gemini-2.5-flash-lite"`.
 * @returns The language model instance.
 * @throws {SyntaxError} If the model string format is invalid.
 * @throws {TypeError} If the provider is not supported.
 */
export async function createModelFromString(
  modelString: string,
): Promise<LanguageModel> {
  const colonIndex = modelString.indexOf(":");
  if (colonIndex === -1) {
    throw new SyntaxError(
      `Invalid model string format: "${modelString}". ` +
        'Expected format: "provider:model" (e.g. "google:gemini-2.5-flash-lite").',
    );
  }

  const provider = modelString.slice(0, colonIndex) as ProviderName;
  const modelId = modelString.slice(colonIndex + 1);

  if (modelId === "") {
    throw new SyntaxError(
      `Invalid model string format: "${modelString}". ` +
        "Model ID cannot be empty.",
    );
  }

  switch (provider) {
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({});
      return openai(modelId);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({});
      return anthropic(modelId);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({});
      return google(modelId);
    }
    default:
      throw new TypeError(
        `Unsupported provider: "${provider}". ` +
          'Supported providers: "openai", "anthropic", "google".',
      );
  }
}

/**
 * Gets the test model from the TEST_MODEL environment variable.
 *
 * @returns A promise that resolves to the language model instance,
 *          or undefined if TEST_MODEL is not set or empty.
 */
export async function getTestModel(): Promise<LanguageModel | undefined> {
  const modelString = process.env.TEST_MODEL;
  if (modelString == null || modelString === "") {
    return undefined;
  }
  return await createModelFromString(modelString);
}

/**
 * Checks if the TEST_MODEL environment variable is set and non-empty.
 *
 * @returns True if TEST_MODEL is set and non-empty, false otherwise.
 */
export function hasTestModel(): boolean {
  const model = process.env.TEST_MODEL;
  return model != null && model !== "";
}
