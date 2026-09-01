#!/usr/bin/env python3
"""Download a licensed, locally cached image library for the public demo."""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/api/data/demo-media/library"
QUERIES = {
    "park": "park trees seasons",
    "river": "river stream ducks",
    "tomato": "tomato plant garden",
    "street-tree": "street tree urban nature",
    "sky-weather": "clouds sky weather",
}
TARGET_PER_SERIES = 61
USER_AGENT = "ObservationHandbookDemo/1.0 (licensed demo archive)"


def request_json(url: str) -> dict:
    output = subprocess.check_output(["curl", "-L", "-sS", "--fail", "--max-time", "45", "-A", USER_AGENT, url])
    return json.loads(output)


def collect(query: str) -> list[dict]:
    results: list[dict] = []
    page = 1
    while len(results) < TARGET_PER_SERIES and page <= 12:
        params = urllib.parse.urlencode({"q": query, "page": page, "page_size": 20})
        payload = request_json(f"https://api.openverse.org/v1/images/?{params}")
        for item in payload.get("results", []):
            url = item.get("url")
            license_name = item.get("license")
            if not url or license_name not in {"cc0", "pdm", "by", "by-sa", "by-nd"}:
                continue
            results.append({
                "id": str(item.get("id")),
                "title": item.get("title") or "Untitled image",
                "url": url,
                "creator": item.get("creator") or "Unknown creator",
                "creatorUrl": item.get("creator_url"),
                "license": license_name,
                "licenseUrl": item.get("license_url"),
                "source": item.get("source"),
                "landingUrl": item.get("foreign_landing_url"),
            })
            if len(results) >= TARGET_PER_SERIES:
                break
        page += 1
    unique: dict[str, dict] = {}
    for item in results:
        unique.setdefault(item["url"], item)
    return list(unique.values())[:TARGET_PER_SERIES]


def safe_name(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", text).strip("-").lower()
    return cleaned[:60] or "image"


def download_one(item: dict, series: str, index: int) -> dict | None:
    series_dir = OUT / series
    original_dir = series_dir / "originals"
    thumb_dir = series_dir / "thumbnails"
    original_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{index:03d}-{safe_name(item['id'])}"
    original = original_dir / f"{stem}.jpg"
    thumbnail = thumb_dir / f"{stem}.jpg"
    if not original.exists() or not thumbnail.exists():
        with tempfile.NamedTemporaryFile(suffix=".download", delete=False) as temp:
            temp_path = Path(temp.name)
        try:
            output = subprocess.check_output(["curl", "-L", "-sS", "--fail", "--max-time", "60", "-A", USER_AGENT, item["url"]])
            temp_path.write_bytes(output)
            subprocess.run(["sips", "-s", "format", "jpeg", "-Z", "1400", str(temp_path), "--out", str(original)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["sips", "-Z", "520", str(original), "--out", str(thumbnail)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as error:
            original.unlink(missing_ok=True)
            thumbnail.unlink(missing_ok=True)
            print(f"skip {series}/{index}: {error}")
            return None
        finally:
            temp_path.unlink(missing_ok=True)
    return {**item, "series": series, "index": index, "originalPath": str(original.relative_to(OUT)), "thumbnailPath": str(thumbnail.relative_to(OUT))}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    for series, query in QUERIES.items():
        items = collect(query)
        print(f"{series}: collected {len(items)} licensed sources")
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(download_one, item, series, index + 1) for index, item in enumerate(items)]
            for future in as_completed(futures):
                result = future.result()
                if result:
                    manifest.append(result)
    manifest.sort(key=lambda item: (item["series"], item["index"]))
    (OUT / "manifest.json").write_text(json.dumps({"count": len(manifest), "series": QUERIES, "items": manifest}, ensure_ascii=False, indent=2), encoding="utf-8")
    credits = ["# Public demo image credits", "", "Images are downloaded from Openverse-compatible sources with commercial-use licenses.", "Each record's creator, source, license and original URL are preserved in `manifest.json`.", ""]
    for item in manifest:
        credits.append(f"- `{item['series']}/{item['index']:03d}` — {item['title']} · {item['creator']} · {item['license']} · {item['landingUrl']}")
    (OUT / "CREDITS.md").write_text("\n".join(credits) + "\n", encoding="utf-8")
    print(f"downloaded {len(manifest)} images")


if __name__ == "__main__":
    main()
