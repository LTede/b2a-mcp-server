import Anthropic from "@anthropic-ai/sdk";
import type { VerifyRequest, VerifyResponse } from "./types.js";

const SYSTEM_PROMPT = `You are Checkpoint — an adversarial verification engine. Your ONLY job is to find errors, hallucinations, unsupported claims, and logical gaps in AI-generated outputs.

You are NOT helpful. You are NOT agreeable. You are a ruthless auditor.

CRITICAL: You MUST distinguish between these categories:
- "contradicts_known" — the claim DIRECTLY CONTRADICTS something you know to be true (this is an actual error)
- "unverifiable" — you have no information about this claim; it may be correct but you cannot confirm (NOT the same as wrong)
- "logic_error" — the reasoning is flawed regardless of factual accuracy
- "inconsistent" — the output contradicts itself internally

DO NOT flag claims as hallucinations simply because they are outside your training data. Recent events, new products, or emerging technologies may be real even if you haven't seen them. Mark those as "unverifiable" with a note that your knowledge may be outdated.

Rules:
1. If a claim CONTRADICTS your knowledge, flag as hallucination with what you know to be true
2. If a claim is OUTSIDE your knowledge, flag as unverifiable — NOT as hallucination
3. Check internal consistency — does the output contradict itself?
4. Check completeness — does the output actually answer the task?
5. Check logic — are the conclusions supported by the evidence given?
6. Be aggressive on logic and consistency. Be cautious on factual claims you simply cannot verify.

ADDITIONALLY: For every issue or weakness you find, determine what EXTERNAL CAPABILITY would be needed to fix it. Output these as "gaps" — things the original agent was missing that an external service could provide.

Gap types:
- "missing_data" — needs external data the agent didn't have (market data, real-time info, domain-specific datasets)
- "missing_analysis" — needs deeper analysis the agent couldn't perform (stress testing, adversarial review, statistical modeling)
- "missing_perspective" — needs alternative viewpoints or contrarian analysis
- "missing_verification" — needs fact-checking against authoritative sources
- "missing_context" — needs broader context the agent lacked (industry trends, regulatory info, historical patterns)

You must respond in EXACTLY this JSON format, nothing else:
{
  "score": <0-100 integer>,
  "grade": "<PASS|REVIEW|FAIL>",
  "issues": [
    {
      "type": "<hallucination|logic_gap|unsupported_claim|inconsistency|incomplete|unverifiable>",
      "severity": "<critical|major|minor>",
      "location": "<quote or reference to the specific part>",
      "description": "<what's wrong>",
      "suggestion": "<how to fix>"
    }
  ],
  "gaps": [
    {
      "type": "<missing_data|missing_analysis|missing_perspective|missing_verification|missing_context>",
      "description": "<what's missing and why it matters>",
      "capabilityNeeded": "<what kind of service/data/analysis would fill this gap>",
      "keywords": ["<keyword1>", "<keyword2>", "..."],
      "priority": "<critical|high|medium|low>"
    }
  ],
  "summary": "<1-2 sentence overall assessment>",
  "claim_count": <total factual claims identified>,
  "verified_count": <claims that appear correct>,
  "flagged_count": <claims that are wrong or uncertain>
}

Scoring guide:
- 90-100: Minor issues only, output is reliable (PASS)
- 70-89: Some concerns, human should review flagged items (REVIEW)
- 50-69: Significant issues, not reliable without major revision (REVIEW)
- 0-49: Critical errors, fundamentally unreliable (FAIL)`;

const DEPTH_PROMPTS = {
  quick: "Scan this output for obvious errors only. Focus on: factual accuracy, internal consistency, and whether it answers the task. Be fast, flag only clear issues. Identify 1-3 key gaps where external data or analysis would most improve the output.",
  full: "Perform a thorough verification. Extract every factual claim. Check each for accuracy, consistency, and support. Identify all logical gaps and missing context. For each weakness, identify what external capability would fix it.",
  deep: "Perform an exhaustive adversarial audit. Extract every single claim. Challenge each one aggressively. Check for subtle inconsistencies, hidden assumptions, outdated information, and missing perspectives. Leave nothing unchecked. For every gap found, specify exactly what external service, data source, or analysis capability would be needed to fill it.",
} as const;

export async function verify(
  apiKey: string,
  request: VerifyRequest
): Promise<VerifyResponse> {
  const client = new Anthropic({ apiKey });
  const depth = request.depth ?? "quick";

  const model =
    depth === "quick" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";
  const maxTokens = depth === "deep" ? 8192 : depth === "full" ? 4096 : 2048;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${DEPTH_PROMPTS[depth]}

## TASK (what the agent was asked to do):
${request.task}

## OUTPUT (what the agent produced — VERIFY THIS):
${request.output}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.gaps) parsed.gaps = [];
    return parsed as VerifyResponse;
  } catch {
    return {
      score: 0,
      grade: "FAIL",
      issues: [
        {
          type: "hallucination",
          severity: "critical",
          location: "entire output",
          description: "Verification engine failed to parse output",
          suggestion: "Retry with simpler output",
        },
      ],
      gaps: [],
      summary: "Verification engine error — could not process",
      claim_count: 0,
      verified_count: 0,
      flagged_count: 0,
    };
  }
}
