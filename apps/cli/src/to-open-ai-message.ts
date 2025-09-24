import OpenAI from "openai";

import { Message } from "@secretary-agent/message-storage";

export function toOpenAIMessage(
  message: Message,
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  switch (message.role) {
    case "developer": {
      return {
        role: "developer",
        content: message.contents.map(
          (content) =>
            ({
              type: "text",
              text: content.text,
            }) satisfies OpenAI.Chat.Completions.ChatCompletionContentPartText,
        ),
      } satisfies OpenAI.Chat.Completions.ChatCompletionDeveloperMessageParam;
    }
    case "user": {
      return {
        role: "user",
        content: message.contents.map((content) =>
          content.type === "image"
            ? ({
                type: "image_url",
                image_url: {
                  url: content.url,
                  detail: "auto",
                },
              } satisfies OpenAI.Chat.Completions.ChatCompletionContentPartImage)
            : ({
                type: "text",
                text: content.text,
              } satisfies OpenAI.Chat.Completions.ChatCompletionContentPartText),
        ),
      } satisfies OpenAI.Chat.Completions.ChatCompletionUserMessageParam;
    }
    case "assistant": {
      const toolCalls = message.contents
        .filter((content) => content.type === "tool")
        .map(
          (content) =>
            ({
              id: content.callId,
              type: "function",
              function: {
                name: content.toolName,
                arguments: content.arguments,
              },
            }) satisfies OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
        );
      const isContentEmpty =
        toolCalls.length !== 0 &&
        message.contents.filter(
          (content) => content.type === "text" && content.text.length !== 0,
        ).length === 0;

      return {
        role: "assistant",
        content: isContentEmpty
          ? undefined
          : message.contents
              .filter((content) => content.type === "text")
              .map(
                (content) =>
                  ({
                    type: "text",
                    text: content.text,
                  }) satisfies OpenAI.Chat.Completions.ChatCompletionContentPartText,
              ),
        tool_calls: toolCalls.length === 0 ? undefined : toolCalls,
      } satisfies OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
    }
    case "tool": {
      return {
        role: "tool",
        tool_call_id: message.callId,
        content: message.contents.map(
          (content) =>
            ({
              type: "text",
              text: content.text,
            }) satisfies OpenAI.Chat.Completions.ChatCompletionContentPartText,
        ),
      } satisfies OpenAI.Chat.Completions.ChatCompletionToolMessageParam;
    }
  }
}
