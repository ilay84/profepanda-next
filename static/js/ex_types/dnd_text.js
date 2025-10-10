/* static/js/ex_types/dnd_text.js
   Exposes: window.PPTypes.renderDnDText(rootEl, exercise, options?)

   - rootEl: HTMLElement where the board renders
   - exercise: {
       id, title, version,
       instructions?: string (HTML),
       columns: [{ id, label }],
       items: [{
         id, text, correct_column,
         hint?: string,
         feedback_correct?: string,
         feedback_incorrect?: string
       }],
       settings?: {
         shuffle_items?: boolean,
         allow_partial_submit?: boolean,
         show_hints?: boolean,
         max_columns?: number,
         theme?: { ok?: string, bad?: string }
       }
     }
   - options?: { onFinish?: (result)=>void, theme?: { ok?: string, bad?: string } }

   Result shape sent to onFinish:
     {
       exercise_id, type: 'dnd_text',
       total, correct, score_pct,
       placements: [{ id, placed_column, correct_column, ok }],
       time_ms
     }
*/
(function(){
  if (!window.PPTypes) window.PPTypes = {};

  window.PPTypes.renderDnDText = function renderDnDText(rootEl, exercise, options){
    // ---------- Guards ----------
    if (!rootEl) return;
    rootEl.innerHTML = "";

    const ex = normalizeExercise(exercise);
    const theme = Object.assign(
      { ok: "#16a34a", bad: "#dc2626" },
      (ex.settings && ex.settings.theme) || {},
      (options && options.theme) || {}
    );

    // ---------- Shell ----------
    const wrap = el("div", { style: "display:flex;flex-direction:column;gap:.75rem;" });

    // If we are inside the admin preview modal, preview.js already shows title + instructions.
    const inPreviewModal = !!(rootEl.closest('#pp-ex-modal') || document.querySelector('.pp-ex-modal'));

    // Header (title + version) — only on public pages (not inside preview modal)
    if (!inPreviewModal && (ex.title || ex.version)) {
      const header = el("div", {
        style: "display:flex;justify-content:space-between;align-items:center;"
      });
      const h = el("div", { style: "font-weight:700;" }, ex.title || "Arrastrar y soltar");
      const ver = ex.version ? el("div", { class: "tiny muted" }, "v" + ex.version) : null;
      header.appendChild(h);
      if (ver) header.appendChild(ver);
      wrap.appendChild(header);
    }

    // Global media (exercise-level) — show before the tray
    if (ex.media && (ex.media.image || ex.media.audio || ex.media.video || ex.media.youtube_url)) {
      const m = ex.media || {};
      const g = el("div", { style: "border:1px solid #e5e7eb;border-radius:10px;padding:.6rem;background:#fff;display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;" });

      if (m.image) {
        const img = document.createElement("img");
        img.src = m.image;
        img.alt = m.image_alt || "";
        img.style.cssText = "max-width:240px;border:1px solid #e5e7eb;border-radius:8px;";
        g.appendChild(img);
      }
      if (m.audio) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = m.audio;
        audio.style.cssText = "display:block;max-width:320px;";
        g.appendChild(audio);
      }
      if (m.video) {
        const vid = document.createElement("video");
        vid.controls = true;
        vid.src = m.video;
        vid.style.cssText = "display:block;max-width:360px;border-radius:6px;";
        g.appendChild(vid);
      }
      if (m.youtube_url) {
        const url = (m.youtube_url || "").trim();
        let id = "";
        try {
          if (url.includes("v=")) id = url.split("v=")[1].split("&")[0];
          else id = url.split("/").pop();
        } catch(e){}
        if (id) {
          const iframe = document.createElement("iframe");
          iframe.width = "360";
          iframe.height = "202";
          iframe.src = "https://www.youtube.com/embed/" + id;
          iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
          iframe.referrerPolicy = "strict-origin-when-cross-origin";
          iframe.style.cssText = "border:0;border-radius:6px;";
          iframe.allowFullscreen = true;
          g.appendChild(iframe);
        }
      }

      wrap.appendChild(g);
    }

    // Create (or reuse) a hidden media panel for per-item media previews
    let mediaPanel = rootEl.querySelector('#pp-dnd-media');
    if (!mediaPanel) {
      mediaPanel = el("div", {
        id: "pp-dnd-media",
        style: "display:none;border:1px solid #e5e7eb;border-radius:10px;padding:.6rem;background:#fff;"
      });
      wrap.appendChild(mediaPanel);
    }

    // Tray
    const tray = card("border:1px dashed #cbd5e1;border-radius:12px;padding:.75rem;background:#fafafa;");
    const trayTitle = el("div", { style: "font-weight:600;margin-bottom:.5rem;" }, "Ítems");
    const trayWrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:.5rem;" });
    tray.appendChild(trayTitle);
    tray.appendChild(trayWrap);

    // Columns grid
    const grid = el("div");
    const colCount = Math.min(
      ex.columns.length,
      Math.max(2, ex.settings.max_columns || 6)
    );
    grid.style.cssText = "display:grid;gap:.75rem;margin-top:.75rem;grid-template-columns:repeat("+colCount+", minmax(0,1fr));";

    // Build columns
    const colDrops = {}; // id -> drop container
    ex.columns.forEach(c => {
      const box = card();
      box.dataset.col = c.id;
      box.style.minHeight = "120px";
      box.style.display = "flex";
      box.style.flexDirection = "column";
      box.style.gap = ".5rem";

      const lab = el("div", {
        style: "font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:.35rem .5rem;margin:-.25rem -.25rem .25rem;"
      }, c.label || c.id);
      const drop = el("div", { style: "min-height:60px;display:flex;flex-wrap:wrap;gap:.5rem;" });

      // DnD events
      [box, drop].forEach(elm => {
        elm.addEventListener("dragover", (e) => { e.preventDefault(); elm.style.background = "#f8fafc"; });
        elm.addEventListener("dragleave", () => { elm.style.background = "#fff"; });
        elm.addEventListener("drop", (e) => {
          e.preventDefault();
          elm.style.background = "#fff";
          const id = e.dataTransfer.getData("text/plain");
          const chip = rootEl.querySelector('[data-item-id="'+id+'"]');
          if (chip) drop.appendChild(chip);
          updateSubmitState();
        });
      });

      box.appendChild(lab);
      box.appendChild(drop);
      grid.appendChild(box);
      colDrops[c.id] = drop;
    });

    // Build items
    let items = ex.items.slice();
    if (ex.settings.shuffle_items) items = shuffle(items);

    const chips = items.map(it => {
      const chip = chipBtn(it.text || it.id);
      chip.setAttribute("draggable", "true");
      chip.dataset.itemId = it.id;

      // drag events
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", it.id);
        chip.style.opacity = "0.6";
        renderMediaFor(it);
      });
      chip.addEventListener("dragend", () => { chip.style.opacity = "1"; });

      // show media on click/focus
      chip.addEventListener("click", () => { renderMediaFor(it); });
      chip.addEventListener("focus", () => { renderMediaFor(it); });

      // Hint tooltip
      if (ex.settings.show_hints && it.hint) chip.title = it.hint;

      // Keyboard accessibility
      chip.tabIndex = 0;
      chip.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // Toggle "grabbed"
          const picked = chip.getAttribute("aria-grabbed") === "true";
          if (!picked) {
            chip.setAttribute("aria-grabbed", "true");
            chip.style.outline = "2px solid #94a3b8";
            renderMediaFor(it);
          } else {
            // Drop back to tray by default
            chip.setAttribute("aria-grabbed", "false");
            chip.style.outline = "none";
            trayWrap.appendChild(chip);
            updateSubmitState();
            renderMediaFor(it);
          }
          return;
        }

        // If grabbed, allow Arrow keys to move across columns
        if (chip.getAttribute("aria-grabbed") === "true") {
          const cols = ex.columns.map(c => c.id);
          let idx = 0;
          if (chip.parentElement && chip.parentElement.closest("[data-col]")) {
            const colId = chip.parentElement.closest("[data-col]").dataset.col;
            const j = cols.indexOf(colId);
            idx = j >= 0 ? j : 0;
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            idx = Math.min(idx + 1, cols.length - 1);
            colDrops[cols[idx]].appendChild(chip);
            updateSubmitState();
            renderMediaFor(it);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            idx = Math.max(idx - 1, 0);
            colDrops[cols[idx]].appendChild(chip);
            updateSubmitState();
            renderMediaFor(it);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            chip.setAttribute("aria-grabbed", "false");
            chip.style.outline = "none";
          }
        }
      });

      trayWrap.appendChild(chip);
      return { it, chip };
    });

    // Auto-show media for the first item that has media (discoverability)
    (function(){
      const firstWithMedia = items.find(i =>
        i && i.media && (i.media.image || i.media.audio || i.media.video || i.media.youtube_url)
      );
      if (firstWithMedia) renderMediaFor(firstWithMedia);
    })();

    function renderMediaFor(item){
      // Ensure the media panel exists and is mounted
      if (!mediaPanel || !mediaPanel.parentNode) {
        mediaPanel = rootEl.querySelector('#pp-dnd-media');
        if (!mediaPanel) {
          mediaPanel = el("div", {
            id: "pp-dnd-media",
            style: "display:none;border:1px solid #e5e7eb;border-radius:10px;padding:.6rem;background:#fff;"
          });
          wrap.appendChild(mediaPanel);
        }
      }

      const m = (item && item.media) || {};
      const has =
        (m.image && String(m.image).trim()) ||
        (m.audio && String(m.audio).trim()) ||
        (m.video && String(m.video).trim()) ||
        (m.youtube_url && String(m.youtube_url).trim());

      if (!has) {
        mediaPanel.style.display = "none";
        mediaPanel.innerHTML = "";
        return;
      }

      const box = document.createElement("div");
      box.style.cssText = "display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;";

      if (m.image) {
        const img = document.createElement("img");
        img.src = m.image;
        img.alt = m.image_alt || "";
        img.style.cssText = "max-width:240px;border:1px solid #e5e7eb;border-radius:8px;";
        box.appendChild(img);
      }
      if (m.audio) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = m.audio;
        audio.style.cssText = "display:block;max-width:320px;";
        box.appendChild(audio);
      }
      if (m.video) {
        const vid = document.createElement("video");
        vid.controls = true;
        vid.src = m.video;
        vid.style.cssText = "display:block;max-width:360px;border-radius:6px;";
        box.appendChild(vid);
      }
      if (m.youtube_url) {
        const url = String(m.youtube_url).trim();
        let id = "";
        try {
          if (url.includes("v=")) id = url.split("v=")[1].split("&")[0];
          else id = url.split("/").pop();
        } catch(e){}
        if (id) {
          const iframe = document.createElement("iframe");
          iframe.width = "360";
          iframe.height = "202";
          iframe.src = "https://www.youtube.com/embed/" + id;
          iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
          iframe.referrerPolicy = "strict-origin-when-cross-origin";
          iframe.style.cssText = "border:0;border-radius:6px;";
          iframe.allowFullscreen = true;
          box.appendChild(iframe);
        }
      }

      mediaPanel.innerHTML = "";
      mediaPanel.appendChild(box);
      mediaPanel.style.display = "block";
    }

    // Controls
    const controls = el("div", { style: "display:flex;gap:.5rem;margin-top:.75rem;align-items:center;flex-wrap:wrap;" });
    const submitBtn = el("button", { class: "btn btn-primary", type: "button", disabled: true }, "Enviar");
    const resetBtn  = el("button", { class: "btn", type: "button" }, "Reiniciar");
    const scoreBox  = el("div", { class: "tiny muted", style:"margin-left:auto;" });

    controls.appendChild(submitBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(scoreBox);

    // Mount
    wrap.appendChild(tray);
    wrap.appendChild(grid);
    wrap.appendChild(controls);
    rootEl.appendChild(wrap);

    // ---------- Behavior ----------
    const t0 = Date.now();

    function allPlaced() {
      const chips = Array.from(rootEl.querySelectorAll("[data-item-id]"));
      return chips.every(ch => ch.parentElement && ch.parentElement !== trayWrap);
    }
    function updateSubmitState() {
      if (!ex.settings.allow_partial_submit) submitBtn.disabled = !allPlaced();
    }
    resetBtn.addEventListener("click", () => {
      // Reset visuals
      Array.from(rootEl.querySelectorAll("[data-item-id]")).forEach(ch => {
        ch.style.borderColor = "#cbd5e1";
        ch.style.background = "#f8fafc";
        const id = ch.dataset.itemId;
        const original = items.find(i => i.id === id);
        ch.textContent = original ? original.text : ch.textContent.replace(/^✅ |^❌ /, "");
        trayWrap.appendChild(ch);
      });
      // remove summary
      const old = rootEl.querySelector(".pp-dnd-summary");
      if (old) old.remove();
      scoreBox.textContent = "";
      // hide media panel
      mediaPanel.style.display = "none";
      mediaPanel.innerHTML = "";
      updateSubmitState();
    });

    submitBtn.addEventListener("click", () => {
      const result = gradeAndSummarize();
      // Analytics hook (no-op if missing)
      if (typeof window.PP_EX_EVENTS === "object" && typeof window.PP_EX_EVENTS.onSubmit === "function") {
        try { window.PP_EX_EVENTS.onSubmit(result); } catch(e){}
      }
      if (options && typeof options.onFinish === "function") {
        try { options.onFinish(result); } catch(e){}
      }
    });

    // Enable submit if partial allowed
    if (ex.settings.allow_partial_submit) submitBtn.disabled = false;
    // Initial check for non-partial
    updateSubmitState();

    function gradeAndSummarize(){
      let correct = 0;
      const placements = [];

      // Grade each chip and recolor
      chips.forEach(({it, chip}) => {
        let placedCol = "";
        const box = chip.closest("[data-col]");
        placedCol = box ? box.dataset.col : "";
        const ok = placedCol && it.correct_column && placedCol === it.correct_column;

        placements.push({ id: it.id, placed_column: placedCol || null, correct_column: it.correct_column || null, ok });

        if (ok) {
          chip.style.background = "#dcfce7";
          chip.style.borderColor = "#86efac";
          chip.textContent = "✅ " + (it.text || it.id);
          correct++;
        } else {
          chip.style.background = "#fee2e2";
          chip.style.borderColor = "#fecaca";
          chip.textContent = "❌ " + (it.text || it.id);
        }
      });

      const scorePct = Math.round((correct / ex.items.length) * 100);
      scoreBox.textContent = "Resultado: " + correct + " / " + ex.items.length + " (" + scorePct + "%)";

      // Summary
      const summary = el("div", { class: "pp-dnd-summary", style: "margin-top:1rem;border-top:1px dashed #e5e7eb;padding-top:.75rem;" });
      const colsWrap = el("div", { style: "display:grid;gap:.75rem;grid-template-columns:repeat("+Math.min(ex.columns.length, 3)+", minmax(0,1fr));" });

      ex.columns.forEach(c => {
        const cardEl = card();
        const h = el("div", {
          style: "font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:.35rem .5rem;margin:-.25rem -.25rem .25rem;"
        }, c.label || c.id);

        const list = el("div", { style: "display:flex;flex-direction:column;gap:.35rem;" });
        const placed = Array.from(grid.querySelectorAll('[data-col="'+c.id+'"] [data-item-id]'));
        placed.forEach(ch => {
          const id = ch.dataset.itemId;
          const it = ex.items.find(i => i.id === id) || {text: id};
          const ok = it && it.correct_column === c.id;
          const row = el("div", { style: "display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start;" });
          const txt = el("div", {}, (ok ? "✅ " : "❌ ") + (it.text || id));
          const fb  = el("div", { class: "tiny muted", style: "text-align:right;max-width:60%;" },
                         ok ? (it.feedback_correct || "") : (it.feedback_incorrect || ""));
          row.appendChild(txt);
          row.appendChild(fb);
          list.appendChild(row);
        });

        cardEl.appendChild(h);
        cardEl.appendChild(list);
        colsWrap.appendChild(cardEl);
      });

      const t1 = Date.now();
      const result = {
        exercise_id: ex.id || "dnd_text",
        type: "dnd_text",
        total: ex.items.length,
        correct,
        score_pct: Math.round((correct / ex.items.length) * 100),
        placements,
        time_ms: (t1 - t0)
      };

      // Replace or append summary
      const old = rootEl.querySelector(".pp-dnd-summary");
      if (old) old.replaceWith(summary); else wrap.appendChild(summary);
      summary.appendChild(colsWrap);

      return result;
    }

    // ---------- Helpers ----------
    function normalizeExercise(raw){
      const ex = Object.assign({
        id: raw && raw.id || "dnd_preview",
        title: raw && raw.title || "",
        version: raw && raw.version || null,
        instructions: raw && raw.instructions || "",
        columns: Array.isArray(raw && raw.columns) ? raw.columns : [],
        items: Array.isArray(raw && raw.items) ? raw.items : [],
        settings: Object.assign({ shuffle_items: true, allow_partial_submit: false, show_hints: true, max_columns: 6 }, (raw && raw.settings) || {})
      }, raw || {});
      // Coerce shapes
      ex.columns = ex.columns.map(c => ({ id: (c.id || (c.label||"").toLowerCase() || "col"), label: c.label || c.id || "Columna" }));
      ex.items = ex.items.map((it, i) => ({
        id: it.id || ("i"+(i+1)),
        text: it.text || "",
        correct_column: it.correct_column || "",
        hint: it.hint || "",
        feedback_correct: it.feedback_correct || "",
        feedback_incorrect: it.feedback_incorrect || "",
        media: it.media || {}
      }));
      return ex;
    }

    function el(tag, attrs, textOrNode) {
      const n = document.createElement(tag);
      if (attrs) {
        for (const k in attrs) {
          if (k === "class") n.className = attrs[k];
          else if (k === "style") n.style.cssText = attrs[k];
          else n.setAttribute(k, attrs[k]);
        }
      }
      if (textOrNode != null) {
        if (typeof textOrNode === "string") n.textContent = textOrNode;
        else n.appendChild(textOrNode);
      }
      return n;
    }
    function card(css){
      const d = document.createElement("div");
      d.style.cssText = css || "border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;";
      return d;
    }
    function chipBtn(label){
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = `
        border:1px solid #94a3b8;
        border-radius:10px;
        padding:.5rem .9rem;
        background:#e2e8f0;
        color:#0f172a;
        font-weight:600;
        cursor:grab;
        transition:background .2s, transform .1s;
      `;
      b.addEventListener("mouseenter", () => b.style.background = "#cbd5e1");
      b.addEventListener("mouseleave", () => b.style.background = "#e2e8f0");
      b.addEventListener("mousedown", () => b.style.transform = "scale(0.96)");
      b.addEventListener("mouseup", () => b.style.transform = "scale(1)");
      return b;
    }
    function shuffle(arr){
      const a = arr.slice();
      for (let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        const t = a[i]; a[i]=a[j]; a[j]=t;
      }
      return a;
    }
  };
})();