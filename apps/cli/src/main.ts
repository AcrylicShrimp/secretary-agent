#!/usr/bin/env -S tsx
import { randomUUID } from "crypto";
import { exit } from "process";
import readline from "readline";
import { Observable } from "rxjs";

import { ChatAgent } from "./chat-agent";

function getMultilineInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.setPrompt(prompt);
    rl.prompt();

    rl.on("line", (line) => {
      if (line.trim().endsWith("\\")) {
        lines.push(line.slice(0, -1));
        rl.prompt();
      } else {
        lines.push(line);
        rl.close();
      }
    });

    rl.on("close", () => {
      resolve(lines.join("\n"));
    });

    rl.on("SIGINT", () => {
      process.exit();
    });
  });
}

async function* toAsyncIterator<T>(source: Observable<T>): AsyncGenerator<T> {
  const queue: (T | Error | "COMPLETE")[] = [];
  let resolve: (() => void) | null = null;

  const subscription = source.subscribe({
    next(value) {
      queue.push(value);
      resolve?.();
    },
    error(err) {
      queue.push(err);
      resolve?.();
    },
    complete() {
      queue.push("COMPLETE");
      resolve?.();
    },
  });

  try {
    for (;;) {
      if (queue.length > 0) {
        const value = queue.shift()!;

        if (value === "COMPLETE") {
          break;
        }

        if (value instanceof Error) {
          throw value;
        }

        yield value;
      } else {
        await new Promise<void>((r) => {
          resolve = r;
        });
      }
    }
  } finally {
    subscription.unsubscribe();
  }
}

async function main(): Promise<void> {
  const modelChatApiBase = process.env.MODEL_CHAT_API_BASE;
  const modelChatApiKey = process.env.MODEL_CHAT_API_KEY;
  const modelChatModel = process.env.MODEL_CHAT_MODEL;

  if (modelChatApiBase == null) {
    console.error("[FATAL] you must set the environment variables");
    exit(-1);
  }

  if (modelChatApiKey == null) {
    console.error("[FATAL] you must set the environment variables");
    exit(-1);
  }

  if (modelChatModel == null) {
    console.error("[FATAL] you must set the environment variables");
    exit(-1);
  }

  const chatAgent = new ChatAgent({
    historyPath: "history.json",
    chatModel: {
      apiBase: modelChatApiBase,
      apiKey: modelChatApiKey,
      model: modelChatModel,
    },
  });

  for (;;) {
    let input = "";

    while (input.length === 0) {
      input = await getMultilineInput("> ");
      input = input.trim();
    }

    const [stream] = chatAgent.say({
      id: randomUUID(),
      unixTimestamp: Date.now(),
      role: "user",
      contents: [{ type: "text", text: input }],
    });

    process.stdout.write("\nAssistant: ");

    for await (const chunk of toAsyncIterator(stream)) {
      process.stdout.write(chunk);
    }

    process.stdout.write("\n\n");
  }
}

main().catch(function onMainError(error: unknown): void {
  console.error(error);
  exit(-1);
});
