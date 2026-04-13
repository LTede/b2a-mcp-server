import Anthropic from "@anthropic-ai/sdk";
import { getCallableServices } from "./registry.js";
import type { Gap, DiscoveredService, RegistryEntry } from "./types.js";

// Known endpoints for internal services
const KNOWN_ENDPOINTS: Record<string, { endpoint: string; price: string }> = {
  thesis402: { endpoint: "/stress-test", price: "20000" },
  checkpoint402: { endpoint: "/verify", price: "10000" },
};

/** Extract meaningful words from text (length >= 3, no stop words) */
function extractWords(text: string): string[] {
  const STOP = new Set([
    "the", "and", "for", "with", "from", "this", "that", "will", "are", "not",
    "but", "has", "have", "can", "all", "its", "may", "any", "per", "via",
    "use", "using", "your", "our", "you", "their", "they", "also", "more",
    "into", "over", "each", "such", "than", "been", "does", "get", "got",
    "let", "lets", "made", "make", "way", "own", "out", "how", "who", "what",
    "when", "where", "which", "why", "about", "between", "through", "just",
  ]);
  return text
    .split(/[\s,.\-_/()[\]{}:;'"!?]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

function resolveEndpoint(service: RegistryEntry): { endpoint: string; price: string } {
  const key = Object.keys(KNOWN_ENDPOINTS).find(
    (k) =>
      service.name.toLowerCase().includes(k) ||
      service.url.toLowerCase().includes(k)
  );
  return key ? KNOWN_ENDPOINTS[key] : { endpoint: "", price: "10000" };
}

/** Keyword-based discovery against 200 ecosystem services */
export function discoverByKeyword(gaps: Gap[]): DiscoveredService[] {
  const results: DiscoveredService[] = [];
  const services = getCallableServices();

  for (const gap of gaps) {
    const gapText =
      `${gap.description} ${gap.capabilityNeeded} ${gap.keywords.join(" ")}`.toLowerCase();
    const gapWords = extractWords(gapText);

    for (const svc of services) {
      if (svc.name.toLowerCase() === "checkpoint402") continue;

      const svcText = `${svc.name} ${svc.description}`.toLowerCase();
      const svcWords = extractWords(svcText);

      const wordMatches = gapWords.filter((gw) =>
        svcWords.some((sw) => sw.includes(gw) || gw.includes(sw))
      );

      const keywordWordMatches = gap.keywords
        .flatMap((kw) => kw.toLowerCase().split(/[\s/\-_]+/).filter((w) => w.length >= 3))
        .filter((w) => svcText.includes(w));

      const unique = [...new Set([...wordMatches, ...keywordWordMatches])];
      if (unique.length < 2) continue;

      const score = Math.min(unique.length / Math.max(gapWords.length, 1), 1.0);
      if (score <= 0.1) continue;

      const ep = resolveEndpoint(svc);
      results.push({
        name: svc.name,
        url: svc.url,
        endpoint: ep.endpoint,
        description: svc.description,
        keywords: gap.keywords,
        price: ep.price,
        network: "eip155:8453",
        category: svc.category,
        matchedGap: gap,
        matchScore: Math.round(score * 100) / 100,
      });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}

/** Semantic discovery: keyword pre-filter → Claude Haiku ranks top candidates */
export async function discoverSemantic(
  apiKey: string,
  gaps: Gap[]
): Promise<DiscoveredService[]> {
  const keywordResults = discoverByKeyword(gaps);
  if (keywordResults.length === 0) return discoverRelaxed(gaps).slice(0, 5);
  if (keywordResults.length <= 3) return keywordResults;

  const candidates = keywordResults.slice(0, 15);
  const client = new Anthropic({ apiKey });

  const gapSummaries = gaps
    .map((g, i) => `Gap ${i + 1} [${g.type}]: ${g.description} (needs: ${g.capabilityNeeded})`)
    .join("\n");

  const serviceSummaries = candidates
    .map((s, i) => `${i + 1}. ${s.name}: ${s.description.substring(0, 150)}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Given these gaps in an AI output and these available x402 services, rank which services are most likely to help fill the gaps. Return ONLY a JSON array of service numbers (1-indexed) sorted by relevance, max 5.

GAPS:
${gapSummaries}

AVAILABLE SERVICES:
${serviceSummaries}

Respond with ONLY a JSON array like [3, 1, 7]. No explanation.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = text.match(/\[[\d,\s]+\]/);
    if (!match) return candidates.slice(0, 5);

    const indices: number[] = JSON.parse(match[0]);
    return indices
      .filter((i) => i >= 1 && i <= candidates.length)
      .map((i) => ({
        ...candidates[i - 1],
        matchScore: Math.round((1 - indices.indexOf(i) * 0.1) * 100) / 100,
      }))
      .slice(0, 5);
  } catch {
    return candidates.slice(0, 5);
  }
}

/** Relaxed matching — lower threshold fallback */
function discoverRelaxed(gaps: Gap[]): DiscoveredService[] {
  const results: DiscoveredService[] = [];
  const services = getCallableServices();

  for (const gap of gaps) {
    const words = gap.keywords.flatMap((kw) =>
      kw.toLowerCase().split(/[\s/\-_]+/).filter((w) => w.length >= 3)
    );

    for (const svc of services) {
      if (svc.name.toLowerCase() === "checkpoint402") continue;
      const svcText = `${svc.name} ${svc.description}`.toLowerCase();
      const matches = words.filter((w) => svcText.includes(w));
      if (matches.length < 1) continue;

      const ep = resolveEndpoint(svc);
      results.push({
        name: svc.name,
        url: svc.url,
        endpoint: ep.endpoint,
        description: svc.description,
        keywords: gap.keywords,
        price: ep.price,
        network: "eip155:8453",
        category: svc.category,
        matchedGap: gap,
        matchScore: matches.length * 0.08,
      });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}
