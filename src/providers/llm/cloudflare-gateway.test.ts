import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudflareGatewayProvider } from "./cloudflare-gateway";

describe("CloudflareGatewayProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes model prefixes for Cloudflare /compat", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      expect(body.model).toBe("google-ai-studio/gemini-2.5-pro");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
        { status: 200 }
      );
    });
    globalThis.fetch = fetchMock as any;

    const provider = new CloudflareGatewayProvider({
      accountId: "acc",
      gatewayId: "gw",
      token: "tok",
      model: "openai/gpt-4o-mini",
    });

    await provider.complete({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("maps xai/* to grok/* and workersai/* to workers-ai/*", async () => {
    const seen: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      if (body.model) seen.push(body.model);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
        { status: 200 }
      );
    });
    globalThis.fetch = fetchMock as any;

    const provider = new CloudflareGatewayProvider({
      accountId: "acc",
      gatewayId: "gw",
      token: "tok",
    });

    await provider.complete({
      model: "xai/grok-4.1-fast-reasoning",
      messages: [{ role: "user", content: "hi" }],
    });

    await provider.complete({
      model: "workersai/@cf/meta/llama-3.1-8b-instruct",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(seen).toEqual([
      "grok/grok-4.1-fast-reasoning",
      "workers-ai/@cf/meta/llama-3.1-8b-instruct",
    ]);
  });

  it("normalizes anthropic version dots to hyphens (e.g. -4.5 -> -4-5)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      expect(body.model).toBe("anthropic/claude-sonnet-4-5");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
        { status: 200 }
      );
    });
    globalThis.fetch = fetchMock as any;

    const provider = new CloudflareGatewayProvider({
      accountId: "acc",
      gatewayId: "gw",
      token: "tok",
    });

    await provider.complete({
      model: "anthropic/claude-sonnet-4.5",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("sends cf-aig-authorization header and parses response", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://gateway.ai.cloudflare.com/v1/acc/gw/compat/chat/completions");
      expect((init?.headers as Record<string, string>)["cf-aig-authorization"]).toBe("Bearer tok");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "hello" } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
        { status: 200 }
      );
    });
    globalThis.fetch = fetchMock as any;

    const provider = new CloudflareGatewayProvider({
      accountId: "acc",
      gatewayId: "gw",
      token: "tok",
    });

    const result = await provider.complete({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.1,
      max_tokens: 5,
    });

    expect(result.content).toBe("hello");
    expect(result.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    });
  });

  it("throws provider error on non-OK responses", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("nope", { status: 401 });
    });
    globalThis.fetch = fetchMock as any;

    const provider = new CloudflareGatewayProvider({
      accountId: "acc",
      gatewayId: "gw",
      token: "tok",
    });

    await expect(
      provider.complete({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });
});
