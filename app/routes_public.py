from flask import Blueprint, render_template, send_from_directory, abort
import os
import json
from flask import request
from flask import make_response

# === BEGIN: Public Pages loader (flat + foldered) ===
def _public_pages_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '.', 'data', 'pages', 'pages.json'))

def _public_pages_root():
    # root folder that may contain <slug>/page.json
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '.', 'data', 'pages'))

def _safe_read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception:
        return None

def _public_load_pages():
    """
    Load pages from:
      1) data/pages/pages.json (flat list)
      2) data/pages/<slug>/page.json (foldered)
    Merge by slug; prefer foldered version on conflict.
    """
    # 1) Flat list
    flat = []
    flat_path = _public_pages_path()
    if os.path.exists(flat_path):
        data = _safe_read_json(flat_path) or []
        if isinstance(data, list):
            flat = [p for p in data if isinstance(p, dict)]

    # 2) Foldered pages
    merged = {}
    root = _public_pages_root()
    if os.path.isdir(root):
        try:
            for name in os.listdir(root):
                folder = os.path.join(root, name)
                if not os.path.isdir(folder):
                    continue
                page_json = os.path.join(folder, "page.json")
                if not os.path.exists(page_json):
                    continue
                obj = _safe_read_json(page_json)
                if isinstance(obj, dict):
                    slug = (obj.get("slug") or name).strip().lower()
                    if slug:
                        merged[slug] = obj
        except Exception:
            pass

    # 3) Add any flat entries not overridden by foldered
    for p in flat:
        slug = (p.get("slug") or "").strip().lower()
        if slug and slug not in merged:
            merged[slug] = p

    # Return newest-first friendly list (caller also sorts by created_at)
    # 4) Remove hidden pages from public output
    return [p for p in merged.values() if (p.get("status") != "hidden")]
# === END: Public Pages loader (flat + foldered) ===

# === BEGIN: public-side loader for glossary visibility settings ===
def _public_settings_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'glossaries', 'settings.json'))

def _public_default_settings(country_map):
    # Default: enable only Argentina unless overridden
    return {code: (code == "ar") for code in country_map.keys()}

def load_public_glossary_settings(country_map):
    """
    Safe loader for /data/glossaries/settings.json on the public side.
    Falls back to defaults if file missing or invalid.
    """
    path = _public_settings_path()
    if not os.path.exists(path):
        return _public_default_settings(country_map)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
        merged = _public_default_settings(country_map)
        # keep only known codes, coerce to bool
        for code in country_map.keys():
            if code in data:
                merged[code] = bool(data[code])
        return merged
    except Exception:
        return _public_default_settings(country_map)
# === END: public-side loader for glossary visibility settings ===

# Map country codes to JSON file base names
country_map = {
    "ar": "glosario-regional-argentina",
    "bo": "glosario-regional-bolivia",
    "cl": "glosario-regional-chile",
    "co": "glosario-regional-colombia",
    "cr": "glosario-regional-costa_rica",
    "cu": "glosario-regional-cuba",
    "do": "glosario-regional-republica_dominicana",
    "ec": "glosario-regional-ecuador",
    "sv": "glosario-regional-el_salvador",
    "gq": "glosario-regional-guinea_ecuatorial",
    "gt": "glosario-regional-guatemala",
    "hn": "glosario-regional-honduras",
    "mx": "glosario-regional-mexico",
    "ni": "glosario-regional-nicaragua",
    "pa": "glosario-regional-panama",
    "py": "glosario-regional-paraguay",
    "pe": "glosario-regional-peru",
    "pr": "glosario-regional-puerto_rico",
    "es": "glosario-regional-espana",
    "uy": "glosario-regional-uruguay",
    "ve": "glosario-regional-venezuela"
}

