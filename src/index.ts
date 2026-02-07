import type { Env } from "./env.d";
import { MahoragaMcpAgent } from "./mcp/agent";
import { handleCronEvent } from "./jobs/cron";
import { getHarnessStub } from "./durable-objects/mahoraga-harness";
import { getOpportunitiesStub } from "./durable-objects/opportunities";

export { SessionDO } from "./durable-objects/session";
export { MahoragaMcpAgent };
export { MahoragaHarness } from "./durable-objects/mahoraga-harness";
export { OpportunitiesDO } from "./durable-objects/opportunities";

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorized(request: Request, env: Env): boolean {
  const token = env.MAHORAGA_API_TOKEN;
  if (!token) return false;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return constantTimeCompare(authHeader.slice(7), token);
}

function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized. Requires: Authorization: Bearer <MAHORAGA_API_TOKEN>" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({
          name: "mahoraga",
          version: "0.3.0",
          description: "Autonomous LLM-powered trading agent on Cloudflare Workers",
          endpoints: {
            health: "/health",
            mcp: "/mcp (auth required)",
            agent: "/agent/* (auth required)",
            opportunities: {
              arbitrage: "/api/opportunities/arbitrage",
              income: "/api/opportunities/income",
              status: "/api/opportunities/status",
              refresh: "/api/opportunities/refresh (POST, auth required)",
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname.startsWith("/mcp")) {
      if (!isAuthorized(request, env)) {
        return unauthorizedResponse();
      }
      return MahoragaMcpAgent.mount("/mcp", { binding: "MCP_AGENT" }).fetch(request, env, ctx);
    }

    if (url.pathname.startsWith("/agent")) {
      const stub = getHarnessStub(env);
      const agentPath = url.pathname.replace("/agent", "") || "/status";
      const agentUrl = new URL(agentPath, "http://harness");
      agentUrl.search = url.search;
      return stub.fetch(new Request(agentUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      }));
    }

    // Opportunities API endpoints
    if (url.pathname === "/api/opportunities/arbitrage") {
      const stub = getOpportunitiesStub(env);
      return stub.fetch(new Request("http://opportunities/arbitrage"));
    }

    if (url.pathname === "/api/opportunities/income") {
      const stub = getOpportunitiesStub(env);
      return stub.fetch(new Request("http://opportunities/income"));
    }

    if (url.pathname === "/api/opportunities/refresh") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      if (!isAuthorized(request, env)) {
        return unauthorizedResponse();
      }
      const stub = getOpportunitiesStub(env);
      return stub.fetch(new Request("http://opportunities/refresh", { method: "POST" }));
    }

    if (url.pathname === "/api/opportunities/status") {
      const stub = getOpportunitiesStub(env);
      return stub.fetch(new Request("http://opportunities/status"));
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const cronId = event.cron;
    console.log(`Cron triggered: ${cronId} at ${new Date().toISOString()}`);
    ctx.waitUntil(handleCronEvent(cronId, env));
  },
};
