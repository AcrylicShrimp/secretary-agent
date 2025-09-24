import type { Message } from "./message";

export abstract class MessageStorage {
  abstract get(limit?: number): Promise<Message[]>;
  abstract set(messages: Message[]): Promise<void>;
  abstract append(message: Message): Promise<void>;
}
