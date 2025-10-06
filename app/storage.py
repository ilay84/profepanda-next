# app/storage.py
from __future__ import annotations

import os
import json
from datetime import datetime
from typing import Tuple, Dict, Any
# --- NEW: helpers for organized exercise storage (type/slug/NNN.json) ---
import re
import unicodedata
from pathlib import Path

# Where exercises live on disk (adjust if your project uses a different root)
EX_BASE_DIR = Path("data/exercises")

def slugify_title(text: str) -> str:
    """
    Slugify an exercise title for use as a folder name.
    Keeps letters/numbers, converts spaces/underscores to '-', strips accents.
    """
    if not isinstance(text, str) or not text.strip():
        return "untitled"
    # normalize accents, lower, strip
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = t.lower().strip()
    # spaces/underscores -> dash
    t = re.sub(r"[\s_]+", "-", t)
    # keep only a-z, 0-9 and dashes
    t = re.sub(r"[^a-z0-9\-]", "", t)
    # collapse multiple dashes
    t = re.sub(r"-{2,}", "-", t).strip("-")
    return t or "untitled"

def ensure_dirs_for(ex_type: str, title_slug: str) -> Path:
    """
    Ensure the directory static/exercises/<type>/<slug>/ exists and return it.
    ex_type is expected like 'tf', 'mcq', 'cloze', etc.
    """
    if not ex_type:
        ex_type = "misc"
    safe_type = slugify_title(str(ex_type))
    safe_slug = slugify_title(str(title_slug))
    folder = EX_BASE_DIR / safe_type / safe_slug
    folder.mkdir(parents=True, exist_ok=True)
    return folder

def next_number_filename(folder: Path, width: int = 3) -> str:
    """
    Find the next numeric filename (e.g., 001.json, 002.json) in a folder.
    """
    max_n = 0
    for p in folder.glob("[0-9]" * width + ".json"):
        try:
            n = int(p.stem)
            if n > max_n:
                max_n = n
        except ValueError:
            continue
    nxt = max_n + 1
    return f"{nxt:0{width}d}.json"

def build_exercise_paths(ex_type: str, title: str) -> dict:
    """
    Returns paths for saving a new version:
      {
        'folder': Path(.../<type>/<slug>/),
        'version_file': Path(.../<type>/<slug>/NNN.json),
        'current_file': Path(.../<type>/<slug>/current.json),
        'meta_file': Path(.../<type>/<slug>/meta.json),
        'slug': '<slug>'
      }
    (No file I/O performed here, only path calculation and ensuring folder.)
    """
    slug = slugify_title(title or "untitled")
    folder = ensure_dirs_for(ex_type, slug)
    version_file = folder / next_number_filename(folder, width=3)
    current_file = folder / "current.json"
    meta_file = folder / "meta.json"
    return {
        "folder": folder,
        "version_file": version_file,
        "current_file": current_file,
        "meta_file": meta_file,
        "slug": slug,
    }
# --- /NEW helpers ---

# --- Paths --------------------------------------------------------------

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
EXERCISES_DIR = os.path.join(DATA_DIR, "exercises")


def _ts_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _ensure_dir(p: str) -> str:
    os.makedirs(p, exist_ok=True)
    return p


def exercise_dir(ex_id: str) -> str:
    return _ensure_dir(os.path.join(EXERCISES_DIR, ex_id))


def versions_dir(ex_id: str) -> str:
    return _ensure_dir(os.path.join(exercise_dir(ex_id), "versions"))


def meta_path(ex_id: str) -> str:
    return os.path.join(exercise_dir(ex_id), "meta.json")


def current_path(ex_id: str) -> str:
    return os.path.join(exercise_dir(ex_id), "current.json")


def version_filename(version: int) -> str:
    return f"v{int(version):03d}.json"


def version_abs_path(ex_id: str, version: int) -> str:
    return os.path.join(versions_dir(ex_id), version_filename(version))


def version_rel_path(ex_id: str, version: int) -> str:
    # repo-relative (what we store in the index)
    return os.path.join("data", "exercises", ex_id, "versions", version_filename(version)).replace("\\", "/")


def oldstyle_rel_path(ex_id: str, version: int) -> str:
    # back-compat helper for files like "<id>@vN.json"
    return os.path.join("data", "exercises", f"{ex_id}@v{int(version)}.json").replace("\\", "/")


