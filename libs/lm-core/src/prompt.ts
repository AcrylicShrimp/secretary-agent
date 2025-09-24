/**
 * Renders a prompt with a context.
 *
 * It captures variables in the format of `{{variable}}` and replaces them with
 * the corresponding value in the context.
 *
 * All variables are case-sensitive.
 *
 * @param prompt - The prompt to render.
 * @param context - The context to render the prompt with.
 * @returns The rendered prompt.
 */
export function renderPrompt(prompt: string, context: any): string {
  prompt = prompt.trim();

  if (!isContext(context)) {
    return prompt;
  }

  return prompt
    .replace(/\{\{\s*([a-zA-Z0-9-_]+)\s*\}\}/g, (match, p1: string) => {
      if (p1 in context) {
        if (typeof context[p1] === "object") {
          return JSON.stringify(context[p1]);
        } else {
          return String(context[p1]);
        }
      }

      throw new Error(
        `variable ${p1} not found in context; this might be a critical bug, please match the placeholders in the prompt with the context variables, or remove the placeholders from the prompt`,
      );
    })
    .replace(/\\{/g, "{")
    .replace(/\\}/g, "}");
}

function isContext(context: any): context is Record<string, any> {
  return typeof context === "object" && context !== null;
}
