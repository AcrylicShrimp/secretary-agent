import OpenAI from "openai";
import { Observable, Subject } from "rxjs";

import { createCompletion } from "@secretary-agent/lm-core";
import {
  AssistantMessage,
  InMemoryStorage,
  PersistentStorage,
  UserMessage,
} from "@secretary-agent/message-storage";

import { renderChatAgentPrompt } from "./chat-agent-prompt";
import { toOpenAIMessage } from "./to-open-ai-message";

export interface ModelConfig {
  apiBase: string;
  apiKey: string;
  model: string;
}

export interface ChatAgentConfig {
  historyPath: string;
  chatModel: ModelConfig;
}

export class ChatAgent {
  private readonly workingMemory = new InMemoryStorage();
  private readonly fullMemory: PersistentStorage;
  private readonly chatModel: OpenAI;

  constructor(private readonly config: ChatAgentConfig) {
    this.fullMemory = new PersistentStorage(config.historyPath);
    this.chatModel = new OpenAI({
      apiKey: config.chatModel.apiKey,
      baseURL: config.chatModel.apiBase,
    });
  }

  say(message: UserMessage): [Observable<string>, Promise<AssistantMessage>] {
    const streamingSubject = new Subject<string>();
    const assistantMessagePromise = new Promise<AssistantMessage>(
      async (resolve, reject) => {
        try {
          if (this.workingMemory.length() === 0) {
            const history = await this.fullMemory.get();
            await this.workingMemory.set(history);
          }

          await Promise.all([
            this.workingMemory.append(message),
            this.fullMemory.append(message),
          ]);

          const messages = await this.workingMemory.get();
          const stream = await createCompletion(this.chatModel, {
            model: this.config.chatModel.model,
            messages: [
              {
                role: "developer",
                content: renderChatAgentPrompt(),
              },
              ...messages.map(toOpenAIMessage),
            ],
            temperature: 0.7,
            reasoning_effort: "medium",
            stream: true,
            stream_options: {
              include_usage: true,
            },
          });

          let id: string | undefined;
          let timestamp: Date | undefined;
          const contentParts: string[] = [];

          for await (const chunk of stream) {
            if (!id) {
              id = chunk.id;
            }

            if (!timestamp) {
              timestamp = new Date(chunk.created);
            }

            const choice = chunk.choices[0];

            if (!choice) {
              continue;
            }

            if (choice.delta.content) {
              contentParts.push(choice.delta.content);
              streamingSubject.next(choice.delta.content);
            }
          }

          if (id == null) {
            throw new Error("[FATAL] id is null");
          }

          if (timestamp == null) {
            throw new Error("[FATAL] timestamp is null");
          }

          const assistantMessage: AssistantMessage = {
            id: id,
            unixTimestamp: timestamp.getTime(),
            role: "assistant",
            contents: [{ type: "text", text: contentParts.join("") }],
          };

          await Promise.all([
            this.workingMemory.append(assistantMessage),
            this.fullMemory.append(assistantMessage),
          ]);

          streamingSubject.complete();
          resolve(assistantMessage);
        } catch (error: unknown) {
          reject(error);
          streamingSubject.error(error);
        }
      },
    );

    return [streamingSubject.asObservable(), assistantMessagePromise];
  }
}
