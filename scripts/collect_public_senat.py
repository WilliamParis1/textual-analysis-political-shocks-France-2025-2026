"""Collect linked headline metadata from Public Sénat's Politique news section."""
import argparse
import csv
import json
import re
import sys
import tempfile
import time
from datetime import date, timedelta
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

ENDPOINT = "https://www.publicsenat.fr/wp-json/wp/v2/posts"
FIELDS = ("date", "source", "headline", "url")


def retrieve(page, start, end):
    # Include midnight at the left boundary even on APIs using strict comparisons.
    params = {
        "after": f"{start - timedelta(days=1)}T23:59:59",
        "before": f"{end + timedelta(days=1)}T00:00:00",
        "per_page": 100,
        "orderby": "id",
        "order": "asc",
        "_fields": "id,date,title,link",
        "page": page,
    }
    request = Request(f"{ENDPOINT}?{urlencode(params)}",
                      headers={"User-Agent": "PoliticalHeadlineResearch/1.0"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=45) as response:
                return (json.load(response), int(response.headers["X-WP-TotalPages"]),
                        int(response.headers["X-WP-Total"]))
        except (URLError, TimeoutError) as err:
            if isinstance(err, HTTPError) and err.code < 500 and err.code != 429:
                raise
            if attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))


def collect(start, end):
    rows, seen = [], set()
    page, pages, expected = 1, 1, None
    while page <= pages:
        items, current_pages, total = retrieve(page, start, end)
        if expected is not None and (total, current_pages) != (expected, pages):
            raise RuntimeError("Source archive changed during collection. Please retry.")
        pages, expected = current_pages, total
        for item in items:
            if item["id"] in seen:
                raise RuntimeError("Inconsistent API pagination. Please retry.")
            seen.add(item["id"])
            day = date.fromisoformat(item["date"][:10])
            url = item["link"]
            if start <= day <= end and urlsplit(url).path.startswith("/actualites/politique/"):
                title = " ".join(unescape(re.sub(r"<[^>]+>", "", item["title"]["rendered"])).split())
                if not title:
                    raise ValueError(f"Missing headline for {url}")
                rows.append((day.isoformat(), "Public Sénat", title, url))
        page += 1
        if page <= pages:
            time.sleep(0.2)
    if len(seen) != expected:
        raise RuntimeError(f"Incomplete collection ({len(seen)}/{expected}).")
    return sorted(rows), expected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=date.fromisoformat, default=date(2024, 6, 1))
    parser.add_argument("--end", type=date.fromisoformat, default=date(2026, 10, 31))
    parser.add_argument("--output", type=Path, default=Path("data/headlines.csv"))
    args = parser.parse_args()
    if args.start > args.end:
        parser.error("Start must be on or before end.")
    rows, total = collect(args.start, args.end)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False,
                                     dir=args.output.parent) as file:
        temporary = Path(file.name)
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(FIELDS)
        writer.writerows(rows)
    temporary.replace(args.output)
    print(f"{len(rows)} Politique headlines retained from {total} API posts.", file=sys.stderr)


if __name__ == "__main__":
    main()
