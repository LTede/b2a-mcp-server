# B2A MCP Server

**Intelligence layer for AI agent capability discovery.** When an agent hits its ceiling, B2A finds, matches, and orchestrates external services to break through.

Not a marketplace. Not a catalog. The brain that knows what you need when you don't.

## What it does

- **Discovers** x402 services across 200+ ecosystem partners using keyword + Claude semantic matching
- **Verifies** AI outputs with adversarial auditing (score, grade, issues, gaps)
- **Enhances** outputs by combining verification with service discovery — tells you exactly which services can fix each gap
- **Calls** x402 services directly (with internal auth or x402 payment)

## Tools

| Tool | Cost | Description |
|------|------|-------------|
| `b2a_discover` | Free | Find services matching a capability gap |
| `b2a_verify` | ~$0.01 API | Adversarial verification with gap detection |
| `b2a_enhance` | ~$0.02 API | Verify + discover services for each gap |
| `b2a_browse` | Free | Browse the x402 ecosystem catalog |
| `b2a_call` | Varies | Call any x402 service endpoint |

## Setup

### Claude Code

```bash
claude mcp add b2a -- node C:/Users/PC/b2a-mcp-server/dist/index.js
```

Or add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "b2a": {
      "command": "node",
      "args": ["C:/Users/PC/b2a-mcp-server/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "b2a": {
      "command": "node",
      "args": ["C:/Users/PC/b2a-mcp-server/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Build

```bash
npm install
npm run build
```

## Architecture

```
Agent hits ceiling
    |
    v
b2a_verify — "here's what's wrong and what's missing"
    |
    v
b2a_discover — "these services can fill each gap"
    |
    v
b2a_call — "here's the result from that service"
    |
    v
Agent breaks through
```

Core engine extracted from [Checkpoint402](https://checkpoint402.itaeui12.workers.dev) v0.3.0 capability discovery protocol.

## x402 Ecosystem

200+ services indexed from the [x402 ecosystem](https://github.com/coinbase/x402). Categories:

- **75 Services/Endpoints** — callable APIs (risk analysis, market data, AI tools)
- **68 Infrastructure & Tooling** — SDKs, facilitators, platforms
- **30 Facilitators** — payment processors
- **23 Client-Side Integrations** — wallets, browser extensions

## License

MIT
