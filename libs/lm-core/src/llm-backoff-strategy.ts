/**
 * A strategy for retrying a request.
 */
export interface LlmBackoffStrategy {
  /**
   * The maximum number of attempts to make.
   */
  maximumAttempts: number;

  /**
   * The base delay in milliseconds.
   */
  baseDelay: number;

  /**
   * The maximum delay in milliseconds.
   */
  maximumDelay: number;
}
