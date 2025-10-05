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
      ? (existing.isCorrect
        ? (q.feedback_correct ?? (q.feedback && q.feedback.correct) ?? "¡Correcto!")
        : (q.feedback_incorrect ?? (q.feedback && q.feedback.incorrect) ?? "No es correcto."))
      : "";
    const fbColor = existing ? (existing.isCorrect ? "#0a7f2e" : "#b91c1c") : "#6b7280";

    // Normalize admin-saved media into the flat fields this template already uses
    (function normalizeMedia(){
      const m = (q && q.media) ? q.media : null;
      if (!m) return;

      if (!q.image && m.image) q.image = m.image;
      if (!q.image_alt && m.image_alt) q.image_alt = m.image_alt;
      if (!q.image_caption && m.image_alt) q.image_caption = m.image_alt;

      if (!q.audio && m.audio) q.audio = m.audio;

      if (!q.video_mp4 && m.video) q.video_mp4 = m.video;             // local MP4 from /static/exercises/media/<id>/qX_video.mp4
      if (!q.video_iframe && m.youtube_url) q.video_iframe = m.youtube_url; // raw YT URL

      // If video_iframe is a normal YouTube URL, convert to embed URL
      if (q.video_iframe && typeof q.video_iframe === "string") {
        try {
          const u = new URL(q.video_iframe, window.location.origin);
          const host = u.hostname.replace(/^www\./, "");
          if (host === "youtu.be") {
            const id = u.pathname.slice(1);
            if (id) q.video_iframe = `https://www.youtube.com/embed/${id}`;
          } else if (host.endsWith("youtube.com")) {
            const id = u.searchParams.get("v");
            if (id) q.video_iframe = `https://www.youtube.com/embed/${id}`;
          }
        } catch (_) { /* ignore */ }
      }
    })();

    // Render block (polished media sizing)
    slide.innerHTML = `
      <div class="pp-ex-q">
        ${(() => {
          const imgRaw = q.image || (q.media && q.media.image) || null;
          if (!imgRaw) return "";

          // Consider http(s), absolute /, blob:, data: as absolute
          const isAbs = typeof imgRaw === "string" &&
                        (imgRaw.startsWith("http") ||
                         imgRaw.startsWith("/")   ||
                         imgRaw.startsWith("blob:") ||
                         imgRaw.startsWith("data:"));

          // Resolve legacy relative names to legacy folder (keeps existing behavior)
          const src = isAbs ? imgRaw : ("/static/exercises/images/" + imgRaw);

          const alt = ((q.image_alt || (q.media && q.media.image_alt) || "") + "").replace(/"/g, "&quot;");
          const caption = (q.image_caption || (q.media && q.media.image_alt) || "");

          // DEBUG toggle via ?debugMedia=1
          const showDebug = /\bdebugMedia=1\b/.test(window.location.search);
          const debugLine = showDebug
            ? `<div style="margin-top:.25rem;font-size:.75rem;color:#6b7280;word-break:break-all;">
                 src: <a href="${src}" target="_blank" rel="noopener">${src}</a>
               </div>`
            : "";

          return `<figure class="pp-ex-image" style="margin:0 0 .9rem 0;">
            <img
              src="${src}"
              alt="${alt}"
              loading="lazy"
              onerror="this.style.border='2px solid #f59e0b';this.alt='Imagen no encontrada';"
              style="display:block;width:100%;max-height:360px;object-fit:contain;border-radius:10px;background:#f8fafc;"
            >
            ${caption ? `<figcaption style="margin-top:.4rem;color:#6b7280;font-size:.85rem;text-align:center;line-height:1.3;">
              ${caption.replace(/</g,"&lt;").replace(/>/g,"&gt;")}
            </figcaption>` : ""}
            ${debugLine}
          </figure>`;
        })()}

        ${(() => {
          const audRaw = q.audio || (q.media && q.media.audio) || null;
          if (!audRaw) return "";
          const src = (audRaw.startsWith("http") || audRaw.startsWith("/")) ? audRaw : ("/static/exercises/audio/" + audRaw);
          return `<div class="pp-ex-audio" style="margin:0 0 .9rem 0;">
            <audio controls
                   src="${src}"
                   style="width:100%;max-width:100%;outline:none;display:block;"></audio>
          </div>`;
        })()}

        ${(() => {
          let yt = q.video_iframe || (q.media && q.media.youtube_url) || "";
          if (!yt) return "";
          try {
            const u = new URL(yt, window.location.origin);
            const host = u.hostname.replace(/^www\./, "");
            if (host === "youtu.be") {
              const id = u.pathname.slice(1);
              if (id) yt = `https://www.youtube.com/embed/${id}`;
            } else if (host.endsWith("youtube.com")) {
              const id = u.searchParams.get("v");
              if (id) yt = `https://www.youtube.com/embed/${id}`;
            }
          } catch (_) {}
          return `<div class="pp-ex-video" style="margin:0 0 .9rem 0;position:relative;width:100%;max-width:100%;border-radius:10px;overflow:hidden;background:#000;">
            <div style="position:relative;padding-bottom:56.25%;height:0;">
              <iframe
                src="${yt}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>
            </div>
          </div>`;
        })()}

        ${(() => {
          const vidRaw = q.video_mp4 || (q.media && q.media.video) || "";
          if (!vidRaw) return "";
          const src = (vidRaw.startsWith("http") || vidRaw.startsWith("/")) ? vidRaw : ("/static/exercises/video/" + vidRaw);
          return `<div class="pp-ex-video" style="margin:0 0 .9rem 0;">
            <video controls preload="metadata"
                   style="display:block;width:100%;max-height:420px;border-radius:10px;background:#000;object-fit:contain;">
              <source src="${src}" type="video/mp4">
            </video>
          </div>`;
        })()}

        <div class="pp-ex-prompt" style="font-weight:600;margin-bottom:.6rem;">${q.prompt_html || ""}</div>
        <div class="pp-ex-choices">${choicesHtml || "<em>(sin opciones)</em>"}</div>
        <button class="pp-ex-check" type="button"
          style="margin-top:.6rem;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:.45rem .95rem;font-size:.9rem;${existing ? "display:none;cursor:default;opacity:0;" : "cursor:not-allowed;opacity:0.6;"}">
          Comprobar
        </button>
        <div class="pp-ex-feedback" style="margin-top:.6rem;min-height:1.25rem;color:${fbColor};">
          ${fbText}
        </div>
      </div>
    `;

    const radios = slide.querySelectorAll(`input[name="${name}"]`);
    const btnCheck = slide.querySelector(".pp-ex-check");
    const fbEl = slide.querySelector(".pp-ex-feedback");

    // Add a11y focus ring for media (inject once)
    if (!document.getElementById('pp-ex-media-focus-style')) {
      const st = document.createElement('style');
      st.id = 'pp-ex-media-focus-style';
      st.textContent = `
        .pp-ex-audio:focus-within,
        .pp-ex-video:focus-within {
          outline: 3px solid #0ea5e9;
          outline-offset: 4px;
          border-radius: 12px;
        }
        .pp-ex-video video { border-radius: 10px; }
      `;
      document.head.appendChild(st);
    }

    // --- Hint UI (only if q.hint exists) ---
    let hintBtn = null;
    let hintDiv = null;
    if (q.hint) {
      hintBtn = document.createElement("button");
      hintBtn.type = "button";
      hintBtn.className = "pp-ex-hint-btn";
      hintBtn.textContent = "💡";
      hintBtn.title = "Ver pista";
      hintBtn.style.cssText = "margin-top:.5rem;background:#f3f4f6;color:#111827;border:1px solid #e5e7eb;border-radius:8px;padding:.35rem .7rem;font-size:.85rem;cursor:pointer;";

      hintDiv = document.createElement("div");
      hintDiv.className = "pp-ex-hint";
      hintDiv.style.cssText = "display:none;margin-top:.4rem;color:#334155;";

      const wrap = slide.querySelector(".pp-ex-q");
      if (wrap) {
        wrap.appendChild(hintBtn);
        wrap.appendChild(hintDiv);
      }

      hintBtn.addEventListener("click", () => {
        hintDiv.style.display = "block";
        hintDiv.textContent = "💡 " + q.hint;
      });
    }

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
        const selectedChoice = (Array.isArray(q.choices) ? q.choices : []).find(c => c && c.key === selected) || null;
        const correctMsg   = q.feedback_correct ?? (q.feedback && q.feedback.correct) ?? "¡Correcto!";
        const incorrectMsg = (selectedChoice && (selectedChoice.feedback_incorrect || selectedChoice.feedback))
                          ?? (q.feedback_incorrect ?? (q.feedback && q.feedback.incorrect) ?? "No es correcto.");
        fbEl.innerHTML = isCorrect ? correctMsg : incorrectMsg;

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