# 🆕 New: map country codes to default glossary colors
country_colors = {
    "ar": "#74ACDF",  # Argentina blue
    "bo": "#D52B1E",  # Bolivia red
    "cl": "#0033A0",  # Chile blue
    "co": "#FFD700",  # Colombia yellow
    "cr": "#002B7F",  # Costa Rica blue
    "cu": "#002A8F",  # Cuba blue
    "do": "#002D62",  # Dominican Republic blue
    "ec": "#FFD100",  # Ecuador yellow
    "sv": "#0047AB",  # El Salvador blue
    "gq": "#009739",  # Equatorial Guinea green
    "gt": "#4997D0",  # Guatemala light blue
    "hn": "#0073CF",  # Honduras blue
    "mx": "#006847",  # Mexico green
    "ni": "#0067C6",  # Nicaragua blue
    "pa": "#005EB8",  # Panama blue
    "py": "#D52B1E",  # Paraguay red
    "pe": "#D91023",  # Peru red
    "pr": "#0038A8",  # Puerto Rico blue
    "es": "#AA151B",  # Spain red
    "uy": "#0038A8",  # Uruguay blue
    "ve": "#FFCC00",  # Venezuela yellow
}

bp = Blueprint("public", __name__)

# === BEGIN: Public Pages loader ===
def _public_pages_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'pages', 'pages.json'))

def _public_load_pages():
    """
    Load pages from both sources, hide status == 'hidden',
    and de-duplicate by *base* slug (strip a trailing -<number>),
    keeping the newest (by updated_at, then created_at).
      - flat:     data/pages/pages.json
      - foldered: data/pages/<slug>/page.json
    """
    from datetime import datetime
    import re

    def norm_slug(s: str) -> str:
        s = (s or "").strip().lower()
        # strip trailing "-<digits>" once: e.g., "foo-bar-3" -> "foo-bar"
        m = re.match(r"^(.*?)(?:-\d+)?$", s)
        return m.group(1) if m else s

    def parse_dt(s):
        if not s:
            return None
        s = str(s).strip()
        try:
            # ISO (with/without Z)
            return datetime.fromisoformat(s.replace("Z", "").replace("z", ""))
        except Exception:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                try:
                    return datetime.strptime(s, fmt)
                except Exception:
                    continue
        return None

    # 1) read flat list
    flat = []
    path = _public_pages_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f) or []
            if isinstance(data, list):
                flat = [p for p in data if isinstance(p, dict)]
        except Exception:
            pass

    # 2) read foldered pages
    foldered = []
    pages_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "pages"))
    if os.path.isdir(pages_root):
        try:
            for name in os.listdir(pages_root):
                folder = os.path.join(pages_root, name)
                if not os.path.isdir(folder):
                    continue
                page_json = os.path.join(folder, "page.json")
                if not os.path.exists(page_json):
                    continue
                try:
                    with open(page_json, "r", encoding="utf-8") as f:
                        obj = json.load(f)
                    if isinstance(obj, dict):
                        foldered.append(obj)
                except Exception:
                    continue
        except Exception:
            pass

    # 3) combine, drop hidden
    all_pages = []
    for p in flat + foldered:
        if not isinstance(p, dict):
            continue
        if (p.get("status") == "hidden"):
            continue
        all_pages.append(p)

    # 4) de-duplicate by base slug; pick newest by (updated_at, created_at)
    buckets = {}
    for p in all_pages:
        slug = (p.get("slug") or "").strip().lower()
        base = norm_slug(slug)
        key = base or slug
        # choose best candidate
        cur = buckets.get(key)
        def score(x):
            return (
                parse_dt(x.get("updated_at")) or parse_dt(x.get("created_at")) or datetime.min,
                # tie-breaker: prefer longer slug (usually the one with -<n>)
                len(x.get("slug") or ""),
            )
        if cur is None or score(p) > score(cur):
            buckets[key] = p

    # 5) return newest-first friendly list
    result = list(buckets.values())
    result.sort(key=lambda p: (p.get("updated_at") or p.get("created_at") or ""), reverse=True)
    return result
