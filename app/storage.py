# app/storage.py
from __future__ import annotations

import os
import json
from datetime import datetime
from typing import Tuple, Dict, Any

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

    Writes:
      - data/exercises/<ex_id>/versions/vNNN.json   (canonical version file)
      - data/exercises/<ex_id>/current.json         (copy of latest)
      - data/exercises/<ex_id>/meta.json            (lightweight metadata)

    Returns (rel_path, abs_path) for the version file.
    """
    abs_version = version_abs_path(ex_id, version)
    rel_version = version_rel_path(ex_id, version)

    # 1) version file
    save_json(abs_version, payload)

    # 2) current.json (easy latest read)
    save_json(current_path(ex_id), payload)

    # 3) meta.json (title/type, timestamps, pin)
    meta_p = meta_path(ex_id)
    meta = load_json(meta_p, {})
    if not meta:
        meta = {
            "id": ex_id,
            "type": ex_type or payload.get("type"),
            "title": title or payload.get("title"),
            "created": _ts_iso(),
            "updated": None,
            "latest_version": int(version),
            "pinned_version": int(version) if pin else None,
        }
    else:
        if title:
            meta["title"] = title
        if ex_type:
            meta["type"] = ex_type
        meta["latest_version"] = int(version)
        if pin or not meta.get("pinned_version"):
            meta["pinned_version"] = int(version)
    meta["updated"] = _ts_iso()
    save_json(meta_p, meta)

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