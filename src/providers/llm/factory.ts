import type { Env } from "../../env.d";
import type { LLMProvider } from "../types";
import { createOpenAIProvider } from "./openai";
import { createAISDKProvider, SUPPORTED_PROVIDERS, type SupportedProvider } from "./ai-sdk";
import { createVercelGatewayProvider } from "./vercel-gateway";

export type LLMProviderType = "openai-raw" | "ai-sdk" | "vercel-gateway";

/**
 * Factory function to create LLM provider based on environment configuration.
 * 
 * Provider selection (via LLM_PROVIDER env):
 * - "openai-raw": Direct OpenAI API calls (default, backward compatible)
 * - "ai-sdk": Vercel AI SDK with 5 providers (OpenAI, Anthropic, Google, xAI, DeepSeek)
 * - "vercel-gateway": Vercel AI Gateway for unified access
 * 
 * @param env - Environment variables
 * @returns LLMProvider instance or null if no valid configuration
 */
export function createLLMProvider(env: Env): LLMProvider | null {
  const providerType = (env.LLM_PROVIDER as LLMProviderType) ?? "openai-raw";
  const model = env.LLM_MODEL ?? "gpt-4o-mini";

  switch (providerType) {
    case "vercel-gateway":
      if (!env.AI_GATEWAY_API_KEY) {
        console.warn("LLM_PROVIDER=vercel-gateway requires AI_GATEWAY_API_KEY");
        return null;
      }
      return createVercelGatewayProvider({
        apiKey: env.AI_GATEWAY_API_KEY,
        model,
      });

    case "ai-sdk": {
      // Collect all available API keys
      const apiKeys: Partial<Record<SupportedProvider, string>> = {};
      if (env.OPENAI_API_KEY) apiKeys.openai = env.OPENAI_API_KEY;
      if (env.ANTHROPIC_API_KEY) apiKeys.anthropic = env.ANTHROPIC_API_KEY;
      if (env.GOOGLE_GENERATIVE_AI_API_KEY) apiKeys.google = env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (env.XAI_API_KEY) apiKeys.xai = env.XAI_API_KEY;
      if (env.DEEPSEEK_API_KEY) apiKeys.deepseek = env.DEEPSEEK_API_KEY;

      if (Object.keys(apiKeys).length === 0) {
        console.warn("LLM_PROVIDER=ai-sdk requires at least one provider API key");
        return null;
      }

      // Check if the selected model's provider has an API key
      const [providerName] = model.split("/");
      const provider = providerName?.toLowerCase() as SupportedProvider;
      if (providerName && provider in SUPPORTED_PROVIDERS && !apiKeys[provider]) {
        console.warn(`Model '${model}' requires ${SUPPORTED_PROVIDERS[provider].envKey}`);
        return null;
      }

      return createAISDKProvider({ model, apiKeys });
    }

    case "openai-raw":
    default:
      // Backward compatible: use existing OpenAI provider
      if (!env.OPENAI_API_KEY) {
        return null;
      }
      return createOpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        model: model.includes("/") ? model.split("/")[1] : model,
      });
  }
}

/**
 * Check if LLM features are available based on environment configuration.
 */
export function isLLMConfigured(env: Env): boolean {
  const providerType = (env.LLM_PROVIDER as LLMProviderType) ?? "openai-raw";

  switch (providerType) {
    case "vercel-gateway":
      return !!env.AI_GATEWAY_API_KEY;
    case "ai-sdk":
      // Any provider API key enables AI SDK
      return !!(
        env.OPENAI_API_KEY ||
        env.ANTHROPIC_API_KEY ||
        env.GOOGLE_GENERATIVE_AI_API_KEY ||
        env.XAI_API_KEY ||
        env.DEEPSEEK_API_KEY
      );
    case "openai-raw":
    default:
      return !!env.OPENAI_API_KEY;
  }
}

/**
 * Get list of configured providers based on available API keys
 */
export function getConfiguredProviders(env: Env): SupportedProvider[] {
  const configured: SupportedProvider[] = [];
  if (env.OPENAI_API_KEY) configured.push("openai");
  if (env.ANTHROPIC_API_KEY) configured.push("anthropic");
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) configured.push("google");
  if (env.XAI_API_KEY) configured.push("xai");
  if (env.DEEPSEEK_API_KEY) configured.push("deepseek");
  return configured;
}