# === END: Public Pages loader ===

# ------------------------------------------------------
# Simple in-memory cache for homepage tiles per language
# ------------------------------------------------------
from time import time

_tiles_cache = {"es": None, "en": None}
_tiles_cache_time = {"es": 0, "en": 0}
_CACHE_TTL = 60 * 5  # 5 minutes

def _get_cached_tiles(lang):
    """Return cached tiles for lang if still valid."""
    now = time()
    if _tiles_cache[lang] and (now - _tiles_cache_time[lang]) < _CACHE_TTL:
        return _tiles_cache[lang]
    return None

def _set_cached_tiles(lang, tiles):
    """Store tiles in cache for lang."""
    _tiles_cache[lang] = tiles
    _tiles_cache_time[lang] = time()

@bp.route("/")
def index():
    """
    Home page: load tiles from data/pages/home_tiles.json (if present),
    normalize fields to match the template, and pass them in.
    Uses a small per-language in-memory cache that auto-invalidates when
    the JSON file changes (based on its mtime).
    """
    from flask import g

    # --- per-lang cache (created once) ---
    cache = globals().setdefault("_HOMEPAGE_TILES_CACHE", {"es": {"tiles": None, "mtime": -1}, "en": {"tiles": None, "mtime": -1}})
    lang = getattr(g, "lang", "es") if getattr(g, "lang", "es") in ("es", "en") else "es"

    # Paths
    tiles = []
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        tiles_path = os.path.join(base_dir, "data", "pages", "home_tiles.json")

        # If file exists, consider cache
        current_mtime = os.path.getmtime(tiles_path) if os.path.exists(tiles_path) else -1

        # Serve from cache if valid
        if current_mtime >= 0 and cache.get(lang, {}).get("tiles") is not None and cache[lang].get("mtime") == current_mtime:
            tiles = cache[lang]["tiles"]
        else:
            # (Re)load from disk
            loaded_tiles = []
            if os.path.exists(tiles_path):
                with open(tiles_path, "r", encoding="utf-8") as f:
                    raw = json.load(f) or []
                    if isinstance(raw, list):
                        normd = []
                        for t in raw:
                            if not isinstance(t, dict):
                                continue
                            # Only enabled tiles (default True)
                            if not t.get("enabled", True):
                                continue

                            # --- Pull both ES + EN fields ---
                            title_es = t.get("title") or ""
                            desc_es  = t.get("subtitle") or t.get("description") or t.get("desc") or ""
                            title_en = t.get("title_en") or ""
                            desc_en  = t.get("subtitle_en") or t.get("description_en") or ""

                            href = t.get("href") or t.get("link") or "#"

                            # Image normalization → store path relative to /static
                            img = (t.get("image_url") or t.get("image") or "").strip()
                            if img.startswith("/static/"):
                                img = img[len("/static/"):]
                            elif img.startswith("static/"):
                                img = img[len("static/"):]

                            normd.append({
                                "title": title_es,
                                "desc": desc_es,
                                "title_en": title_en,
                                "desc_en": desc_en,
                                "href": href,
                                "image": img,
                                "enabled": True,
                                "order": int(t.get("order", 9999)) if str(t.get("order", "")).isdigit() else 9999
                            })

                        loaded_tiles = sorted(normd, key=lambda x: x.get("order", 9999))

            tiles = loaded_tiles

            # Update cache for this lang (also when empty list)
            if current_mtime >= 0:
                cache[lang] = {"tiles": tiles, "mtime": current_mtime}
            else:
                # no file → invalidate cache for both langs
                cache["es"] = {"tiles": None, "mtime": -1}
                cache["en"] = {"tiles": None, "mtime": -1}

    except Exception:
        tiles = []

    # Only pass tiles if we have any; otherwise let template fallback render
    if tiles:
        return render_template("index.html", tiles=tiles)
    return render_template("index.html")

