// static/js/exercises.js
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("pp-ex-modal");
  if (!modal) return;

  const openButtons = document.querySelectorAll(".pp-ex-card, .pp-ex-card__open");
  const closeButtons = modal.querySelectorAll("[data-close]");

  // ---------- Helpers ----------
  async function loadExerciseData(exerciseId) {
    const url = `/static/exercises/${exerciseId}.json`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Accept either an array ([{...}]) or a single object ({...})
      return Array.isArray(data) ? data[0] : data;
    } catch (err) {
      return { error: `No se pudo cargar ${url} — ${err.message}` };
    }
  }

  function renderCarousel(modalEl, exercise) {
    const titleEl = modalEl.querySelector("#pp-ex-modal-title");
    titleEl.textContent = `Abrir ejercicio: ${exercise.title || "Ejercicio"}`;

    const content = modalEl.querySelector(".pp-ex-modal__content");
    if (exercise.error) {
        content.innerHTML = `<p style="color:#b91c1c;"><strong>Error:</strong> ${exercise.error}</p>`;
        return;
    }
    if (!exercise.items || !exercise.items.length) {
        content.innerHTML = `<p style="color:#6b7280;">Este ejercicio no tiene ítems aún.</p>`;
        return;
    }

    // ── State for scoring ─────────────────────────────────────────────
    const state = {
        index: 0,
        correct: 0,
        responses: {} // { [q.id]: { selected: "T", isCorrect: true } }
    };

    // Restore if saved state exists
    if (exercise._savedState) {
      state.index = exercise._savedState.index || 0;
      state.correct = exercise._savedState.correct || 0;
      state.responses = exercise._savedState.responses || {};
    }

    // Persist to sessionStorage
    function saveState() {
      try {
        const key = `pp-ex-${exercise.exercise_id || exercise.exerciseId || "unknown"}`;
        const payload = {
          index: state.index,
          correct: state.correct,
          responses: state.responses
        };
        sessionStorage.setItem(key, JSON.stringify(payload));
      } catch (_) { /* ignore */ }
    }

    content.innerHTML = `
      <div class="pp-ex-carousel" data-index="0">
        <div class="pp-ex-progress" style="margin-bottom:.5rem;">
          <div class="pp-ex-progressbar-wrap" style="height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-bottom:.4rem;">
            <div class="pp-ex-progressbar" style="height:100%;width:0%;background:#2563eb;"></div>
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
    const step = content.querySelector(".pp-ex-step");
    const btnPrev = content.querySelector(".pp-ex-prev");
    const btnNext = content.querySelector(".pp-ex-next");
    const barElInit = content.querySelector(".pp-ex-progressbar");
    if (barElInit) barElInit.style.transition = "width .25s ease";


    function renderSummary() {
        const total = exercise.items.length;
        const pct = Math.round((state.correct / total) * 100);

        slide.innerHTML = `
          <div>
            <h4 style="margin:.25rem 0 0.5rem;">Resumen</h4>
            <p style="margin:0 0 .5rem;color:${pct >= (exercise.settings?.pass_threshold || 0) ? "#0a7f2e" : "#b91c1c"};">
              Puntaje: <strong>${state.correct} / ${total}</strong> (${pct}%)
            </p>
            <div class="pp-ex-review-list" style="margin:.5rem 0;display:flex;flex-direction:column;gap:.5rem;">
              ${exercise.items.map((q, idx) => {
                const r = state.responses[q.id] || {};
                const tag = r.isCorrect ? "✅" : "❌";
                const selectedKey = r.selected;

                const choices = Array.isArray(q.choices) ? q.choices : [];
                const selectedChoice = choices.find(c => c && c.key === selectedKey) || null;
                const correctChoice  = choices.find(c => c && c.key === q.answer) || null;

                const correctMsg = q.feedback_correct ?? (q.feedback && q.feedback.correct) ?? "¡Correcto!";
                const incorrectMsg = (selectedChoice && (selectedChoice.feedback_incorrect || selectedChoice.feedback))
                                   ?? (q.feedback_incorrect ?? (q.feedback && q.feedback.incorrect) ?? "Repasá la explicación y volvé a intentar.");
                const rationale = r.isCorrect ? correctMsg : incorrectMsg;

                const yourAns  = selectedChoice ? (selectedChoice.label || selectedChoice.html || selectedKey) : (selectedKey || "-");
                const rightAns = correctChoice  ? (correctChoice.label  || correctChoice.html  || q.answer)    : (q.answer || "-");

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
              }).join("")}
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

        // Wire jump-to-question buttons
        slide.querySelectorAll(".pp-ex-jump").forEach(btn => {
          btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.idx);
            state.index = idx;
            wrap.dataset.index = String(idx);
            renderSlide(idx);
          });
        });

        const barEl = content.querySelector(".pp-ex-progressbar");
        if (barEl) barEl.style.width = "100%";

        const btnRetry = slide.querySelector(".pp-ex-retry");
          btnRetry.addEventListener("click", () => {
          state.index = 0;
          state.correct = 0;
          state.responses = {};
          wrap.dataset.index = "0";
          renderSlide(0);
          saveState();
        });
    }

    function renderSlide(i) {
      const total = exercise.items.length;

      // Summary when i === total
      if (i >= total) {
        renderSummary();
        return;
      }

      const q = exercise.items[i];

      // If type is not specified, default to single choice
      const type = q.type || "single_choice";

      if (type === "true_false" || type === "mcq" || type === "single_choice") {
        if (window.PPTypes && typeof window.PPTypes.renderSingleChoice === "function") {
          window.PPTypes.renderSingleChoice(q, state, i, {
            content,
            slide,
            step,
            btnNext,
            btnPrev,
            saveState
          }, exercise);
        } else {
          slide.innerHTML = `<div style="color:#b91c1c;">Error: renderSingleChoice no está cargado</div>`;
        }
      } else {
        slide.innerHTML = `<div style="color:#b91c1c;">Tipo de ejercicio no soportado: ${type}</div>`;
      }
    }



    // Initial render (use restored index if present)
    wrap.dataset.index = String(state.index);
    renderSlide(state.index);

    // Wire buttons
    btnPrev.addEventListener("click", () => {
        if (state.index > 0) {
        state.index -= 1;
        wrap.dataset.index = String(state.index);
        renderSlide(state.index);
        saveState();
        }
    });

    btnNext.addEventListener("click", () => {
        const last = exercise.items.length;
        if (state.index < last) {
        state.index += 1;
        wrap.dataset.index = String(state.index);
        renderSlide(state.index);
        saveState();
        } else {
        // On summary "Cerrar"
        modalEl.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        }
    });
    }

    // Expose for external callers (old modal styling)
    window.PPRenderCarousel = renderCarousel;

  // ---------- Open modal ----------
  openButtons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const card = e.currentTarget.closest(".pp-ex-card");
      if (!card) return;

      const id = card.dataset.exerciseId;
      const version = card.dataset.exerciseVersion;
      const type = card.dataset.exerciseType;
      const title = card.getAttribute("aria-label") || "Ejercicio";

      // Basic title while loading
      modal.querySelector("#pp-ex-modal-title").textContent = title;
      modal.querySelector(".pp-ex-modal__content").innerHTML = `<p style="margin:0;color:#6b7280;">Cargando ejercicio…</p>`;
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      const ex = await loadExerciseData(id);
      // Fallback: if file missing, at least show the metadata
      if (ex.error) {
        modal.querySelector(".pp-ex-modal__content").innerHTML =
          `<p><strong>ID:</strong> ${id} (v${version})</p>
           <p><strong>Tipo:</strong> ${type}</p>
           <p style="color:#b91c1c;"><strong>Error:</strong> ${ex.error}</p>`;
        return;
      }

      // Validate schema (lightweight)
      {
        const problems = [];
        if (!ex || typeof ex !== "object") {
          problems.push("el archivo no es un objeto JSON válido");
        } else {
          if (!Array.isArray(ex.items) || ex.items.length === 0) {
            problems.push("items[] falta o está vacío");
          } else {
            ex.items.forEach((q, idx) => {
              if (!q || typeof q !== "object") problems.push(`ítem ${idx + 1}: no es un objeto`);
              if (!q.id) problems.push(`ítem ${idx + 1}: falta "id"`);
              if (!q.prompt_html) problems.push(`ítem ${idx + 1}: falta "prompt_html"`);
              if (!Array.isArray(q.choices) || q.choices.length < 2) problems.push(`ítem ${idx + 1}: "choices" inválidas o < 2`);
              if (typeof q.answer === "undefined") {
                problems.push(`ítem ${idx + 1}: falta "answer"`);
              } else if (!Array.isArray(q.choices) || !q.choices.some(c => c && c.key === q.answer)) {
                problems.push(`ítem ${idx + 1}: "answer" no coincide con ningún choices.key`);
              }
            });
          }
        }
        if (problems.length) {
          modal.querySelector(".pp-ex-modal__content").innerHTML =
            `<div style="color:#b91c1c;">
               <strong>Archivo de ejercicio inválido:</strong>
               <ul style="margin:.25rem 0 0;padding-left:1.25rem;">
                 ${problems.slice(0, 6).map(p => `<li>${p}</li>`).join("")}
                 ${problems.length > 6 ? `<li>…y ${problems.length - 6} más</li>` : ""}
               </ul>
             </div>`;
          return;
        }
      }

      // Ensure minimal fields
      ex.title = ex.title || title;

      // Restore state from sessionStorage (if available)
      try {
        const key = `pp-ex-${id}`;
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          ex._savedState = parsed; // attach for renderCarousel
        }
      } catch (_) { /* ignore */ }

      renderCarousel(modal, ex);
    });
  });

  // ---------- Close modal ----------
  closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    });
  });
});

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
