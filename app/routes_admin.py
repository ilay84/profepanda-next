from flask import Blueprint, render_template, request, jsonify, send_from_directory
import os
import json
import uuid
import glob
import shutil

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
    """
    Load exercises.index.json if present and valid; otherwise rebuild by scanning
    the filesystem. Prefer the new foldered layout:

      data/exercises/<id>/
        meta.json
        current.json
        versions/vNNN.json

    Also merges legacy files named "<id>@vN.json" (preferring the new vNNN.json
    paths when both exist). Saves a refreshed exercises.index.json on rebuild.
    """
    path = _exercise_index_path()

    # --- 1) Try to load an existing valid index --------------------------
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f) or {}
            if isinstance(data.get("exercises"), list) and data["exercises"]:
                return data
    except Exception:
        pass  # fall through to rebuild

    # --- 2) Rebuild by scanning the filesystem ---------------------------
    root = _exercises_root_path()
    ex_map = {}

    # Helper: safe JSON load
    def _safe_load_json(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    # (a) Scan folder-based records first (new layout)
    try:
        for name in os.listdir(root):
            d = os.path.join(root, name)
            if not os.path.isdir(d):
                continue

            meta_p = os.path.join(d, "meta.json")
            current_p = os.path.join(d, "current.json")
            versions_d = os.path.join(d, "versions")

            rec = {
                "id": name,
                "type": None,
                "title": None,
                "pinned_version": None,
                "versions": [],
            }

            meta = _safe_load_json(meta_p)
            if meta:
                rec["type"] = meta.get("type")
                rec["title"] = meta.get("title")
                if isinstance(meta.get("pinned_version"), int):
                    rec["pinned_version"] = meta.get("pinned_version")

            # enumerate vNNN.json
            if os.path.isdir(versions_d):
                for fn in os.listdir(versions_d):
                    if not fn.lower().endswith(".json"):
                        continue
                    import re as _re
                    m = _re.match(r"^v(\d+)\.json$", fn, _re.I)
                    if not m:
                        continue
                    ver = int(m.group(1))
                    rec["versions"].append({
                        "version": ver,
                        "path": os.path.join("data", "exercises", name, "versions", fn).replace("\\", "/")
                    })

            # If we found any versions, finalize the record.
            # If no versions but current.json exists, still include the record so the UI can show it;
            # preview will fall back to current.json (Edit #3).
            if rec["versions"]:
                rec["versions"].sort(key=lambda v: v.get("version", 0))
                if rec["pinned_version"] is None:
                    rec["pinned_version"] = rec["versions"][-1]["version"]
                ex_map[name] = rec
            else:
                if os.path.exists(current_p):
                    ex_map[name] = rec
    except Exception:
        pass  # continue to legacy scan regardless

    # (b) Merge legacy "<id>@vN.json" files
    try:
        import re
        for fn in os.listdir(root):
            p = os.path.join(root, fn)
            if not (os.path.isfile(p) and fn.lower().endswith(".json")):
                continue
            m = re.match(r"^(.+?)@v(\d+)\.json$", fn)
            if not m:
                continue
            ex_id, ver = m.group(1), int(m.group(2))
            rec = ex_map.get(ex_id)
            if not rec:
                rec = {"id": ex_id, "type": None, "title": None, "pinned_version": None, "versions": []}
                ex_map[ex_id] = rec
            # Skip if this version already exists via new layout
            if any(v.get("version") == ver for v in rec["versions"]):
                continue
            rec["versions"].append({
                "version": ver,
                "path": os.path.join("data", "exercises", fn).replace("\\", "/")
            })
            if rec["pinned_version"] is None or ver > rec["pinned_version"]:
                rec["pinned_version"] = ver
    except Exception:
        pass

    # --- 3) Finalize & persist refreshed index ---------------------------
    exercises = list(ex_map.values())
    exercises.sort(key=lambda r: ((r.get("title") or "").lower(), r.get("id") or ""))
    index_data = {"exercises": exercises}
    try:
        _save_exercise_index(index_data)
    except Exception:
        pass
    return index_data

def _save_exercise_index(index_data: dict):
    os.makedirs(os.path.dirname(_exercise_index_path()), exist_ok=True)
    with open(_exercise_index_path(), "w", encoding="utf-8") as f:
        json.dump(index_data or {"exercises": []}, f, ensure_ascii=False, indent=2)
    return index_data

def _write_versioned_exercise(exercise_id: str, version: int, payload: dict):
    """
    Writes a versioned exercise JSON using the new canonical structure:

      data/exercises/<exercise_id>/
        meta.json
        current.json
        versions/
          vNNN.json

    Returns: (rel_path, abs_path) for the version file, e.g.
      ("data/exercises/<id>/versions/v003.json", "<ABSOLUTE_PATH>").
    """
    # Local import so this edit only touches one spot in this file.
    from . import storage

    rel_path, abs_path = storage.write_exercise_version(
        exercise_id,
        int(version),
        payload or {},
        title=(payload or {}).get("title"),
        ex_type=(payload or {}).get("type"),
        pin=True,  # keep latest pinned for preview by default
    )
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

    return render_template(
        "admin_exercises.html",
        create_type=ex_type,
        index=_load_exercise_index(),
        edit_ex=edit_payload
    )

@bp.route("/exercises/<exercise_id>/preview", methods=["GET"])
def admin_exercises_preview(exercise_id):
    """
    Return the pinned (or latest) version payload for an exercise as JSON.
    Used by the Biblioteca 'Vista previa' button in the admin UI.
    """
    try:
        index = _load_exercise_index()
        rec = next((e for e in index.get("exercises", []) if e.get("id") == exercise_id), None)
        if not rec:
            return jsonify({"success": False, "error": "Exercise not found"}), 404

        # choose pinned_version if present, else the highest version number
        ver = rec.get("pinned_version")
        if not ver:
            if rec.get("versions"):
                ver = max(v.get("version", 0) for v in rec["versions"])

        vrow = None
        if rec.get("versions"):
            vrow = next((v for v in rec["versions"] if v.get("version") == ver), None)
            if not vrow:  # fallback to last row if not found
                vrow = rec["versions"][-1]

        # Try the pinned/latest version path first; if missing, fall back to current.json
        abs_path = None

        if vrow and vrow.get("path"):
            cand = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", vrow["path"]))
            if os.path.exists(cand):
                abs_path = cand

        if not abs_path:
            # Fallback to new storage layout's current.json
            try:
                from . import storage  # new helper module
                cand = storage.current_path(exercise_id)
            except Exception:
                # Safe fallback if storage import isn't available
                cand = os.path.abspath(os.path.join(
                    os.path.dirname(__file__), "..", "data", "exercises", exercise_id, "current.json"
                ))
            if os.path.exists(cand):
                abs_path = cand

        if not abs_path:
            return jsonify({"success": False, "error": "No version file found (and no current.json)"}), 404

        with open(abs_path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        # ---------- NEW: if ?as=player, return an embeddable HTML player ----------
        if (request.args.get("as") or "").lower() == "player":
            from flask import render_template_string
            # minimal TF player (no external template needed)
            html = r"""
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{{ ex.title or 'Vista previa' }}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root{--bg:#f6f8fb;--card:#fff;--muted:#64748b;--ink:#0f172a;--line:#e5e7eb;--good:#15803d;--bad:#b91c1c;}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,"Helvetica Neue",Arial}
    .wrap{padding:14px 16px}
    .h{margin:0 0 10px;font-weight:700}
    .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:0 0 12px;box-shadow:0 6px 20px rgba(0,0,0,.06)}
    .prompt{font-weight:600;margin-bottom:8px}
    .row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
    .btn{appearance:none;border:1px solid var(--line);background:#fff;color:var(--ink);padding:.45rem .7rem;border-radius:10px;cursor:pointer;font-weight:600}
    .btn:hover{background:#f8fafc}
    .tiny{font-size:.9rem;color:var(--muted)}
    .media{display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;margin-bottom:.5rem}
    .media img{max-width:220px;border:1px solid var(--line);border-radius:8px}
    .media video{display:block;max-width:320px;border-radius:6px}
    .media iframe{width:320px;height:180px;border:0;border-radius:6px}
    .fb{margin-top:.35rem}
    .good{color:var(--good)} .bad{color:var(--bad)}
  </style>
</head>
<body>
  <div class="wrap">
    <h3 class="h">{{ ex.title or 'Vista previa' }}</h3>
    {% set items_list = ex['items'] or [] %}
    {% for it in items_list %}
      <div class="card" data-idx="{{ loop.index0 }}">
        {% set m = (it.media or {}) %}
        {% if m.image or m.audio or m.video or m.youtube_url %}
          <div class="media">
            {% if m.image %}<img src="{{ m.image }}" alt="{{ m.image_alt or '' }}">{% endif %}
            {% if m.audio %}<audio controls src="{{ m.audio }}"></audio>{% endif %}
            {% if m.video %}<video controls src="{{ m.video }}"></video>{% endif %}
            {% if m.youtube_url %}
              {% set _id = 'v=' in m.youtube_url and m.youtube_url.split('v=')[-1].split('&')[0] or m.youtube_url.rsplit('/',1)[-1] %}
              <iframe src="https://www.youtube.com/embed/{{ _id }}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            {% endif %}
          </div>
        {% endif %}
        <div class="prompt">{{ it.prompt or '(sin enunciado)' }}</div>
        <div class="row">
          <button class="btn" data-a="true">Verdadero</button>
          <button class="btn" data-a="false">Falso</button>
          {% if it.hint %}<button class="btn" data-hint>Ver pista</button>{% endif %}
        </div>
        {% if it.hint %}<div class="tiny" data-hint-box style="display:none;margin-top:.35rem;">{{ it.hint }}</div>{% endif %}
        <div class="fb tiny" data-fb></div>
      </div>
    {% endfor %}
  </div>
  <script>
    (function(){
      var items = {{ (payload.get("items") or [])|tojson }};
      document.addEventListener('click', function(e){
        var b = e.target.closest('button[data-a],button[data-hint]');
        if(!b) return;
        var card = b.closest('.card');
        var idx = parseInt(card.getAttribute('data-idx')||'0',10);
        var it = items[idx] || {};
        if(b.hasAttribute('data-hint')){
          var box = card.querySelector('[data-hint-box]');
          if(box){ box.style.display = box.style.display === 'none' ? 'block' : 'none'; }
          return;
        }
        var ans = b.getAttribute('data-a') === 'true';
        var ok = (ans === !!it.answer);
        var fb = card.querySelector('[data-fb]');
        fb.textContent = ok ? (it.feedback_correct || '¡Correcto!') : (it.feedback_incorrect || 'No es correcto.');
        fb.className = 'fb tiny ' + (ok ? 'good' : 'bad');
      });
    })();
  </script>
</body>
</html>
"""
            return render_template_string(html, ex=payload, payload=payload)

        # ---------- default JSON (unchanged) ----------
        return jsonify({"success": True, "exercise": payload})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/exercises/save", methods=["POST"])
def admin_exercises_save():
    """
    Create or update an exercise and write a new versioned payload (GLOBAL; no region).

    Expected (form-data OR JSON):
      - type: str              ("tf" initially)
      - title: str             (admin-facing title)
      - items: JSON string or object
         For TF: [{ prompt, answer, feedback_correct?, feedback_incorrect?, hint?, media? }]
         media may include:
           {
             youtube_url?: str,
             image_alt?: str,
             image?: "__UPLOAD__" | "/static/...",
             audio?: "__UPLOAD__" | "/static/...",
             video?: "__UPLOAD__" | "/static/..."
           }

    If using form-data for uploads, also include arrays aligned by item index:
      - media_index[]        (hidden; "0", "1", "2", ...)
      - media_image[]        (files; optional per row)
      - media_image_alt[]    (text; already in items JSON too)
      - media_audio[]        (files; optional per row)
      - media_video[]        (files; optional per row)
      - media_youtube_url[]  (text; already in items JSON too)

    Optional:
      - id: str
      - version: int
      - meta: JSON
      - overrides: JSON

    Behavior:
      - Saves any uploaded files under: static/exercises/media/<exercise_id>/
      - Rewrites each item's media fields from "__UPLOAD__" to stored /static/... paths
      - Writes a versioned JSON under data/exercises/
      - Updates exercises.index.json
    """
    from datetime import datetime
    from werkzeug.utils import secure_filename

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
    def ensure_obj(val, default_empty):
        if isinstance(val, (dict, list)):
            return val
        if not val:
            return default_empty
        try:
            return json.loads(val)
        except Exception:
            return default_empty

    items = ensure_obj(pick("items", {}), [])
    meta = ensure_obj(pick("meta", {}), {})
    overrides = ensure_obj(pick("overrides", {}), {})

    # Normalize items to a list
    if not isinstance(items, list):
        items = []

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

    # Track files explicitly removed by the user so we can unlink them after saving
    deleted_media_paths = []

    # ---------- Backfill prior media when not re-uploaded ----------
    # If this is an edit and the user didn't upload a new file for a slot,
    # keep the previously saved media path for that item — unless the form
    # explicitly asked to delete it using the "__DELETE__" sentinel.
    prev_items = []
    if existing and isinstance(existing.get("versions"), list) and existing["versions"]:
        # choose pinned_version if present, else the highest version number
        _ver = existing.get("pinned_version")
        if not _ver:
            _ver = max(v.get("version", 0) for v in existing["versions"])
        _vrow = next((v for v in existing["versions"] if v.get("version") == _ver), None) or existing["versions"][-1]
        _path = (_vrow or {}).get("path")
        if _path:
            _abs = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", _path))
            if os.path.exists(_abs):
                try:
                    with open(_abs, "r", encoding="utf-8") as _f:
                        _payload_prev = json.load(_f)
                        if isinstance(_payload_prev.get("items"), list):
                            prev_items = _payload_prev["items"]
                except Exception:
                    prev_items = []

    if prev_items:
        for i, it in enumerate(items):
            if not isinstance(it, dict):
                continue
            m = it.get("media") if isinstance(it.get("media"), dict) else {}
            pm = {}
            if i < len(prev_items) and isinstance(prev_items[i], dict):
                pm = prev_items[i].get("media") if isinstance(prev_items[i].get("media"), dict) else {}

            # Carry forward *only* when value wasn't provided.
            # Respect "__UPLOAD__" (new file incoming) and "__DELETE__" (explicit removal).
            def _apply(key):
                new_val = m.get(key)
                if new_val == "__DELETE__":
                    # record the file we're removing (if it existed) so we can unlink later
                    if pm.get(key):
                        deleted_media_paths.append(pm[key])
                    m[key] = None
                    return
                if (new_val is None or new_val == "") and new_val not in ("__UPLOAD__", "__DELETE__"):
                    if pm.get(key):
                        m[key] = pm[key]

            for _k in ("image", "audio", "video"):
                _apply(_k)

            # keep YouTube/alt if newly blank; clear if explicitly deleted
            if m.get("youtube_url") == "__DELETE__":
                if pm.get("youtube_url"):
                    deleted_media_paths.append(None)  # nothing to unlink for URLs
                m["youtube_url"] = None
            elif (m.get("youtube_url") in (None, "")) and pm.get("youtube_url"):
                m["youtube_url"] = pm["youtube_url"]

            if m.get("image_alt") == "__DELETE__":
                m["image_alt"] = None
            elif (m.get("image_alt") in (None, "")) and pm.get("image_alt"):
                m["image_alt"] = pm["image_alt"]

            it["media"] = m
            items[i] = it

    # ---------- Handle media uploads (form-data only) ----------
    # (Backfill was already handled above with explicit delete support.)
    # Browsers only include selected files in each media_*[] list, so their positions
    # DO NOT align with item indices. We walk items and pull the NEXT available file
    # from each list only when "__UPLOAD__" is present.
    if request.files:
        # Base dir for this exercise's media
        media_dir_abs = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "static", "exercises", "media", exercise_id)
        )
        os.makedirs(media_dir_abs, exist_ok=True)

        # Get lists of files (may contain empties; filter to filename truthy)
        raw_imgs = request.files.getlist("media_image[]")
        raw_auds = request.files.getlist("media_audio[]")
        raw_vids = request.files.getlist("media_video[]")

        img_list = [fs for fs in raw_imgs if getattr(fs, "filename", "")]
        aud_list = [fs for fs in raw_auds if getattr(fs, "filename", "")]
        vid_list = [fs for fs in raw_vids if getattr(fs, "filename", "")]

        # Cursors for each media list
        img_i = 0
        aud_i = 0
        vid_i = 0

        # Helper to save a FileStorage if present
        def _save_file(fs, out_name_hint):
            if not fs or not getattr(fs, "filename", ""):
                return None
            filename = secure_filename(fs.filename or out_name_hint)
            _base, ext = os.path.splitext(filename)
            if not ext:
                mt = (getattr(fs, "mimetype", "") or "").lower()
                if mt.startswith("image/"):
                    ext = ".png"
                elif mt.startswith("audio/"):
                    ext = ".mp3"
                elif mt.startswith("video/"):
                    ext = ".mp4"
                else:
                    ext = ".bin"
            out_name = f"{out_name_hint}{ext.lower()}"
            abs_path = os.path.join(media_dir_abs, out_name)
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            fs.save(abs_path)
            return f"/static/exercises/media/{exercise_id}/{out_name}".replace("\\", "/")

        # Walk items and attach media in order
        for i, it in enumerate(items):
            if not isinstance(it, dict):
                continue
            m = it.get("media") if isinstance(it.get("media"), dict) else {}

            # IMAGE
            if m.get("image") == "__UPLOAD__" and img_i < len(img_list):
                saved = _save_file(img_list[img_i], f"q{i}_image")
                img_i += 1
                if saved:
                    m["image"] = saved
                else:
                    m["image"] = None  # clear if save failed

            # AUDIO
            if m.get("audio") == "__UPLOAD__" and aud_i < len(aud_list):
                saved = _save_file(aud_list[aud_i], f"q{i}_audio")
                aud_i += 1
                if saved:
                    m["audio"] = saved
                else:
                    m["audio"] = None

            # VIDEO
            if m.get("video") == "__UPLOAD__" and vid_i < len(vid_list):
                saved = _save_file(vid_list[vid_i], f"q{i}_video")
                vid_i += 1
                if saved:
                    m["video"] = saved
                else:
                    m["video"] = None

            # Normalize and assign back
            it["media"] = {
                "youtube_url": (m.get("youtube_url") or None),
                "image_alt": (m.get("image_alt") or None),
                "image": m.get("image") or None,
                "audio": m.get("audio") or None,
                "video": m.get("video") or None,
            }
            items[i] = it

    else:
        # If no files (JSON or simple form), normalize placeholders.
        # Clear "__UPLOAD__" and honor "__DELETE__" (and record files to unlink).
        for i, it in enumerate(items):
            if not isinstance(it, dict):
                continue
            m = it.get("media") if isinstance(it.get("media"), dict) else {}

            # Find previous media for potential unlink when "__DELETE__"
            pm = {}
            if i < len(prev_items) and isinstance(prev_items[i], dict):
                pm = prev_items[i].get("media") if isinstance(prev_items[i].get("media"), dict) else {}

            for k in ("image", "audio", "video"):
                if m.get(k) == "__UPLOAD__":
                    m[k] = None
                elif m.get(k) == "__DELETE__":
                    if pm.get(k):
                        deleted_media_paths.append(pm[k])
                    m[k] = None

            if m.get("youtube_url") == "__DELETE__":
                m["youtube_url"] = None
            if m.get("image_alt") == "__DELETE__":
                m["image_alt"] = None

            it["media"] = {
                "youtube_url": (m.get("youtube_url") or None),
                "image_alt": (m.get("image_alt") or None),
                "image": m.get("image") or None,
                "audio": m.get("audio") or None,
                "video": m.get("video") or None,
            }
            items[i] = it

    # Remove any media files the user explicitly deleted
    # Only unlink paths under /static/... (safety guard)
    for rel in deleted_media_paths:
        try:
            if not rel or not isinstance(rel, str):
                continue
            if not rel.startswith("/static/"):
                continue
            static_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
            abs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", rel.lstrip("/")))
            # ensure we only delete inside the static directory
            if os.path.commonpath([abs_path, static_root]) != static_root:
                continue
            if os.path.exists(abs_path):
                os.remove(abs_path)
        except Exception:
            # best-effort; ignore unlink errors
            pass

    # ---------- Build payload to persist (after media injection) ----------
    payload = {
        "id": exercise_id,
        "type": ex_type,
        "title": title,
        "version": version,
        "created_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "items": items,
        "meta": meta,
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

    # Always pin the just-saved version so Biblioteca preview shows your edits
    record["pinned_version"] = version

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

@bp.route("/exercises/<exercise_id>/delete", methods=["POST"])
def admin_exercises_delete(exercise_id):
    """
    Delete an entire exercise (new + legacy layouts):
      - Removes folder data/exercises/<id>/ (meta.json, current.json, versions/*)
      - Removes any legacy files data/exercises/<id>@vN.json
      - Removes its record from exercises.index.json
      - Optionally deletes media under static/exercises/media/<id>/

    Body JSON (optional):
      { "purge_media": true|false }   # default: False
    """
    try:
        data = request.get_json(silent=True) or {}
        purge_media = bool(data.get("purge_media", False))

        # Load index and find record
        index_data = _load_exercise_index()
        ex_list = index_data.get("exercises", [])
        record = next((e for e in ex_list if e.get("id") == exercise_id), None)
        if not record:
            return jsonify({"success": False, "error": "Exercise not found"}), 404

        # --- Paths ---
        app_dir       = os.path.dirname(__file__)
        project_root  = os.path.abspath(os.path.join(app_dir, ".."))
        data_root     = os.path.abspath(os.path.join(project_root, "data"))
        exercises_root = os.path.abspath(os.path.join(data_root, "exercises"))
        ex_dir        = os.path.abspath(os.path.join(exercises_root, exercise_id))
        versions_dir  = os.path.join(ex_dir, "versions")
        meta_json     = os.path.join(ex_dir, "meta.json")
        current_json  = os.path.join(ex_dir, "current.json")

        # --- Delete versioned JSON files listed in index (corrected path base) ---
        for v in (record.get("versions") or []):
            p = (v or {}).get("path")
            if not p:
                continue
            # stored paths are repo-relative like "data/exercises/<id>/versions/vNNN.json"
            abs_path = os.path.abspath(os.path.join(project_root, p))
            try:
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception:
                pass  # best-effort

        # --- Extra sweep: remove any versions not listed in index ---
        try:
            if os.path.isdir(versions_dir):
                for fn in os.listdir(versions_dir):
                    if fn.lower().endswith(".json"):
                        fpath = os.path.join(versions_dir, fn)
                        try:
                            os.remove(fpath)
                        except Exception:
                            pass
        except Exception:
            pass

        # --- Remove meta/current and then the <id> folder entirely ---
        for f in (meta_json, current_json):
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass
        try:
            if os.path.isdir(ex_dir) and os.path.commonpath([ex_dir, exercises_root]) == exercises_root:
                shutil.rmtree(ex_dir)
        except Exception:
            pass

        # --- Legacy cleanup: <id>@vN.json in data/exercises root ---
        try:
            legacy_pattern = os.path.join(exercises_root, f"{exercise_id}@v*.json")
            for fpath in glob.glob(legacy_pattern):
                try:
                    os.remove(fpath)
                except Exception:
                    pass
        except Exception:
            pass

        # --- Remove from index and save back ---
        index_data["exercises"] = [e for e in ex_list if e.get("id") != exercise_id]
        _save_exercise_index(index_data)

        # --- Optionally purge media folder ---
        deleted_media = False
        if purge_media:
            static_root = os.path.abspath(os.path.join(project_root, "static"))
            media_dir = os.path.abspath(os.path.join(static_root, "exercises", "media", exercise_id))
            try:
                if os.path.commonpath([media_dir, static_root]) == static_root and os.path.isdir(media_dir):
                    shutil.rmtree(media_dir)
                    deleted_media = True
            except Exception:
                pass

        return jsonify({
            "success": True,
            "deleted": {"id": exercise_id},
            "deleted_media": deleted_media
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


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