@bp.route("/glosarios")
def glosarios_index():
    """
    Neutral landing page that lists all **enabled** regional glossaries.
    Links go to /<country_code>/glosario
    """
    country_names = {
        "ar": "Argentina","bo": "Bolivia","cl": "Chile","co": "Colombia","cr": "Costa Rica",
        "cu": "Cuba","do": "República Dominicana","ec": "Ecuador","sv": "El Salvador",
        "gq": "Guinea Ecuatorial","gt": "Guatemala","hn": "Honduras","mx": "México",
        "ni": "Nicaragua","pa": "Panamá","py": "Paraguay","pe": "Perú","pr": "Puerto Rico",
        "es": "España","uy": "Uruguay","ve": "Venezuela"
    }

    # ✅ NEW: load visibility settings and keep only enabled country codes
    settings = load_public_glossary_settings(country_map)
    enabled_codes = {code for code, on in settings.items() if on}

    # Build a clean, ordered list of countries we actually have files for AND are enabled
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "glossaries"))
    items = []
    for cc, base in country_map.items():
        if cc not in enabled_codes:
            continue  # skip disabled glossaries
        filename = f"{base}.json"
        path = os.path.join(base_dir, filename)
        if os.path.exists(path):
            items.append({
                "code": cc,
                "name": country_names.get(cc, cc.upper()),
                "href": f"/{cc}/glosario",
                "color": country_colors.get(cc, "#2563eb"),
            })

    # Sort by country display name
    items.sort(key=lambda x: x["name"])

    return render_template("glosarios_index.html", countries=items)


@bp.route("/<country_code>/glosario")
def glosario(country_code):
    """Render public glossary page for the given country."""
    if country_code not in country_map:
        abort(404, description=f"Invalid country code: {country_code}")

    # ✅ Respect enable/disable settings first (public-side loader)
    settings = load_public_glossary_settings(country_map)
    if not settings.get(country_code, False):
        return "Este glosario todavía no está disponible.", 404

    filename = f"{country_map[country_code]}.json"
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "glossaries", filename)

    if not os.path.exists(data_path):
        abort(404, description=f"No glossary found for {country_code}")

    with open(data_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    # Sort entries alphabetically by 'word', ignoring accents and case
    import unicodedata
    def normalize_for_sort(s):
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()
    entries.sort(key=lambda e: normalize_for_sort(e.get("word", "")))

    # ✅ Accent color for this country
    accent_color = country_colors.get(country_code, "#2563eb")

    # ✅ Pass enabled countries to the template
    enabled_glossaries = [code for code, on in settings.items() if on]

    # Render public-facing template
    return render_template(
        "public_glosario.html",
        entries=entries,
        country_code=country_code,
        accent_color=accent_color,
        country_color=accent_color,  # back-compat
        enabled_glossaries=enabled_glossaries
    )

# 🆕 NEW route: list all entries by source
@bp.route("/<country_code>/source/<kind>/<slug>")
def entries_by_source(country_code, kind, slug):
    """
    Show all glossary entries for a given source (episode, series, film, etc.)
    """
    if country_code not in country_map:
        abort(404, description=f"Invalid country code: {country_code}")

    filename = f"{country_map[country_code]}.json"
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "glossaries", filename)
    if not os.path.exists(data_path):
        abort(404, description=f"No glossary found for {country_code}")

    with open(data_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    # helpers
    import unicodedata, re
    def slugify(text):
        t = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode("ascii").lower()
        t = t.replace("ñ", "n")
        t = re.sub(r"[^a-z0-9]+", "-", t)
        t = re.sub(r"(^-|-$)+", "", t)
        return t

    # collect only entries that reference this source
    results = []
    target_kind = (kind or "").lower()
    for e in entries:
        matched = False
        for s in (e.get("senses") or []):
            if matched: break
            for ex in (s.get("examples") or []):
                src = ex.get("source") or {}
                if not isinstance(src, dict):
                    continue
                if (src.get("kind") or "").lower() != target_kind:
                    continue
                src_slug = slugify(src.get("title") or src.get("song") or src.get("handle") or src.get("text") or "")
                if src_slug == slug:
                    results.append(e)
                    matched = True
                    break

    # sort results by word (accent-insensitive)
    def normalize_for_sort(s):
        return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii").lower()
    results.sort(key=lambda e: normalize_for_sort(e.get("word", "")))

    # ✅ Respect enable/disable settings BEFORE rendering
    settings = load_public_glossary_settings(country_map)
    if not settings.get(country_code, False):
        return "Este glosario todavía no está disponible.", 404
    enabled_glossaries = [code for code, on in settings.items() if on]

    # color for this country
    accent_color = country_colors.get(country_code, "#2563eb")

    # Render the same public template but with the FILTERED list
    return render_template(
        "public_glosario.html",
        entries=results,                 # <- filtered
        country_code=country_code,
        accent_color=accent_color,
        country_color=accent_color,      # back-compat
        enabled_glossaries=enabled_glossaries
    )

@bp.route("/data/glossaries/<country_code>.json")
def serve_glossary_json(country_code):
    """Serve raw glossary JSON for the given country."""
    if country_code not in country_map:
        abort(404, description=f"Invalid country code: {country_code}")

    filename = f"{country_map[country_code]}.json"
    glossary_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "glossaries"))

    if not os.path.exists(os.path.join(glossary_dir, filename)):
        abort(404, description=f"No glossary found for {country_code}")

    return send_from_directory(glossary_dir, filename)

