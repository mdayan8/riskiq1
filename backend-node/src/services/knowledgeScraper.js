import fs from "fs";
import path from "path";

function loadCuratedSources() {
  try {
    const file = path.resolve(process.cwd(), "../rules/compliance_datastore.json");
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
}

function stripHtml(input) {
  return input.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i);
  return match ? match[1].trim() : "";
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : "";
}

function extractFirstParagraph(html) {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return match ? stripHtml(match[1]) : "";
}

async function fetchSummary(url) {
  try {
    const startedAt = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      return {
        scraped_title: "",
        scraped_summary: "",
        fetch_status: "failed",
        fetch_http_status: response.status,
        fetch_latency_ms: Date.now() - startedAt
      };
    }

    const html = await response.text();
    const scrapedTitle = extractTitle(html);
    const meta = extractMetaDescription(html);
    const p1 = extractFirstParagraph(html);
    const bodyText = stripHtml(html).slice(0, 1200);
    return {
      scraped_title: scrapedTitle,
      scraped_summary: meta || p1 || bodyText || "",
      fetch_status: "ok",
      fetch_http_status: response.status,
      fetch_latency_ms: Date.now() - startedAt
    };
  } catch {
    return {
      scraped_title: "",
      scraped_summary: "",
      fetch_status: "timeout_or_network_error",
      fetch_http_status: 0,
      fetch_latency_ms: 15000
    };
  }
}

export async function scrapeRegulatoryKnowledge() {
  const CURATED_SOURCES = loadCuratedSources();
  const now = new Date().toISOString();
  const results = await Promise.allSettled(
    CURATED_SOURCES.map(async (source) => ({ source, scraped: await fetchSummary(source.source_url) }))
  );

  return results.map((result, idx) => {
    const source = CURATED_SOURCES[idx];
    if (result.status === "fulfilled") {
      const { scraped } = result.value;
      return {
        ...source,
        summary: scraped.scraped_summary || source.summary || source.title,
        scraped_title: scraped.scraped_title || source.title,
        fetch_status: scraped.fetch_status,
        fetch_http_status: scraped.fetch_http_status,
        fetch_latency_ms: scraped.fetch_latency_ms,
        refreshed_at: now
      };
    }

    return {
      ...source,
      summary: source.summary || source.title,
      scraped_title: source.title,
      fetch_status: "failed",
      fetch_http_status: 0,
      fetch_latency_ms: 15000,
      refreshed_at: now
    };
  });
}
