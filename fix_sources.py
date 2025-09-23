# fix_sources.py
# ------------------------------------------------------------
# Standardizes example["source"] objects in glosario-regional-argentina.json
# - HARD RULE: any "Relatos Salvajes" reference → {"kind":"pelicula","title":"Relatos Salvajes","year":"2014"}
# - Converts {"kind":"otro","text":"..."} into structured serie/pelicula when possible
# - Coerces odd shapes (None, string, missing keys) into a consistent minimal schema
# - Backs up the original JSON next to the input file as *.bak
# - Accepts Windows/Unix paths via --in / --out; also searches by basename if the path doesn't exist
# - Prints a clear summary of changes
# ------------------------------------------------------------

import argparse
import json
import re
from copy import deepcopy
from pathlib import Path

# ---------- Regex helpers ----------
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")

# Serie patterns (order matters: most specific first)
SERIE_PATTERNS = [
    # "Título, Temporada 1, Episodio 1:"
    re.compile(
        r"^\s*(?P<title>.+?),\s*Temporada\s*(?P<season>\d+),\s*Episodio\s*(?P<episode>\d+)\b.*",
        re.IGNORECASE | re.UNICODE
    ),
    # "Título, T1E1 - Algo"
    re.compile(
        r"^\s*(?P<title>.+?),\s*T(?P<season>\d+)E(?P<episode>\d+)\b.*",
        re.IGNORECASE | re.UNICODE
    ),
]

# Película pattern: "Título (2014), ..."
PELICULA_PATTERN = re.compile(
    r"^\s*(?P<title>.+?)\s*\(\s*(?P<year>(19|20)\d{2})\s*\)\b.*",
    re.UNICODE
)


# ---------- Path resolution ----------
def resolve_input_path(cli_path: str | None, default_name: str = "glosario-regional-argentina.json") -> Path:
    """
    Resolve the input JSON path robustly:
      - If --in is provided and exists → use it.
      - Else if a file with the same basename exists in CWD → use it.
      - Else search recursively under CWD for that basename.
      - Else, if --in not provided, repeat the above with the default filename.
    """
    def _search_by_basename(basename: str) -> Path | None:
        # 1) CWD
        p = Path(basename)
        if p.exists():
            return p
        # 2) Recursive search
        matches = list(Path(".").rglob(basename))
        if matches:
            return matches[0]
        return None

    if cli_path:
        p = Path(cli_path).expanduser()
        if p.exists():
            return p
        # If the full path didn't exist, try by its basename
        candidate = _search_by_basename(Path(cli_path).name)
        if candidate:
            return candidate
        raise FileNotFoundError(f"--in path not found (and not found by basename search): {cli_path}")

    # No --in provided: try default name
    candidate = _search_by_basename(default_name)
    if candidate:
        return candidate
    raise FileNotFoundError(
        f"Could not locate '{default_name}'. "
        f"Run with:  python fix_sources.py --in path\\to\\{default_name}"
    )


# ---------- Normalization helpers ----------
def contains_relatos_salvajes(text: str) -> bool:
    return bool(re.search(r"\bRelatos\s+Salvajes\b", text or "", re.IGNORECASE))


def normalize_relato_hard_rule(src_dict: dict | None, text_hint: str = "") -> dict | None:
    """
    If the source (or its text) contains 'Relatos Salvajes', return the canonical pelicula object.
    """
    if isinstance(src_dict, dict):
        for key in ("title", "text"):
            val = src_dict.get(key, "")
            if isinstance(val, str) and contains_relatos_salvajes(val):
                return {"kind": "pelicula", "title": "Relatos Salvajes", "year": "2014"}
    if text_hint and contains_relatos_salvajes(text_hint):
        return {"kind": "pelicula", "title": "Relatos Salvajes", "year": "2014"}
    return None


