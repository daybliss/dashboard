⚠️ **Warning:** This software is provided for educational and informational purposes only. Nothing in this repository constitutes financial, investment, legal, or tax advice.

# MAHORAGA

An autonomous, LLM-powered trading agent that runs 24/7 on Cloudflare Workers.

[![Discord](https://img.shields.io/discord/1467592472158015553?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/Ys8KpsW5NN)

MAHORAGA monitors social sentiment from StockTwits and Reddit, uses OpenAI to analyze signals, and executes trades through Alpaca. It runs as a Cloudflare Durable Object with persistent state, automatic restarts, and 24/7 crypto trading support.

<img width="1278" height="957" alt="dashboard" src="https://github.com/user-attachments/assets/56473ab6-e2c6-45fc-9e32-cf85e69f1a2d" />

## Features

- **24/7 Operation** — Runs on Cloudflare Workers, no local machine required
- **Multi-Source Signals** — StockTwits, Reddit (4 subreddits), Twitter confirmation
- **LLM-Powered Analysis** — OpenAI evaluates signals and makes trading decisions
- **Crypto Trading** — Trade BTC, ETH, SOL around the clock
- **Options Support** — High-conviction options plays
- **Staleness Detection** — Auto-exit positions that lose momentum
- **Pre-Market Analysis** — Prepare trading plans before market open
- **Discord Notifications** — Get alerts on BUY signals
- **Fully Customizable** — Well-documented with `[TUNE]` and `[CUSTOMIZABLE]` markers

## Requirements

- Node.js 18+
- Cloudflare account (free tier works)
- Alpaca account (free, paper trading supported)
- OpenAI API key

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/ygwyg/MAHORAGA.git
cd mahoraga
npm install
```

### 2. Create Cloudflare resources

```bash
# Create D1 database
npx wrangler d1 create mahoraga-db
# Copy the database_id to wrangler.jsonc

# Create KV namespace
npx wrangler kv namespace create CACHE
# Copy the id to wrangler.jsonc

# Run migrations
npx wrangler d1 migrations apply mahoraga-db
```

### 3. Set secrets

```bash
# Required
npx wrangler secret put ALPACA_API_KEY
npx wrangler secret put ALPACA_API_SECRET
npx wrangler secret put OPENAI_API_KEY

# API Authentication - generate a secure random token (64+ chars recommended)
# Example: openssl rand -base64 48
npx wrangler secret put MAHORAGA_API_TOKEN

# Optional
npx wrangler secret put ALPACA_PAPER         # "true" for paper trading (recommended)
npx wrangler secret put TWITTER_BEARER_TOKEN
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put KILL_SWITCH_SECRET   # Emergency kill switch (separate from API token)
```

### 4. Deploy

```bash
npx wrangler deploy
```

### 5. Enable the agent

All API endpoints require authentication via Bearer token:

```bash
# Set your API token as an env var for convenience
export MAHORAGA_TOKEN="your-api-token"

# Enable the agent
curl -H "Authorization: Bearer $MAHORAGA_TOKEN" \
  https://your-worker.workers.dev/agent/enable
```

### 6. Monitor

```bash
# Check status
curl -H "Authorization: Bearer $MAHORAGA_TOKEN" \
  https://your-worker.workers.dev/agent/status

# View logs
curl -H "Authorization: Bearer $MAHORAGA_TOKEN" \
  https://your-worker.workers.dev/agent/logs

# Emergency kill switch (uses separate KILL_SWITCH_SECRET)
curl -H "Authorization: Bearer $KILL_SWITCH_SECRET" \
  https://your-worker.workers.dev/agent/kill

# Run dashboard locally
cd dashboard && npm install && npm run dev
```

## Local Development

```bash
# Terminal 1 - Start wrangler
npx wrangler dev

# Terminal 2 - Start dashboard  
cd dashboard && npm run dev

# Terminal 3 - Enable the agent
curl -H "Authorization: Bearer $MAHORAGA_TOKEN" \
  http://localhost:8787/agent/enable
```

## Customizing the Harness

The main trading logic is in `src/durable-objects/mahoraga-harness.ts`. It's documented with markers to help you find what to modify:

| Marker | Meaning |
|--------|---------|
| `[TUNE]` | Numeric values you can adjust |
| `[TOGGLE]` | Features you can enable/disable |
| `[CUSTOMIZABLE]` | Sections with code you might want to modify |

### Adding a New Data Source

1. Create a new `gather*()` method that returns `Signal[]`
2. Add it to `runDataGatherers()` Promise.all
3. Add source weight to `SOURCE_CONFIG.weights`

See `docs/harness.html` for detailed customization guide.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `max_positions` | 5 | Maximum concurrent positions |
| `max_position_value` | 5000 | Maximum $ per position |
| `take_profit_pct` | 10 | Take profit percentage |
| `stop_loss_pct` | 5 | Stop loss percentage |
| `min_sentiment_score` | 0.3 | Minimum sentiment to consider |
| `min_analyst_confidence` | 0.6 | Minimum LLM confidence to trade |
| `options_enabled` | false | Enable options trading |
| `crypto_enabled` | false | Enable 24/7 crypto trading |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/agent/status` | Full status (account, positions, signals) |
| `/agent/enable` | Enable the agent |
| `/agent/disable` | Disable the agent |
| `/agent/config` | Get or update configuration |
| `/agent/logs` | Get recent logs |
| `/agent/trigger` | Manually trigger (for testing) |
| `/agent/kill` | Emergency kill switch (uses `KILL_SWITCH_SECRET`) |
| `/mcp` | MCP server for tool access |

## Security

### API Authentication (Required)

All `/agent/*` endpoints require Bearer token authentication using `MAHORAGA_API_TOKEN`:

```bash
curl -H "Authorization: Bearer $MAHORAGA_TOKEN" https://your-worker.workers.dev/agent/status
```

Generate a secure token: `openssl rand -base64 48`

### Emergency Kill Switch

The `/agent/kill` endpoint uses a separate `KILL_SWITCH_SECRET` for emergency shutdown:

```bash
curl -H "Authorization: Bearer $KILL_SWITCH_SECRET" https://your-worker.workers.dev/agent/kill
```

This immediately disables the agent, cancels all alarms, and clears the signal cache.

### Cloudflare Access (Recommended)

For additional security with SSO/email verification, set up Cloudflare Access:

```bash
# 1. Create a Cloudflare API token with Access:Edit permissions
#    https://dash.cloudflare.com/profile/api-tokens

# 2. Run the setup script
CLOUDFLARE_API_TOKEN=your-token \
CLOUDFLARE_ACCOUNT_ID=your-account-id \
MAHORAGA_WORKER_URL=https://mahoraga.your-subdomain.workers.dev \
MAHORAGA_ALLOWED_EMAILS=you@example.com \
npm run setup:access
```

This creates a Cloudflare Access Application with email verification or One-Time PIN.

## Project Structure

```
mahoraga/
├── wrangler.jsonc              # Cloudflare Workers config
├── src/
│   ├── index.ts                # Entry point
│   ├── durable-objects/
│   │   ├── mahoraga-harness.ts # THE HARNESS - customize this!
│   │   └── session.ts
│   ├── mcp/                    # MCP server & tools
│   ├── policy/                 # Trade validation
│   └── providers/              # Alpaca, OpenAI clients
├── dashboard/                  # React dashboard
├── docs/                       # Documentation
└── migrations/                 # D1 database migrations
```

## Safety Features

| Feature | Description |
|---------|-------------|
| Paper Trading | Start with `ALPACA_PAPER=true` |
| Kill Switch | Emergency halt via secret |
| Position Limits | Max positions and $ per position |
| Daily Loss Limit | Stops trading after 2% daily loss |
| Staleness Detection | Auto-exit stale positions |
| No Margin | Cash-only trading |
| No Shorting | Long positions only |

## Community

Join our Discord for help and discussion:

**[Discord Server](https://discord.gg/Ys8KpsW5NN)**

## Disclaimer

**⚠️ IMPORTANT: READ BEFORE USING**

This software is provided for **educational and informational purposes only**. Nothing in this repository constitutes financial, investment, legal, or tax advice.

**By using this software, you acknowledge and agree that:**

- All trading and investment decisions are made **at your own risk**
- Markets are volatile and **you can lose some or all of your capital**
- No guarantees of performance, profits, or outcomes are made
- The authors and contributors are **not responsible** for any financial losses
- This software may contain bugs or behave unexpectedly
- Past performance does not guarantee future results

**Always start with paper trading and never risk money you cannot afford to lose.**

## License

MIT License - Free for personal and commercial use. See [LICENSE](LICENSE) for full terms.
