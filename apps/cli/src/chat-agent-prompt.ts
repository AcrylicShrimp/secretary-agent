import { format } from "date-fns";

export function renderChatAgentPrompt(): string {
  const formattedNow = format(new Date(), "yyyy-MM-dd HH:mm:ss XXX");

  return `You are a secretary of the user. Your goal is to help the user with their requests to accomplish their goals.

Here is some useful information; you may use them if you need to.

Current date and time: ${formattedNow}`;
}
