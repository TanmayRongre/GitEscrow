/**
 * GitEscrow - Task 4C.1: Centralized Groq AI Provider
 *
 * Provides a resilient, rate-limit-aware HTTP client for Groq's OpenAI-compatible API.
 * Features:
 *   - Configurable API key, model (default: openai/gpt-oss-120b), and base URL
 *   - Strict JSON Schema / json_object output formatting
 *   - Request timeout with AbortController
 *   - Exponential backoff retry for transient network/server errors
 *   - Intelligent HTTP 429 rate-limit and quota exhaustion handling
 *   - Credential redaction in error reporting and logging
 *   - Token usage metadata extraction
 */

export interface GroqProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  temperature?: number;
  responseFormat?: { type: "json_object" };
  maxTokens?: number;
}

export interface GroqTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GroqRateLimitInfo {
  remainingRequests?: number;
  remainingTokens?: number;
  resetRequests?: string;
  resetTokens?: string;
  retryAfterSec?: number;
}

export interface GroqChatCompletionResult {
  content: string;
  model: string;
  usage?: GroqTokenUsage;
  rateLimit?: GroqRateLimitInfo;
}

export class GroqError extends Error {
  public readonly statusCode?: number;
  public readonly isRateLimit: boolean;
  public readonly isQuotaExhausted: boolean;
  public readonly isTransient: boolean;
  public readonly retryAfterSec?: number;
  public readonly code?: string;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      isRateLimit?: boolean;
      isQuotaExhausted?: boolean;
      isTransient?: boolean;
      retryAfterSec?: number;
      code?: string;
    },
  ) {
    super(GroqError.sanitizeMessage(message));
    this.name = "GroqError";
    this.statusCode = options?.statusCode;
    this.isRateLimit = options?.isRateLimit || false;
    this.isQuotaExhausted = options?.isQuotaExhausted || false;
    this.isTransient = options?.isTransient || false;
    this.retryAfterSec = options?.retryAfterSec;
    this.code = options?.code;
  }

  /**
   * Redacts potential API keys (gsk_...) or authorization headers from error messages
   */
  public static sanitizeMessage(raw: string): string {
    return raw
      .replace(/gsk_[a-zA-Z0-9_-]{20,}/g, "gsk_***[REDACTED]")
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, "Bearer [REDACTED]");
  }
}

export class GroqProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config?: GroqProviderConfig) {
    this.apiKey =
      config?.apiKey !== undefined
        ? config.apiKey.trim() || undefined
        : process.env.GROQ_API_KEY?.trim() || undefined;

    this.model =
      config?.model?.trim() ||
      process.env.GROQ_MODEL?.trim() ||
      "openai/gpt-oss-120b";

    this.baseUrl =
      config?.baseUrl?.trim() ||
      process.env.GROQ_BASE_URL?.trim() ||
      "https://api.groq.com/openai/v1";