# === BEGIN: Serve versioned exercises JSON ===
def _public_exercises_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "exercises"))

@bp.route("/data/exercises/<region>/<filename>")
def serve_exercise_json(region, filename):
    """
    Serves a versioned exercise JSON:
      /data/exercises/<region>/<exercise_id>@v<version>.json
    Example:
      /data/exercises/ar/abcd1234@v1.json
    """
    import re
    region = (region or "").strip().lower()

    # Basic safety checks
    if not re.fullmatch(r"[a-z]{2}", region):
        abort(404, description="Invalid region")

    if not re.fullmatch(r"[A-Za-z0-9_-]+_v[0-9]+\.json", filename):
        abort(404, description="Invalid filename")

    region_dir = os.path.join(_public_exercises_root(), region)
    file_path = os.path.join(region_dir, filename)

    if not os.path.exists(file_path):
        abort(404, description="Exercise not found")

    return send_from_directory(region_dir, filename)
# === END: Serve versioned exercises JSON ===

# === BEGIN: Serve versioned exercises JSON (flat, no region) ===
@bp.route("/data/exercises/<filename>")
def serve_exercise_json_flat(filename):
    """
    Serves a versioned exercise JSON without region:
      /data/exercises/<exercise_id>@v<version>.json

    If not found at the root, it will also look in any 1-level subfolder
    (so existing regional subfolders keep working).
    """
    import re
    root_dir = _public_exercises_root()

    # Basic filename safety: <id>@v<integer>.json
    if not re.fullmatch(r"[A-Za-z0-9_-]+_v[0-9]+\.json", filename):
        abort(404, description="Invalid filename")

    # 1) Try root
    root_path = os.path.join(root_dir, filename)
    if os.path.exists(root_path):
        return send_from_directory(root_dir, filename)

    # 2) Try any immediate subfolder (e.g., legacy regional dirs)
    for entry in os.listdir(root_dir):
        subdir = os.path.join(root_dir, entry)
        if not os.path.isdir(subdir):
            continue
        candidate = os.path.join(subdir, filename)
        if os.path.exists(candidate):
            return send_from_directory(subdir, filename)

    abort(404, description="Exercise not found")
# === END: Serve versioned exercises JSON (flat, no region) ===

