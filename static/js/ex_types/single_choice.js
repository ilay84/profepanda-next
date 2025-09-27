// static/js/ex_types/single_choice.js
// Exposes: window.PPTypes.renderSingleChoice(q, state, i, refs, exercise)
// - q: current item
// - state: { index, correct, responses, ... }
// - i: current index
// - refs: { content, slide, step, btnNext, btnPrev, saveState }
// - exercise: whole exercise object (for settings like shuffle)

(function () {
  if (!window.PPTypes) window.PPTypes = {};

  window.PPTypes.renderSingleChoice = function renderSingleChoice(q, state, i, refs, exercise) {
    const { content, slide, step, btnNext, btnPrev, saveState } = refs;

    const total = exercise.items.length;

    // Label + next/prev state (caller may also set these)
    step.textContent = String(i + 1);
    btnNext.textContent = (i === total - 1) ? "Finalizar" : "Siguiente →";
    btnPrev.disabled = i === 0;

    // Progress bar update (optional; safe if missing)
    const barEl = content.querySelector(".pp-ex-progressbar");
    if (barEl) {
      const pct = Math.round(((i + 1) / total) * 100);
      barEl.style.width = `${pct}%`;
    }

    // Prepare choices with optional shuffle
    const name = `q_${q.id}`;
    let choices = Array.isArray(q.choices) ? [...q.choices] : [];
    if (exercise.settings && exercise.settings.shuffle) {
      for (let j = choices.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [choices[j], choices[k]] = [choices[k], choices[j]];
      }
    }
    const choicesHtml = choices.map((c, idx) => {
      const id = `${name}_${idx}`;
      const checked = (state.responses[q.id] && state.responses[q.id].selected === c.key) ? "checked" : "";
      return `
        <div class="pp-ex-choice" style="margin:.25rem 0;">
          <input type="radio" id="${id}" name="${name}" value="${c.key}" ${checked}>
          <label for="${id}">${c.label}</label>
        </div>
      `;
    }).join("");

    // Existing result (back/forward)
    const existing = state.responses[q.id];
    const fbText = existing
      ? (existing.isCorrect ? (q.feedback && q.feedback.correct || "¡Correcto!") : (q.feedback && q.feedback.incorrect || "No es correcto."))
      : "";
    const fbColor = existing ? (existing.isCorrect ? "#0a7f2e" : "#b91c1c") : "#6b7280";

    // Render block
    slide.innerHTML = `
      <div class="pp-ex-q">
        ${q.image ? `<div class="pp-ex-image" style="margin-bottom:.75rem;">
          <img
            src="/static/exercises/images/${q.image}"
            alt="${(q.image_alt || "").replace(/"/g, "&quot;")}"
            loading="lazy"
            onerror="this.closest('.pp-ex-image').style.display='none';"
            style="max-width:100%;height:auto;border-radius:8px;display:block;"
          >
          ${q.image_caption ? `<div class="pp-ex-image-cap" style="margin-top:.35rem;color:#6b7280;font-size:.85rem;text-align:center;">
            ${(q.image_caption || "").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
          </div>` : ""}
        </div>` : ""}
        <div class="pp-ex-prompt" style="font-weight:600;margin-bottom:.5rem;">${q.prompt_html || ""}</div>
        <div class="pp-ex-choices">${choicesHtml || "<em>(sin opciones)</em>"}</div>
        <button class="pp-ex-check" type="button"
          style="margin-top:.5rem;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:.4rem .9rem;font-size:.85rem;${existing ? "display:none;cursor:default;opacity:0;" : "cursor:not-allowed;opacity:0.6;"}">
          Comprobar
        </button>
        <div class="pp-ex-feedback" style="margin-top:.5rem;min-height:1.25rem;color:${fbColor};">
          ${fbText}
        </div>
      </div>
    `;

    const radios = slide.querySelectorAll(`input[name="${name}"]`);
    const btnCheck = slide.querySelector(".pp-ex-check");
    const fbEl = slide.querySelector(".pp-ex-feedback");

    // If already answered → lock + hide check button and allow next
    if (existing) {
      radios.forEach(r => {
        r.disabled = true;
        if (r.value === existing.selected) {
          const label = r.nextElementSibling;
          label.style.fontWeight = "600";
          label.style.color = existing.isCorrect ? "#0a7f2e" : "#b91c1c";
        }
      });
      btnNext.disabled = false;
    } else {
      btnNext.disabled = true; // gate until "Comprobar"
    }

    // Enable Comprobar after selection
    radios.forEach(r => {
      r.addEventListener("change", () => {
        if (!btnCheck) return;
        btnCheck.style.cursor = "pointer";
        btnCheck.style.opacity = "1";
        btnCheck.disabled = false;
      });
    });

    // Keyboard support (Enter/Arrows) before check
    if (!existing) {
      slide.tabIndex = 0;

      function setCheckedAndEnable(idx) {
        if (!radios.length) return;
        const r = radios[idx];
        if (!r) return;
        r.checked = true;
        r.dispatchEvent(new Event("change", { bubbles: true }));
        r.focus();
      }
      function currentIndex() {
        const arr = Array.from(radios);
        const ix = arr.findIndex(r => r.checked);
        return ix >= 0 ? ix : -1;
      }

      slide.addEventListener("keydown", (e) => {
        if (btnCheck.style.display === "none") return;

        if (e.key === "Enter") {
          if (!btnCheck.disabled) {
            e.preventDefault();
            btnCheck.click();
          }
          return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          const arr = Array.from(radios);
          if (!arr.length) return;
          const ix = currentIndex();
          const next = (ix >= 0 ? (ix + 1) : 0) % arr.length;
          setCheckedAndEnable(next);
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          const arr = Array.from(radios);
          if (!arr.length) return;
          const ix = currentIndex();
          const prev = ix > 0 ? ix - 1 : arr.length - 1;
          setCheckedAndEnable(prev);
          return;
        }
      });
    }

    // Comprobar logic
    if (btnCheck) {
      btnCheck.addEventListener("click", () => {
        const selectedRadio = Array.from(radios).find(r => r.checked);
        if (!selectedRadio) {
          fbEl.style.color = "#b91c1c";
          fbEl.innerHTML = "Por favor seleccioná una opción.";
          return;
        }

        const selected = selectedRadio.value;
        const isCorrect = selected === q.answer;

        state.responses[q.id] = { selected, isCorrect, hintIdx: -1 };
        if (isCorrect) state.correct += 1;

        // Lock inputs
        radios.forEach(r => r.disabled = true);
        const label = selectedRadio.nextElementSibling;
        label.style.fontWeight = "600";
        label.style.color = isCorrect ? "#0a7f2e" : "#b91c1c";

        // Feedback
        fbEl.style.color = isCorrect ? "#0a7f2e" : "#b91c1c";
        fbEl.innerHTML = isCorrect
          ? ((q.feedback && q.feedback.correct) || "¡Correcto!")
          : ((q.feedback && q.feedback.incorrect) || "No es correcto.");

        // Persist if helper present
        if (typeof saveState === "function") {
          try { saveState(); } catch (_) {}
        }

        // Hide check and allow next
        btnCheck.style.display = "none";
        btnNext.disabled = false;

        if (i === total - 1) {
          btnNext.textContent = "Finalizar";
        }
      });
    }
  };
})();