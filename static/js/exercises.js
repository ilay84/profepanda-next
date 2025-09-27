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
            <ul style="margin:0;padding-left:1.2rem;">
              ${exercise.items.map((q, idx) => {
                const r = state.responses[q.id];
                const tag = r?.isCorrect ? "✅" : "❌";
                return `<li><button class="pp-ex-jump" data-idx="${idx}" style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;">Pregunta ${idx + 1}</button> — ${q.id} ${tag}</li>`;
              }).join("")}
            </ul>

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