def parse_source_text(text: str):
    """
    Convert a free-form 'text' into a structured {kind,title,year[,season,episode]} when possible.
    Returns (normalized_source_dict, success_bool, counters_delta).
    """
    s = (text or "").strip()

    # HARD RULE first: any 'Relatos Salvajes'
    relato = normalize_relato_hard_rule({"text": s})
    if relato:
        return relato, True, {"relatos_fixed": 1}

    # Try explicit serie patterns
    for pat in SERIE_PATTERNS:
        m = pat.match(s)
        if m:
            gd = m.groupdict()
            title = gd.get("title", "").strip().rstrip(":")
            season = gd.get("season")
            episode = gd.get("episode")
            # Optional: find a year anywhere
            year = ""
            ym = YEAR_RE.search(s)
            if ym:
                year = ym.group(0)
            out = {
                "kind": "serie",
                "title": title,
                "year": year,
                "season": str(int(season)) if season is not None else "",
                "episode": str(int(episode)) if episode is not None else "",
            }
            return out, True, {"series_fixed": 1}

    # Película pattern "Title (YYYY) ..."
    pm = PELICULA_PATTERN.match(s)
    if pm:
        title = pm.group("title").strip()
        year = pm.group("year")
        # Drop any trailing ", segmento …" that might sneak into title area
        title = re.sub(r",\s*segmento.*$", "", title, flags=re.IGNORECASE).strip()
        out = {"kind": "pelicula", "title": title, "year": year}
        return out, True, {"peliculas_fixed": 1}

    # Heuristic: mentions Temporada or T#E#
    if re.search(r"\bTemporada\b", s, flags=re.IGNORECASE) or re.search(r"\bT\d+E\d+\b", s, flags=re.IGNORECASE):
        season, episode = "", ""
        m = re.search(r"T(\d+)E(\d+)", s, flags=re.IGNORECASE)
        if m:
            season, episode = m.group(1), m.group(2)
        year = ""
        ym = YEAR_RE.search(s)
        if ym:
            year = ym.group(0)
        title = s.split(",")[0].strip().rstrip(":")
        out = {"kind": "serie", "title": title, "year": year, "season": season, "episode": episode}
        return out, True, {"series_fixed": 1}

    # Heuristic película if it says 'segmento' and has a year
    if "segmento" in s.lower() and YEAR_RE.search(s):
        # Title before "(" best-effort; else before first comma; else whole
        paren = s.find("(")
        if paren > 0:
            title = s[:paren].strip()
        else:
            title = s.split(",")[0].strip()
        year = YEAR_RE.search(s).group(0)
        out = {"kind": "pelicula", "title": title, "year": year}
        return out, True, {"peliculas_fixed": 1}

    # Fallback: coerce to minimal 'otro' with 'title' (drop legacy 'text')
    return {"kind": "otro", "title": s, "year": ""}, False, {"otros_coerced": 1}