# ===== NEW: entries filtered by source (episode or whole series, etc.) =====
@bp.route("/api/<country_code>/by-source")
def api_entries_by_source(country_code):
    """
    JSON API to return entries from one country's glossary that match a given source.
    Examples:
      /api/ar/by-source?kind=serie&title=Casados%20con%20Hijos&season=1&episode=1   -> this episode
      /api/ar/by-source?kind=serie&title=Casados%20con%20Hijos                      -> entire series
      /api/ar/by-source?kind=pelicula&title=Relatos%20Salvajes&year=2014            -> film
      /api/ar/by-source?kind=redes&handle=@cuenta                                   -> social
      /api/ar/by-source?kind=cancion&song=De%20M%C3%BAsica%20Ligera&artist=Soda%20Stereo
    """
    if country_code not in country_map:
        abort(404, description=f"Invalid country code: {country_code}")

    # --- query params ---
    kind    = (request.args.get("kind") or "").strip().lower()
    title   = (request.args.get("title") or "").strip()
    year    = (request.args.get("year") or "").strip()
    season  = (request.args.get("season") or "").strip()
    episode = (request.args.get("episode") or "").strip()
    handle  = (request.args.get("handle") or "").strip()
    song    = (request.args.get("song") or "").strip()
    artist  = (request.args.get("artist") or "").strip()
    text    = (request.args.get("text") or "").strip()

    # ints where applicable
    def as_int(s):
        try: return int(s)
        except Exception: return None
    year_i, season_i, episode_i = as_int(year), as_int(season), as_int(episode)

    # load country glossary
    filename = f"{country_map[country_code]}.json"
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "glossaries", filename)
    if not os.path.exists(data_path):
        abort(404, description=f"No glossary found for {country_code}")
    with open(data_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    # helpers
    import unicodedata, re
    def normalize_str(s):
        s = unicodedata.normalize("NFD", s or "")
        s = s.encode("ascii", "ignore").decode("ascii")
        return s.lower().strip()

    def slugify(text):
        t = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode("ascii").lower()
        t = t.replace("ñ", "n")
        t = re.sub(r"[^a-z0-9]+", "-", t)
        t = re.sub(r"(^-|-$)+", "", t)
        return t

    def source_matches(src):
        if not isinstance(src, dict): return False
        k = normalize_str(src.get("kind"))
        if kind and k != normalize_str(kind): return False

        if k == "serie":
            if title and normalize_str(src.get("title")) != normalize_str(title): return False
            if season_i is not None and as_int(src.get("season")) != season_i:   return False
            if episode_i is not None and as_int(src.get("episode")) != episode_i:return False
            return True

        if k == "pelicula":
            if title and normalize_str(src.get("title")) != normalize_str(title): return False
            if year_i is not None and as_int(src.get("year")) != year_i:         return False
            return True

        if k == "redes":
            if handle and normalize_str(src.get("handle")) != normalize_str(handle): return False
            if not handle and title and normalize_str(src.get("handle")) != normalize_str(title): return False
            return True

        if k == "cancion":
            target_song = song or title
            if target_song and normalize_str(src.get("song")) != normalize_str(target_song): return False
            if artist and normalize_str(src.get("artist")) != normalize_str(artist):         return False
            return True

        if k == "otro":
            if text and normalize_str(src.get("text")) != normalize_str(text): return False
            if not text and title and normalize_str(src.get("text")) != normalize_str(title): return False
            return True

        # fallback: try title/handle/text match if provided
        if title and normalize_str(src.get("title") or src.get("handle") or src.get("text") or "") != normalize_str(title):
            return False
        return True

    results = []
    for e in entries:
        match_count = 0
        for s in (e.get("senses") or []):
            for ex in (s.get("examples") or []):
                if source_matches(ex.get("source")):
                    match_count += 1
        if match_count:
            results.append({
                "word": e.get("word", ""),
                "slug": e.get("slug") or slugify(e.get("word", "")),
                "audio": e.get("audio") or "",
                "matches": match_count
            })

    # sort by word (accent-insensitive), then by matches desc
    def normkey(w):
        return unicodedata.normalize("NFKD", w or "").encode("ascii", "ignore").decode("ascii").lower()
        results.sort(key=lambda r: (normkey(r.get("word", "")), -int(r.get("matches", 0) or 0)))

    payload = {
        "country_code": country_code,
        "kind": kind,
        "scope": "episode" if (season_i is not None or episode_i is not None) else "series-or-global",
        "count": len(results),
        "results": results
    }
    return (json.dumps(payload), 200, {"Content-Type": "application/json"})

@bp.route("/search")
def global_search():
    """
    Global search across all regional glossaries.
    Query param: ?q=term
    Returns JSON: {"query": "...", "results": [{"country_code": "ar", "country_name": "Argentina", "word": "boludo", "slug": "boludo"}]}
    """
    q = (request.args.get("q") or "").strip()
    if not q:
        return (json.dumps({"query": "", "results": []}), 200, {"Content-Type": "application/json"})
    # normalize needle
    import unicodedata, re
    def normalize(s):
        s = unicodedata.normalize("NFD", s or "")
        s = s.encode("ascii", "ignore").decode("ascii")
        return s.lower()

    needle = normalize(q)

    def slugify(text):
        t = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode("ascii").lower()
        t = t.replace("ñ", "n")
        t = re.sub(r"[^a-z0-9]+", "-", t)
        t = re.sub(r"(^-|-$)+", "", t)
        return t

    results = []
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "glossaries"))

    for cc, base in country_map.items():
        path = os.path.join(base_dir, f"{base}.json")
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                entries = json.load(f)
        except Exception:
            continue

        for e in entries:
            # build searchable text
            hay = e.get("word", "") + " "
            v = e.get("variants", {}) or {}
            for k in ("ms", "mp", "fs", "fp", "diminutivo", "aumentativo"):
                arr = v.get(k) or []
                if isinstance(arr, list):
                    hay += " " + " ".join(arr)
            senses = e.get("senses") or []
            if isinstance(senses, list):
                for s in senses:
                    if isinstance(s, dict):
                        if s.get("definition"):
                            hay += " " + s["definition"]
                        eq = s.get("equivalents") or []
                        if isinstance(eq, list):
                            hay += " " + " ".join(eq)
                        exs = s.get("examples") or []
                        if isinstance(exs, list):
                            for ex in exs:
                                if isinstance(ex, dict):
                                    hay += " " + (ex.get("es") or "") + " " + (ex.get("en") or "")

            if needle in normalize(hay):
                results.append({
                    "country_code": cc,
                    "country_name": {
                        "ar": "Argentina","bo": "Bolivia","cl": "Chile","co": "Colombia","cr": "Costa Rica",
                        "cu": "Cuba","do": "República Dominicana","ec": "Ecuador","sv": "El Salvador",
                        "gq": "Guinea Ecuatorial","gt": "Guatemala","hn": "Honduras","mx": "México",
                        "ni": "Nicaragua","pa": "Panamá","py": "Paraguay","pe": "Perú","pr": "Puerto Rico",
                        "es": "España","uy": "Uruguay","ve": "Venezuela"
                    }.get(cc, cc.upper()),
                    "word": e.get("word", ""),
                    "slug": e.get("slug") or slugify(e.get("word", "")),
                })
                # keep response snappy
                if len(results) >= 100:
                    break
        if len(results) >= 100:
            break

    payload = {"query": q, "results": results}
    return (json.dumps(payload), 200, {"Content-Type": "application/json"})

