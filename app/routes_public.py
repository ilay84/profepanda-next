from flask import Blueprint, render_template, send_from_directory, abort
import os
import json
from flask import request

# === BEGIN: Public Pages loader ===
import os, json

def _public_pages_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'pages', 'pages.json'))

def _public_load_pages():
    path = _public_pages_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or []
        return [p for p in data if isinstance(p, dict)]
    except Exception:
        return []
# === END: Public Pages loader ===

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
    path = _public_pages_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or []
        return [p for p in data if isinstance(p, dict)]
    except Exception:
        return []
# === END: Public Pages loader ===

@bp.route("/")
def index():
    """
    Home page: load tiles from data/pages/home_tiles.json (if present),
    normalize fields to match the template, and pass them in.
    If the file is missing/empty, we do NOT pass `tiles` so the template's
    fallback (local_tiles) renders instead.
    """
    tiles = []
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        tiles_path = os.path.join(base_dir, "data", "pages", "home_tiles.json")  # <-- fixed path
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

                        title = t.get("title") or ""
                        desc  = t.get("subtitle") or t.get("description") or t.get("desc") or ""
                        href  = t.get("href") or t.get("link") or "#"

                        # Image: prefer image_url, then image; strip leading /static/ if present
                        img = (t.get("image_url") or t.get("image") or "").strip()
                        if img.startswith("/static/"):
                            img = img[len("/static/"):]
                        elif img.startswith("static/"):
                            img = img[len("static/"):]
                        # At this point `img` should be relative to /static so the template’s
                        # url_for('static', filename=img) works (e.g., assets/tiles/foo.jpg)

                        normd.append({
                            "title": title,
                            "desc": desc,
                            "href": href,
                            "image": img,
                            "enabled": True,
                            "order": int(t.get("order", 9999)) if str(t.get("order", "")).isdigit() else 9999
                        })

                    tiles = sorted(normd, key=lambda x: x.get("order", 9999))
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
    Public list of all pages (newest first).
    Renders a simple index with links to /pages/<slug>.
    """
    pages = _public_load_pages()
    pages = sorted(pages, key=lambda p: p.get("created_at", ""), reverse=True)
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
    return render_template("public_page.html", page=page)
# === END: Public Page view ===