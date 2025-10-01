from flask import Blueprint, render_template, request, jsonify, send_from_directory
import os
import json
import uuid

bp = Blueprint("admin", __name__, url_prefix="/admin")

# Map ISO 2-letter codes to full JSON file names
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

# === Accent colors per country (picked for good contrast on white) ===
ACCENT_COLOR_MAP = {
    "ar": "#1E7CCB",  # Argentina (deep sky blue)
    "bo": "#1E8449",  # Bolivia (green stripe, darker for contrast)
    "cl": "#1F5AA6",  # Chile (flag blue)
    "co": "#1F3C88",  # Colombia (navy)
    "cr": "#1F4788",  # Costa Rica (flag blue)
    "cu": "#0A57A3",  # Cuba (royal blue)
    "do": "#0D5EAF",  # República Dominicana (flag blue)
    "ec": "#153E90",  # Ecuador (navy)
    "sv": "#1E66C1",  # El Salvador (flag blue)
    "mx": "#1E7A3C",  # México (flag green)
    "es": "#C1121F",  # España (flag red)
    "uy": "#2A6FB0",  # Uruguay (deeper celeste)
    "py": "#1F5CA8",  # Paraguay (flag blue)
    "pe": "#B00020",  # Perú (flag red)
    "ve": "#1F4BA8",  # Venezuela (flag blue)
    "gt": "#1F7FC0",  # Guatemala (deeper sky blue)
    "hn": "#2368B3",  # Honduras (flag blue)
    "ni": "#1F6FB2",  # Nicaragua (flag blue)
    "pa": "#1F5CA8",  # Panamá (flag blue)
    "pr": "#0E4DA4",  # Puerto Rico (flag blue)
}
DEFAULT_ACCENT_COLOR = "#1D3557"  # fallback if a country code isn’t mapped

@bp.route("/")
def admin_home():
    # Build a simple list of countries for the template (no hardwiring)
    country_names = {
        "ar": "Argentina", "bo": "Bolivia", "cl": "Chile", "co": "Colombia",
        "cr": "Costa Rica", "cu": "Cuba", "do": "República Dominicana",
        "ec": "Ecuador", "sv": "El Salvador", "gq": "Guinea Ecuatorial",
        "gt": "Guatemala", "hn": "Honduras", "mx": "México", "ni": "Nicaragua",
        "pa": "Panamá", "py": "Paraguay", "pe": "Perú", "pr": "Puerto Rico",
        "es": "España", "uy": "Uruguay", "ve": "Venezuela"
    }
    countries = [{"code": code, "name": country_names.get(code, code.upper())}
                 for code in sorted(country_map.keys())]

    # ✅ load enable/disable map and pass it to the template
    settings = load_glossary_settings()

    return render_template("admin_home.html",
                           countries=countries,
                           settings=settings)

@bp.route("/glosario/<country_code>")
def glosario(country_code):
    if country_code not in country_map:
        return f"❌ Código de país no válido: {country_code}", 404

    country_name = country_code.upper()  # or replace with a prettier mapping later
    filename = f"{country_map[country_code]}.json"

    # Load glossary JSON
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "glossaries", filename)
    if not os.path.exists(data_path):
        entries = []
    else:
        with open(data_path, "r", encoding="utf-8") as f:
            entries = json.load(f)

    # Sort entries alphabetically by 'word', ignoring accents and case
    import unicodedata
    def normalize_for_sort(s):
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

    entries.sort(key=lambda e: normalize_for_sort(e.get("word", "")))

    # --- TEMP PROBE: shows a yellow badge if this route is hit ---
    probe_html = (
        f"<!-- probe -->\n"
        f"<div id='__route_probe__' "
        f"style='position:fixed;bottom:8px;left:8px;z-index:99999;"
        f"background:#fef3c7;border:1px solid #f59e0b;color:#78350f;"
        f"padding:6px 8px;border-radius:8px;font:12px/1.1 system-ui'>"
        f"ROUTE HIT: /admin/glosario/{country_code}</div>"
    )
    page = render_template("admin_glosario.html",
                           country_code=country_code,
                           country_name=country_name,
                           entries=entries)
    return probe_html + page

