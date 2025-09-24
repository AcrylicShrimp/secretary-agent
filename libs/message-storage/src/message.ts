import type { ImageContent, TextContent, ToolContent } from "./content";

export type Message =
  | DeveloperMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

export interface MessageBase<R extends string> {
  id: string;
  unixTimestamp: number;
  role: R;
}

export interface DeveloperMessage extends MessageBase<"developer"> {
  contents: Array<TextContent>;
}

export interface UserMessage extends MessageBase<"user"> {
  contents: Array<TextContent | ImageContent>;
}

export interface AssistantMessage extends MessageBase<"assistant"> {
  contents: Array<TextContent | ToolContent>;
}

export interface ToolMessage extends MessageBase<"tool"> {
  callId: string;
  contents: Array<TextContent>;
}
