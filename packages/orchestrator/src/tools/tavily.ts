import crypto from "crypto";
import { getRedis } from "../lib/redis";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

const CACHE_TTL_SECONDS = 24 * 60 * 60;

export async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  const cacheKey = `tavily:cache:${crypto.createHash("sha1").update(query).digest("hex")}`;
  const r = getRedis();

  const cached = await r.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as TavilyResult[];
  }

  if (!apiKey) {
    console.warn("[tavily] TAVILY_API_KEY missing — returning empty results");
    return [];
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[tavily] HTTP ${res.status} — returning empty`);
      return [];
    }
    const json = (await res.json()) as { results?: TavilyResult[] };
    const results = json.results ?? [];
    await r.set(cacheKey, JSON.stringify(results), "EX", CACHE_TTL_SECONDS);
    return results;
  } catch (err) {
    console.warn("[tavily] error", err);
    return [];
  }
}
