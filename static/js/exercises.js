// static/js/exercises.js
(function(){
  function init(){
    // Support both old and new modal markups
    const modal =
      document.getElementById("pp-ex-modal") ||
      document.querySelector(".pp-ex-modal") ||
      document.getElementById("pp-exercise-modal");

    // Do NOT early-return here: in admin preview the modal may be injected later.
    const openButtons = document.querySelectorAll(".pp-ex-card, .pp-ex-card__open");
    const closeButtons = modal ? modal.querySelectorAll("[data-close]") : [];

    // ---------- Helpers ----------
    // NEW: loader that supports either:
    //  - legacy IDs: "a1b2c3..."  -> /static/exercises/<id>.json
    //  - new paths:  "tf/mi-ejercicio" -> /data/exercises/<type>/<slug>/current.json (preferred),
    //                                          then /static/exercises/<type>/<slug>/current.json (fallback)
    //  - direct JSON paths: "/data/exercises/tf/mi-ejercicio/001.json"
    async function loadExerciseData(exerciseRef) {
      const ref = String(exerciseRef || "").trim().replace(/^\/+|\/+$/g, "");
      const isJsonPath = /\.json(\?|$)/i.test(ref);
      const looksPath  = ref.includes("/");

      // Build candidate URLs in order of preference
      const candidates = [];

      if (isJsonPath) {
        // Caller already passed a .json; respect it as-is.
        candidates.push(ref.startsWith("/") ? ref : `/${ref}`);
      } else if (looksPath) {
        // New scheme: type/slug
        candidates.push(`/data/exercises/${ref}/current.json`);     // primary (served by app route)
        candidates.push(`/static/exercises/${ref}/current.json`);   // fallback if mirrored under /static
        // last fallback: treat the whole thing as an ID like before (unlikely, but harmless)
        candidates.push(`/static/exercises/${ref}.json`);
      } else {
        // Legacy flat file by id
        candidates.push(`/static/exercises/${ref}.json`);
      }

      // Try in sequence until one responds OK
      for (const url of candidates) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          return Array.isArray(data) ? data[0] : data;
        } catch (_) {
          // try next
        }
      }
      return { error: `No se pudo cargar el ejercicio (“${ref}”).` };
    }

    function renderCarousel(modalEl, exercise) {
      const titleEl = modalEl.querySelector("#pp-ex-modal-title");
      if (titleEl) titleEl.textContent = `Abrir ejercicio: ${exercise.title || "Ejercicio"}`;

      const content = modalEl.querySelector(".pp-ex-modal__content");
      if (!content) return;

      if (exercise.error) {
        content.innerHTML = `<p style="color:#b91c1c;"><strong>Error:</strong> ${exercise.error}</p>`;
        return;
      }
      if (!exercise.items || !exercise.items.length) {
        content.innerHTML = `<p style="color:#6b7280;">Este ejercicio no tiene ítems aún.</p>`;
        return;
      }

      // ── State ─────────────────────────────────────────────
      const state = { index: 0, correct: 0, responses: {} };

      // Restore if saved state exists
      if (exercise._savedState) {
        state.index = exercise._savedState.index || 0;
        state.correct = exercise._savedState.correct || 0;
        state.responses = exercise._savedState.responses || {};
      }

      function saveState() {
        try {
          const key =
            exercise._persistKey ||
            `pp-ex-${exercise.exercise_id || exercise.exerciseId || "unknown"}`;
          sessionStorage.setItem(key, JSON.stringify({
            index: state.index, correct: state.correct, responses: state.responses
          }));
        } catch (_) {}
      }

      content.innerHTML = `
        <div class="pp-ex-carousel" data-index="0">
          <div class="pp-ex-progress" style="margin-bottom:.5rem;">
            <div class="pp-ex-progressbar-wrap" style="height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-bottom:.4rem;">
              <div class="pp-ex-progressbar" style="height:100%;width:0%;background:#2563eb;transition:width .25s ease;"></div>
            </div>
            <div class="pp-ex-progresslabel" style="color:#6b7280;">
              <span class="pp-ex-step">1</span> / ${exercise.items.length}
            </div>
          </div>
          <div class="pp-ex-slide" id="pp-ex-slide"></div>
          <div class="pp-ex-nav" style="margin-top:1rem;display:flex;gap:.5rem;justify-content:flex-end;">
            <button class="pp-ex-prev" type="button" disabled>← Anterior</button>
            <button class="pp-ex-next" type="button">Siguiente →</button>
          </div>
        </div>
      `;

      const wrap = content.querySelector(".pp-ex-carousel");
      const slide = content.querySelector("#pp-ex-slide");
      const step  = content.querySelector(".pp-ex-step");
      const btnPrev = content.querySelector(".pp-ex-prev");
      const btnNext = content.querySelector(".pp-ex-next");

      // --- Disabled styling + sync for nav buttons (Prev/Next) ---
      function ppSyncBtnDisabledStyle(el){
        if (!el) return;
        el.style.opacity = el.disabled ? "0.5" : "1";
        el.style.cursor  = el.disabled ? "not-allowed" : "pointer";
        el.setAttribute("aria-disabled", el.disabled ? "true" : "false");
      }
      ppSyncBtnDisabledStyle(btnPrev);
      ppSyncBtnDisabledStyle(btnNext);

      // Watch the 'disabled' attribute and auto-update styles when any renderer toggles it
      new MutationObserver(() => ppSyncBtnDisabledStyle(btnPrev))
        .observe(btnPrev, { attributes: true, attributeFilter: ["disabled"] });
      new MutationObserver(() => ppSyncBtnDisabledStyle(btnNext))
        .observe(btnNext, { attributes: true, attributeFilter: ["disabled"] });

      function toEmbedYouTube(u) {
        if (!u) return null;
        try {
          const url = new URL(u, window.location.origin);
          const host = url.hostname.replace(/^www\./, "");
          if (host === "youtu.be") {
            const id = url.pathname.slice(1);
            return id ? `https://www.youtube.com/embed/${id}` : u;
          }
          if (host.endsWith("youtube.com")) {
            const id = url.searchParams.get("v");
            return id ? `https://www.youtube.com/embed/${id}` : u;
          }
        } catch (_) {}
        return u;
      }

      function resolveSrc(s, kind) {
        if (!s || typeof s !== "string") return null;
        if (s.startsWith("http") || s.startsWith("/") || s.startsWith("blob:") || s.startsWith("data:")) return s;
        if (s.startsWith("exercises/media/") || s.startsWith("media/"))  return "/static/" + s.replace(/^\/?/,"");
        if (s.startsWith("exercises/images/") || s.startsWith("images/"))return "/static/" + s.replace(/^\/?/,"");
        if (s.startsWith("exercises/audio/") || s.startsWith("audio/"))  return "/static/" + s.replace(/^\/?/,"");
        if (s.startsWith("exercises/video/") || s.startsWith("video/"))  return "/static/" + s.replace(/^\/?/,"");
        if (kind === "image") return "/static/exercises/images/" + s;
        if (kind === "audio") return "/static/exercises/audio/" + s;
        if (kind === "video") return "/static/exercises/video/" + s;
        return s;
      }

      function renderSummary() {
        const total = exercise.items.length;
        const pct = Math.round((state.correct / Math.max(1, total)) * 100);

        const reviewHTML = (exercise.items || []).map((q, idx) => {
          const r = state.responses[q.id] || {};
          const tag = r.isCorrect ? "✅" : "❌";

          // ---- TF / MCQ (single_choice) ----
          if (q.type === "true_false" || q.type === "mcq" || q.type === "single_choice") {
            const selectedKey   = r.selected;
            const choices       = Array.isArray(q.choices) ? q.choices : [];
            const selectedChoice = choices.find(c => c && c.key === selectedKey) || null;
            const correctChoice  = choices.find(c => c && c.key === q.answer) || null;

            const correctMsg = q.feedback_correct ?? (q.feedback && q.feedback.correct) ?? "¡Correcto!";
            const incorrectMsg = (selectedChoice && (selectedChoice.feedback_incorrect || selectedChoice.feedback))
                              ?? (q.feedback_incorrect ?? (q.feedback && q.feedback.incorrect) ?? "Repasá la explicación y volvé a intentar.");
            const rationale = r.isCorrect ? correctMsg : incorrectMsg;

            const yourAns  = selectedChoice ? (selectedChoice.label || selectedChoice.html || selectedKey || "-") : (selectedKey || "-");
            const rightAns = correctChoice  ? (correctChoice.label  || correctChoice.html  || q.answer      || "-") : (q.answer || "-");

            return `
              <div class="pp-summary-item" style="border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;">
                <div style="font-weight:600;display:inline-flex;align-items:center;gap:.25rem;">${idx + 1}<span>: ${tag}</span></div>
                <details style="margin-top:.35rem;">
                  <summary style="cursor:pointer;user-select:none">Repasar</summary>
                  <div style="margin-top:.4rem">
                    <div style="color:#64748b;margin-bottom:.25rem;">${q.prompt_html || ""}</div>
                    <div><strong>Tu respuesta:</strong> <span style="color:${r.isCorrect ? "#0a7f2e" : "#b91c1c"}">${yourAns}</span></div>
                    <div><strong>Correcta:</strong> <span style="color:#0a7f2e">${rightAns}</span></div>
                    <div style="margin-top:.25rem;color:#334155;">💡 ${rationale}</div>
                  </div>
                </details>
              </div>
            `;
          }

          // ---- CLOZE (per-blank rows) ----
          const per = Array.isArray(r.perBlank) ? r.perBlank : [];
          const rows = per.map(pb => {
            const your  = (pb.your ?? pb.value ?? "").toString() || "—";
            const right = Array.isArray(pb.answers) ? pb.answers.join(", ") : (pb.answers || "—");
            const color = pb.ok ? "#0a7f2e" : "#b91c1c";
            const fb    = pb.feedback ? `<div style="margin-top:.15rem;color:${color};">${pb.feedback}</div>` : "";
            return `
              <div style="display:grid;grid-template-columns:70px 1fr;gap:.5rem;align-items:start;">
                <div class="tiny muted" style="font-weight:700;text-align:right;">${pb.key || ""}</div>
                <div class="tiny" style="display:flex;flex-direction:column;gap:.2rem;">
                  <div><span class="muted">Tu respuesta:</span> <code style="padding:.1rem .3rem;border:1px solid ${pb.ok ? "#86efac" : "#fecaca"};border-radius:6px;background:${pb.ok ? "#f0fdf4" : "#fef2f2"};">${your}</code></div>
                  <div><span class="muted">Correctas:</span> <code style="padding:.1rem .3rem;border:1px solid #e5e7eb;border-radius:6px;background:#f8fafc;">${right}</code></div>
                  ${fb}
                </div>
              </div>
            `;
          }).join("");

          return `
            <div class="pp-summary-item" style="border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;">
              <div style="font-weight:600;display:inline-flex;align-items:center;gap:.25rem;">${idx + 1}<span>: ${tag}</span></div>
              <details style="margin-top:.35rem;">
                <summary style="cursor:pointer;user-select:none">Repasar</summary>
                <div style="margin-top:.4rem">
                  <div style="color:#64748b;margin-bottom:.25rem;">${q.prompt_html || ""}</div>
                  ${rows || "<div class='tiny muted'>Sin respuestas registradas.</div>"}
                </div>
              </details>
            </div>
          `;
        }).join("");

        slide.innerHTML = `
          <div>
            <h4 style="margin:.25rem 0 0.5rem;">Resumen</h4>
            <p style="margin:0 0 .5rem;color:${pct >= (exercise.settings?.pass_threshold || 0) ? "#0a7f2e" : "#b91c1c"};">
              Puntaje: <strong>${state.correct} / ${total}</strong> (${pct}%)
            </p>
            <div class="pp-ex-review-list" style="margin:.5rem 0;display:flex;flex-direction:column;gap:.5rem;">
              ${reviewHTML}
            </div>
            <button class="pp-ex-retry" type="button"
              style="margin-top:1rem;background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:.5rem 1rem;font-size:.9rem;cursor:pointer;">
              ↻ Intentar de nuevo
            </button>
          </div>
        `;

        step.textContent = String(total);
        btnNext.textContent = "Cerrar";
        btnPrev.disabled = total === 0;

        const barEl = content.querySelector(".pp-ex-progressbar");
        if (barEl) barEl.style.width = "100%";

        const btnRetry = slide.querySelector(".pp-ex-retry");
        if (btnRetry) {
          btnRetry.addEventListener("click", () => {
            state.index = 0;
            state.correct = 0;
            state.responses = {};
            wrap.dataset.index = "0";
            renderSlide(0);
            // persist reset
            try {
              const key = exercise._persistKey || `pp-ex-${exercise.exercise_id || exercise.exerciseId || "unknown"}`;
              sessionStorage.setItem(key, JSON.stringify({ index: 0, correct: 0, responses: {} }));
            } catch(_) {}
          });
        }
      }

      function renderSlide(i) {
        const total = exercise.items.length;
        if (i >= total) { renderSummary(); return; }

        const raw = exercise.items[i] || {};
        const m   = raw.media || {};
        const q   = { ...raw };

        // --- media normalization into flat fields the renderers already use ---
        q.image         = resolveSrc(q.image || m.image || null, "image");
        q.image_alt     = q.image_alt || m.image_alt || null;
        q.image_caption = q.image_caption || m.image_alt || null;
        q.audio         = resolveSrc(q.audio || m.audio || null, "audio");
        q.video_mp4     = resolveSrc(q.video_mp4 || m.video || null, "video");
        q.video_iframe  = toEmbedYouTube(q.video_iframe || m.youtube_url || null);

        // --- robust type detection: prefer explicit, else infer from data ---
        const rawType = (q.type || "").toString().toLowerCase();
        const inferredType =
          rawType ||
          (Array.isArray(q.answers) && q.answers.length ? "cloze" :
           (Array.isArray(q.choices) && q.choices.length ? "single_choice" : "single_choice"));
        const type = inferredType;

        // --- route to renderer ---
        if (type === "true_false" || type === "mcq" || type === "single_choice") {
          if (window.PPTypes && typeof window.PPTypes.renderSingleChoice === "function") {
            window.PPTypes.renderSingleChoice(
              q, state, i,
              { content, slide, step, btnNext, btnPrev, saveState },
              exercise
            );
          } else {
            slide.innerHTML = `<div style="color:#b91c1c;">Error: renderSingleChoice no está cargado</div>`;
          }
          return;
        }

        if (
          type === "cloze" ||
          type === "fitb" ||
          type === "fill_blank" ||
          type === "fill_in_blank" ||
          type === "cloze_one_blank" ||
          type === "cloze_fill"
        ) {
          const callCloze = () => {
            if (window.PPTypes && typeof window.PPTypes.renderCloze === "function") {
              window.PPTypes.renderCloze(
                q, state, i,
                { content, slide, step, btnNext, btnPrev, saveState },
                exercise
              );
            } else {
              slide.innerHTML = `<div style="color:#b91c1c;">Error: renderCloze no está cargado</div>`;
            }
          };

          if (window.PPTypes && typeof window.PPTypes.renderCloze === "function") {
            callCloze();
          } else {
            // Lazy-load cloze.js once if the template didn’t include it
            const already = document.querySelector('script[data-pp-load="cloze-js"]');
            if (!already) {
              const s = document.createElement('script');
              s.src = '/static/js/ex_types/cloze.js';
              s.defer = true;
              s.setAttribute('data-pp-load', 'cloze-js');
              s.onload = callCloze;
              s.onerror = () => {
                slide.innerHTML = `<div style="color:#b91c1c;">Error: no se pudo cargar cloze.js</div>`;
              };
              document.head.appendChild(s);
            } else {
              setTimeout(callCloze, 50);
            }
          }
          return;
        }

        slide.innerHTML = `<div style="color:#b91c1c;">Tipo de ejercicio no soportado: ${type}</div>`;
      }

      // Initial render (use restored index if present)
      wrap.dataset.index = String(state.index);
      renderSlide(state.index);

      // Wire buttons
      btnPrev.addEventListener("click", () => {
        if (btnPrev.disabled) return; // hard block if disabled
        if (state.index > 0) {
          state.index -= 1;
          wrap.dataset.index = String(state.index);
          renderSlide(state.index);
          saveState();
        }
      });

      btnNext.addEventListener("click", () => {
        if (btnNext.disabled) return; // hard block if disabled
        const last = exercise.items.length;
        if (state.index < last) {
          state.index += 1;
          wrap.dataset.index = String(state.index);
          renderSlide(state.index);
          saveState();
        } else {
          modalEl.setAttribute("aria-hidden", "true");
          document.body.style.overflow = "";
        }
      });
    }

    // Expose for external callers
    window.PPRenderCarousel = renderCarousel;
    window.renderCarousel = renderCarousel;

    // ---------- Open modal ----------
    openButtons.forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const card = e.currentTarget.closest(".pp-ex-card");
        if (!card) return;

        const id = card.dataset.exerciseId;
        const version = card.dataset.exerciseVersion;
        const type = card.dataset.exerciseType;
        const title = card.getAttribute("aria-label") || "Ejercicio";

        if (modal) {
          const t = modal.querySelector("#pp-ex-modal-title");
          const c = modal.querySelector(".pp-ex-modal__content");
          if (t) t.textContent = title;
          if (c) c.innerHTML = `<p style="margin:0;color:#6b7280;">Cargando ejercicio…</p>`;
          modal.setAttribute("aria-hidden", "false");
          document.body.style.overflow = "hidden";
        }

        const ex = await loadExerciseData(id);
        if (ex.error && modal) {
          modal.querySelector(".pp-ex-modal__content").innerHTML =
            `<p><strong>ID:</strong> ${id} (v${version})</p>
             <p><strong>Tipo:</strong> ${type}</p>
             <p style="color:#b91c1c;"><strong>Error:</strong> ${ex.error}</p>`;
          return;
        }

        ex.title = ex.title || title;
        try {
          const key = `pp-ex-${id}`;
          const saved = sessionStorage.getItem(key);
          if (saved) ex._savedState = JSON.parse(saved);
          ex._persistKey = key; // ensure saveState() uses the same key
        } catch (_) {}

        renderCarousel(modal, ex);
      });
    });

    // ---------- Close modal ----------
    closeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (!modal) return;
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      });
    });
  } // end init

  // Run now if DOM is ready; otherwise wait for DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// === BEGIN: Exercise Modal Loader ===