@bp.route("/glosario/<country_code>/delete", methods=["POST"])
def delete_glosario(country_code):
    word_to_delete = request.json.get("word")

    if not word_to_delete:
        return jsonify({"success": False, "error": "No word provided"}), 400

    filename = f"{country_map[country_code]}.json"
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'glossaries', filename)

    if not os.path.exists(data_path):
        return jsonify({"success": False, "error": f"No glossary found for {country_code}"}), 404

    with open(data_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    new_entries = [e for e in entries if e["word"] != word_to_delete]

    if len(new_entries) == len(entries):
        return jsonify({"success": False, "error": "Word not found"}), 404

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(new_entries, f, ensure_ascii=False, indent=4)

    return jsonify({"success": True})

# ========= BEGIN: NEW UPDATE ENDPOINT =========
@bp.route("/glosario/<country_code>/update", methods=["POST"])
def update_glosario(country_code):
    """
    Update an existing entry. Accepts multipart/form-data (preferred) and will
    also fall back to JSON if present. Always writes back 'word', 'variants',
    and 'senses' so edits stick.
    """
    from werkzeug.utils import secure_filename
    import json
    import os
    import unicodedata

    if country_code not in country_map:
        return jsonify({"success": False, "error": f"Invalid country code: {country_code}"}), 400

    # Paths
    filename  = f"{country_map[country_code]}.json"
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'glossaries', filename)
    if not os.path.exists(data_path):
        return jsonify({"success": False, "error": f"No glossary found for {country_code}"}), 404

    # ---- Read inputs ----
    # Prefer form fields (because we send FormData with files), but also check JSON
    req_json = request.get_json(silent=True) or {}

    original_word = (request.form.get("original_word") or req_json.get("original_word") or "").strip()
    word          = (request.form.get("word")          or req_json.get("word")          or "").strip()

    if not original_word or not word:
        return jsonify({"success": False, "error": "original_word and word are required"}), 400

    # Parse variants
    variants_raw = request.form.get("variants")
    if variants_raw is None and "variants" in req_json:
        variants_raw = req_json.get("variants")
    try:
        variants = variants_raw if isinstance(variants_raw, dict) else json.loads(variants_raw or "{}")
    except Exception as e:
        return jsonify({"success": False, "error": f"Invalid variants JSON: {e}"}), 400

    # Parse senses
    senses_raw = request.form.get("senses")
    if senses_raw is None and "senses" in req_json:
        senses_raw = req_json.get("senses")
    try:
        senses = senses_raw if isinstance(senses_raw, list) else json.loads(senses_raw or "[]")
    except Exception as e:
        return jsonify({"success": False, "error": f"Invalid senses JSON: {e}"}), 400

    # ---- Load existing entries ----
    with open(data_path, "r", encoding="utf-8") as f:
        entries = json.load(f) or []

    # Find existing entry index (case-insensitive match)
    idx = next((i for i, e in enumerate(entries)
                if (e.get("word", "") or "").lower() == original_word.lower()), -1)
    if idx == -1:
        return jsonify({"success": False, "error": f'Word "{original_word}" not found'}), 404

    existing = entries[idx]

    # ---- Compute slug (like /add) ----
    slug = word.lower().replace("ñ", "n")
    slug = "".join(ch if ch.isalnum() or ch == " " else "-" for ch in slug).replace(" ", "-")

    # ---- Optional: main word audio ----
    audio_relpath = existing.get("audio")  # keep current unless new uploaded
    if "audio_word" in request.files and request.files["audio_word"].filename:
        word_audio_file = request.files["audio_word"]
        audio_filename  = secure_filename(f"w-{slug}.mp3")
        audio_path      = os.path.join("static", "audio", "word", audio_filename)
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        word_audio_file.save(audio_path)
        audio_relpath = os.path.join("static", "audio", "word", audio_filename).replace("\\", "/")

    # ---- Save example audios (optional, same behavior as /add) ----
    examples_dir = os.path.join("static", "audio", "examples", slug)
    os.makedirs(examples_dir, exist_ok=True)
    for key, fs in request.files.items():
        if key.startswith("example_audio_") and fs.filename:
            save_as = secure_filename(fs.filename)
            fs.save(os.path.join(examples_dir, save_as))

    # ---- Build the updated entry (ALWAYS trust the incoming variants/senses) ----
    # If client sent nothing for those, fall back to existing so we don't wipe.
    if not isinstance(variants, dict):
        variants = existing.get("variants", {})
    if not isinstance(senses, list):
        senses = existing.get("senses", [])

    updated_entry = {
        "word":     word,
        "slug":     slug,
        "variants": variants,
        "audio":    audio_relpath,
        "senses":   senses,
    }

    # Replace, then sort by normalized word
    entries[idx] = updated_entry

    def normalize_for_sort(s):
        return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii").lower()
    entries.sort(key=lambda e: normalize_for_sort(e.get("word", "")))

    # Save back
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=4)

    # Return some quick debug counts so you can confirm in DevTools
    return jsonify({
        "success": True,
        "updated_word": word,
        "counts": {
            "variants_keys": len(updated_entry.get("variants", {})),
            "senses": len(updated_entry.get("senses", [])),
            "examples_total": sum(len(s.get("examples", [])) for s in updated_entry.get("senses", []))
        }
    })
# ========= END: NEW UPDATE ENDPOINT =========

@bp.route("/glosario/<country_code>/edit", methods=["POST"])
def edit_glosario(country_code):
    data = request.json
    word = data.get("word")
    definition = data.get("definition")
    example = data.get("example")

    if not word or not definition:
        return jsonify({"success": False, "error": "Word and definition are required"}), 400

    filename = f"{country_map[country_code]}.json"
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'glossaries', filename)

    if not os.path.exists(data_path):
        return jsonify({"success": False, "error": f"No glossary found for {country_code}"}), 404

    with open(data_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    updated = False
    for entry in entries:
        if entry["word"].lower() == word.lower():
            entry["definition"] = definition
            entry["example"] = example or ""
            updated = True
            break

    if not updated:
        return jsonify({"success": False, "error": "Word not found"}), 404

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=4)

    return jsonify({"success": True})

