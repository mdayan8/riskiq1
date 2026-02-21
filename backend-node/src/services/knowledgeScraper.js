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
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      return { scraped_title: "", scraped_summary: "Failed to fetch source content" };
    }

    const html = await response.text();
    const scrapedTitle = extractTitle(html);
    const meta = extractMetaDescription(html);
    const p1 = extractFirstParagraph(html);
    return {
      scraped_title: scrapedTitle,
      scraped_summary: meta || p1 || "Summary unavailable from source page"
    };
  } catch {
    return { scraped_title: "", scraped_summary: "Source fetch timeout or network error" };
  }
}

export async function scrapeRegulatoryKnowledge() {
  const CURATED_SOURCES = loadCuratedSources();
  const items = [];
  for (const source of CURATED_SOURCES) {
    const scraped = await fetchSummary(source.source_url);
    items.push({
      ...source,
      summary: scraped.scraped_summary || source.title,
      scraped_title: scraped.scraped_title || source.title,
      refreshed_at: new Date().toISOString()
    });
  }
  return items;
}
