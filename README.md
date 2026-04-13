# B2A MCP Server

**Adversarial verification + capability discovery for AI outputs.**

AI checks its own work and says "looks good" (sycophancy bias). B2A gives you the real score — and fixes it.

## The Problem

```
You: "Is this output good?"
Claude: "Yes, it covers the key points." (~82/100)

You: "Check it with B2A."
B2A:  score: 28/100, grade: FAIL
      issues: [
        "Zero financial metrics, no risk assessment",
        "No evidence for 'expanding' — what expansion?",
        "'Stock might go up' is a tautology, not analysis"
      ]
      gaps: [
        "missing_data: No P/E, revenue, hash rate",
        "missing_analysis: No BTC price scenarios",
        "missing_context: No competitors (RIOT, MARA)"
      ]
```

Then `/enhance` fills those gaps with real data and produces a structured analysis. **3 lines in, full report out.**

## Install (10 seconds)

```bash
claude mcp add b2a -- npx b2a-mcp-server
```

Or with npm:

```bash
npm install -g b2a-mcp-server
claude mcp add b2a -- b2a-mcp
```

Set `ANTHROPIC_API_KEY` environment variable for verify/enhance tools.

## Tools

| Tool | Cost | What it does |
|------|------|-------------|
| `b2a_discover` | Free | Find x402 services for a capability gap |
| `b2a_verify` | ~$0.01 API | Adversarial audit: score, issues, gaps |
| `b2a_enhance` | ~$0.05 API | Verify + discover + recommend fixes |
| `b2a_browse` | Free | Browse 200+ x402 ecosystem services |
| `b2a_call` | Varies | Call any x402 service directly |

## How it works

```
Your output (score: 28)
    |
    v
b2a_verify — adversarial audit, sycophancy-free
    |         "score: 28. Here's what's wrong. Here's what's missing."
    v
b2a_enhance — finds services to fill each gap
    |          routes to real-time data, stress-testers, analyzers
    v
Enhanced output (score: 78)
    with real data, structured analysis, verified claims
```

## Why not just ask Claude to check itself?

1. **Sycophancy bias** — Models trained on human feedback learn to agree. "Is my output good?" → "Yes." Every time.
2. **No external data** — Claude can't fetch real-time prices, on-chain data, or call paid APIs.
3. **No memory** — Claude doesn't learn which fixes worked. B2A's feedback loop does.

B2A uses a separate Claude instance with an adversarial "ruthless auditor" mandate. Same model, different role. This breaks the self-assessment loop.

## x402 Services (paid, Base USDC)

The MCP server connects to live x402 services:

| Service | URL | Price | What it does |
|---------|-----|-------|-------------|
| Checkpoint402 /verify | checkpoint402.itaeui12.workers.dev | $0.05-0.08 | Adversarial verification |
| Checkpoint402 /enhance | checkpoint402.itaeui12.workers.dev | $0.20-0.70 | Verify + enhance with data |
| Thesis402 | thesis402.itaeui12.workers.dev | $0.08 | Investment thesis stress-test |
| data402 | data402.itaeui12.workers.dev | Free (100/day) | Real-time crypto, web, on-chain |

## Ecosystem

200+ services indexed from the [x402 ecosystem](https://github.com/coinbase/x402):
- 75 callable API endpoints
- 68 infrastructure tools
- 30 payment facilitators
- 23 client integrations

## Build from source

```bash
git clone https://github.com/LTede/b2a-mcp-server.git
cd b2a-mcp-server
npm install
npm run build
```

## License

MIT