window.PPExercises = (function(NS){

  function getEls(){
    const modal = document.getElementById("exerciseModal");
    const root  = document.getElementById("exerciseRoot");
    return { modal, root };
  }

  // No region needed anymore
  function openExercise(id, version){
    const { modal, root } = getEls();
    if(!modal || !root){
      alert("No se encontró el modal de ejercicios en la página.");
      return;
    }

    fetch(`/data/exercises/${id}_v${version}.json`)
      .then(r => r.json())
      .then(ex => {
        modal.style.display = "block";
        root.innerHTML = "";
        if (ex.type === "tf" && window.PPTypes && typeof window.PPTypes.renderTF === "function"){
          window.PPTypes.renderTF(root, ex);
        } else {
          root.innerHTML = `<p>Tipo no soportado aún: ${ex.type || "(desconocido)"}.</p>`;
        }
      })
      .catch(err => {
        console.error("Error loading exercise:", err);
        root.innerHTML = "<p style='color:red'>No se pudo cargar el ejercicio.</p>";
        const { modal } = getEls();
        if(modal) modal.style.display = "block";
      });
  }

  NS.openExercise = openExercise;
  return NS;
})(window.PPExercises || {});
// === END: Exercise Modal Loader ===

// === BEGIN: Adapter to old modal & carousel ===
(function(NS){
  // Convert simple TF exercise -> structure expected by your old renderCarousel()
  function adaptTFToOld(ex) {
    const out = {
      exercise_id: ex.id || "tf_demo",
      title: ex.title || "Ejercicio T/F",
      items: [],
      settings: { pass_threshold: 0 } // keep same behavior as before unless changed in file
    };

    const items = Array.isArray(ex.items) ? ex.items : [];
    out.items = items.map((it, idx) => {
      const id = it.id || `q${idx + 1}`;
      const isTrue = !!it.answer; // boolean
      const prompt = it.prompt || "";

      return {
        id,
        type: "true_false", // your old code routes this to renderSingleChoice()
        prompt_html: `<p>${prompt}</p>`,
        choices: [
          { key: "T", label: "Verdadero", html: "Verdadero" },
          { key: "F", label: "Falso",     html: "Falso" }
        ],
        answer: isTrue ? "T" : "F",
        feedback_correct: it.feedback_correct || null,
        feedback_incorrect: it.feedback_incorrect || null,
        hint: it.hint || null,

        // ── media passthrough (optional) ─────────────────────────────
        // Use relative paths like: "tf/tf_demo_1/q1.mp3" for audio,
        //                          "tf/tf_demo_1/clip1.mp4" for mp4,
        //                          "tf/tf_demo_1/img1.png" for image.
        audio: it.audio || null,             // served from /static/exercises/audio/<path>
        video_iframe: it.video_iframe || null, // full iframe src (YouTube/Vimeo, etc.)
        video_mp4: it.video_mp4 || null,     // served from /static/exercises/video/<path>
        image: it.image || null,             // served from /static/exercises/images/<path>
        image_caption: it.image_caption || null
      };
    });

    return out;
  }

  // Convert simple MCQ exercise -> structure expected by your old renderCarousel()
  function adaptMCQToOld(ex) {
    const out = {
      exercise_id: ex.id || "mcq_demo",
      title: ex.title || "Ejercicio MCQ",
      items: [],
      settings: {
        pass_threshold: (ex.settings && typeof ex.settings.pass_threshold === "number") ? ex.settings.pass_threshold : 0,
        shuffle: !!(ex.settings && ex.settings.shuffle)
      }
    };

    const items = Array.isArray(ex.items) ? ex.items : [];
    out.items = items.map((it, idx) => {
      const id = it.id || `q${idx + 1}`;
      const prompt = it.prompt || "";

      // Normalize choices (A, B, C…) if key missing; prefer provided html/label
      const choices = (it.choices || []).map((c, j) => {
        const key = (c && c.key) ? c.key : String.fromCharCode(65 + j); // A, B, C…
        const label = (c && (c.label ?? c.text)) || (typeof c === "string" ? c : `Opción ${key}`);
        const html = (c && (c.html ?? c.label ?? c.text)) || label;
        return { key, label, html };
      });

      return {
        id,
        type: "mcq",
        prompt_html: `<p>${prompt}</p>`,
        choices,
        answer: it.answer, // must match one of choices.key
        feedback_correct: it.feedback_correct || null,
        feedback_incorrect: it.feedback_incorrect || null,
        hint: it.hint || null,

        // ── media passthrough (optional) ─────────────────────────────
        // Use relative paths like: "mcq/mcq_demo_1/q1.mp3" for audio,
        //                          "mcq/mcq_demo_1/clip1.mp4" for mp4,
        //                          "mcq/mcq_demo_1/img1.png" for image.
        audio: it.audio || null,             // served from /static/exercises/audio/<path>
        video_iframe: it.video_iframe || null, // full iframe src (YouTube/Vimeo)
        video_mp4: it.video_mp4 || null,     // served from /static/exercises/video/<path>
        image: it.image || null,             // served from /static/exercises/images/<path>
        image_caption: it.image_caption || null
      };
    });

    return out;
  }

  // Open using the OLD modal (#pp-ex-modal) and OLD look (renderCarousel)
  function openExerciseOld(id, version){
    fetch(`/data/exercises/${id}_v${version}.json`)
      .then(r => r.json())
      .then(ex => {
        // 1) Adapt TF to old structure
        let adapted = ex;
        if (ex && ex.type === "tf") {
          adapted = adaptTFToOld(ex);
        } else if (ex && ex.type === "mcq") {
          adapted = adaptMCQToOld(ex);
        }

        // Restore saved progress (same behavior as the old click-flow)
        try {
          const key = `pp-ex-${adapted.exercise_id || adapted.exerciseId || "unknown"}`;
          const saved = sessionStorage.getItem(key);
          if (saved) {
            adapted._savedState = JSON.parse(saved);
          }
        } catch (_) { /* ignore */ }

        // 2) Find old modal elements
        const modal = document.getElementById("pp-ex-modal");
        if(!modal){
          alert("No se encontró #pp-ex-modal en esta página.");
          return;
        }
        const titleEl = modal.querySelector("#pp-ex-modal-title");
        const content = modal.querySelector(".pp-ex-modal__content");

        // 3) Open old modal and render with old renderer
        if(titleEl) titleEl.textContent = adapted.title || ex.title || "Ejercicio";
        if(content) content.innerHTML = `<p style="margin:0;color:#6b7280;">Cargando…</p>`;
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        if(typeof window.PPRenderCarousel === "function"){
          // renderCarousel(modalEl, exerciseObj)
          window.PPRenderCarousel(modal, adapted);
        } else {
          if(content) content.innerHTML = `<p style="color:#b91c1c;">No se encontró PPRenderCarousel.</p>`;
        }
      })
      .catch(err => {
        console.error("Error loading exercise:", err);
        const modal = document.getElementById("pp-ex-modal");
        const content = modal && modal.querySelector(".pp-ex-modal__content");
        if(modal){
          modal.setAttribute("aria-hidden", "false");
          document.body.style.overflow = "hidden";
        }
        if(content) content.innerHTML = "<p style='color:#b91c1c;'>No se pudo cargar el ejercicio.</p>";
      });
  }

  // expose
  NS.openExerciseOld = openExerciseOld;
})(window.PPExercises = window.PPExercises || {});
// === END: Adapter to old modal & carousel ===