@bp.route("/glosario/<country_code>/add", methods=["POST"])
def add_glosario(country_code):
    # We expect multipart/form-data with:
    # - form fields: word, variants (JSON string), senses (JSON string)
    # - files: optional audio_word, optional example_audio_* files
    from werkzeug.utils import secure_filename
    import json
    import os

    if country_code not in country_map:
        return jsonify({"success": False, "error": f"Invalid country code: {country_code}"}), 400

    # Paths
    filename = f"{country_map[country_code]}.json"
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'glossaries', filename)
    os.makedirs(os.path.dirname(data_path), exist_ok=True)

    # Ensure glossary file exists
    if not os.path.exists(data_path):
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=4)

    # ---- Parse form fields ----
    word = (request.form.get("word") or "").strip()
    if not word:
        return jsonify({"success": False, "error": "Word is required"}), 400

    # Parse JSON strings for variants and senses
    try:
        variants = json.loads(request.form.get("variants") or "{}")
    except json.JSONDecodeError as e:
        return jsonify({"success": False, "error": f"Invalid variants JSON: {e}"}), 400

    try:
        senses = json.loads(request.form.get("senses") or "[]")
    except json.JSONDecodeError as e:
        return jsonify({"success": False, "error": f"Invalid senses JSON: {e}"}), 400

    # ---- Save main word audio (optional) ----
    audio_relpath = None
    if "audio_word" in request.files and request.files["audio_word"].filename:
        word_audio_file = request.files["audio_word"]
        # simple kebab-case slug for filename (we can harden later)
        slug = word.lower().replace("ñ", "n")
        slug = "".join(ch if ch.isalnum() or ch == " " else "-" for ch in slug).replace(" ", "-")
        audio_filename = secure_filename(f"w-{slug}.mp3")
        audio_path = os.path.join("static", "audio", "word", audio_filename)
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        word_audio_file.save(audio_path)
        audio_relpath = os.path.join("static", "audio", "word", audio_filename).replace("\\", "/")
    else:
        # still compute slug for later (examples folder)
        slug = word.lower().replace("ñ", "n")
        slug = "".join(ch if ch.isalnum() or ch == " " else "-" for ch in slug).replace(" ", "-")

    # ---- Save example audios (optional) ----
    examples_dir = os.path.join("static", "audio", "examples", slug)
    os.makedirs(examples_dir, exist_ok=True)

    for key, fs in request.files.items():
        if key.startswith("example_audio_") and fs.filename:
            save_as = secure_filename(fs.filename)
            fs.save(os.path.join(examples_dir, save_as))

    # ---- Load existing entries ----
    with open(data_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    # Prevent duplicate words
    if any(e.get("word", "").lower() == word.lower() for e in entries):
        return jsonify({"success": False, "error": "Word already exists"}), 400

    # ---- Build new entry object ----
    new_entry = {
        "word": word,
        "slug": slug,
        "variants": variants,
        "audio": audio_relpath,     # may be None
        "senses": senses
    }

    # Append and alphabetize before saving
    import unicodedata

    entries.append(new_entry)

    # Sort entries alphabetically by 'word', ignoring accents and case
    def normalize_for_sort(s):
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

    entries.sort(key=lambda e: normalize_for_sort(e.get("word", "")))

    # Save back
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=4)

    return jsonify({"success": True})

# === BEGIN: Home tiles (homepage cards) – admin list view ===
def _home_tiles_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'pages', 'home_tiles.json'))

def _load_home_tiles():
    path = _home_tiles_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or []
        tiles = [t for t in data if isinstance(t, dict)]
        # keep only enabled by default for display; we can add a toggle later
        tiles = sorted(tiles, key=lambda t: t.get("order", 9999))
        return tiles
    except Exception:
        return []

@bp.route("/home", methods=["GET"])
def admin_home_tiles_index():
    """
    Admin view: list homepage tiles from data/pages/home_tiles.json.
    (Read-only for now; we'll add Add/Edit/Delete in the next step.)
    """
    tiles = load_home_tiles()
    return render_template("admin_home_tiles.html", tiles=tiles)

@bp.route("/home/tiles/<tile_id>/delete", methods=["POST"])
def admin_home_tile_delete(tile_id):
    """
    Delete a homepage tile by its 'id'.
    Body is optional. Returns JSON.
    """
    tiles = load_home_tiles()
    idx = next((i for i, t in enumerate(tiles) if t.get("id") == tile_id), -1)

    # Fallback: allow deletion by slug or title if 'id' not present
    if idx == -1:
        idx = next((i for i, t in enumerate(tiles)
                    if t.get("slug") == tile_id or _slugify(t.get("title", "")) == tile_id), -1)

    if idx == -1:
        return jsonify({"success": False, "error": "Tile not found"}), 404

    deleted = tiles.pop(idx)
    save_home_tiles(tiles)
    return jsonify({
        "success": True,
        "deleted": {
            "id": deleted.get("id"),
            "title": deleted.get("title"),
            "slug": deleted.get("slug")
        }
    })

