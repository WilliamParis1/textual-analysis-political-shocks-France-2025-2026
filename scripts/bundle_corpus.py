"""Package the CSV for offline use by index.html (no browser server required)."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
with (ROOT / "data/headlines.csv").open(encoding="utf-8", newline="") as stream:
    rows = list(csv.DictReader(stream))
if not rows or set(rows[0]) != {"date", "source", "headline", "url"}:
    raise ValueError("Expected a nonempty date,source,headline,url CSV")

info = {
    "label": "Public Sénat · Politique",
    "note": "Tous les titres archivés dans la rubrique Politique de Public Sénat sur la période collectée, sans filtre par mot-clé.",
}
def to_js(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

(ROOT / "data/corpus.js").write_text(
    "window.CORPUS_INFO = " + to_js(info) + ";\n"
    "window.DEFAULT_CORPUS = " + to_js(rows) + ";\n",
    encoding="utf-8",
)
