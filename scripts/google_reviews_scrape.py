#!/usr/bin/env python3
import glob
import json
import os
import re
import sys
from datetime import datetime
from typing import Any, Optional
from urllib.parse import parse_qs, quote_plus, urlsplit, urlunsplit

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
VIEWPORT = {"width": 1920, "height": 1800}


def configure_stdio() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def ensure_playwright_browser_path() -> None:
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        return

    candidates: list[str] = []
    if os.name == "nt":
        local_app_data = clean_text(os.environ.get("LOCALAPPDATA", ""))
        if local_app_data:
            candidates.append(os.path.join(local_app_data, "ms-playwright"))
        candidates.extend(glob.glob(r"C:\Users\*\AppData\Local\ms-playwright"))
    else:
        candidates.extend([
            "/ms-playwright",
            os.path.expanduser("~/.cache/ms-playwright"),
        ])

    for candidate in candidates:
        if os.path.isdir(candidate):
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = candidate
            return


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_rating(value: str) -> Optional[float]:
    match = re.search(r"([0-5](?:[.,]\d)?)", value or "")
    if not match:
        return None
    return float(match.group(1).replace(",", "."))


def parse_review_count(value: str) -> int:
    digits = re.sub(r"\D+", "", value or "")
    return int(digits) if digits else 0


def simplify_query(value: str) -> str:
    query = clean_text(value)
    if not query:
        return ""

    parts = [clean_text(part) for part in re.split(r"\|", query) if clean_text(part)]
    if parts:
        candidate = parts[-1]
        if len(candidate) >= 4:
            return candidate

    query = re.sub(r"\bDermatologista em [^|,-]+", "", query, flags=re.IGNORECASE)
    query = re.sub(r"\bParan[aá]\b", "", query, flags=re.IGNORECASE)
    query = clean_text(query.strip(" -|,"))
    return query


def build_google_search_url(query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(query)}&hl=pt-BR&gl=br"


def dismiss_google_popups(page: Any) -> None:
    patterns = [
        "Recusar tudo",
        "Aceitar tudo",
        "I agree",
        "Reject all",
        "Accept all",
        "Agora não",
        "Not now",
    ]
    for label in patterns:
        try:
            button = page.get_by_role("button", name=label)
            if button.count() > 0 and button.first.is_visible():
                button.first.click(timeout=2000)
                page.wait_for_timeout(1000)
        except Exception:
            continue


def extract_summary(page: Any) -> Optional[dict[str, Any]]:
    return page.evaluate(
        """() => {
          const clean = (value) => (value || "").replace(/\\s+/g, " ").trim();
          const titleNode = document.querySelector('[data-attrid="title"]');
          if (!titleNode) {
            return null;
          }

          let panelRoot = titleNode;
          while (panelRoot && panelRoot !== document.body) {
            if (panelRoot.querySelector('a[data-fid]')) {
              break;
            }
            panelRoot = panelRoot.parentElement;
          }

          if (!panelRoot || panelRoot === document.body) {
            return null;
          }

          const reviewLink = Array.from(panelRoot.querySelectorAll('a[data-fid]')).find((element) => {
            return clean(element.textContent).toLowerCase().includes("google");
          });

          const placeLink = Array.from(panelRoot.querySelectorAll('a[href]')).find((element) => {
            const href = element.getAttribute("href") || "";
            return href.includes("/maps/place/") || href.includes("/maps?cid=") || href.includes("/maps/place");
          });

          return {
            title: clean(titleNode.textContent),
            panel_text: clean(panelRoot.textContent),
            review_label: reviewLink ? clean(reviewLink.textContent) : "",
            fid: reviewLink ? clean(reviewLink.getAttribute("data-fid")) : "",
            place_url: placeLink ? new URL(placeLink.getAttribute("href"), location.href).toString() : "",
          };
        }"""
    )


def extract_reviews(page: Any, max_reviews: int) -> list[dict[str, Any]]:
    return page.evaluate(
        """(limit) => {
          const clean = (value) => (value || "").replace(/\\s+/g, " ").trim();
          const cards = Array.from(document.querySelectorAll(".bwb7ce")).slice(0, limit);
          return cards.map((card) => {
            const link = card.querySelector("a[href]");
            const profileUrl = link ? new URL(link.getAttribute("href"), location.href).toString() : "";

            return {
              author: clean(card.querySelector(".Vpc5Fe")?.textContent || ""),
              reviewer_meta: clean(card.querySelector(".GSM50")?.textContent || ""),
              rating_label: clean(card.querySelector(".dHX2k")?.getAttribute("aria-label") || card.querySelector(".dHX2k")?.textContent || ""),
              relative_date: clean(card.querySelector(".y3Ibjb")?.textContent || ""),
              body: clean(card.querySelector(".OA1nbd")?.textContent || ""),
              profile_url: profileUrl,
            };
          }).filter((review) => review.author && review.body);
        }""",
        max_reviews,
    )


