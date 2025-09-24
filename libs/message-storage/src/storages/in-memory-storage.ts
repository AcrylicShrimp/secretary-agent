import type { Message } from "../message";
import { MessageStorage } from "../message-storage";

export class InMemoryStorage extends MessageStorage {
  private messages: Message[] = [];

  length(): number {
    return this.messages.length;
  }

  async get(limit?: number): Promise<Message[]> {
    return this.messages.slice(
      Math.max(0, this.messages.length - (limit ?? Number.MAX_SAFE_INTEGER)),
    );
  }

  async set(messages: Message[]): Promise<void> {
    this.messages = messages;
  }

  async append(message: Message): Promise<void> {
    this.messages.push(message);
  }
}
