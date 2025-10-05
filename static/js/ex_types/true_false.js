/* static/js/ex_types/true_false.js
   Exposes: window.PPTypes.renderTF(rootEl, exercise, options?)

   - rootEl: HTMLElement where the exercise UI will render
   - exercise: {
       id, title, version, items: [
         { prompt: string, answer: true|false,
           feedback_correct?: string|null, feedback_incorrect?: string|null,
           // optional media, either flat or under item.media (as saved by backend):
           // media: { image, image_alt, audio, video, youtube_url }
           hint?: string|null
         }
       ]
     }
   - options: { onFinish?: (result)=>void, theme?: { ok?: string, bad?: string } }
*/

(function () {
  const NS = (window.PPTypes = window.PPTypes || {});
  const defaultTheme = { ok: "#16a34a", bad: "#dc2626" };

  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") el.className = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    }
    return el;
  }

  // Helpers to resolve media URLs
  const isAbs = (s) => typeof s === "string" && (s.startsWith("/") || s.startsWith("http"));
  const orNull = (s) => (s && String(s).trim()) || null;
  const asImageSrc = (s) => (isAbs(s) ? s : s ? "/static/exercises/images/" + s : null);
  const asAudioSrc = (s) => (isAbs(s) ? s : s ? "/static/exercises/audio/" + s : null);
  const asVideoSrc = (s) => (isAbs(s) ? s : s ? "/static/exercises/video/" + s : null);
  const toYTEmbed = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url, window.location.origin);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = u.pathname.slice(1);
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      if (host.endsWith("youtube.com")) {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
    } catch (_) {}
    return url;
  };

  function sanitizeItems(items) {
    return (Array.isArray(items) ? items : []).map((it) => {
      const m = (it && it.media && typeof it.media === "object") ? it.media : {};
      const image = orNull(m.image || it.image);
      const image_alt = orNull(m.image_alt || it.image_alt || it.image_caption);
      const audio = orNull(m.audio || it.audio);
      const video_mp4 = orNull(m.video || it.video_mp4);
      const video_iframe = orNull(m.youtube_url || it.video_iframe);

      return {
        prompt: (it && it.prompt) || "",
        answer: typeof it?.answer === "boolean" ? it.answer : null,

        // feedback (global + per-choice overrides)
        feedback_correct: it?.feedback_correct || null,
        feedback_incorrect: it?.feedback_incorrect || null,
        feedback_true_correct: it?.feedback_true_correct || null,
        feedback_false_correct: it?.feedback_false_correct || null,
        feedback_true_incorrect: it?.feedback_true_incorrect || null,
        feedback_false_incorrect: it?.feedback_false_incorrect || null,

        hint: it?.hint || null,

        // normalized media
        image, image_alt, audio, video_mp4, video_iframe
      };
    });
  }

  NS.renderTF = function renderTF(root, exercise, options = {}) {
    if (!root) return;
    root.innerHTML = "";

    const theme = { ...defaultTheme, ...(options.theme || {}) };
    const items = sanitizeItems(exercise?.items);
    let i = 0;
    let score = 0;
    const results = []; // {correct:boolean, choice:boolean, item, index}

    // --- Header
    const head = h(
      "div",
      { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem" },
      h("div", { style: "font-weight:700;color:#0f172a" }, exercise?.title || "True/False"),
      h("div", { style: "font-size:.9rem;color:#64748b" }, `v${exercise?.version || 1}`)
    );

    // --- Slide container
    const slide = h("div");

    // --- Footer controls
    const btnPrev  = h("button", { class: "pp-btn", style: btnStyle() }, "⟵ Anterior");
    const btnCheck = h("button", { class: "pp-btn", style: btnPrimaryStyle() }, "Comprobar");
    const btnNext  = h("button", { class: "pp-btn", style: btnStyle() }, "Siguiente ⟶");
    const btnRetry = h("button", { class: "pp-btn", style: btnStyle("border-color:#475569;color:#475569") }, "Intentar de nuevo");
    const btnHint  = h("button", { class: "pp-btn", style: btnStyle(), disabled: true, title: "Ver pista" }, "💡");

    const footer = h(
      "div",
      { style: "display:flex;gap:.5rem;align-items:center;margin-top:.75rem;flex-wrap:wrap" },
      btnPrev, btnCheck, btnHint, btnNext, btnRetry
    );
    const status = h("div", { style: "font-size:.9rem;color:#64748b;margin-left:auto;" });
    footer.appendChild(status);

    // --- Styles
    const css = h("style", {}, `
      .pp-card{border:1px solid #e5e7eb;border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.06);overflow:hidden}
      .pp-card .pp-head{padding:.75rem 1rem;border-bottom:1px solid #e5e7eb;background:#f8fafc;font-weight:600;color:#0f172a}
      .pp-card .pp-body{padding:1rem}
      .pp-row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
      .pp-tf-choices{display:flex;gap:.5rem;margin-top:.5rem}
      .pp-choice{padding:.6rem .9rem;border:1px solid #cbd5e1;border-radius:10px;background:#fff;cursor:pointer;font-size:1rem;line-height:1.2;color:#0f172a;min-width:120px;text-align:center}
      .pp-choice[aria-pressed="true"]{outline:2px solid #0ea5e9;border-color:#0ea5e9}
      .pp-feedback{margin-top:.6rem;border-radius:10px;padding:.6rem .75rem;border:1px solid #e5e7eb;background:#f8fafc;color:#0f172a;display:none}
      .pp-feedback.ok{border-color:${theme.ok}33;background:${theme.ok}10}
      .pp-feedback.bad{border-color:${theme.bad}33;background:${theme.bad}10}
      .pp-hint{margin-top:.5rem;font-size:.95rem;color:#334155;display:none}
      .pp-summary-list{margin:.75rem 0;display:flex;flex-direction:column;gap:.5rem}
      .pp-summary-item{border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem}
      .pp-summary-item.ok{border-color:${theme.ok}66}
      .pp-summary-item.bad{border-color:${theme.bad}66}
      .pp-muted{color:#64748b}
      .pp-media figure{margin:0 0 .9rem 0}
      .pp-media img{display:block;width:100%;max-height:360px;object-fit:contain;border-radius:10px;background:#f8fafc}
      .pp-media figcaption{margin-top:.4rem;color:#6b7280;font-size:.85rem;text-align:center;line-height:1.3}
      .pp-media audio, .pp-media video{display:block;width:100%;max-width:100%}
      .pp-media .video-embed{position:relative;padding-bottom:56.25%;height:0;border-radius:10px;overflow:hidden;background:#000;margin:0 0 .9rem 0}
      .pp-media .video-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
    `);

    // --- Renderers
    function renderSlide(idx) {
      const item = items[idx];
      slide.innerHTML = "";

      const card = h("div", { class: "pp-card" },
        h("div", { class: "pp-head" }, `Pregunta ${idx + 1} de ${items.length}`),
        h("div", { class: "pp-body" },
          renderMedia(item),
          h("div", { style: "font-size:1.05rem;color:#0f172a" }, item.prompt || "(Sin enunciado)"),
          h("div", { class: "pp-tf-choices" }, choiceBtn("Verdadero", true), choiceBtn("Falso", false)),
          h("div", { class: "pp-feedback", id: "ppFeedback" }),
          h("div", { class: "pp-hint", id: "ppHint" })
        )
      );

      slide.appendChild(card);

      // Reset controls
      btnPrev.disabled = idx === 0;
      btnNext.disabled = true;
      btnCheck.disabled = false;
      btnRetry.disabled = false;
      btnHint.disabled = !item.hint;

      updateStatus();

      // local selection state
      let selection = null;

      function choiceBtn(label, val) {
        const b = h("button", { class: "pp-choice", "aria-pressed": "false", type: "button" }, label);
        b.addEventListener("click", () => {
          selection = val;
          card.querySelectorAll(".pp-choice").forEach((p) => p.setAttribute("aria-pressed", p === b ? "true" : "false"));
        });
        return b;
      }

      btnCheck.onclick = () => {
        if (selection === null) {
          alert("Seleccioná Verdadero o Falso.");
          return;
        }
        const correct = selection === item.answer;
        const fb = card.querySelector("#ppFeedback");
        fb.classList.remove("ok", "bad");
        fb.classList.add("pp-feedback", correct ? "ok" : "bad");
        fb.style.display = "block";
        const choiceKey = selection ? "true" : "false";
        const msg = correct
          ? (choiceKey === "true"  && item.feedback_true_correct)  ||
            (choiceKey === "false" && item.feedback_false_correct) ||
            item.feedback_correct || "¡Correcto!"
          : (choiceKey === "true"  && item.feedback_true_incorrect)  ||
            (choiceKey === "false" && item.feedback_false_incorrect) ||
            item.feedback_incorrect || "Incorrecto. Probá de nuevo.";
        fb.textContent = msg;

        if (!results[idx]) {
          results[idx] = { correct, choice: selection, index: idx, item };
          if (correct) score += 1;
        } else {
          if (results[idx].correct !== correct) {
            if (correct) score += 1; else score -= 1;
            results[idx] = { correct, choice: selection, index: idx, item };
          } else {
            results[idx].choice = selection;
          }
        }

        btnNext.disabled = false;
      };

      btnHint.onclick = () => {
        if (!item.hint) return;
        const hdiv = card.querySelector("#ppHint");
        hdiv.style.display = "block";
        hdiv.textContent = "💡 " + item.hint;
      };
    }

    function renderMedia(item) {
      const parts = [];
      // image
      const img = asImageSrc(item.image);
      if (img) {
        const alt = (item.image_alt || "").replace(/"/g, "&quot;");
        parts.push(
          h("figure", {},
            h("img", { src: img, alt, loading: "lazy",
              onerror: "this.style.border='2px solid #f59e0b';this.alt='Imagen no encontrada';" }),
            item.image_alt ? h("figcaption", {}, item.image_alt) : null
          )
        );
      }
      // audio
      const aud = asAudioSrc(item.audio);
      if (aud) {
        parts.push(
          h("div", {}, h("audio", { controls: true, src: aud }))
        );
      }
      // YouTube iframe
      const yt = toYTEmbed(item.video_iframe);
      if (yt) {
        parts.push(
          h("div", { class: "video-embed" },
            h("iframe", {
              src: yt,
              allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
              allowfullscreen: "true"
            })
          )
        );
      }
      // mp4
      const mp4 = asVideoSrc(item.video_mp4);
      if (mp4) {
        parts.push(
          h("div", {},
            h("video", { controls: true, preload: "metadata", style: "border-radius:10px;background:#000;object-fit:contain;max-height:420px" },
              h("source", { src: mp4, type: "video/mp4" })
            )
          )
        );
      }

      return parts.length ? h("div", { class: "pp-media" }, parts) : h("div");
    }

    function renderSummary() {
      root.innerHTML = "";
      const pct = Math.round((score / items.length) * 100);
      const passed = score === items.length;

      const wrap = h("div", { class: "pp-card" },
        h("div", { class: "pp-head" }, "Resumen"),
        h("div", { class: "pp-body" },
          h("div", { style: `font-weight:700;color:${passed ? theme.ok : theme.bad};margin-bottom:.5rem` },
            `Puntaje: ${score} / ${items.length} (${pct}%)`
          ),
          h("div", { class: "pp-muted", style: "margin-bottom:.5rem" }, "Revisión rápida:"),
          h("div", { class: "pp-summary-list" },
            results.map((r, idx) =>
              h("div", { class: "pp-summary-item " + (r?.correct ? "ok" : "bad") },
                h("span", { style: "font-weight:600" }, String(idx + 1)),
                h("span", {}, ": " + (r?.correct ? "✅" : "❌")),
                h("details", { style: "margin-top:.35rem" },
                  h("summary", { style: "cursor:pointer;user-select:none" }, "Repasar"),
                  h("div", { style: "margin-top:.4rem" },
                    h("div", { class: "pp-muted", style: "margin-bottom:.25rem" }, r?.item?.prompt || ""),
                    h("div", {}, h("strong", {}, "Tu respuesta:"), " ",
                      h("span", { style: `color:${r?.correct ? theme.ok : theme.bad}` },
                        (r?.choice ? "Verdadero" : "Falso")
                      )
                    ),
                    h("div", {}, h("strong", {}, "Correcta:"), " ",
                      h("span", { style: `color:${theme.ok}` }, (r?.item?.answer ? "Verdadero" : "Falso"))
                    ),
                    (function () {
                      const choiceKey = r?.choice ? "true" : "false";
                      const correctMsg =
                        (choiceKey === "true"  && r?.item?.feedback_true_correct)  ||
                        (choiceKey === "false" && r?.item?.feedback_false_correct) ||
                        r?.item?.feedback_correct || "¡Correcto!";
                      const incorrectMsg =
                        (choiceKey === "true"  && r?.item?.feedback_true_incorrect)  ||
                        (choiceKey === "false" && r?.item?.feedback_false_incorrect) ||
                        r?.item?.feedback_incorrect || "Repasá la explicación y volvé a intentar.";
                      const rationale = r?.correct ? correctMsg : incorrectMsg;
                      return h("div", { style: "margin-top:.25rem;color:#334155;" }, "💡 " + rationale);
                    })()
                  )
                )
              )
            )
          )
        )
      );
      root.appendChild(css);
      root.appendChild(wrap);

      if (typeof options.onFinish === "function") {
        options.onFinish({ score, total: items.length, percent: pct, results: results.slice() });
      }
    }

    function startOver() {
      i = 0;
      score = 0;
      results.length = 0;
      mount();
    }

    function mount() {
      root.innerHTML = "";
      root.appendChild(css);
      root.appendChild(head);
      root.appendChild(slide);
      root.appendChild(footer);
      renderSlide(i);
    }

    function updateStatus() {
      status.textContent = `Pregunta ${i + 1}/${items.length} • Aciertos: ${score}`;
    }

    // nav wiring
    btnPrev.onclick = () => { if (i > 0) { i -= 1; renderSlide(i); } };
    btnNext.onclick = () => { if (i < items.length - 1) { i += 1; renderSlide(i); } else { renderSummary(); } };
    btnRetry.onclick = () => startOver();

    function btnStyle(extra = "") {
      return `appearance:none;border:1px solid #cbd5e1;background:#fff;padding:.55rem .8rem;border-radius:10px;cursor:pointer;${extra}`;
    }
    function btnPrimaryStyle() {
      return `appearance:none;border:1px solid #0284c7;background:#0284c7;color:#fff;padding:.55rem .8rem;border-radius:10px;cursor:pointer;`;
    }

    // Kickoff
    if (!items.length) {
      root.appendChild(h("div", { class: "pp-muted" }, "No hay items en este ejercicio."));
      return;
    }
    mount();
  };
})();