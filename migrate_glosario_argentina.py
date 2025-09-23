#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migrate/merge OLD glossary JSON into the NEW multi-sense format used by the project.

- Reads an "old" JSON file (default: ./old_glosario.json)
- Optionally reads the current new JSON to merge into
  (default: ./data/glossaries/glosario-regional-argentina.json)
- Writes a MIGRATED output first (default: ./data/glossaries/glosario-regional-argentina.MIGRATED.json)
  so you can review before replacing the live file.

Usage (examples):
  python migrate_glosario_argentina.py
  python migrate_glosario_argentina.py --input "old_glosario.json"
  python migrate_glosario_argentina.py --input "path/to/old.json" --existing "data/glossaries/glosario-regional-argentina.json" --output "data/glossaries/glosario-regional-argentina.MIGRATED.json" --sort
"""

import argparse, json, os, sys, re, unicodedata
from pathlib import Path
from typing import Any, Dict, List

# --- Project path defaults
DEFAULT_INPUT   = Path("old_glosario.json")  # <-- put your OLD file here or pass --input
DEFAULT_EXISTING= Path("data/glossaries/glosario-regional-argentina.json")
DEFAULT_OUTPUT  = Path("data/glossaries/glosario-regional-argentina.MIGRATED.json")

# --- Helpers
def slugify(text: str) -> str:
    text = (text or "").strip().lower().replace("ñ", "n")
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text

def normalize_variants(v: Any) -> Dict[str, List[str]]:
    """
    Normalize variants to canonical keys used by the new project:
      ms, mp, fs, fp, diminutivo, aumentativo
    Accepts old keys like "m.s.", "m.p.", "f.s.", "f.p.", "dim.", "aum."
    """
    out = {"ms": [], "mp": [], "fs": [], "fp": [], "diminutivo": [], "aumentativo": []}
    if not isinstance(v, dict):
        return out

    # direct canonical keys
    for k in ["ms", "mp", "fs", "fp", "diminutivo", "aumentativo"]:
        vals = v.get(k)
        if isinstance(vals, list):
            out[k] = [s for s in (vals or []) if isinstance(s, str) and s.strip()]

    # old dotted keys
    mapping = {
        "m.s.": "ms", "m.p.": "mp", "f.s.": "fs", "f.p.": "fp",
        "dim.": "diminutivo", "aum.": "aumentativo"
    }
    for old_key, new_key in mapping.items():
        vals = v.get(old_key)
        if isinstance(vals, list):
            out[new_key].extend([s for s in (vals or []) if isinstance(s, str) and s.strip()])

    # remove dups, keep order
    for k in out:
        seen = set()
        uniq = []
        for s in out[k]:
            if s not in seen:
                uniq.append(s)
                seen.add(s)
        out[k] = uniq
    return out

def coerce_source(src: Any) -> Any:
    """
    Convert old string sources to structured dicts:
      "Some source" -> {"kind": "otro", "text": "Some source"}
    If src is already a dict with fields (kind/title/handle/etc.), keep as-is.
    """
    if isinstance(src, dict) or src is None:
        return src
    return {"kind": "otro", "text": str(src)}

def entry_richness_score(e: Dict[str, Any]) -> int:
    """Heuristic for merge conflicts: more examples + more tags wins."""
    try:
        senses = e.get("senses") or []
        ex_count = sum(len(s.get("examples") or []) for s in senses)
        tg_count = sum(len(s.get("tag_general") or []) for s in senses)
        return ex_count * 10 + tg_count
    except Exception:
        return 0

def normalize_for_sort(s: str) -> str:
    s = s or ""
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

def to_new_format(old: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a single OLD entry to the NEW multi-sense shape:
      - wrap old fields into senses[0]
      - map type -> tag_word_class
      - map tags -> tag_general
      - keep word-level audio if present (audio or audio_word)
    """
    word = (old.get("word") or "").strip()
    if not word:
        return {}

    slug = (old.get("slug") or "").strip() or slugify(word)
    variants = normalize_variants(old.get("variants") or {})

    # word-level audio (handle both "audio" and legacy "audio_word")
    audio = old.get("audio")
    if not audio:
        audio = old.get("audio_word")

    # Build sense from old flat fields if senses is not already present/valid
    if isinstance(old.get("senses"), list) and old["senses"]:
        # Ensure normalization inside existing senses too (source normalization)
        senses = []
        for s in old["senses"]:
            # clone minimal with coerced source in examples
            examples = []
            for ex in (s.get("examples") or []):
                examples.append({
                    "es": ex.get("es", ""),
                    "en": ex.get("en", ""),
                    "audio": ex.get("audio"),
                    "source": coerce_source(ex.get("source")),
                    "linked": ex.get("linked", []),
                })
            senses.append({
                "id": s.get("id") or "s1",
                "tag_word_class": s.get("tag_word_class") or ([] if not old.get("type") else [old.get("type")]),
                "tag_general": s.get("tag_general") or (old.get("tags") or []),
                "definition": s.get("definition", ""),
                "equivalents": s.get("equivalents", []),
                "see_also": s.get("see_also", []),
                "examples": examples,
                # if some projects stored per-sense audio:
                "audio": s.get("audio")
            })
    else:
        # Build a single sense from old flat fields
        examples = []
        for ex in (old.get("examples") or []):
            examples.append({
                "es": ex.get("es", ""),
                "en": ex.get("en", ""),
                "audio": ex.get("audio"),
                "source": coerce_source(ex.get("source")),
                "linked": ex.get("linked", []),
            })
        senses = [{
            "id": "s1",
            "tag_word_class": [old["type"]] if old.get("type") else [],
            "tag_general": old.get("tags", []),
            "definition": old.get("definition", ""),
            "equivalents": old.get("equivalents", []),
            "see_also": [],
            "examples": examples
        }]

    return {
        "word": word,
        "slug": slug,
        "variants": variants,
        "audio": audio,
        "senses": senses
    }