@bp.route("/home/tiles/<tile_id>/edit", methods=["POST"])
def admin_home_tile_edit(tile_id):
    """
    Update a homepage tile by its 'id' (or fallback: slug/title match).
    Body: JSON with any of these optional fields:
      - title, subtitle, href, image, order (int), enabled (bool), slug
    Returns JSON { success, tile }.
    """
    data = request.get_json(silent=True) or {}

    tiles = load_home_tiles()

    # Find by id first
    idx = next((i for i, t in enumerate(tiles) if t.get("id") == tile_id), -1)

    # Fallbacks: slug or slugified title
    if idx == -1:
        idx = next(
            (i for i, t in enumerate(tiles)
             if t.get("slug") == tile_id or _slugify(t.get("title", "")) == tile_id),
            -1
        )

    if idx == -1:
        return jsonify({"success": False, "error": "Tile not found"}), 404

    # Update only provided fields
    allowed = {"title", "subtitle", "href", "image", "order", "enabled", "slug"}
    for k, v in data.items():
        if k in allowed:
            tiles[idx][k] = v

    # If title changed and no explicit slug provided, keep slug in sync
    if "title" in data and "slug" not in data:
        tiles[idx]["slug"] = _slugify(tiles[idx].get("title", ""))

    save_home_tiles(tiles)

    return jsonify({"success": True, "tile": tiles[idx]})
# === END: Home tiles (homepage cards) – admin list view ===

# === BEGIN: Glossary enable/disable settings helpers ===
# File: data/glossaries/settings.json (created on first save)
def _settings_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'glossaries', 'settings.json'))

def _ensure_settings_dir():
    os.makedirs(os.path.dirname(_settings_path()), exist_ok=True)

def _default_settings():
    # Default: enable Argentina, disable others (change defaults later if you want)
    return {code: (code == "ar") for code in country_map.keys()}

def load_glossary_settings():
    path = _settings_path()
    if not os.path.exists(path):
        return _default_settings()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
        # make sure all known codes exist (fill with defaults where missing)
        merged = _default_settings()
        merged.update({k: bool(v) for k, v in data.items() if k in country_map})
        return merged
    except Exception:
        # if file is corrupt, fall back to defaults
        return _default_settings()

def save_glossary_settings(settings: dict):
    _ensure_settings_dir()
    # only persist known codes as booleans
    clean = {code: bool(settings.get(code, False)) for code in country_map.keys()}
    with open(_settings_path(), "w", encoding="utf-8") as f:
        json.dump(clean, f, ensure_ascii=False, indent=2)
    return clean
# === END: Glossary enable/disable settings helpers ===

# === BEGIN: Pages (blog-like) storage + routes scaffolding ===
# File storage: data/pages/pages.json (flat JSON list; no DB required)
def _pages_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'pages', 'pages.json'))

def _ensure_pages_dir():
    os.makedirs(os.path.dirname(_pages_path()), exist_ok=True)

def _load_pages():
    path = _pages_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or []
        # Ensure minimal shape
        return [p for p in data if isinstance(p, dict)]
    except Exception:
        return []

def _save_pages(pages: list):
    _ensure_pages_dir()
    with open(_pages_path(), "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)
    return pages

# === BEGIN: Home tiles storage helpers (data/pages/home_tiles.json) ===
def _home_tiles_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'pages', 'home_tiles.json'))

def _ensure_home_tiles_dir():
    os.makedirs(os.path.dirname(_home_tiles_path()), exist_ok=True)

def load_home_tiles():
    """
    Returns a list (possibly empty) of tile dicts from data/pages/home_tiles.json.
    We won't assume a schema here yet; just load whatever is there.
    """
    path = _home_tiles_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or []
        # Ensure it's a list of dicts
        return [t for t in data if isinstance(t, dict)]
    except Exception:
        # If corrupt, act like empty to avoid hard failures in admin flows
        return []

def save_home_tiles(tiles: list):
    """
    Persist the provided tiles list back to data/pages/home_tiles.json.
    """
    _ensure_home_tiles_dir()
    with open(_home_tiles_path(), "w", encoding="utf-8") as f:
        json.dump(tiles or [], f, ensure_ascii=False, indent=2)
    return tiles
# === END: Home tiles storage helpers ===

# === BEGIN: Tiles admin API (used by admin_home.html) ===
from werkzeug.utils import secure_filename

def _tiles_image_dir():
    # Where tile images will be stored
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'static', 'assets', 'tiles'))

def _ensure_tiles_image_dir():
    os.makedirs(_tiles_image_dir(), exist_ok=True)