# --- JSON I/O -----------------------------------------------------------

def load_json(path: str, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path: str, obj) -> None:
    _ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


# --- Public API: write a version + keep meta/current --------------------

def write_exercise_version(
    ex_id: str,
    version: int,
    payload: Dict[str, Any],
    *,
    title: str | None = None,
    ex_type: str | None = None,
    pin: bool = True,
) -> Tuple[str, str]:
    """
    Canonical writer for exercises.

    NEW LAYOUT:
      data/exercises/<type>/<slug>/
        meta.json
        current.json
        NNN.json           (version file, 3-digit)

    Returns (rel_path, abs_path) for the version file (repo-relative path).
    """
    # Guard + defaults
    ex_type = (ex_type or (payload or {}).get("type") or "misc").strip().lower()
    title_for_slug = title or (payload or {}).get("title") or ex_id

    # Use the helpers added in Edit #1
    try:
        from .storage import build_exercise_paths  # self-import for clarity
    except Exception:
        # If helpers aren’t available for some reason, fall back to flat ID layout
        # (keeps things from breaking)
        rel_fallback = os.path.join("data", "exercises", f"{ex_id}", "versions", f"v{int(version):03d}.json")
        abs_fallback = os.path.abspath(os.path.join(PROJECT_ROOT, rel_fallback))
        _ensure_dir(os.path.dirname(abs_fallback))
        save_json(abs_fallback, payload)
        # also write simple current/meta in the same legacy folder
        save_json(os.path.abspath(os.path.join(PROJECT_ROOT, "data", "exercises", ex_id, "current.json")), payload)
        meta_p = os.path.abspath(os.path.join(PROJECT_ROOT, "data", "exercises", ex_id, "meta.json"))
        meta = load_json(meta_p, {}) or {}
        meta.update({
            "id": ex_id,
            "title": title or meta.get("title"),
            "type": ex_type or meta.get("type"),
            "latest_version": int(version),
            "pinned_version": int(version) if pin or not meta.get("pinned_version") else meta.get("pinned_version"),
            "updated": _ts_iso(),
        })
        save_json(meta_p, meta)
        return (rel_fallback, abs_fallback)

    paths = build_exercise_paths(ex_type, title_for_slug)
    folder = paths["folder"]
    # we want the version number we were asked to write (not auto-increment),
    # using 3 digits like 001.json
    ver_filename = f"{int(version):03d}.json"
    version_file = folder / ver_filename
    current_file = paths["current_file"]
    meta_file    = paths["meta_file"]

    # 1) Write version file
    _ensure_dir(str(folder))
    save_json(str(version_file), payload)

    # 2) Write current.json (copy of latest)
    save_json(str(current_file), payload)

    # 3) Update meta.json
    meta = load_json(str(meta_file), {}) or {}
    if not isinstance(meta, dict):
        meta = {}
    # minimal identifying info
    meta.setdefault("id", ex_id)  # keep stable GUID/ID for the record
    meta["title"] = title or meta.get("title") or title_for_slug
    meta["type"] = ex_type or meta.get("type") or "misc"
    meta["latest_version"] = int(version)
    if pin or not meta.get("pinned_version"):
        meta["pinned_version"] = int(version)
    meta["updated"] = _ts_iso()
    save_json(str(meta_file), meta)

    # Return repo-relative path for index (e.g., "data/exercises/tf/mi-ejercicio/001.json")
    rel_version = os.path.relpath(str(version_file), PROJECT_ROOT).replace("\\", "/")
    abs_version = str(version_file)
    return (rel_version, abs_version)

# --- Back-compat helpers (optional) ------------------------------------

def resolve_version_abspath_from_rel(rel_path: str) -> str:
    """Turn 'data/…' relative paths (as stored in the index) into absolute paths."""
    return os.path.abspath(os.path.join(PROJECT_ROOT, rel_path))


def maybe_read_oldstyle_payload(ex_id: str, version: int):
    """
    Try to load legacy '<id>@vN.json'. Returns (payload or None, rel_path or None).
    Useful if you want to auto-migrate old versions later.
    """
    rel = oldstyle_rel_path(ex_id, version)
    abs_p = resolve_version_abspath_from_rel(rel)
    if os.path.exists(abs_p):
        try:
            return load_json(abs_p, None), rel
        except Exception:
            return None, None
    return None, None