    this.timeoutMs = config?.timeoutMs ?? 25000;
    this.maxRetries = config?.maxRetries ?? 2;
  }

  /**
   * Check if the provider has an active API key configured
   */
  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  /**
   * Returns current active model identifier
   */
  public getModel(): string {
    return this.model;
  }

  /**
   * Execute chat completion against Groq API with retries and rate limit handling
   */
  public async chatCompletion(
    messages: GroqChatMessage[],
    options?: GroqChatOptions,
  ): Promise<GroqChatCompletionResult> {
    if (!this.apiKey) {
      throw new GroqError("GROQ_API_KEY is not configured.", {
        statusCode: 401,
        code: "GROQ_KEY_MISSING",
      });
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const payload = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.1,
      response_format: options?.responseFormat ?? { type: "json_object" },
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        // Extract rate limit headers safely
        const rateLimit: GroqRateLimitInfo = {
          remainingRequests: this.parseHeaderInt(
            response.headers.get("x-ratelimit-remaining-requests"),
          ),
          remainingTokens: this.parseHeaderInt(
            response.headers.get("x-ratelimit-remaining-tokens"),
          ),
          resetRequests:
            response.headers.get("x-ratelimit-reset-requests") || undefined,
          resetTokens:
            response.headers.get("x-ratelimit-reset-tokens") || undefined,
        };

        const retryAfterHeader = response.headers.get("retry-after");
        if (retryAfterHeader) {
          rateLimit.retryAfterSec = parseInt(retryAfterHeader, 10) || undefined;
        }

        if (!response.ok) {
          const rawErrorBody = await response.text();
          let parsedError: any;
          try {
            parsedError = JSON.parse(rawErrorBody);
          } catch {
            parsedError = { error: { message: rawErrorBody } };
          }

          const errorMsg =
            parsedError?.error?.message ||
            response.statusText ||
            `HTTP ${response.status}`;
          const isQuota =
            errorMsg.toLowerCase().includes("quota") ||
            errorMsg.toLowerCase().includes("billing") ||
            parsedError?.error?.code === "insufficient_quota";

          const isRateLimit = response.status === 429;
          const isTransient = [408, 500, 502, 503, 504].includes(
            response.status,
          );

          const groqErr = new GroqError(
            `Groq API error (${response.status}): ${errorMsg}`,
            {
              statusCode: response.status,
              isRateLimit,
              isQuotaExhausted: isQuota,
              isTransient,
              retryAfterSec: rateLimit.retryAfterSec,
              code: parsedError?.error?.code || parsedError?.error?.type,
            },
          );

          // Quota exhaustion: do NOT burn retries, throw immediately
          if (isQuota) {
            throw groqErr;
          }

          // Rate limit with short Retry-After: wait and retry if attempt remaining
          if (isRateLimit) {
            if (
              rateLimit.retryAfterSec &&
              rateLimit.retryAfterSec <= 5 &&
              attempt <= this.maxRetries
            ) {
              await this.delay(rateLimit.retryAfterSec * 1000);
              continue;
            }
            throw groqErr;
          }

          // Transient server error: retry with exponential backoff
          if (isTransient && attempt <= this.maxRetries) {
            lastError = groqErr;
            const backoffMs = Math.min(
              1000 * Math.pow(2, attempt) + Math.random() * 400,
              8000,
            );
            await this.delay(backoffMs);
            continue;
          }

          throw groqErr;
        }

        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new GroqError(
            "Groq returned an empty or malformed completion content.",
            {
              code: "EMPTY_COMPLETION",
            },
          );
        }

        const usage: GroqTokenUsage | undefined = data?.usage
          ? {
              promptTokens: Number(data.usage.prompt_tokens || 0),
              completionTokens: Number(data.usage.completion_tokens || 0),
              totalTokens: Number(data.usage.total_tokens || 0),
            }
          : undefined;

        return {
          content,
          model: data.model || this.model,
          usage,
          rateLimit,
        };
      } catch (err: any) {
        if (err.name === "AbortError") {
          const timeoutErr = new GroqError(
            `Groq request timed out after ${this.timeoutMs}ms`,
            {
              statusCode: 408,
              isTransient: true,
              code: "REQUEST_TIMEOUT",
            },
          );
          if (attempt <= this.maxRetries) {
            lastError = timeoutErr;
            await this.delay(1000 * attempt);
            continue;
          }
          throw timeoutErr;
        }

        // If it's already a non-retryable GroqError (e.g. 401, quota, or 429 without quick reset)
        if (
          err instanceof GroqError &&
          (!err.isTransient || err.isQuotaExhausted)
        ) {
          throw err;
        }

        lastError = err;
        if (attempt <= this.maxRetries) {
          const backoffMs = Math.min(
            1000 * Math.pow(2, attempt) + Math.random() * 400,
            8000,
          );
          await this.delay(backoffMs);
          continue;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw (
      lastError ||
      new GroqError("Groq request failed after all retry attempts.", {
        isTransient: true,
      })
    );
  }

  private parseHeaderInt(val: string | null): number | undefined {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) ? undefined : num;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
