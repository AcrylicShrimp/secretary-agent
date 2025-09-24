import OpenAI from "openai";
import { Stream } from "openai/core/streaming";

import { LlmBackoffStrategy } from "./llm-backoff-strategy";
import { PostGenerationCallback, PreGenerationCallback } from "./llm-callback";

export const DEFAULT_BACKOFF_STRATEGY: LlmBackoffStrategy = {
  maximumAttempts: 5,
  baseDelay: 1000,
  maximumDelay: 5000,
};

export async function createCompletion(
  api: OpenAI,
  body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  options?: OpenAI.RequestOptions,
  backoffStrategy?: LlmBackoffStrategy,
  callback?: PreGenerationCallback,
): Promise<OpenAI.ChatCompletion>;

export async function createCompletion(
  api: OpenAI,
  body: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
  options?: OpenAI.RequestOptions,
  backoffStrategy?: LlmBackoffStrategy,
  callback?: PreGenerationCallback,
): Promise<Stream<OpenAI.ChatCompletionChunk>>;

/**
 * Create a completion.
 *
 * This function will create a completion for the given body and options.
 *
 * It retries the request when the LLM returns a 429 or a 5xx error.
 *
 * @param api - The API to use to create the completion.
 * @param body - The body of the request to the LLM.
 * @param options - The options for the request to the LLM.
 * @param backoffStrategy - The backoff strategy to use for the request to the LLM.
 * @returns The completion.
 */
export async function createCompletion(
  api: OpenAI,
  body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  options?: OpenAI.RequestOptions,
  backoffStrategy?: LlmBackoffStrategy,
  callback?: PreGenerationCallback,
): Promise<OpenAI.ChatCompletion | Stream<OpenAI.ChatCompletionChunk>> {
  const backoffStrategyOrDefault = backoffStrategy ?? DEFAULT_BACKOFF_STRATEGY;

  if (backoffStrategyOrDefault.maximumAttempts < 1) {
    throw new Error("maximumAttempts must be greater than 0");
  }

  for (let i = 1; i <= backoffStrategyOrDefault.maximumAttempts; ++i) {
    try {
      let postGenerationCallback: PostGenerationCallback | null = null;

      if (callback) {
        const result = await callback(
          api,
          body,
          options,
          backoffStrategyOrDefault,
        );

        if (typeof result === "function") {
          postGenerationCallback = result;
        }
      }

      const completion = await api.chat.completions.create(body, options);

      if (postGenerationCallback) {
        await postGenerationCallback(completion);
      }

      return completion;
    } catch (error: unknown) {
      if (
        error instanceof OpenAI.APIError ||
        error instanceof OpenAI.InternalServerError
      ) {
        if (i === backoffStrategyOrDefault.maximumAttempts) {
          throw error;
        }

        const jitter = Math.random() * backoffStrategyOrDefault.baseDelay;
        const delay = Math.min(
          backoffStrategyOrDefault.baseDelay * 2 ** (i - 1) + jitter,
          backoffStrategyOrDefault.maximumDelay,
        );
        let delayWithRetryAfter = delay;

        if (
          error instanceof OpenAI.RateLimitError &&
          error.headers.has("retry-after")
        ) {
          let retryAfter = parseInt(error.headers.get("retry-after")!);

          if (isNaN(retryAfter)) {
            retryAfter =
              (Date.parse(error.headers.get("retry-after")!) - Date.now()) /
              1000;
          }

          if (!isNaN(retryAfter) && 0 < retryAfter) {
            delayWithRetryAfter = Math.max(delay, retryAfter * 1000);
          }
        }

        await new Promise((resolve) =>
          setTimeout(resolve, delayWithRetryAfter),
        );
      } else {
        throw error;
      }
    }
  }

  throw new Error("unreachable");
}