def _coerce_tile_shape(t):
    """
    Normalize tile shape using the actual schema we store:
      id, title, description, image, link, order, enabled
    Falls back to legacy keys if present, but outputs a consistent shape.
    """
    if not isinstance(t, dict):
        return {}

    # Prefer real fields; fallbacks only if missing
    _id   = t.get("id") or t.get("slug") or uuid.uuid4().hex
    title = t.get("title") or ""
    desc  = t.get("description") or t.get("subtitle") or ""
    img   = t.get("image") or t.get("image_url") or ""
    link  = t.get("link") or t.get("href") or ""
    order = t.get("order", 9999)
    enabled = bool(t.get("enabled", True))
    slug  = t.get("slug") or _slugify(title)

    return {
        "id": _id,
        "title": title,
        "description": desc,   # ← use the real key
        "image": img,          # ← use the real key
        "link": link,          # ← use the real key
        "order": order,
        "enabled": enabled,
        "slug": slug
    }

@bp.route("/tiles", methods=["GET"])
def admin_tiles_list():
    """
    Returns { tiles: [ {id, title, subtitle, image_url, ...}, ... ] }
    Used by admin_home.html to render the list.
    """
    tiles = load_home_tiles()
    # Normalize and sort by order
    tiles_norm = [_coerce_tile_shape(t) for t in tiles]
    tiles_norm.sort(key=lambda x: x.get("order", 9999))
    return jsonify({"tiles": tiles_norm})

@bp.route("/tiles/save", methods=["POST"])
def admin_tiles_save():
    """
    Create or update a tile (multipart/form-data).
    Fields:
      - id?            (optional: if present, we update; otherwise create)
      - title          (required)
      - subtitle       (optional)
      - image          (optional file upload)
    Behavior:
      - Saves/updates data/pages/home_tiles.json
      - Stores image under static/assets/tiles/ and sets image_url to /static/assets/tiles/<file>
    """
    _ensure_tiles_image_dir()

    tiles = load_home_tiles()
    # Normalize list and index by id for quick lookups
    indexed = {}
    for t in tiles:
        norm = _coerce_tile_shape(t)
        indexed[str(norm["id"])] = {**t, **norm}  # keep originals + normalized

    # Read form fields
    tile_id = (request.form.get("id") or "").strip()
    title = (request.form.get("title") or "").strip()
    subtitle = (request.form.get("subtitle") or "").strip()

    if not title:
        return jsonify({"success": False, "error": "El título es obligatorio."}), 400

    # If new, create an id
    is_new = not tile_id
    if is_new:
        tile_id = uuid.uuid4().hex

    # Start from existing (if any)
    existing = indexed.get(tile_id, {})
    current = {
        "id": tile_id,
        "title": title,
        # store both subtitle and description for compatibility
        "subtitle": subtitle,
        "description": subtitle,
        "order": existing.get("order", 9999),
        "enabled": existing.get("enabled", True),
        "href": existing.get("href") or existing.get("link") or "",
        "slug": existing.get("slug") or _slugify(title)
    }

    # Handle image upload (optional)
    if "image" in request.files and request.files["image"].filename:
        f = request.files["image"]
        # Keep extension if any
        filename = secure_filename(f.filename)
        name, ext = os.path.splitext(filename)
        safe_ext = ext.lower() if ext.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
        out_name = f"tile-{tile_id}{safe_ext}"
        out_path = os.path.join(_tiles_image_dir(), out_name)
        f.save(out_path)
        # relative URL for frontend
        current["image"] = f"/static/assets/tiles/{out_name}"
        current["image_url"] = current["image"]
    else:
        # Keep previous image if present
        prev_img = existing.get("image_url") or existing.get("image") or ""
        if prev_img:
            current["image"] = prev_img
            current["image_url"] = prev_img

    # Rebuild tiles list: replace if exists, else append
    replaced = False
    for i, t in enumerate(tiles):
        nid = str(_coerce_tile_shape(t).get("id"))
        if nid == tile_id:
            tiles[i] = {**t, **current}
            replaced = True
            break
    if not replaced:
        tiles.append(current)

    # Keep tiles sorted and persist
    tiles = sorted(tiles, key=lambda t: _coerce_tile_shape(t).get("order", 9999))
    save_home_tiles(tiles)

    return jsonify({"success": True, "tile": _coerce_tile_shape(current)})

@bp.route("/tiles/reorder", methods=["POST"])
def admin_tiles_reorder():
    """
    Reorder homepage tiles.
    Body JSON:
      { "order": ["id1","id2","id3", ...] }  # array of tile ids in desired order
    Any tiles not listed will be appended in their previous relative order.
    Also normalizes each tile's 'order' field to match the new index.
    """
    data = request.get_json(silent=True) or {}
    new_order = data.get("order")

    if not isinstance(new_order, list):
        return jsonify({"success": False, "error": "Body must include array 'order'"}), 400

    tiles = load_home_tiles()

    # Map by normalized id
    by_id = {}
    for t in tiles:
        nid = str(_coerce_tile_shape(t).get("id"))
        by_id[nid] = t

    # Build the reordered list
    result = []
    seen = set()
    for tid in new_order:
        sid = str(tid)
        if sid in by_id and sid not in seen:
            result.append(by_id[sid])
            seen.add(sid)

    # Append any leftover tiles preserving their prior order
    for t in tiles:
        nid = str(_coerce_tile_shape(t).get("id"))
        if nid not in seen:
            result.append(t)

    # Normalize 'order' field to match new index
    for i, t in enumerate(result):
        try:
            t["order"] = i
        except Exception:
            pass

    save_home_tiles(result)

    return jsonify({
        "success": True,
        "tiles": [_coerce_tile_shape(t) for t in result]
    })