@bp.route("/pages", methods=["GET"])
def public_pages_index():
    """
    Public list of all pages (newest first), showing friendly Spanish-formatted
    last updated date and tags.
    """
    from datetime import datetime

    def parse_date(s):
        if not s:
            return None
        s = str(s).strip()
        # Try ISO first (handles: 2025-10-10T11:52:31Z / with or without 'Z' / with ms)
        try:
            return datetime.fromisoformat(s.replace("Z", "").replace("z", ""))
        except Exception:
            pass
        # Fallbacks for common formats
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(s, fmt)
            except Exception:
                continue
        return None

    def format_spanish_date(dt):
        if not dt:
            return ""
        meses = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
            7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
        }
        return f"{dt.day} de {meses.get(dt.month, '')}, {dt.year}"

    pages = _public_load_pages()
    # Sort newest-first by created_at string
    pages = sorted(pages, key=lambda p: p.get("created_at", ""), reverse=True)

    # Add display_date for template use (prefer updated_at)
    for p in pages:
        raw = p.get("updated_at") or p.get("created_at")
        dt = parse_date(raw)
        p["display_date"] = format_spanish_date(dt)

    return render_template("public_pages_index.html", pages=pages)

@bp.route("/exercises/test")
def exercises_test():
    return render_template("exercises_test.html")

