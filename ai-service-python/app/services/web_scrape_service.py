import requests
from bs4 import BeautifulSoup
from time import perf_counter


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
