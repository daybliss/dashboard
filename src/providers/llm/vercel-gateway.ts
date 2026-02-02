import { generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { createError, ErrorCode } from "../../lib/errors";
import type { LLMProvider, CompletionParams, CompletionResult } from "../types";

export interface VercelGatewayConfig {
  /** Vercel AI Gateway API key */
  apiKey: string;
  /** Default model in format "provider/model" (e.g., "openai/gpt-4o", "anthropic/claude-sonnet-4") */
  model?: string;
}

/**
 * Vercel AI Gateway Provider - Unified access to multiple AI providers
 * 
 * Uses Vercel's AI Gateway for pricing management and provider routing.
 * Single API key provides access to all supported providers.
 * 
 * Features:
 * - Unified billing through Vercel
 * - Automatic model fallbacks
 * - Provider routing options
 */
export class VercelGatewayProvider implements LLMProvider {
  private gateway: ReturnType<typeof createGateway>;
  private model: string;

  constructor(config: VercelGatewayConfig) {
    if (!config.apiKey) {
      throw createError(ErrorCode.INVALID_INPUT, "AI_GATEWAY_API_KEY required for Vercel Gateway");
    }

    this.gateway = createGateway({ apiKey: config.apiKey });
    this.model = config.model ?? "openai/gpt-4o-mini";
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    try {
      const modelToUse = params.model ?? this.model;

      const result = await generateText({
        model: this.gateway(modelToUse),
        messages: params.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.max_tokens ?? 1024,
      });

      return {
        content: result.text,
        usage: {
          prompt_tokens: result.usage?.inputTokens ?? 0,
          completion_tokens: result.usage?.outputTokens ?? 0,
          total_tokens: result.usage?.totalTokens ?? 0,
        },
      };
    } catch (error) {
      throw createError(
        ErrorCode.PROVIDER_ERROR,
        `Vercel Gateway error: ${String(error)}`
      );
    }
  }
}

export function createVercelGatewayProvider(config: VercelGatewayConfig): VercelGatewayProvider {
  return new VercelGatewayProvider(config);
}