// --- Expose carousel renderer for admin preview (TF/MCQ) with a shim ---
(function(){
  try {
    if (typeof window !== 'undefined' && typeof renderCarousel === 'function') {
      const _real = renderCarousel;

      // Accept either (modalEl, exercise) or (bodyEl, exercise).
      function shimmedRenderCarousel(el, exercise){
        // If we were given the modal, great — call directly.
        const looksLikeModal =
          !!(el && el.querySelector && el.querySelector('#pp-ex-modal-title') && el.querySelector('.pp-ex-modal__content'));

        if (looksLikeModal) {
          return _real(el, exercise);
        }

        // If we were given the body element, find the modal and forward.
        let modalEl = null;
        try {
          if (window.PPAdminModal && typeof window.PPAdminModal.getPPModalEls === 'function') {
            const els = window.PPAdminModal.getPPModalEls();
            modalEl = els && els.modal ? els.modal : null;
          }
        } catch(_) {}

        // Fallback discovery if helper isn’t present for any reason
        if (!modalEl) {
          modalEl =
            document.getElementById('pp-ex-modal') ||
            document.querySelector('.pp-ex-modal') ||
            document.getElementById('pp-exercise-modal') ||
            document.body; // absolute last resort
        }

        return _real(modalEl, exercise);
      }

      // Primary name preview.js looks for
      window.renderCarousel = shimmedRenderCarousel;
      // Alternate name preview.js also checks
      window.PPRenderCarousel = shimmedRenderCarousel;
    }
  } catch (_) { /* noop */ }
})();