def build_reviews_url(current_url: str, fid: str) -> str:
    parts = urlsplit(current_url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, f"lrd={fid},1,,,,"))


def run(source_url: str, max_reviews: int) -> dict[str, Any]:
    ensure_playwright_browser_path()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            channel="chromium",
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            locale="pt-BR",
            viewport=VIEWPORT,
            user_agent=USER_AGENT,
            extra_http_headers={"Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"},
        )
        page = context.new_page()

        tried_urls: list[str] = []
        summary: Optional[dict[str, Any]] = None

        def visit(url: str) -> Optional[dict[str, Any]]:
            if not url or url in tried_urls:
                return None
            tried_urls.append(url)
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(4000)
            dismiss_google_popups(page)
            page.wait_for_timeout(1000)
            return extract_summary(page)

        try:
            summary = visit(source_url)

            if not summary or not summary.get("fid"):
                current_query = parse_qs(urlsplit(page.url).query).get("q", [""])[0]
                fallback_query = simplify_query(current_query) or simplify_query(page.title())
                if fallback_query:
                    summary = visit(build_google_search_url(fallback_query))

            if not summary or not summary.get("fid"):
                raise RuntimeError("Nao foi possivel localizar o painel publico de reviews do Google.")

            reviews_url = build_reviews_url(page.url, summary["fid"])
            page.goto(reviews_url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(4000)
            dismiss_google_popups(page)
            page.wait_for_timeout(1000)

            try:
                page.wait_for_selector(".bwb7ce", timeout=15000)
            except PlaywrightTimeoutError:
                raise RuntimeError("O Google nao exibiu os comentarios publicos neste momento.")

            reviews = extract_reviews(page, max_reviews)
            if not reviews:
                raise RuntimeError("Nenhum comentario publico foi encontrado no Google neste momento.")

            panel_text = clean_text(summary.get("panel_text"))
            rating_match = re.search(r"([0-5](?:[.,]\d)?)\s*(\d[\d.,]*)\s+avalia", panel_text, re.IGNORECASE)
            rating = parse_rating(rating_match.group(1)) if rating_match else parse_rating(panel_text)
            review_count = 0
            if summary.get("review_label"):
                review_count = parse_review_count(summary["review_label"])
            elif rating_match:
                review_count = parse_review_count(rating_match.group(2))

            normalized_reviews = []
            for review in reviews:
                normalized_reviews.append(
                    {
                        "author": clean_text(review.get("author")),
                        "body": clean_text(review.get("body")),
                        "rating": parse_rating(clean_text(review.get("rating_label"))),
                        "relative_date": clean_text(review.get("relative_date")),
                        "reviewer_meta": clean_text(review.get("reviewer_meta")),
                        "profile_url": clean_text(review.get("profile_url")),
                    }
                )

            return {
                "ok": True,
                "source": "google",
                "source_label": "Google",
                "source_url": source_url,
                "canonical_url": page.url,
                "reviews_url": page.url,
                "place_url": clean_text(summary.get("place_url")),
                "title": clean_text(summary.get("title")),
                "rating": rating,
                "review_count": review_count,
                "reviews": normalized_reviews,
                "fetched_at": datetime.now().astimezone().isoformat(),
            }
        finally:
            context.close()
            browser.close()


def main() -> int:
    configure_stdio()
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "message": "URL nao informada"}, ensure_ascii=False))
        return 1

    source_url = clean_text(sys.argv[1])
    max_reviews = 6
    if len(sys.argv) >= 3:
        try:
            max_reviews = max(1, min(12, int(sys.argv[2])))
        except ValueError:
            max_reviews = 6

    try:
        payload = run(source_url, max_reviews)
        print(json.dumps(payload, ensure_ascii=False))
        return 0 if payload.get("ok") else 1
    except Exception as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "message": clean_text(str(exc)) or "Falha ao consultar os reviews do Google.",
                },
                ensure_ascii=False,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
