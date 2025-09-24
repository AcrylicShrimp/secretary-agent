import OpenAI from "openai";
import { Stream } from "openai/core/streaming";

import { LlmBackoffStrategy } from "./llm-backoff-strategy";

export type PreGenerationCallback = (
  api: OpenAI,
  body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  options: OpenAI.RequestOptions | undefined,
  backoffStrategy: LlmBackoffStrategy,
) => void | PostGenerationCallback | Promise<void | PostGenerationCallback>;

export type PostGenerationCallback = (
  completion: (
    | OpenAI.Chat.Completions.ChatCompletion
    | Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
  ) & {
    _request_id?: string | null;
  },
) => void | Promise<void>;
