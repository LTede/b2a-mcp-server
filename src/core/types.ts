// ── Gap & Issue types (from Checkpoint402 verify engine) ──

export interface Issue {
  type: "hallucination" | "logic_gap" | "unsupported_claim" | "inconsistency" | "incomplete" | "unverifiable";
  severity: "critical" | "major" | "minor";
  location: string;
  description: string;
  suggestion: string;
}

export interface Gap {
  type: "missing_data" | "missing_analysis" | "missing_perspective" | "missing_verification" | "missing_context";
  description: string;
  capabilityNeeded: string;
  keywords: string[];
  priority: "critical" | "high" | "medium" | "low";
}

// ── Verification ──

export interface VerifyRequest {
  task: string;
  output: string;
  depth?: "quick" | "full" | "deep";
}

export interface VerifyResponse {
  score: number;
  grade: "PASS" | "REVIEW" | "FAIL";
  issues: Issue[];
  gaps: Gap[];
  summary: string;
  claim_count: number;
  verified_count: number;
  flagged_count: number;
}

// ── Service Registry ──

export interface RegistryEntry {
  name: string;
  description: string;
  url: string;
  category: string;
}

export interface DiscoveredService {
  name: string;
  url: string;
  endpoint: string;
  description: string;
  keywords: string[];
  price: string;
  network: string;
  category: string;
  matchedGap: Gap;
  matchScore: number;
}

// ── Enhance (verify + discover combined) ──

export interface EnhanceResult {
  verification: VerifyResponse;
  recommendations: ServiceRecommendation[];
}

export interface ServiceRecommendation {
  service: DiscoveredService;
  gap: Gap;
  reason: string;
  estimatedCost: string;
}
