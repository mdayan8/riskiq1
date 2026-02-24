import requests
from bs4 import BeautifulSoup
from time import perf_counter
from urllib.parse import quote_plus, urlparse, parse_qs, unquote


def scrape_reference_url(url: str, timeout_sec: int = 15):
    started = perf_counter()
    try:
        response = requests.get(
            url,
            timeout=timeout_sec,
            headers={
                "User-Agent": "RiskIQ-ComplianceBot/1.0 (+https://riskiq.local)"
            },
        )
        latency_ms = int((perf_counter() - started) * 1000)
        if response.status_code >= 400:
            return {
                "scraped_title": "",
                "scraped_summary": "",
                "fetch_status": "failed",
                "fetch_http_status": response.status_code,
                "fetch_latency_ms": latency_ms,
                "source_url": url,
            }

        soup = BeautifulSoup(response.text, "html.parser")
        title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
        if meta_tag and meta_tag.get("content"):
            meta_desc = str(meta_tag.get("content")).strip()

        paragraph = ""
        p = soup.find("p")
        if p:
            paragraph = p.get_text(" ", strip=True)

        body_text = soup.get_text(" ", strip=True)[:1200]
        summary = meta_desc or paragraph or body_text

        return {
            "scraped_title": title,
            "scraped_summary": summary,
            "fetch_status": "ok",
            "fetch_http_status": response.status_code,
            "fetch_latency_ms": latency_ms,
            "source_url": url,
        }
    except Exception:
        return {
            "scraped_title": "",
            "scraped_summary": "",
            "fetch_status": "timeout_or_network_error",
            "fetch_http_status": 0,
            "fetch_latency_ms": timeout_sec * 1000,
            "source_url": url,
        }


def _unwrap_ddg_redirect(url: str) -> str:
    try:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        if "uddg" in qs and qs["uddg"]:
            return unquote(qs["uddg"][0])
    except Exception:
        return url
    return url


def search_web(query: str, max_results: int = 6, timeout_sec: int = 12):
    started = perf_counter()
    if not query.strip():
        return {"query": query, "results": [], "search_latency_ms": 0, "search_status": "empty_query"}

    urls = [
        f"https://duckduckgo.com/html/?q={quote_plus(query)}",
        f"https://html.duckduckgo.com/html/?q={quote_plus(query)}",
    ]

    result_items = []
    for search_url in urls:
        try:
            response = requests.get(
                search_url,
                timeout=timeout_sec,
                headers={"User-Agent": "RiskIQ-ResearchAgent/1.0 (+https://riskiq.local)"},
            )
            if response.status_code >= 400:
                continue
            soup = BeautifulSoup(response.text, "html.parser")
            anchors = soup.select("a.result__a")
            if not anchors:
                anchors = soup.select("a[data-testid='result-title-a']")
            for a in anchors:
                href = str(a.get("href") or "").strip()
                title = a.get_text(" ", strip=True)
                if not href or not title:
                    continue
                href = _unwrap_ddg_redirect(href)
                if not href.startswith("http"):
                    continue
                result_items.append({"title": title, "url": href})
                if len(result_items) >= max_results:
                    break
            if result_items:
                break
        except Exception:
            continue

    deduped = []
    seen = set()
    for r in result_items:
        if r["url"] in seen:
            continue
        seen.add(r["url"])
        deduped.append(r)
        if len(deduped) >= max_results:
            break

    enriched = []
    for item in deduped:
        scraped = scrape_reference_url(item["url"], timeout_sec=timeout_sec)
        enriched.append(
            {
                "title": item["title"] or scraped.get("scraped_title", ""),
                "url": item["url"],
                "snippet": scraped.get("scraped_summary", ""),
                "fetch_status": scraped.get("fetch_status", "unknown"),
                "fetch_http_status": scraped.get("fetch_http_status", 0),
                "fetch_latency_ms": scraped.get("fetch_latency_ms", 0),
            }
        )

    return {
        "query": query,
        "results": enriched,
        "search_latency_ms": int((perf_counter() - started) * 1000),
        "search_status": "ok" if enriched else "no_results",
    }
