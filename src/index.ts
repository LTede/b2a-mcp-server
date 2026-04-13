#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { verify } from "./core/verify.js";
import { discoverByKeyword, discoverSemantic } from "./core/matching.js";
import { browseServices, getRegistryStats } from "./core/registry.js";
import type { Gap, EnhanceResult, ServiceRecommendation } from "./core/types.js";

// ── Resolve API key ──

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY environment variable required");
  return key;
}

// ── Tool definitions ──

const TOOLS = [
  {
    name: "b2a_discover",
    description:
      "Find x402 services that can solve a specific capability gap. Use when an agent hits a ceiling and needs external help. Free — no payment required. Searches 200+ x402 ecosystem services using keyword matching, optionally enhanced with Claude semantic ranking.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Describe what capability is needed. E.g. 'real-time stock market data for IREN' or 'investment thesis stress testing'",
        },
        gap_type: {
          type: "string",
          enum: [
            "missing_data",
            "missing_analysis",
            "missing_perspective",
            "missing_verification",
            "missing_context",
          ],
          description: "Type of gap (optional, helps narrow search)",
        },
        semantic: {
          type: "boolean",
          description:
            "Use Claude for semantic ranking (more accurate, costs ~$0.001 in API). Default: false",
        },
        max_results: {
          type: "number",
          description: "Maximum results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "b2a_verify",
    description:
      "Verify an AI-generated output for quality, accuracy, and gaps. Uses Claude as an adversarial auditor. Returns a score (0-100), grade (PASS/REVIEW/FAIL), specific issues found, and capability gaps that could be filled by external services. Costs ~$0.01-0.05 in Anthropic API usage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string",
          description: "What the agent was asked to do",
        },
        output: {
          type: "string",
          description: "The AI-generated output to verify",
        },
        depth: {
          type: "string",
          enum: ["quick", "full", "deep"],
          description:
            "Verification depth. quick=fast scan, full=thorough, deep=exhaustive adversarial audit. Default: quick",
        },
      },
      required: ["task", "output"],
    },
  },
  {
    name: "b2a_enhance",
    description:
      "Verify an output AND discover services that could improve it. Combines verification + discovery in one step. Returns the verification result plus specific service recommendations for each identified gap. This is the core B2A intelligence — finding what you need to break through your ceiling.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string",
          description: "What the agent was asked to do",
        },
        output: {
          type: "string",
          description: "The AI-generated output to verify and enhance",
        },
        depth: {
          type: "string",
          enum: ["quick", "full", "deep"],
          description: "Verification depth. Default: full",
        },
        semantic: {
          type: "boolean",
          description: "Use semantic matching for service discovery. Default: true",
        },
      },
      required: ["task", "output"],
    },
  },
  {
    name: "b2a_browse",
    description:
      "Browse the x402 service ecosystem catalog. 200+ services across categories: Services/Endpoints, Facilitators, Infrastructure & Tooling, Client-Side Integrations. Free.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            "Filter by category. E.g. 'Services/Endpoints', 'Facilitators', 'Infrastructure'",
        },
        keyword: {
          type: "string",
          description: "Search keyword in name/description",
        },
        limit: {
          type: "number",
          description: "Max results (default: 20)",
        },
      },
    },
  },
  {
    name: "b2a_call",
    description:
      "Call an x402 service endpoint directly. Sends an HTTP POST request to the specified URL. Note: paid x402 services will return 402 Payment Required — actual payment integration coming in Phase 2. Free/internal services work immediately.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "Full URL of the service (e.g. https://thesis402.itaeui12.workers.dev)",
        },
        endpoint: {
          type: "string",
          description: "API endpoint path (e.g. /stress-test)",
        },
        payload: {
          type: "object",
          description: "JSON payload to send",
        },
        internal_secret: {
          type: "string",
          description:
            "Internal auth secret for own services (bypasses x402 payment)",
        },
      },
      required: ["url", "endpoint", "payload"],
    },
  },
] as const;

// ── Tool handlers ──

async function handleDiscover(args: {
  query: string;
  gap_type?: string;
  semantic?: boolean;
  max_results?: number;
}): Promise<string> {
  const gap: Gap = {
    type: (args.gap_type as Gap["type"]) || "missing_data",
    description: args.query,
    capabilityNeeded: args.query,
    keywords: args.query
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((w) => w.length >= 3),
    priority: "high",
  };

  const maxResults = args.max_results ?? 5;

  let services;
  if (args.semantic) {
    const apiKey = getApiKey();
    services = await discoverSemantic(apiKey, [gap]);
  } else {
    services = discoverByKeyword([gap]);
  }

  services = services.slice(0, maxResults);

  if (services.length === 0) {
    return JSON.stringify({
      found: 0,
      message: "No matching services found. Try broader keywords or enable semantic search.",
      suggestion: "Use semantic: true for Claude-powered matching, or try different keywords.",
    });
  }

  return JSON.stringify({
    found: services.length,
    services: services.map((s) => ({
      name: s.name,
      description: s.description,
      url: s.url,
      endpoint: s.endpoint || "(check service docs)",
      price: `$${(parseInt(s.price) / 1000000).toFixed(4)} USDC`,
      matchScore: s.matchScore,
      network: s.network,
    })),
  });
}