def normalize_source(src):
    """
    Normalize a source object. Leaves already-correct objects mostly untouched,
    but applies the Relatos Salvajes hard rule even if already structured.
    Returns: (normalized_source, changed?, counters_delta)
    """
    counters = {"relatos_fixed": 0, "series_fixed": 0, "peliculas_fixed": 0, "otros_coerced": 0, "missing_added": 0}

    # None / missing → minimal empty
    if src is None:
        counters["missing_added"] += 1
        return {"kind": "otro", "title": "", "year": ""}, True, counters

    # Unexpected non-dict (e.g., a plain string) → coerce to 'otro'
    if not isinstance(src, dict):
        counters["otros_coerced"] += 1
        return {"kind": "otro", "title": str(src), "year": ""}, True, counters

    # HARD RULE: if any field references Relatos Salvajes → canonical pelicula
    relato = normalize_relato_hard_rule(src)
    if relato:
        counters["relatos_fixed"] += 1
        return relato, True, counters

    # Already structured kinds
    if src.get("kind") in {"pelicula", "serie"} and "title" in src:
        changed = False
        out = deepcopy(src)
        if src["kind"] == "pelicula":
            # For peliculas, keep only title/year; drop season/episode if present
            if "season" in out:
                out.pop("season")
                changed = True
            if "episode" in out:
                out.pop("episode")
                changed = True
            if "year" not in out:
                out["year"] = ""
                changed = True
        elif src["kind"] == "serie":
            # For series, ensure keys exist
            if "season" not in out:
                out["season"] = ""
                changed = True
            if "episode" not in out:
                out["episode"] = ""
                changed = True
            if "year" not in out:
                out["year"] = ""
                changed = True
        return out, changed, counters

    # Legacy 'otro' with 'text'
    if src.get("kind") == "otro" and "text" in src:
        normalized, success, delta = parse_source_text(src.get("text", ""))
        for k, v in delta.items():
            counters[k] = counters.get(k, 0) + v
        return normalized, True, counters

    # Other odd shapes → try to coerce minimally to include required keys
    changed = False
    out = deepcopy(src)
    if "title" not in out:
        out["title"] = ""
        changed = True
    if "year" not in out:
        out["year"] = ""
        changed = True
    if "kind" not in out:
        out["kind"] = "otro"
        changed = True
    if changed:
        counters["otros_coerced"] += 1
    return out, changed, counters


def walk_and_fix(data):
    """
    Walk entries → senses → examples, normalizing example['source'].
    Returns (new_data, summary_counters, total_changes)
    """
    summary = {"relatos_fixed": 0, "series_fixed": 0, "peliculas_fixed": 0, "otros_coerced": 0, "missing_added": 0}
    changes = 0

    if not isinstance(data, list):
        return data, summary, changes

    for entry in data:
        for sense in entry.get("senses", []):
            for ex in sense.get("examples", []):
                if "source" in ex:
                    new_src, did_change, delta = normalize_source(ex.get("source"))
                else:
                    # Ensure key exists
                    new_src, did_change, delta = normalize_source(None)

                if did_change:
                    ex["source"] = new_src
                    changes += 1

                for k, v in delta.items():
                    summary[k] = summary.get(k, 0) + v

    return data, summary, changes


def main():
    parser = argparse.ArgumentParser(description="Normalize example.source objects in the glossary JSON.")
    parser.add_argument("--in", dest="in_path", default=None, help="Path to glosario-regional-argentina.json (accepts Windows/Unix)")
    parser.add_argument("--out", dest="out_path", default=None, help="Optional output path (defaults to overwrite input)")
    args = parser.parse_args()

    input_path = resolve_input_path(args.in_path)
    output_path = Path(args.out_path).expanduser() if args.out_path else input_path

    # Backup next to input
    backup_path = input_path.with_suffix(input_path.suffix + ".bak")
    backup_path.write_bytes(input_path.read_bytes())

    data = json.loads(input_path.read_text(encoding="utf-8"))
    new_data, summary, changes = walk_and_fix(data)

    # Save result (pretty-printed)
    output_path.write_text(json.dumps(new_data, ensure_ascii=False, indent=2), encoding="utf-8")

    print("✅ Done. Sources normalized.")
    print(f"   Input : {input_path}")
    print(f"   Output: {output_path} (overwritten)" if output_path == input_path else f"   Output: {output_path}")
    print(f"🗄️  Backup saved to: {backup_path}")
    print(f"🔢 Changes applied: {changes}")
    print(
        "📊 Breakdown → "
        f"Relatos fixed: {summary.get('relatos_fixed',0)} | "
        f"Series fixed: {summary.get('series_fixed',0)} | "
        f"Películas fixed: {summary.get('peliculas_fixed',0)} | "
        f"Otros coerced: {summary.get('otros_coerced',0)} | "
        f"Missing added: {summary.get('missing_added',0)}"
    )


if __name__ == "__main__":
    main()
