/**
 * An error that occurs when the LLM fails to generate a valid output.
 *
 * Throw this type of error inside of the {@link TextHandler} or {@link ToolHandler}
 * to indicate that the LLM has failed to generate a valid output and the request
 * should be retried.
 */
export class LlmFailure extends Error {
  constructor(message: string) {
    super(message);
  }

  getMessage(): string {
    return this.message;
  }
}

/**
 * An error that occurs when the LLM fails to generate any valid output, even after a few retries.
 *
 * You should review and edit the prompt if this error occurs.
 */
export class LlmUnrecoverableError extends Error {
  constructor(message: string) {
    super(message);
  }

  getMessage(): string {
    return this.message;
  }
}