# === END: Tiles admin API (used by admin_home.html) ===

def _slugify(text: str):
    import re, unicodedata
    text = (text or "").strip().lower()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9\s-]", "-", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "pagina"

@bp.route("/pages", methods=["GET"])
def admin_pages_index():
    """
    Admin manage view: list all pages (newest first) with quick actions.
    """
    pages = _load_pages()
    pages = sorted(pages, key=lambda p: p.get("created_at", ""), reverse=True)
    return render_template("admin_pages_index.html", pages=pages)

@bp.route("/pages/new", methods=["GET"])
def admin_pages_new():
    """
    Render the 'New Page' form (template to be added next step).
    """
    # We'll create this template next: templates/admin_pages_new.html
    return render_template("admin_pages_new.html")

@bp.route("/pages", methods=["POST"])
def admin_pages_create():
    """
    Create a new page.
    Expects form fields (multipart/form-data or application/x-www-form-urlencoded):
      - title: str (required)
      - html: str (required) -> full HTML content from the rich text editor
      - tags: str (optional, comma-separated: e.g., "ser/estar, beginner, A2")
    Returns JSON.
    """
    from datetime import datetime
    title = (request.form.get("title") or "").strip()
    html = (request.form.get("html") or "").strip()
    tags_raw = (request.form.get("tags") or "").strip()

    if not title or not html:
        return jsonify({"success": False, "error": "Both 'title' and 'html' are required."}), 400

    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

    pages = _load_pages()

    # Simple unique slug attempt; append suffix if conflict
    base_slug = _slugify(title)
    slug = base_slug
    existing_slugs = {p.get("slug") for p in pages}
    i = 2
    while slug in existing_slugs:
        slug = f"{base_slug}-{i}"
        i += 1

    new_page = {
        "id": f"{slug}",                 # simple ID = slug
        "slug": slug,
        "title": title,
        "html": html,                    # store as HTML (editor output)
        "tags": tags,                    # list of strings
        "created_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "updated_at": None,
        "status": "published"            # future use: draft/published
    }

    pages.append(new_page)
    _save_pages(pages)

    return jsonify({"success": True, "page": new_page})

@bp.route("/pages/<slug>/delete", methods=["POST"])
def admin_pages_delete(slug):
    """
    Delete a page by slug.
    Returns JSON { success: bool, deleted: {slug, title} } or 404.
    """
    pages = _load_pages()
    idx = next((i for i, p in enumerate(pages) if p.get("slug") == slug), -1)
    if idx == -1:
        return jsonify({"success": False, "error": "Page not found"}), 404

    deleted = pages.pop(idx)
    _save_pages(pages)
    return jsonify({
        "success": True,
        "deleted": {"slug": deleted.get("slug"), "title": deleted.get("title")}
    })

@bp.route("/home/tiles/<tile_id>/update", methods=["POST"])
def admin_home_tile_update(tile_id):
    """
    Update an existing homepage tile.
    Expects JSON body with optional keys:
      - title, description, image, link, order
    """
    tiles = load_home_tiles()
    idx = next((i for i, t in enumerate(tiles) if t.get("id") == tile_id), -1)

    if idx == -1:
        return jsonify({"success": False, "error": "Tile not found"}), 404

    data = request.get_json(silent=True) or {}
    allowed = ["title", "description", "image", "link", "order"]

    for key in allowed:
        if key in data:
            tiles[idx][key] = data[key]

    save_home_tiles(tiles)

    return jsonify({"success": True, "tile": tiles[idx]})

@bp.route("/home/tiles/new", methods=["POST"])
def admin_home_tile_create():
    """
    Create a new homepage tile.
    Expects JSON body with:
      - title (required)
      - description (optional)
      - image (optional)  -> URL or /static/... path
      - link (optional)   -> URL or in-site path
      - order (optional)  -> int; lower shows earlier
      - enabled (optional)-> bool; default True
    """
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"success": False, "error": "Title is required"}), 400

    description = (data.get("description") or "").strip()
    image = (data.get("image") or "").strip()
    link = (data.get("link") or "").strip()

    # order: coerce to int if provided
    order = data.get("order", 9999)
    try:
        order = int(order)
    except (TypeError, ValueError):
        order = 9999

    enabled = bool(data.get("enabled", True))

    tiles = load_home_tiles()

    new_tile = {
        "id": uuid.uuid4().hex,   # requires: import uuid (already added)
        "title": title,
        "description": description,
        "image": image,
        "link": link,
        "order": order,
        "enabled": enabled,
    }

    tiles.append(new_tile)
    # keep list ordered by 'order'
    tiles = sorted(tiles, key=lambda t: t.get("order", 9999))
    save_home_tiles(tiles)

    return jsonify({"success": True, "tile": new_tile})

