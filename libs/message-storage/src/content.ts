export interface ContentBase<T extends string> {
  type: T;
}

export interface TextContent extends ContentBase<"text"> {
  text: string;
}

export interface ImageContent extends ContentBase<"image"> {
  url: string;
}

export interface ToolContent extends ContentBase<"tool"> {
  callId: string;
  toolName: string;
  arguments: string;
}
