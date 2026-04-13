import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { RegistryEntry } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _registry: RegistryEntry[] | null = null;

function loadRegistry(): RegistryEntry[] {
  if (_registry) return _registry;
  const dataPath = join(__dirname, "..", "data", "ecosystem-registry.json");
  const raw = readFileSync(dataPath, "utf-8");
  _registry = JSON.parse(raw) as RegistryEntry[];
  return _registry;
}

/** Get all callable services (Services/Endpoints category) */
export function getCallableServices(): RegistryEntry[] {
  return loadRegistry().filter(
    (e) => e.category === "Services/Endpoints" && e.url && e.description
  );
}

/** Get all services, optionally filtered */
export function browseServices(opts?: {
  category?: string;
  keyword?: string;
  limit?: number;
}): RegistryEntry[] {
  let results = loadRegistry();

  if (opts?.category) {
    results = results.filter((e) =>
      e.category.toLowerCase().includes(opts.category!.toLowerCase())
    );
  }

  if (opts?.keyword) {
    const kw = opts.keyword.toLowerCase();
    results = results.filter(
      (e) =>
        e.name.toLowerCase().includes(kw) ||
        e.description.toLowerCase().includes(kw)
    );
  }

  const limit = opts?.limit ?? 20;
  return results.slice(0, limit);
}

/** Get registry stats */
export function getRegistryStats(): {
  total: number;
  byCategory: Record<string, number>;
} {
  const all = loadRegistry();
  const byCategory: Record<string, number> = {};
  for (const entry of all) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }
  return { total: all.length, byCategory };
}
