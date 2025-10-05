// static/js/ex_types/cloze.js
// Exposes: window.PPTypes.renderCloze(q, state, i, refs, exercise)
// Works like renderSingleChoice (MCQ) but for fill-in-the-blank.

(function(){
  if (!window.PPTypes) window.PPTypes = {};

  window.PPTypes.renderCloze = function renderCloze(q, state, i, refs, exercise){
    const { content, slide, step, btnNext, btnPrev, saveState } = refs;
    const total = exercise.items.length;

    step.textContent = String(i + 1);
    btnNext.textContent = (i === total - 1) ? "Finalizar" : "Siguiente →";
    btnPrev.disabled = i === 0;

    const barEl = content.querySelector(".pp-ex-progressbar");
    if (barEl) {
      const pct = Math.round(((i + 1) / total) * 100);
      barEl.style.width = `${pct}%`;
    }

    const existing = state.responses[q.id];
    const prevVal = existing ? existing.value || "" : "";

    slide.innerHTML = `
      <div class="pp-ex-q">
        <div class="pp-ex-prompt" style="font-weight:600;margin-bottom:.6rem;">
          ${q.prompt_html || ""}
        </div>
        <input type="text" class="pp-ex-input"
          value="${prevVal.replace(/"/g,'&quot;')}"
          style="width:100%;padding:.45rem .6rem;border:1px solid #d1d5db;border-radius:8px;font-size:1rem;">
        <button class="pp-ex-check" type="button"
          ${prevVal ? "" : "disabled"}
          style="margin-top:.6rem;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:.45rem .95rem;font-size:.9rem;${prevVal ? "" : "cursor:not-allowed;opacity:0.6;"}">
          Comprobar
        </button>
        <div class="pp-ex-feedback" style="margin-top:.6rem;min-height:1.25rem;color:#6b7280;"></div>
      </div>
    `;

    const input = slide.querySelector(".pp-ex-input");
    const btnCheck = slide.querySelector(".pp-ex-check");
    const fbEl = slide.querySelector(".pp-ex-feedback");

    // Initial gating (handles autofill/whitespace cases)
    (function initGate(){
      const has = !!input.value.trim();
      btnCheck.disabled = !has;
      if (!has) {
        btnCheck.style.cursor = "not-allowed";
        btnCheck.style.opacity = "0.6";
      }
    })();

    // Restore answered state
    if (existing && existing.checked) {
      input.disabled = true;
      fbEl.style.color = existing.isCorrect ? "#0a7f2e" : "#b91c1c";
      fbEl.textContent = existing.feedback || (existing.isCorrect ? "¡Correcto!" : "Incorrecto.");
      btnCheck.style.display = "none";
      btnNext.disabled = false;
      return;
    } else {
      btnNext.disabled = true;
    }

    // Enable check when text entered
    input.addEventListener("input", () => {
      const val = input.value.trim();
      if (val) {
        btnCheck.disabled = false;
        btnCheck.style.cursor = "pointer";
        btnCheck.style.opacity = "1";
      } else {
        btnCheck.disabled = true;
        btnCheck.style.cursor = "not-allowed";
        btnCheck.style.opacity = "0.6";
      }
    });

    // Check logic
    btnCheck.addEventListener("click", () => {
      const val = input.value.trim();
      if (!val) {
        fbEl.style.color = "#b91c1c";
        fbEl.textContent = "Completá el espacio antes de continuar.";
        return;
      }

      const answers = Array.isArray(q.answers) ? q.answers.map(a=>a.trim().toLowerCase()) : [];
      const ok = answers.includes(val.toLowerCase());
      const correctMsg = q.feedback_correct ?? "¡Correcto!";
      const incorrectMsg = q.feedback_incorrect ?? "No es correcto.";

      fbEl.style.color = ok ? "#0a7f2e" : "#b91c1c";
      fbEl.textContent = ok ? correctMsg : incorrectMsg;

      state.responses[q.id] = {
        value: val,
        isCorrect: ok,
        feedback: ok ? correctMsg : incorrectMsg,
        checked: true
      };
      if (ok) state.correct += 1;

      input.disabled = true;
      btnCheck.style.display = "none";
      btnNext.disabled = false;

      if (typeof saveState === "function") {
        try { saveState(); } catch(_) {}
      }

      if (i === total - 1) btnNext.textContent = "Finalizar";
    });
  };
})();