# === END: Pages (blog-like) storage + routes scaffolding ===

# === BEGIN: Exercises storage + admin routes scaffolding ===
# Files live under: data/exercises/
#   - exercises.index.json                  (global registry of all exercises)
#   - <exercise_id>@v<version>.json        (versioned payloads)

def _exercises_root_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'exercises'))

def _ensure_exercises_dir():
    path = _exercises_root_path()
    os.makedirs(path, exist_ok=True)
    return path

def _exercise_index_path():
    return os.path.join(_ensure_exercises_dir(), 'exercises.index.json')

def _load_exercise_index():
    path = _exercise_index_path()
    if not os.path.exists(path):
        return {"exercises": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
        # Normalize minimal expected structure
        if "exercises" not in data or not isinstance(data["exercises"], list):
            data = {"exercises": []}
        return data
    except Exception:
        return {"exercises": []}

def _save_exercise_index(index_data: dict):
    os.makedirs(os.path.dirname(_exercise_index_path()), exist_ok=True)
    with open(_exercise_index_path(), "w", encoding="utf-8") as f:
        json.dump(index_data or {"exercises": []}, f, ensure_ascii=False, indent=2)
    return index_data

def _write_versioned_exercise(exercise_id: str, version: int, payload: dict):
    """
    Writes a versioned exercise JSON:
      data/exercises/<exercise_id>@v<version>.json
    Returns the relative filepath and absolute path.
    """
    base_dir = _ensure_exercises_dir()
    filename = f"{exercise_id}@v{version}.json"
    abs_path = os.path.join(base_dir, filename)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(payload or {}, f, ensure_ascii=False, indent=2)
    # Return a repo-relative path for later use, if needed
    rel_path = os.path.join("data", "exercises", filename).replace("\\", "/")
    return rel_path, abs_path

@bp.route("/exercises", methods=["GET"])
def admin_exercises_library():
    """
    Admin library shell (global, no regions).
    """
    index_data = _load_exercise_index()
    return render_template("admin_exercises.html", index=index_data)

@bp.route("/exercises/new", methods=["GET"])
def admin_exercises_new():
    """
    New exercise shell (global, no regions).
    If ?id=<exercise_id> is provided, load that exercise's pinned (or latest)
    version and pass it to the template as `edit_ex` to prefill the form.
    Query params:
      - type: "tf" | "mcq" | ...
      - id?: exercise id to edit
    """
    ex_type = (request.args.get("type") or "tf").lower().strip()
    ex_id = (request.args.get("id") or "").strip()

    edit_payload = None
    if ex_id:
        try:
            index = _load_exercise_index()
            rec = next((e for e in index.get("exercises", []) if e.get("id") == ex_id), None)
            if rec:
                # choose pinned_version if present, else the highest version number
                ver = rec.get("pinned_version")
                if not ver:
                    if rec.get("versions"):
                        ver = max(v.get("version", 0) for v in rec["versions"])
                # resolve the JSON path for that version
                vrow = None
                if rec.get("versions"):
                    vrow = next((v for v in rec["versions"] if v.get("version") == ver), None)
                    if not vrow:  # fallback to last row if not found
                        vrow = rec["versions"][-1]
                if vrow and vrow.get("path"):
                    abs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", vrow["path"]))
                    if os.path.exists(abs_path):
                        with open(abs_path, "r", encoding="utf-8") as f:
                            edit_payload = json.load(f)
                # If the stored type exists, prefer it for the builder
                if edit_payload and edit_payload.get("type"):
                    ex_type = str(edit_payload.get("type")).lower().strip()
        except Exception:
            edit_payload = None  # fail-safe

    return render_template(
        "admin_exercises.html",
        create_type=ex_type,
        index=_load_exercise_index(),
        edit_ex=edit_payload
    )

@bp.route("/exercises/save", methods=["POST"])
def admin_exercises_save():
    """
    Create or update an exercise and write a new versioned payload (GLOBAL; no region).
    Expects form-data (or JSON) with at minimum:
      - type: str              ("tf" initially)
      - title: str             (admin-facing title)
      - items: JSON string or object  (exercise content; for TF this is the list of questions)
    Optional:
      - id: str                (if omitted, new UUID4)
      - version: int           (if omitted, auto-increment from index)
      - meta: JSON string or object  (tags, level, etc.)
      - overrides: JSON string or object (stored on the index record)

    Behavior:
      - Appends a new version file under data/exercises/.
      - Updates/creates the exercise record in exercises.index.json with pinned_version (if not set).
    """
    # Accept both JSON and form submissions
    data = request.get_json(silent=True) or {}
    form = request.form or {}

    def pick(k, default=None):
        return (data.get(k) if k in data else form.get(k, default))

    ex_type = (pick("type", "tf") or "tf").lower().strip()
    title = (pick("title", "") or "").strip()
    if not title:
        return jsonify({"success": False, "error": "Missing required field: title"}), 400

    # id: keep if provided; else new
    exercise_id = (pick("id") or uuid.uuid4().hex)

    # items/meta/overrides may arrive as JSON strings
    def ensure_obj(val):
        if isinstance(val, (dict, list)):
            return val
        if not val:
            return {}
        try:
            return json.loads(val)
        except Exception:
            return {}

    items = ensure_obj(pick("items", {}))
    meta = ensure_obj(pick("meta", {}))
    overrides = ensure_obj(pick("overrides", {}))

    # Load index and compute next version if not given
    index_data = _load_exercise_index()
    ex_list = index_data.get("exercises", [])
    existing = next((e for e in ex_list if e.get("id") == exercise_id), None)

    # Determine version
    req_version = pick("version")
    if req_version is not None:
        try:
            version = int(req_version)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "version must be an integer"}), 400
    else:
        if existing and isinstance(existing.get("versions"), list) and existing["versions"]:
            version = max(v.get("version", 0) for v in existing["versions"]) + 1
        else:
            version = 1

    # Build payload to persist
    from datetime import datetime
    payload = {
        "id": exercise_id,
        "type": ex_type,      # "tf", "mcq", ...
        "title": title,
        "version": version,
        "created_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "items": items,       # e.g., list of T/F questions with feedback & optional hints
        "meta": meta,         # tags/CEFR/etc.
    }

    # Write versioned file
    rel_path, _abs = _write_versioned_exercise(exercise_id, version, payload)

    # Update index record
    record = existing or {
        "id": exercise_id,
        "type": ex_type,
        "title": title,
        "pinned_version": version,   # default pin to first version
        "overrides": overrides,      # placeholder for per-insert defaults
        "versions": []
    }
    # Keep title/type in sync if changed
    record["title"] = title
    record["type"] = ex_type
    record.setdefault("versions", [])
    # Append/replace this version info
    v_entry = {"version": version, "path": rel_path}
    found_idx = next((i for i, v in enumerate(record["versions"]) if v.get("version") == version), -1)
    if found_idx >= 0:
        record["versions"][found_idx] = v_entry
    else:
        record["versions"].append(v_entry)
        record["versions"].sort(key=lambda v: v.get("version", 0))

    # Put back into list
    if existing:
        ex_list = [record if e.get("id") == exercise_id else e for e in ex_list]
    else:
        ex_list.append(record)

    # Save index
    index_data["exercises"] = ex_list
    _save_exercise_index(index_data)

    return jsonify({
        "success": True,
        "exercise": {
            "id": exercise_id,
            "type": ex_type,
            "title": title,
            "saved_version": version,
            "pinned_version": record.get("pinned_version", version),
            "versions": record.get("versions", []),
        },
        "path": rel_path
    })
