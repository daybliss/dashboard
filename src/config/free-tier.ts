// Free tier protection configuration
// Cloudflare Workers Free Tier Limits:
// - 100,000 requests/day
// - 50 subrequests per request
// - 10ms CPU time per request

export const FREE_TIER_CONFIG = {
  // Caching - aggressive to minimize API calls
  CACHE_TTL_SECONDS: 300, // 5 minutes (was considering 30s, but 5min saves API calls)
  
  // Rate limiting for manual refreshes
  REFRESH_COOLDOWN_SECONDS: 60, // 1 minute between manual refreshes
  
  // API call limits per day (to stay under 100k total)
  MAX_POLYGON_CALLS_PER_DAY: 100, // Whale tracking
  MAX_GAMMA_CALLS_PER_DAY: 1000, // Market data (every 5 min = 288/day)
  
  // Batch size limits
  MAX_MARKETS_PER_FETCH: 50, // Limit markets to stay under subrequest limit
  
  // Feature flags to disable expensive features if needed
  FEATURES: {
    WHALE_TRACKING: true, // Can disable to save API calls
    INCOME_DISPLAY: true,  // Static data, minimal cost
    ARBITRAGE_SCANNER: true, // Main feature
  },
  
  // Fallback mode - serve cached data even if stale
  SERVE_STALE_ON_ERROR: true,
};

// Helper to check if we're within limits
export function checkRateLimit(
  key: string,
  limit: number,
  kv: KVNamespace
): Promise<boolean> {
  // Implementation in DO
  return Promise.resolve(true);
}