def load_json(path: Path) -> Any:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ {path}: invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

def index_by_word(entries: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    idx = {}
    for e in entries or []:
        w = (e.get("word") or "").strip().casefold()
        if not w:
            continue
        if w not in idx:
            idx[w] = e
        else:
            # keep the richer one
            if entry_richness_score(e) > entry_richness_score(idx[w]):
                idx[w] = e
    return idx

def main():
    ap = argparse.ArgumentParser(description="Migrate old glossary JSON → new multi-sense format")
    ap.add_argument("--input", "-i", type=Path, default=DEFAULT_INPUT, help="Path to OLD glossary JSON")
    ap.add_argument("--existing", "-e", type=Path, default=DEFAULT_EXISTING, help="Path to CURRENT new JSON (to merge into)")
    ap.add_argument("--output", "-o", type=Path, default=DEFAULT_OUTPUT, help="Where to write migrated output")
    ap.add_argument("--sort", action="store_true", help="Sort alphabetically by 'word'")
    args = ap.parse_args()

    old_raw = load_json(args.input)
    if not isinstance(old_raw, list):
        print("❌ --input must be a list of entries.", file=sys.stderr)
        sys.exit(1)

    existing_raw = load_json(args.existing)
    if existing_raw and not isinstance(existing_raw, list):
        print("❌ --existing must be a list of entries.", file=sys.stderr)
        sys.exit(1)

    # Convert OLD → NEW shape
    converted = []
    for o in old_raw:
        new_e = to_new_format(o)
        if new_e:
            converted.append(new_e)

    # Merge into existing (existing wins ties unless converted is richer)
    merged_idx = index_by_word(existing_raw if isinstance(existing_raw, list) else [])
    conv_idx   = index_by_word(converted)

    for w, e in conv_idx.items():
        if w not in merged_idx:
            merged_idx[w] = e
        else:
            if entry_richness_score(e) > entry_richness_score(merged_idx[w]):
                merged_idx[w] = e

    out = list(merged_idx.values())
    if args.sort:
        out.sort(key=lambda e: normalize_for_sort(e.get("word", "")))

    # Ensure output dir
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"✅ Converted {len(converted)} entries from OLD file.")
    print(f"↪  Existing entries loaded: {len(existing_raw) if isinstance(existing_raw, list) else 0}")
    print(f"📦 Final merged count: {len(out)}")
    print(f"💾 Wrote: {args.output}")

if __name__ == "__main__":
    main()