# === END: Exercises storage + admin routes scaffolding ===

# === BEGIN: Admin endpoints to read/update glossary visibility ===
@bp.route("/glosarios/settings", methods=["GET"])
def get_glossary_settings():
    """
    Returns a JSON map of { country_code: enabled(bool) } for all glossaries.
    """
    return jsonify(load_glossary_settings())

@bp.route("/glosarios/settings", methods=["POST"])
def update_glossary_settings():
    """
    Body JSON:
      { "code": "<country_code>", "enabled": true/false }
    Updates the enabled flag for a single country code.
    """
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").lower().strip()
    if code not in country_map:
        return jsonify({"success": False, "error": f"Invalid country code: {code}"}), 400

    if "enabled" not in data:
        return jsonify({"success": False, "error": "Missing 'enabled' boolean"}), 400

    enabled = bool(data["enabled"])
    settings = load_glossary_settings()
    settings[code] = enabled
    saved = save_glossary_settings(settings)
    return jsonify({"success": True, "settings": saved})
# === END: Admin endpoints to read/update glossary visibility ===

@bp.route("/data/glossaries/<country_code>.json")
def serve_glossary_json(country_code):
    if country_code not in country_map:
        return f"Invalid country code: {country_code}", 404

    filename = f"{country_map[country_code]}.json"
    glossary_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'glossaries'))

    if not os.path.exists(os.path.join(glossary_dir, filename)):
        return f"No glossary found for {country_code}", 404

    return send_from_directory(glossary_dir, filename)

# ==== Admin: Home Tiles (list page) ==========================================
def _tiles_json_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'pages', 'home_tiles.json'))

def _load_home_tiles():
    path = _tiles_json_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or []
        # keep only enabled tiles; normalize and sort by "order"
        tiles = []
        for t in data:
            if not isinstance(t, dict):
                continue
            if t.get("enabled", True) is False:
                continue
            # Back-compat: if JSON uses "image_url", map it to "image"
            if "image" not in t and "image_url" in t:
                t["image"] = t.get("image_url")
            tiles.append(t)
        tiles.sort(key=lambda x: x.get("order", 0))
        return tiles
    except Exception:
        return []

@bp.route("/home/tiles")
def admin_home_tiles():
    """Admin tiles screen: show enabled tiles from home_tiles.json."""
    return render_template("admin_tiles.html", tiles=_load_home_tiles())