import fs from "fs/promises";
import { dirname } from "path";

import type { Message } from "../message";
import { MessageStorage } from "../message-storage";

export class PersistentStorage extends MessageStorage {
  constructor(private readonly path: string) {
    super();
  }

  async get(limit?: number): Promise<Message[]> {
    try {
      const file = await fs.readFile(this.path, "utf-8");
      const messages = JSON.parse(file) as Message[];
      return messages.slice(
        Math.max(0, messages.length - (limit ?? Number.MAX_SAFE_INTEGER)),
      );
    } catch {
      return [];
    }
  }

  async set(messages: Message[]): Promise<void> {
    await setupDatabase(this.path);
    await fs.writeFile(this.path, JSON.stringify(messages));
  }

  async append(message: Message): Promise<void> {
    const messages = await this.get();
    await setupDatabase(this.path);

    messages.push(message);
    await fs.writeFile(this.path, JSON.stringify(messages));
  }
}

async function setupDatabase(path: string): Promise<void> {
  const pathDir = dirname(path);
  const exists = await fs
    .access(pathDir)
    .then(() => true)
    .catch(() => false);

  if (exists) {
    return;
  }

  await fs.mkdir(pathDir, { recursive: true });
}
