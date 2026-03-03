import { getLogger } from "@logtape/logtape";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { Glossary } from "./glossary.ts";

const logger = getLogger(["vertana", "core", "evaluate"]);

/**
 * Options for {@link TranslationEvaluator}.
 */
export interface EvaluatorOptions {
  /**
   * An optional `AbortSignal` to cancel the evaluation.
   */
  readonly signal?: AbortSignal;
}

/**
 * Options for the {@link evaluate} function.
 */
export interface EvaluateOptions {
  /**
   * The target language of the translation.
   */
  readonly targetLanguage: Intl.Locale | string;

  /**
   * The source language of the original text.
   */
  readonly sourceLanguage?: Intl.Locale | string;

  /**
   * A glossary of terms that should be used consistently.
   */
  readonly glossary?: Glossary;

  /**
   * An optional `AbortSignal` to cancel the evaluation.
   */
  readonly signal?: AbortSignal;
}

/**
 * Evaluates the quality of a translation.
 *
 * @param original The original text that was translated.
 * @param translated The translated text to evaluate.
 * @param options Optional settings for the evaluation.
 * @returns A promise that resolves to the evaluation result.
 */
export type TranslationEvaluator = (
  original: string,
  translated: string,
  options?: EvaluatorOptions,
) => Promise<EvaluationResult>;

/**
 * The result of evaluating a translation.
 */
export interface EvaluationResult {
  /**
   * A quality score between 0 and 1, where 1 indicates a perfect translation
   * and 0 indicates a completely incorrect translation.
   */
  readonly score: number;

  /**
   * Specific issues found in the translation.
   */
  readonly issues: readonly TranslationIssue[];
}

/**
 * The type of issue found in a translation.
 *
 * - `"accuracy"`: The translation does not accurately convey the meaning
 *   of the original text.
 * - `"fluency"`: The translation is not natural or readable in the target
 *   language.
 * - `"terminology"`: Incorrect or inconsistent use of domain-specific terms.
 * - `"style"`: The translation does not match the desired tone or style.
 */
export type TranslationIssueType =
  | "accuracy"
  | "fluency"
  | "terminology"
  | "style";

/**
 * A specific issue found in a translation.
 */
export interface TranslationIssue {
  /**
   * The type of issue.
   */
  readonly type: TranslationIssueType;

  /**
   * A human-readable description of the issue.
   */
  readonly description: string;

  /**
   * The location of the issue in the translated text, if applicable.
   */
  readonly location?: TranslationIssueLocation;
}

/**
 * The location of a translation issue within the translated text.
 */
export interface TranslationIssueLocation {
  /**
   * The starting character index (0-based, inclusive).
   */
  readonly start: number;

  /**
   * The ending character index (0-based, exclusive).
   */
  readonly end: number;
}

const issueTypeSchema = z.enum(["accuracy", "fluency", "terminology", "style"]);

const issueSchema = z.object({
  type: issueTypeSchema,
  description: z.string(),
  location: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
});

const evaluationResultSchema = z.object({
  score: z.number(),
  issues: z.array(issueSchema),
});

/**
 * Gets the language name from a locale.
 */
function getLanguageName(locale: Intl.Locale | string): string {
  const tag = typeof locale === "string" ? locale : locale.baseName;
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    return displayNames.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/**
 * Builds the system prompt for evaluation.
 */
function buildEvaluationSystemPrompt(options: EvaluateOptions): string {
  const targetLang = getLanguageName(options.targetLanguage);
  const sourceLang = options.sourceLanguage
    ? getLanguageName(options.sourceLanguage)
    : null;

  let prompt = `You are an expert translation quality evaluator.

Your task is to evaluate the quality of a translation from ${
    sourceLang ?? "the source language"
  } to ${targetLang}.

Evaluate the translation based on these criteria:

1. **Accuracy**: Does the translation accurately convey the meaning of the original text?
2. **Fluency**: Is the translation natural and readable in ${targetLang}?
3. **Terminology**: Are domain-specific terms translated correctly and consistently?
4. **Style**: Does the translation maintain the appropriate tone and style?

Provide:
- A score from 0 to 1 (where 1 is perfect, 0.9+ is excellent, 0.7-0.9 is good, 0.5-0.7 is acceptable, below 0.5 is poor)
- A list of specific issues found, if any

Be strict but fair in your evaluation. Minor issues should result in small deductions, while major meaning errors should significantly lower the score.`;

  if (options.glossary != null && options.glossary.length > 0) {
    prompt += `\n\n## Glossary

The following terms MUST be translated as specified. Violations should be marked as "terminology" issues:

`;
    for (const entry of options.glossary) {
      prompt += `- "${entry.original}" → "${entry.translated}"\n`;
    }
  }

  return prompt;
}

/**
 * Builds the user prompt for evaluation.
 */
function buildEvaluationUserPrompt(
  original: string,
  translated: string,
): string {
  return `## Original Text

${original}

## Translated Text

${translated}

Please evaluate this translation.`;
}

/**
 * Evaluates the quality of a translation using an LLM.
 *
 * @param model The language model to use for evaluation.
 * @param original The original text that was translated.
 * @param translated The translated text to evaluate.
 * @param options Evaluation options including target language.
 * @returns A promise that resolves to the evaluation result.
 */
export async function evaluate(
  model: LanguageModel,
  original: string,
  translated: string,
  options: EvaluateOptions,
): Promise<EvaluationResult> {
  logger.debug("Evaluating translation quality...");

  const systemPrompt = buildEvaluationSystemPrompt(options);
  const userPrompt = buildEvaluationUserPrompt(original, translated);

  const result = await generateObject({
    model,
    schema: evaluationResultSchema,
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: options.signal,
  });

  // Convert to the expected type
  const issues: readonly TranslationIssue[] = result.object.issues.map(
    (issue: z.infer<typeof issueSchema>) => ({
      type: issue.type as TranslationIssueType,
      description: issue.description,
      location: issue.location,
    }),
  );
  const score = Math.max(0, Math.min(1, result.object.score));

  logger.debug("Evaluation result: score {score}, {issueCount} issue(s).", {
    score,
    issueCount: issues.length,
  });

  return {
    score,
    issues,
  };
}
