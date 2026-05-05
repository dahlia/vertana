import type { LanguageModel } from "ai";
import type { ValueParser, ValueParserResult } from "@optique/core/valueparser";
import {
  commandLine,
  type Message,
  message,
  metavar,
  text,
} from "@optique/core/message";
import {
  getApiKey,
  isProviderName,
  type ProviderName,
  providerNames,
} from "./config/index.ts";

/**
 * Parsed model code information.
 */
export interface ParsedModelCode {
  /**
   * The provider name.
   */
  readonly provider: ProviderName;

  /**
   * The model ID.
   */
  readonly modelId: string;
}

/**
 * Parses a model code into provider and model ID.
 *
 * @param code The model code in "provider:model" format.
 * @returns The parsed provider and model ID.
 * @throws {SyntaxError} If the model code format is invalid.
 * @throws {TypeError} If the provider is not supported.
 *
 * @example
 * ```typescript
 * const { provider, modelId } = parseModelCode("openai:gpt-4o");
 * // provider === "openai", modelId === "gpt-4o"
 * ```
 */
export function parseModelCode(code: string): ParsedModelCode {
  const colonIndex = code.indexOf(":");
  if (colonIndex === -1) {
    throw new SyntaxError(
      `Invalid model code format: "${code}". ` +
        'Expected format: "provider:model" (e.g., "openai:gpt-4o").',
    );
  }

  const provider = code.slice(0, colonIndex);
  const modelId = code.slice(colonIndex + 1);

  if (modelId === "") {
    throw new SyntaxError(
      `Invalid model code format: "${code}". ` +
        "Model ID cannot be empty.",
    );
  }

  if (!isProviderName(provider)) {
    throw new TypeError(
      `Unsupported provider: "${provider}". ` +
        `Supported providers: ${
          providerNames.map((p) => `"${p}"`).join(", ")
        }.`,
    );
  }

  return { provider, modelId };
}

/**
 * Creates a ValueParser for model codes.
 * Model codes are in the format "provider:model" (e.g., "openai:gpt-4o").
 *
 * @returns A ValueParser for model codes.
 */
export function modelCode(): ValueParser<"sync", ParsedModelCode> {
  return {
    mode: "sync",
    metavar: "PROVIDER:MODEL",
    placeholder: { provider: "openai", modelId: "model" },
    parse(input: string): ValueParserResult<ParsedModelCode> {
      const colonIndex = input.indexOf(":");
      if (colonIndex === -1) {
        return {
          success: false,
          error: message`Invalid model code format. Expected ${
            metavar("PROVIDER")
          }${text(":")}${metavar("MODEL")} (e.g., ${
            commandLine("openai:gpt-4o")
          }).`,
        };
      }

      const provider = input.slice(0, colonIndex);
      const modelId = input.slice(colonIndex + 1);

      if (modelId === "") {
        return {
          success: false,
          error: message`${metavar("MODEL")} cannot be empty.`,
        };
      }

      if (!isProviderName(provider)) {
        let providerList: Message = [];
        for (let i = 0; i < providerNames.length; i++) {
          if (i > 0) {
            providerList = [...providerList, ...message`, `];
          }
          providerList = [...providerList, ...message`${providerNames[i]}`];
        }
        return {
          success: false,
          error:
            message`Unsupported provider: ${provider}. Supported providers: ${providerList}.`,
        };
      }

      return {
        success: true,
        value: { provider, modelId },
      };
    },
    format(value: ParsedModelCode): string {
      return `${value.provider}:${value.modelId}`;
    },
  };
}

/**
 * Creates a language model from a model code.
 * Uses the API key from the keyring or environment variables.
 *
 * @param code The model code (e.g., "openai:gpt-4o").
 * @returns The language model instance.
 * @throws {SyntaxError} If the model code format is invalid.
 * @throws {TypeError} If the provider is not supported.
 * @throws {Error} If the API key is not configured.
 *
 * @example
 * ```typescript
 * const model = await createModel("openai:gpt-4o");
 * ```
 */
export async function createModel(code: string): Promise<LanguageModel> {
  const { provider, modelId } = parseModelCode(code);
  const apiKey = getApiKey(provider);

  if (apiKey == null) {
    throw new Error(
      `API key not configured for provider "${provider}". ` +
        `Run "vertana config api-key ${provider} <key>" to set it.`,
    );
  }

  switch (provider) {
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
  }
}
