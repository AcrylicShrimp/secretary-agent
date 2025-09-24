import OpenAI from "openai";

import { LlmFailure, LlmUnrecoverableError } from "./errors";
import { LlmBackoffStrategy } from "./llm-backoff-strategy";
import { PreGenerationCallback } from "./llm-callback";
import { createCompletion } from "./llm-create-completion";

/**
 * A handler for text.
 *
 * This type is used to simplify the process of handling text.
 */
export type TextHandler<I, O> = (input: I, text: string) => O | Promise<O>;

/**
 * A handler for tool calls.
 *
 * This type is used to simplify the process of handling tool calls.
 */
export type ToolHandler<I, O> = (
  input: I,
  toolCallId: string,
  toolName: string,
  toolInput: unknown,
) => O | Promise<O>;

/**
 * A proxy for an LLM.
 *
 * This class simplifies the process of calling an LLM by providing a way to
 * handle text and tool calls. It automatically retries the request when the LLM
 * fails to generate a valid output.
 */
export class LlmProxy<I, O> {
  private textHandler: TextHandler<I, O> | undefined;
  private readonly toolHandlers: Map<string, ToolHandler<I, O>> = new Map();
  private errorCallback: ((error: LlmFailure) => void) | undefined;
  private preGenerationCallback: PreGenerationCallback | undefined;

  /**
   * Set the text handler.
   *
   * The text handler is called when the LLM generates text.
   *
   * @param handler - The text handler.
   * @returns The proxy itself.
   */
  withTextHandler(handler: TextHandler<I, O>): this {
    this.textHandler = handler;
    return this;
  }

  /**
   * Set the tool handler.
   *
   * The tool handler is called when the LLM generates a tool call.
   *
   * @param name - The name of the tool.
   * @param handler - The tool handler.
   * @returns The proxy itself.
   */
  withToolHandler(name: string, handler: ToolHandler<I, O>): this {
    this.toolHandlers.set(name, handler);
    return this;
  }

  withErrorCallback(callback: (error: LlmFailure) => void): this {
    this.errorCallback = callback;
    return this;
  }

  withPreGenerationCallback(callback: PreGenerationCallback): this {
    this.preGenerationCallback = callback;
    return this;
  }

  /**
   * Call the LLM without streaming.
   *
   * This method will call the LLM with the given body and options.
   *
   * @param input - The input to the LLM.
   * @param api - The API to use to call the LLM.
   * @param body - The body of the request to the LLM.
   * @param options - The options for the request to the LLM.
   * @param backoffStrategy - The backoff strategy to use for the request to the LLM.
   * @returns The output of the LLM.
   */
  async call(
    input: I,
    api: OpenAI,
    body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAI.RequestOptions,
    backoffStrategy?: LlmBackoffStrategy,
  ): Promise<O[]> {
    interface ILastFailure {
      llmOutput: OpenAI.ChatCompletion;
      llmFailure: string;
    }

    let lastFailure: ILastFailure | null = null;
    const MAXIMUM_RETRIES = 5;

    outer: for (let i = 1; i <= MAXIMUM_RETRIES; ++i) {
      const mergedBody = {
        ...body,
        messages: [...body.messages],
      };

      if (lastFailure != null) {
        const lastMessage = lastFailure.llmOutput.choices[0]!.message;
        mergedBody.messages.push(lastMessage);

        if (lastMessage.tool_calls && lastMessage.tool_calls.length !== 0) {
          for (const toolCall of lastMessage.tool_calls) {
            mergedBody.messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: lastFailure.llmFailure,
            });
          }
        } else {
          mergedBody.messages.push({
            role: "user",
            content: lastFailure.llmFailure,
          });
        }
      }

      const completion = await createCompletion(
        api,
        mergedBody,
        options,
        backoffStrategy,
        this.preGenerationCallback,
      );

      const outputs: O[] = [];
      const content = completion.choices[0]!.message.content;

      if (content != null && content.trim().length !== 0) {
        if (this.textHandler == null) {
          lastFailure = {
            llmOutput: completion,
            llmFailure:
              "you should trigger tools instead of generating text; try again",
          };
          continue;
        }

        try {
          outputs.push(await this.textHandler(input, content));
        } catch (error: unknown) {
          if (error instanceof LlmFailure) {
            if (this.errorCallback != null) {
              this.errorCallback(error);
            }

            lastFailure = {
              llmOutput: completion,
              llmFailure: error.getMessage(),
            };
            continue;
          }

          throw error;
        }
      }

      const toolCalls = completion.choices[0]?.message.tool_calls?.filter(
        (toolCall) => toolCall.type === "function",
      );

      if (toolCalls != null) {
        for (const toolCall of toolCalls) {
          const handler = this.toolHandlers.get(toolCall.function.name);

          if (handler == null) {
            const toolNames = Array.from(this.toolHandlers.keys()).join(", ");
            const message = `tool ${toolCall.function.name} not found; available tools are: ${toolNames}`;
            lastFailure = {
              llmOutput: completion,
              llmFailure: message,
            };
            continue outer;
          }

          let args: unknown;

          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (error: unknown) {
            if (error instanceof SyntaxError) {
              lastFailure = {
                llmOutput: completion,
                llmFailure: `you've generated invalid JSON: "${error.message}"; try again`,
              };
              continue outer;
            }

            throw error;
          }

          try {
            outputs.push(
              await handler(input, toolCall.id, toolCall.function.name, args),
            );
          } catch (error: unknown) {
            if (error instanceof LlmFailure) {
              if (this.errorCallback != null) {
                this.errorCallback(error);
              }

              lastFailure = {
                llmOutput: completion,
                llmFailure: error.getMessage(),
              };
              continue outer;
            }

            throw error;
          }
        }
      }

      return outputs;
    }

    throw new LlmUnrecoverableError(
      `failed to generate output, despite maximum retries(=${MAXIMUM_RETRIES}); last failure: ${JSON.stringify(lastFailure, null, 2)}`,
    );
  }
}