# === BEGIN: Public Page view ===
@bp.route("/pages/<slug>", methods=["GET"])
def public_page(slug):
    pages = _public_load_pages()
    page = next((p for p in pages if p.get("slug") == slug), None)
    if not page:
        return f"Página no encontrada: {slug}", 404

    # Determine language for initial render: ?lang= takes precedence, then cookie, else 'es'
    lang = (request.args.get("lang") or "").strip().lower()
    if lang not in ("es", "en"):
        lang = (request.cookies.get("pp_lang") or "").strip().lower()
        if lang not in ("es", "en"):
            lang = "es"

    # Remember the user’s choice if they provided ?lang=...
    resp = make_response(render_template("public_page.html", page=page, lang=lang))
    if "lang" in request.args:
        resp.set_cookie("pp_lang", lang, max_age=60 * 60 * 24 * 365, samesite="Lax")
    return resp
# === END: Public Page view ===

# === BEGIN: Serve new foldered exercises (type/slug) ===
@bp.route("/data/exercises/<ex_type>/<slug>/current.json")
def serve_exercise_current_by_type_slug(ex_type, slug):
    """
    Serve the canonical JSON for the new layout:
      data/exercises/<type>/<slug>/current.json

    Fallbacks:
      - If current.json is missing, serve the highest numeric file NNN.json.
    """
    import re

    ex_type = (ex_type or "").strip().lower()
    slug    = (slug or "").strip().lower()

    # Safety: only allow simple slugs (letters, numbers, dash, underscore)
    if not re.fullmatch(r"[a-z0-9_-]+", ex_type):
        abort(404, description="Invalid type")
    if not re.fullmatch(r"[a-z0-9_-]+", slug):
        abort(404, description="Invalid slug")

    base_dir = _public_exercises_root()
    folder   = os.path.abspath(os.path.join(base_dir, ex_type, slug))

    # Must live inside data/exercises
    try:
        if os.path.commonpath([folder, base_dir]) != base_dir or not os.path.isdir(folder):
            abort(404, description="Exercise folder not found")
    except Exception:
        abort(404, description="Exercise folder not found")

    # 1) Prefer current.json
    current_name = "current.json"
    current_path = os.path.join(folder, current_name)
    if os.path.exists(current_path):
        rv = send_from_directory(folder, current_name)
        # avoid stale caches while editing
        rv.headers["Cache-Control"] = "no-store"
        return rv

    # 2) Fallback to latest numeric NNN.json (e.g., 001.json, 012.json)
    try:
        numeric = [
            fn for fn in os.listdir(folder)
            if fn.lower().endswith(".json") and fn[:-5].isdigit()
        ]
        if numeric:
            latest = sorted(numeric, key=lambda x: int(x[:-5]))[-1]
            rv = send_from_directory(folder, latest)
            rv.headers["Cache-Control"] = "no-store"
            return rv
    except Exception:
        pass

    abort(404, description="Exercise JSON not found")
# === END: Serve new foldered exercises (type/slug) ===