async function handleVerify(args: {
  task: string;
  output: string;
  depth?: string;
}): Promise<string> {
  const apiKey = getApiKey();
  const result = await verify(apiKey, {
    task: args.task,
    output: args.output,
    depth: (args.depth as "quick" | "full" | "deep") ?? "quick",
  });

  return JSON.stringify({
    score: result.score,
    grade: result.grade,
    summary: result.summary,
    claims: {
      total: result.claim_count,
      verified: result.verified_count,
      flagged: result.flagged_count,
    },
    issues: result.issues.map((i) => ({
      type: i.type,
      severity: i.severity,
      description: i.description,
      suggestion: i.suggestion,
    })),
    gaps: result.gaps.map((g) => ({
      type: g.type,
      description: g.description,
      capabilityNeeded: g.capabilityNeeded,
      priority: g.priority,
    })),
  });
}

async function handleEnhance(args: {
  task: string;
  output: string;
  depth?: string;
  semantic?: boolean;
}): Promise<string> {
  const apiKey = getApiKey();

  // Step 1: Verify
  const verification = await verify(apiKey, {
    task: args.task,
    output: args.output,
    depth: (args.depth as "quick" | "full" | "deep") ?? "full",
  });

  // Step 2: Discover services for each gap
  const recommendations: ServiceRecommendation[] = [];

  if (verification.gaps.length > 0) {
    const useSemantic = args.semantic !== false;
    const services = useSemantic
      ? await discoverSemantic(apiKey, verification.gaps)
      : discoverByKeyword(verification.gaps);

    for (const svc of services) {
      recommendations.push({
        service: svc,
        gap: svc.matchedGap,
        reason: `This service can address the "${svc.matchedGap.type}" gap: ${svc.matchedGap.description}`,
        estimatedCost: `$${(parseInt(svc.price) / 1000000).toFixed(4)} USDC`,
      });
    }
  }

  const result: EnhanceResult = { verification, recommendations };

  return JSON.stringify({
    verification: {
      score: result.verification.score,
      grade: result.verification.grade,
      summary: result.verification.summary,
      issueCount: result.verification.issues.length,
      gapCount: result.verification.gaps.length,
    },
    gaps: result.verification.gaps.map((g) => ({
      type: g.type,
      description: g.description,
      priority: g.priority,
    })),
    recommendations: result.recommendations.map((r) => ({
      serviceName: r.service.name,
      serviceUrl: r.service.url,
      endpoint: r.service.endpoint || "(check docs)",
      reason: r.reason,
      estimatedCost: r.estimatedCost,
      matchScore: r.service.matchScore,
    })),
    nextSteps:
      recommendations.length > 0
        ? "Use b2a_call to invoke recommended services, then re-verify the enhanced output."
        : "No external services found for current gaps. Consider rephrasing or deepening the analysis.",
  });
}

function handleBrowse(args: {
  category?: string;
  keyword?: string;
  limit?: number;
}): string {
  const services = browseServices(args);
  const stats = getRegistryStats();

  return JSON.stringify({
    total_in_ecosystem: stats.total,
    categories: stats.byCategory,
    results: services.map((s) => ({
      name: s.name,
      description: s.description.substring(0, 200),
      url: s.url,
      category: s.category,
    })),
    resultCount: services.length,
  });
}

async function handleCall(args: {
  url: string;
  endpoint: string;
  payload: Record<string, unknown>;
  internal_secret?: string;
}): Promise<string> {
  const fullUrl = `${args.url.replace(/\/$/, "")}${args.endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (args.internal_secret) {
    headers["X-Internal-Auth"] = args.internal_secret;
  }

  try {
    const response = await fetch(fullUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(args.payload),
    });

    if (response.status === 402) {
      const body = await response.text();
      return JSON.stringify({
        status: 402,
        message: "Payment Required — this is a paid x402 service.",
        info: "Automatic payment coming in Phase 2. For now, use internal_secret for own services or pay manually.",
        paymentDetails: body.substring(0, 500),
      });
    }

    if (!response.ok) {
      return JSON.stringify({
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        body: (await response.text()).substring(0, 500),
      });
    }

    const data = await response.json();
    return JSON.stringify({
      status: 200,
      data,
    });
  } catch (err) {
    return JSON.stringify({
      status: 0,
      error: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ── MCP Server ──

const server = new Server(
  {
    name: "b2a",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOLS],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case "b2a_discover":
        result = await handleDiscover(args as Parameters<typeof handleDiscover>[0]);
        break;
      case "b2a_verify":
        result = await handleVerify(args as Parameters<typeof handleVerify>[0]);
        break;
      case "b2a_enhance":
        result = await handleEnhance(args as Parameters<typeof handleEnhance>[0]);
        break;
      case "b2a_browse":
        result = handleBrowse(args as Parameters<typeof handleBrowse>[0]);
        break;
      case "b2a_call":
        result = await handleCall(args as Parameters<typeof handleCall>[0]);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: result }],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("B2A MCP Server running (stdio)");
  console.error(`Registry: 200+ x402 ecosystem services loaded`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
