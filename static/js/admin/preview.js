// static/js/admin/preview.js
(function () {
  'use strict';

  // ---------------------------
  // Modal helper (self-sufficient)
  // ---------------------------
  if (!window.PPAdminModal) {
    window.PPAdminModal = (function () {
      function getPPModalEls() {
        // supports either the new include (admin/_preview_modal.html) or the older inline modal
        const modal   = document.getElementById('pp-ex-modal') || document.querySelector('.pp-ex-modal') || document.getElementById('pp-exercise-modal');
        const overlay = modal && (modal.querySelector('.pp-ex-modal__overlay') || modal.querySelector('.pp-ex-modal__backdrop') || modal.querySelector('[data-close]'));
        const closeB  = modal && (modal.querySelector('.pp-ex-modal__close') || modal.querySelector('[data-close]'));
        const titleEl = modal && modal.querySelector('#pp-ex-modal-title');
        const bodyEl  = modal && modal.querySelector('.pp-ex-modal__content');
        return { modal, overlay, closeB, titleEl, bodyEl };
      }

      function openPPModal() {
        const { modal, overlay, closeB } = getPPModalEls();
        if (!modal) return;

        if (!modal._wired) {
          if (overlay) overlay.addEventListener('click', closePPModal);
          if (closeB)  closeB.addEventListener('click', closePPModal);
          modal._wired = true;
        }

        modal.style.display = 'block';
        modal.removeAttribute('aria-hidden');
        document.body.style.overflow = 'hidden';
      }

      function closePPModal() {
        const { modal, bodyEl } = getPPModalEls();
        if (!modal) return;

        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        if (bodyEl) bodyEl.innerHTML = '';
        document.body.style.overflow = '';
      }

      return { getPPModalEls, openPPModal, closePPModal };
    })();
  }

  // ---------------------------------
  // Preview renderer (TF / MCQ / Cloze)
  // ---------------------------------
  if (!window.PPAdminPreview) {
    window.PPAdminPreview = (function () {

      // normalize TF
      function adaptTF(ex) {
        if (!ex || ex.type !== 'tf') return ex;
        const items = Array.isArray(ex.items) ? ex.items : [];

        const toYT = (u) => {
          if (!u) return null;
          try {
            const url = new URL(u, window.location.origin);
            const host = url.hostname.replace(/^www\./, '');
            if (host === 'youtu.be') {
              const id = url.pathname.slice(1);
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
            if (host.indexOf('youtube.com') >= 0) {
              const id = url.searchParams.get('v');
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
          } catch (_) {}
          return u;
        };

        return {
          exercise_id: ex.id || 'tf_preview',
          title: ex.title || 'Ejercicio T/F',
          items: items.map((it, idx) => {
            const m = it.media || {};
            return {
              id: it.id || ('q' + (idx+1)),
              type: 'true_false',
              prompt_html: '<p>' + (it.prompt || '') + '</p>',
              choices: [
                { key: 'T', label: 'Verdadero', html: 'Verdadero' },
                { key: 'F', label: 'Falso',     html: 'Falso' }
              ],
              answer: (it.answer ? 'T' : 'F'),
              hint: it.hint || null,
              feedback_correct: it.feedback_correct || null,
              feedback_incorrect: it.feedback_incorrect || null,
              // be generous with media shapes (string, {url|path|src}, or *_url variants)
              // helper to coerce any value to a usable src string
              image: (function () {
                const pick = (v) => (typeof v === 'string' && v) || (v && (v.url || v.path || v.src)) || null;
                return pick(m.image) || pick(it.image) || pick(m.image_url) || pick(it.image_url) || null;
              })(),
              image_caption: (m.image_alt || m.caption || it.image_caption || it.alt || null) || null,
              image_alt: (m.image_alt || it.image_alt || it.alt || null) || null,
              audio: (function () {
                const pick = (v) => (typeof v === 'string' && v) || (v && (v.url || v.path || v.src)) || null;
                return pick(m.audio) || pick(it.audio) || null;
              })(),
              video_mp4: (function () {
                const pick = (v) => (typeof v === 'string' && v) || (v && (v.url || v.path || v.src)) || null;
                return pick(m.video) || pick(it.video) || pick(m.video_mp4) || pick(it.video_mp4) || null;
              })(),
              video_iframe: toYT(
                m.youtube_url || m.youtube || it.youtube_url || it.youtube || it.video_iframe || null
              )
            };
          }),
          settings: ex.settings || {}
        };
      }

      // normalize MCQ -> single_choice
      function adaptMCQ(ex) {
        if (!ex || ex.type !== 'mcq') return ex;
        const items = Array.isArray(ex.items) ? ex.items : [];

        const toYT = (u) => {
          if (!u) return null;
          try {
            const url = new URL(u, window.location.origin);
            const host = url.hostname.replace(/^www\./, '');
            if (host === 'youtu.be') {
              const id = url.pathname.slice(1);
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
            if (host.indexOf('youtube.com') >= 0) {
              const id = url.searchParams.get('v');
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
          } catch (_) {}
          return u;
        };

        return {
          exercise_id: ex.id || 'mcq_preview',
          title: ex.title || 'Ejercicio Opción múltiple',
          items: items.map((it, idx) => {
            const m = it.media || {};
const choices = (Array.isArray(it.choices) ? it.choices : []).map((c, j) => {
              const key = (c && c.key) ? c.key : String.fromCharCode(65 + j); // A, B, C…
              const label = (c && (c.text != null ? c.text : c.label)) || ('Opción ' + key);
              const html  = (c && (c.html != null ? c.html : (c.text != null ? c.text : c.label))) || label;
              const feedback = (c && c.feedback != null) ? c.feedback : null; // carry per-choice feedback
              return { key, label, html, feedback };
            });
            return {
              id: it.id || ('q' + (idx+1)),
              type: 'single_choice',
              prompt_html: '<p>' + (it.prompt || '') + '</p>',
              choices: choices,
              answer: it.answer || null,
              hint: it.hint || null,
              feedback_correct: it.feedback_correct || null,
              feedback_incorrect: it.feedback_incorrect || null,
              image: (m.image || it.image || null),
              image_caption: (m.image_alt || it.image_caption || it.alt || null) || null,
              image_alt: (m.image_alt || it.image_alt || it.alt || null) || null,
              audio: (m.audio || it.audio || null),
              video_mp4: (m.video || it.video || null),
              video_iframe: toYT(m.youtube_url || it.youtube || it.video_iframe || null)
            };
          }),
          settings: ex.settings || {}
        };
      }

      // normalize Cloze
      function adaptCloze(ex) {
        if (!ex || ex.type !== 'cloze') return ex;
        const items = Array.isArray(ex.items) ? ex.items : [];

        const toYT = (u) => {
          if (!u) return null;
          try {
            const url = new URL(u, window.location.origin);
            const host = url.hostname.replace(/^www\./, '');
            if (host === 'youtu.be') {
              const id = url.pathname.slice(1);
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
            if (host.indexOf('youtube.com') >= 0) {
              const id = url.searchParams.get('v');
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
          } catch (_) {}
          return u;
        };

        // cache-bust static assets we overwrite (e.g., /static/.../q0_image.jpg)
        const cb = (u) => {
          if (!u || typeof u !== 'string') return u;
          if (u.indexOf('/static/') !== 0) return u;
          const v = (ex.saved_version || ex.version || Date.now());
          return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'v=' + v;
        };

        return {
          exercise_id: ex.id || 'cloze_preview',
          title: ex.title || 'Completar huecos',
          type: 'cloze',
          items: items.map((it, idx) => {
            const m = it.media || {};
            return {
              id: it.id || ('q' + (idx+1)),
              type: 'cloze',
              prompt_html: '<p>' + (it.prompt || '') + '</p>',  // contains [[B1]], [[B2]] tokens
              blanks: Array.isArray(it.blanks) ? it.blanks.map(function(b){
                return {
                  key: b.key,
                  answers: Array.isArray(b.answers) ? b.answers : [],
                  case_sensitive: !!b.case_sensitive,
                  normalize_accents: (b.normalize_accents !== false),
                  hint: (b.hint || null),
                  feedback_correct: (b.feedback_correct || null),
                  feedback_incorrect: (b.feedback_incorrect || null)
                };
              }) : [],
              hint: it.hint || null,
              feedback_correct: it.feedback_correct || null,
              feedback_incorrect: it.feedback_incorrect || null,

              // renderer expects media under it.media.*
              media: {
                image: cb(m.image || it.image || null),
                image_alt: (m.image_alt || it.image_alt || it.image_caption || it.alt || null) || null,
                audio: cb(m.audio || it.audio || null),
                video: cb(m.video || it.video || it.video_mp4 || null),
                youtube_url: toYT(m.youtube_url || it.youtube_url || it.youtube || it.video_iframe || null)
              },

              // optional: keep legacy top-level fields for backward compatibility
              image: cb(m.image || it.image || null),
              image_caption: (m.image_alt || it.image_caption || it.alt || null) || null,
              image_alt: (m.image_alt || it.image_alt || it.alt || null) || null,
              audio: cb(m.audio || it.audio || null),
              video_mp4: cb(m.video || it.video || it.video_mp4 || null),
              video_iframe: toYT(m.youtube_url || it.youtube || it.video_iframe || null)
            };
          }),
          settings: ex.settings || {}
        };
      }

      // normalize Dictation (rendered via the Cloze carousel with one blank)
      function adaptDictation(ex) {
        if (!ex || ex.type !== 'dictation') return ex;
        const items = Array.isArray(ex.items) ? ex.items : [];
        const S = ex.settings || {};

        const toYT = (u) => {
          if (!u) return null;
          try {
            const url = new URL(u, window.location.href);
            const host = url.hostname || '';
            if (host.indexOf('youtu.be') >= 0) {
              const id = url.pathname.slice(1);
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
            if (host.indexOf('youtube.com') >= 0) {
              const id = url.searchParams.get('v');
              return id ? ('https://www.youtube.com/embed/' + id) : u;
            }
          } catch (_) {}
          return u;
        };

        return {
          exercise_id: ex.id || 'dictation_preview',
          title: ex.title || 'Dictado',
          type: 'dictation',
          instructions: ex.instructions || '',
          items: items.map((it, idx) => {
            const m = it.media || {};
            // Answers support string or array (builder emits string OR string[])
            const ans = Array.isArray(it.answer) ? it.answer
                      : (typeof it.answer === 'string' && it.answer.trim() ? [it.answer] : []);
            return {
              id: it.id || ('i' + (idx + 1)),
              // Single input rendered by Cloze carousel
              prompt_html: '[[B1]]',
              blanks: [{
                key: 'B1',
                answers: ans,
                case_sensitive: !!S.case_sensitive,
                // In Cloze, normalize_accents=true means "ignore accents".
                // So if exercise is accent_sensitive, do NOT normalize.
                normalize_accents: !S.accent_sensitive,
                // New flag we’ll honor in the Cloze evaluator:
                punctuation_sensitive: !!S.punctuation_sensitive
              }],
              media: {
                image: null, // dictation doesn’t use images
                audio: (m.audio || null),
                video: (m.video || null),
                video_iframe: toYT(m.youtube_url || null)
              },
              hint: it.hint || null,
              feedback_correct: it.feedback_correct || null,
              feedback_incorrect: it.feedback_incorrect || null
            };
          }),
          settings: Object.assign({}, ex.settings || {})
        };
      }

      // ------- CLOZE carousel (gated buttons + save/restore + retry) -------
      function renderClozeCarousel(containerEl, playable) {
        if (!containerEl) return;

        // Helpers
        function stripAccents(s){ try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); } catch(_){ return s; } }
        var persistKey = 'pp-ex-' + (playable.exercise_id || playable.id || 'cloze_preview');

        // State (load if present)
        var state = { i: 0, correct: 0, results: {} }; // results[id] = { ok, checked, blanks:{ B1:{ok,value,answers}, ... } }
        try {
          var saved = sessionStorage.getItem(persistKey);
          if (saved) {
            var parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              state = Object.assign(state, parsed);
            }
          }
        } catch (_) {}

        var items = Array.isArray(playable.items) ? playable.items : [];
        containerEl.innerHTML = ''
          + '<div class="pp-ex-carousel" data-index="0">'
          + '  <div class="pp-ex-progress" style="margin-bottom:.5rem;">'
          + '    <div class="pp-ex-progressbar-wrap" style="height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-bottom:.4rem;">'
          + '      <div class="pp-ex-progressbar" style="height:100%;width:0%;background:#2563eb;transition:width .25s ease;"></div>'
          + '    </div>'
          + '    <div class="pp-ex-progresslabel" style="color:#6b7280;">'
          + '      <span class="pp-ex-step">1</span> / ' + (items.length || 1)
          + '    </div>'
          + '  </div>'
          + '  <div id="pp-ex-slide"></div>'
          + '  <div style="margin-top:1rem;display:flex;gap:.5rem;justify-content:flex-end;">'
          + '    <button class="pp-ex-prev" type="button">← Anterior</button>'
          + '    <button class="pp-ex-next" type="button">Siguiente →</button>'
          + '  </div>'
          + '</div>';

        var wrap    = containerEl.querySelector('.pp-ex-carousel');
        var slide   = containerEl.querySelector('#pp-ex-slide');
        var stepEl  = containerEl.querySelector('.pp-ex-step');
        var barEl   = containerEl.querySelector('.pp-ex-progressbar');
        var prevBtn = containerEl.querySelector('.pp-ex-prev');
        var nextBtn = containerEl.querySelector('.pp-ex-next');
        var isDictation = !!(playable && playable.type === 'dictation');

        // Ensure disabled styling feels consistent
        function syncBtn(el){
          if (!el) return;
          el.style.opacity = el.disabled ? '0.5' : '1';
          el.style.cursor  = el.disabled ? 'not-allowed' : 'pointer';
          el.setAttribute('aria-disabled', el.disabled ? 'true' : 'false');
        }
        function save() {
          try {
            sessionStorage.setItem(persistKey, JSON.stringify({
              i: state.i, correct: state.correct, results: state.results
            }));
          } catch(_) {}
        }
        function recalcCorrect() {
          var vals = Object.keys(state.results).map(function(k){ return state.results[k]; });
          state.correct = vals.filter(function(r){ return r && r.ok; }).length;
        }
        function evaluateItem(it, inputs) {
          var blanks = Array.isArray(it.blanks) ? it.blanks : [];
          var byKey  = {};
          blanks.forEach(function(b){ byKey[b.key] = b; });
          var allOk = true;
          var per = { ok:false, checked:true, blanks:{} };

          inputs.forEach(function(entry){
            var key = entry.key;
            var input = entry.input;
            var cfg = byKey[key];
            var raw = (input.value || '').trim();

            if (!cfg) {
              allOk = false;
              per.blanks[key] = { ok:false, value:raw, answers:[] };
              return;
            }

            var caseSensitive = !!cfg.case_sensitive;
            var normAccents   = (cfg.normalize_accents !== false);
            var punctSensitive = !!cfg.punctuation_sensitive;

            function stripPunct(s){
              // Remove common punctuation incl. ¡! ¿? quotes, dashes, ellipses, parens
              return s.replace(/[.,;:!¡?¿"“”'’()\-—…]/g, '');
            }

            var norm = function(s){
              var o = s;
              if (!caseSensitive) o = o.toLowerCase();
              if (!punctSensitive) o = stripPunct(o);
              if (normAccents) o = stripAccents(o);
              return o;
            };
            var answers = Array.isArray(cfg.answers) ? cfg.answers : [];
            var ok = answers.map(function(a){ return norm((a || '').trim()); }).indexOf(norm(raw)) >= 0;
            if (!ok) allOk = false;

            per.blanks[key] = { ok: ok, value: raw, answers: answers.slice() };
          });

          per.ok = allOk;
          return per;
        }

        var currentItem = null;
        var currentControls = []; // [{ key, input, hintBox, fbBox }]
        function allInputsFilled() {
          return currentControls.every(function(c){ return ((c.input.value || '').trim().length > 0); });
        }

        function renderSummary(){
          var total = items.length;
          recalcCorrect();
          var passThreshold = (playable.settings && typeof playable.settings.pass_threshold === 'number') ? playable.settings.pass_threshold : 0;
          var pct = total ? Math.round((state.correct/total)*100) : 0;

          var reviewHTML = items.map(function(it, idx){
            var r = state.results[it.id] || { ok:false, blanks:{} };
            var tag = r.ok ? '✅' : '❌';

            // full sentence with user's answers filled in
            var tmp = document.createElement('div');
            tmp.innerHTML = String(it.prompt_html || '');
            var plain = tmp.textContent || (it.prompt || '');
            var parts = String(plain).split(/\[\[(B\d+)\]\]/g);

            var sentence = parts.map(function(part, i){
              if (i % 2 === 0) return part;
              var key = part;
              var rb  = r.blanks[key] || { value:'' };
              var shown = (rb.value || '').trim() || '—';
              return '<span style="padding:.05rem .35rem;border:1px solid #cbd5e1;border-radius:6px;">' + shown + '</span>';
            }).join('');

            // list each blank’s correct options
            var blanks = Array.isArray(it.blanks) ? it.blanks : [];
            var correctRows = blanks.map(function(b){
              var rb = r.blanks[b.key] || { value:'', answers:[] , ok:false };
              var yourAns = (rb.value || '').trim() || '—';
              var rightAns = (Array.isArray(rb.answers) && rb.answers.length) ? rb.answers.join(', ') : '—';
              return ''
                + '<div style="display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;margin:.15rem 0 0 0;">'
                +   '<div><strong>Tu respuesta:</strong> <span style="color:' + (rb.ok ? '#0a7f2e' : '#b91c1c') + '">' + yourAns + '</span></div>'
                +   '<div><strong>Correcta:</strong> <span style="color:#0a7f2e">' + rightAns + '</span></div>'
                + '</div>';
            }).join('');

            return ''
              + '<div class="pp-summary-item" style="border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;">'
              +   '<div style="font-weight:600;display:inline-flex;align-items:center;gap:.25rem;">' + (idx + 1) + '<span>: ' + tag + '</span></div>'
              +   '<details style="margin-top:.35rem;">'
              +     '<summary style="cursor:pointer;user-select:none">Repasar</summary>'
              +     '<div style="margin-top:.4rem">'
              +       '<div style="color:#334155;margin-bottom:.35rem;">' + sentence + '</div>'
              +       correctRows
              +     '</div>'
              +   '</details>'
              + '</div>';
          }).join('');

          slide.innerHTML = ''
            + '<div>'
            +   '<h4 style="margin:.25rem 0 .5rem;">Resumen</h4>'
            +   '<p style="margin:0 0 .5rem;color:' + (pct >= passThreshold ? '#0a7f2e' : '#b91c1c') + '">'
            +     'Puntaje: <strong>' + state.correct + ' / ' + total + '</strong> (' + pct + '%)'
            +   '</p>'
            +   '<div class="pp-ex-review-list" style="margin:.5rem 0;display:flex;flex-direction:column;gap:.5rem;">'
            +     reviewHTML
            +   '</div>'
            +   '<button class="pp-ex-retry" type="button"'
            +     ' style="margin-top:1rem;background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:.5rem 1rem;font-size:.9rem;cursor:pointer;">'
            +     '↻ Intentar de nuevo'
            +   '</button>'
            + '</div>';

          stepEl.textContent = String(total);
          if (barEl) barEl.style.width = '100%';
          prevBtn.disabled = total === 0;
          nextBtn.textContent = 'Cerrar';
          syncBtn(prevBtn); syncBtn(nextBtn);

          var retry = slide.querySelector('.pp-ex-retry');
          if (retry) {
            retry.addEventListener('click', function(){
              state = { i: 0, correct: 0, results: {} };
              save();
              go(0);
            });
          }
        }

        function renderItem(idx){
          var total = items.length;
          if (idx >= total) { renderSummary(); return; }

          var it = items[idx] || {};
          var tmp = document.createElement('div');
          tmp.innerHTML = String(it.prompt_html || '');
          var plain = tmp.textContent || (it.prompt || '');
          var blanks = Array.isArray(it.blanks) ? it.blanks : [];
          var byKey  = {};
          blanks.forEach(function(b){ byKey[b.key] = b; });
          var parts  = String(plain).split(/\[\[(B\d+)\]\]/g);

          currentItem = it;
          currentControls = [];

          var row = document.createElement('div');
          row.style.cssText = 'line-height:1.6;color:#0f172a;';

          for (var i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
              row.appendChild(document.createTextNode(parts[i]));
            } else {
              var key = parts[i];

              var wrap = document.createElement('span');
              wrap.style.cssText = 'display:inline-flex;flex-direction:column;gap:.25rem;align-items:flex-start;margin:0 .25rem;';

              var inp  = document.createElement('input');
              inp.type = 'text';
              inp.setAttribute('data-key', key);
              inp.style.cssText = 'padding:.35rem .5rem;border:1px solid #cbd5e1;border-radius:8px;min-width:120px;';
              
              // Wider input for Dictation (full-sentence typing)
              if (isDictation) {
                // make the input stretch nicely on desktop while remaining responsive
               inp.style.cssText += 'width:calc(100% - 1rem);max-width:760px;font-size:1.05rem;padding:.55rem .75rem;box-sizing:border-box;';
                // let the container align to the wider input
                wrap.style.alignItems = 'flex-start';
                wrap.style.minWidth = 'min(100%, 760px)';
              }

              // restore value if previously checked/saved
              var prev = state.results[it.id] && state.results[it.id].blanks && state.results[it.id].blanks[key];
              if (prev && typeof prev.value === 'string') inp.value = prev.value;

              // hint + feedback
              var hintBtn = document.createElement('button');
              hintBtn.type = 'button';
              hintBtn.className = 'btn tiny';
              hintBtn.textContent = '💡';

              var hintBox = document.createElement('div');
              hintBox.className = 'tiny muted';
              hintBox.style.cssText = 'display:none;margin-top:.15rem;';
              var cfg = byKey[key];
              var hintText = (cfg && cfg.hint) ? cfg.hint : (it.hint || '');
              if (hintText) hintBox.textContent = hintText;
              hintBtn.addEventListener('click', function(hb, text){
                return function(){
                  if (!text) return;
                  hb.style.display = (hb.style.display === 'none') ? 'block' : 'none';
                };
              }(hintBox, hintText));

              var fbBox = document.createElement('div');
              fbBox.className = 'tiny';
              fbBox.style.cssText = 'display:none;margin-top:.15rem;';

              wrap.appendChild(inp);
              wrap.appendChild(hintBtn);
              wrap.appendChild(hintBox);
              wrap.appendChild(fbBox);

              row.appendChild(wrap);
              currentControls.push({ key: key, input: inp, hintBox: hintBox, fbBox: fbBox, cfg: cfg });
            }
          }

          // Card + media (kept simple)
          var card = document.createElement('div');
          card.style.cssText = 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.6rem;';
          var m = it.media || {};
          if (m && m.image){ var img=new Image(); img.src=m.image; img.alt=(m.image_alt||''); img.style.cssText='max-width:220px;border:1px solid #e5e7eb;border-radius:8px;'; card.appendChild(img); }
          if (m && m.audio){ var aud=document.createElement('audio'); aud.controls=true; aud.src=m.audio; aud.style.minWidth='220px'; card.appendChild(aud); }
          if (m && m.video){ var vid=document.createElement('video'); vid.controls=true; vid.src=m.video; vid.style.cssText='display:block;max-width:320px;border-radius:6px;'; card.appendChild(vid); }
          card.appendChild(row);

          // --- Accent helper (desktop-only, hybrid: insert-into-focused OR copy) ---
          (function(){
            var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            // Title row (placed below buttons, shorter label)
            var title = document.createElement('div');
            title.className = 'pp-ex-accentbar-title';
            title.textContent = '📋 Copiar';
            title.style.cssText = 'margin-top:.35rem;font-size:.85rem;color:#4b5563;';

            // Buttons row
            var accentBar = document.createElement('div');
            accentBar.className = 'pp-ex-accentbar';
            accentBar.style.cssText = 'display:' + (isMobile ? 'none' : 'flex') + ';flex-wrap:wrap;gap:.4rem;';
            var chars = ['á','é','í','ó','ú','ü','ö','¿','¡'];
            accentBar.innerHTML = chars.map(function(ch){
              return '<button type="button" class="accent-btn" data-ch="' + ch + '" ' +
                     'style="position:relative;padding:.3rem .55rem;font-size:1rem;border:1px solid #d1d5db;' +
                     'border-radius:6px;background:#f9fafb;color:#111827;cursor:pointer;">' + ch + '</button>';
            }).join('');
            card.appendChild(accentBar);
            card.appendChild(title);

            // Track focused input among currentControls
            var activeInput = null;
            (currentControls || []).forEach(function(c){
              if (!c || !c.input) return;
              c.input.addEventListener('focusin', function(){ activeInput = c.input; });
              c.input.addEventListener('focusout', function(){ activeInput = null; });
            });

            // Click → insert if an input is focused; otherwise copy to clipboard (with tooltip)
            accentBar.addEventListener('click', function(e){
              var btn = e.target && e.target.closest('.accent-btn');
              if (!btn) return;
              var ch = btn.getAttribute('data-ch') || '';
              if (activeInput) {
                var start = activeInput.selectionStart || 0;
                var end   = activeInput.selectionEnd   || 0;
                var val   = activeInput.value || '';
                activeInput.value = val.slice(0, start) + ch + val.slice(end);
                activeInput.focus();
                activeInput.selectionStart = activeInput.selectionEnd = start + ch.length;
                activeInput.dispatchEvent(new Event('input'));
              } else {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(ch).then(function(){
                    // Tooltip: ¡Copiado!
                    var tip = document.createElement('span');
                    tip.textContent = '¡Copiado!';
                    tip.style.cssText = 'position:absolute;left:50%;transform:translate(-50%,-140%);' +
                      'background:#111827;color:#fff;font-size:.75rem;padding:.15rem .4rem;border-radius:4px;white-space:nowrap;';
                    btn.style.position = 'relative';
                    btn.appendChild(tip);
                    setTimeout(function(){ if (tip.parentNode) tip.parentNode.removeChild(tip); }, 900);
                  }).catch(function(){});
                }
              }
            });
          })();                  

          // Check + overall feedback
          var overallBox = document.createElement('div');
          overallBox.className = 'tiny';
          overallBox.style.cssText = 'margin-top:.25rem;';
          var checkBtn = document.createElement('button');
          checkBtn.type = 'button';
          checkBtn.className = 'btn tiny';
          checkBtn.textContent = 'Comprobar';

          // initial gating
          function gate(){
            var hasAll = allInputsFilled();

            // Button state
            checkBtn.disabled = !hasAll;
            checkBtn.style.opacity = hasAll ? '1' : '0.6';
            checkBtn.style.cursor  = hasAll ? 'pointer' : 'not-allowed';

            // For Dictation: require pressing "Comprobar" before enabling Next
            if (isDictation) {
              var checked = !!(state.results[it.id] && state.results[it.id].checked);
              nextBtn.disabled = !(hasAll && checked);
            } else {
              // Cloze (non-dictation): allow Next when all blanks are filled
              nextBtn.disabled = !hasAll;
            }
            syncBtn(nextBtn);
          }
          currentControls.forEach(function(c){ c.input.addEventListener('input', gate); });

          // Restore checked UI if present
          if (state.results[it.id] && state.results[it.id].checked) {
            var r = state.results[it.id];
            currentControls.forEach(function(entry){
              var key = entry.key;
              var input = entry.input;
              var fbBox = entry.fbBox;
              var cfg = entry.cfg;
              var rb = r.blanks[key] || { ok:false, value:'' };
              input.value = rb.value || '';
              input.style.borderColor = rb.ok ? '#16a34a' : '#b91c1c';
              fbBox.textContent = rb.ok
                ? ((cfg && (cfg.feedback_correct || '¡Correcto!')) || '¡Correcto!')
                : ((cfg && (cfg.feedback_incorrect || 'Revisá esta respuesta.')) || 'Revisá esta respuesta.');
              fbBox.style.color = rb.ok ? '#15803d' : '#b91c1c';
              fbBox.style.display = 'block';
            });
            overallBox.textContent = r.ok ? '¡Todas correctas!' : 'Algunas respuestas necesitan revisión.';
            overallBox.style.color = r.ok ? '#15803d' : '#b91c1c';
          }

          checkBtn.addEventListener('click', function(){
            // require all inputs first
            if (!allInputsFilled()) return;

            var per = evaluateItem(it, currentControls);
            state.results[it.id] = per;
            recalcCorrect();

            // paint feedback and lock visuals
            currentControls.forEach(function(entry){
              var key = entry.key;
              var input = entry.input;
              var fbBox = entry.fbBox;
              var cfg = entry.cfg;
              var rb = per.blanks[key] || { ok:false, value:'' };
              input.style.borderColor = rb.ok ? '#16a34a' : '#b91c1c';
              fbBox.textContent = rb.ok
                ? ((cfg && (cfg.feedback_correct || '¡Correcto!')) || '¡Correcto!')
                : ((cfg && (cfg.feedback_incorrect || 'Revisá esta respuesta.')) || 'Revisá esta respuesta.');
              fbBox.style.color = rb.ok ? '#15803d' : '#b91c1c';
              fbBox.style.display = 'block';
            });

            overallBox.textContent = per.ok ? '¡Todas correctas!' : 'Algunas respuestas necesitan revisión.';
            overallBox.style.color = per.ok ? '#15803d' : '#b91c1c';

            // Enable Next after checked, save progress
            nextBtn.disabled = false;
            syncBtn(nextBtn);
            save();
          });

          // Dictation shows "Comprobar"; Cloze hides it (auto-evaluated)
          checkBtn.style.display = isDictation ? 'inline-block' : 'none';
          card.appendChild(checkBtn);
          card.appendChild(overallBox);

          slide.innerHTML = '';
          slide.appendChild(card);

          // Progress + nav labels
          stepEl.textContent = String(idx + 1);
          if (barEl) {
            var w = Math.round((idx / Math.max(1,total)) * 100);
            barEl.style.width = (w + '%');
          }
          prevBtn.disabled = (idx === 0);
          nextBtn.textContent = (idx === total - 1) ? 'Finalizar' : 'Siguiente →';
          syncBtn(prevBtn);

          // Apply gating now that DOM is ready
          gate();
        }

        function go(i){
          state.i = i;
          wrap.dataset.index = String(i);
          renderItem(i);
          save();
        }

        prevBtn.addEventListener('click', function(){
          if (prevBtn.disabled) return;
          if (state.i > 0) go(state.i - 1);
        });
        nextBtn.addEventListener('click', function(){
          if (nextBtn.disabled) return;

          var it = items[state.i];

          // For non-dictation Cloze, still auto-evaluate if user skipped "Comprobar"
          if (!isDictation && it && !(state.results[it.id] && state.results[it.id].checked)) {
            var per = evaluateItem(it, currentControls || []);
            state.results[it.id] = per;
            recalcCorrect();
            save();
          }

          var last = items.length;
          if (state.i < last) {
            go(state.i + 1);
          } else {
            // close modal on summary 'Cerrar'
            var els = window.PPAdminModal.getPPModalEls();
            if (els && els.modal){ els.modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
          }
        });

        // Start on restored index
        var startIdx = Math.max(0, Math.min(state.i, Math.max(0, items.length - 1)));
        go(startIdx);
      }

      // ------- Minimal in-modal TF renderer (fallback when public player is missing) -------
      function renderTFMinimal(containerEl, playable) {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const items = Array.isArray(playable.items) ? playable.items : [];
        if (!items.length) {
          containerEl.innerHTML = '<div class="tiny muted">No hay preguntas en este ejercicio.</div>';
          return;
        }

        items.forEach((it, idx) => {
          const card = document.createElement('div');
          card.style.cssText = 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.6rem;margin-bottom:.6rem;';

          // media row (image / audio / mp4 / iframe)
          const mediaRow = document.createElement('div');
          mediaRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;';
          let hasMedia = false;
          if (it.image) {
            hasMedia = true;
            const img = new Image();
            img.src = it.image;
            img.alt = it.image_alt || '';
            img.style.cssText = 'max-width:220px;border:1px solid #e5e7eb;border-radius:8px;';
            mediaRow.appendChild(img);
          }
          if (it.audio) {
            hasMedia = true;
            const aud = document.createElement('audio');
            aud.controls = true;
            aud.src = it.audio;
            aud.style.minWidth = '220px';
            mediaRow.appendChild(aud);
          }
          if (it.video_mp4) {
            hasMedia = true;
            const vid = document.createElement('video');
            vid.controls = true;
            vid.src = it.video_mp4;
            vid.style.cssText = 'display:block;max-width:320px;border-radius:6px;';
            mediaRow.appendChild(vid);
          }
          if (it.video_iframe) {
            hasMedia = true;
            const ifr = document.createElement('iframe');
            ifr.src = it.video_iframe;
            ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            ifr.allowFullscreen = true;
            ifr.style.cssText = 'width:320px;height:180px;border:0;border-radius:6px;';
            mediaRow.appendChild(ifr);
          }
          if (hasMedia) card.appendChild(mediaRow);

          // prompt
          const prompt = document.createElement('div');
          prompt.innerHTML = it.prompt_html || '';
          card.appendChild(prompt);

          // choices
          const groupName = `tf_${idx}`;
          const choicesWrap = document.createElement('div');
          (it.choices || []).forEach((ch) => {
            const label = document.createElement('label');
            label.style.cssText = 'display:inline-flex;align-items:center;gap:.4rem;margin-right:1rem;';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = groupName;
            input.value = ch.key || '';
            label.appendChild(input);
            label.appendChild(document.createTextNode(ch.label || ch.html || ch.key || ''));
            choicesWrap.appendChild(label);
          });
          card.appendChild(choicesWrap);

          // check button + fb
          const fb = document.createElement('div');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn tiny';
          btn.textContent = 'Comprobar';
          btn.addEventListener('click', () => {
            const chosen = card.querySelector(`input[name="${groupName}"]:checked`);
            const isCorrect = !!(chosen && String(chosen.value) === String(it.answer));

            // Try per-choice feedback first
            let chosenFeedback = null;
            if (chosen) {
                const chosenKey = String(chosen.value);
                const found = (Array.isArray(it.choices) ? it.choices : []).find(c => String(c.key) === chosenKey);
                if (found && found.feedback) chosenFeedback = String(found.feedback);
            }

            // Fallbacks to generic exercise-level feedback
            if (chosenFeedback && chosenFeedback.trim()) {
                fb.textContent = chosenFeedback;
            } else {
                fb.textContent = isCorrect
                ? (it.feedback_correct || '¡Correcto!')
                : (it.feedback_incorrect || 'Revisá tu respuesta.');
            }
            fb.style.color = isCorrect ? '#15803d' : '#b91c1c';
            });
            card.appendChild(btn);
            card.appendChild(fb);

          containerEl.appendChild(card);
        });
      }

      // ------- Minimal in-modal MCQ renderer (fallback when public player is missing) -------
      function renderMCQMinimal(containerEl, playable) {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const items = Array.isArray(playable.items) ? playable.items : [];
        if (!items.length) {
          containerEl.innerHTML = '<div class="tiny muted">No hay preguntas en este ejercicio.</div>';
          return;
        }

        items.forEach((it, idx) => {
          const card = document.createElement('div');
          card.style.cssText = 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.6rem;margin-bottom:.6rem;';

          // media row (image / audio / mp4 / iframe)
          const mediaRow = document.createElement('div');
          mediaRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;';
          let hasMedia = false;
          if (it.image) {
            hasMedia = true;
            const img = new Image();
            img.src = it.image;
            img.alt = it.image_alt || '';
            img.style.cssText = 'max-width:220px;border:1px solid #e5e7eb;border-radius:8px;';
            mediaRow.appendChild(img);
          }
          if (it.audio) {
            hasMedia = true;
            const aud = document.createElement('audio');
            aud.controls = true;
            aud.src = it.audio;
            aud.style.minWidth = '220px';
            mediaRow.appendChild(aud);
          }
          if (it.video_mp4) {
            hasMedia = true;
            const vid = document.createElement('video');
            vid.controls = true;
            vid.src = it.video_mp4;
            vid.style.cssText = 'display:block;max-width:320px;border-radius:6px;';
            mediaRow.appendChild(vid);
          }
          if (it.video_iframe) {
            hasMedia = true;
            const ifr = document.createElement('iframe');
            ifr.src = it.video_iframe;
            ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            ifr.allowFullscreen = true;
            ifr.style.cssText = 'width:320px;height:180px;border:0;border-radius:6px;';
            mediaRow.appendChild(ifr);
          }
          if (hasMedia) card.appendChild(mediaRow);

          // prompt
          const prompt = document.createElement('div');
          prompt.innerHTML = it.prompt_html || '';
          card.appendChild(prompt);

          // choices
          const groupName = `mcq_${idx}`;
          const choicesWrap = document.createElement('div');
          (it.choices || []).forEach((ch) => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin:.2rem 0;';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = groupName;
            input.value = ch.key || '';
            label.appendChild(input);
            const text = document.createElement('span');
            text.innerHTML = ch.html || ch.label || ch.key || '';
            label.appendChild(text);
            choicesWrap.appendChild(label);
          });
          card.appendChild(choicesWrap);

          // check button + fb
          const fb = document.createElement('div');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn tiny';
          btn.textContent = 'Comprobar';
          btn.addEventListener('click', () => {
            const chosen = card.querySelector(`input[name="${groupName}"]:checked`);
            const isCorrect = !!(chosen && String(chosen.value) === String(it.answer));
            fb.textContent = isCorrect ? (it.feedback_correct || '¡Correcto!') : (it.feedback_incorrect || 'Revisá tu respuesta.');
            fb.style.color = isCorrect ? '#15803d' : '#b91c1c';
          });
          card.appendChild(btn);
          card.appendChild(fb);

          containerEl.appendChild(card);
        });
      }

      // ------- normalize DND (drag & drop text -> columns) -------
      // IMPORTANT: carry through exercise-level media AND per-item media.
      function adaptDND(ex) {
        if (!ex || ex.type !== 'dnd_text') return ex;

        const cols  = Array.isArray(ex.columns) ? ex.columns : [];
        const items = Array.isArray(ex.items)   ? ex.items   : [];

        // Pass exercise-level media verbatim if present
        const media = (ex.media && typeof ex.media === 'object') ? ex.media : undefined;

        return {
          exercise_id: ex.id || 'dnd_preview',
          title:       ex.title || 'Arrastrar y soltar',
          type:        'dnd_text',
          instructions: ex.instructions || '',
          media, // <-- keep exercise-level media so PPTypes.renderDnDText can render it

          columns: cols.map(c => ({
            id:    c.id || String(c.label || '').toLowerCase() || 'col',
            label: c.label || c.id || 'Columna'
          })),

          items: items.map((it, i) => {
            const m = it.media || {};
            return {
              id:                 it.id || ('i' + (i + 1)),
              text:               it.text || '',
              correct_column:     it.correct_column || '',
              hint:               it.hint || '',
              feedback_correct:   it.feedback_correct || '',
              feedback_incorrect: it.feedback_incorrect || '',
              media: (Object.keys(m).length ? m : undefined) // <-- keep per-item media
            };
          }),

          settings: Object.assign(
            { shuffle_items: true, allow_partial_submit: false, show_hints: true, max_columns: 6 },
            ex.settings || {}
          )
        };
      }

      // ------- Minimal in-modal DND renderer (fallback when public player is missing) -------
      function renderDNDMinimal(containerEl, playable) {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const cols = Array.isArray(playable.columns) ? playable.columns : [];
        const items = Array.isArray(playable.items) ? playable.items.slice() : [];
        if (!cols.length || !items.length) {
          containerEl.innerHTML = '<div class="tiny muted">Configurá columnas e ítems para previsualizar.</div>';
          return;
        }
        if (playable.settings && playable.settings.shuffle_items) {
          for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = items[i]; items[i] = items[j]; items[j] = t;
          }
        }

        // Styled helpers
        const mkCard = (css) => {
          const d = document.createElement('div');
          d.style.cssText = (css || 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;');
          return d;
        };
        const mkBtn = (label) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = label;
          b.style.cssText = 'border:1px solid #cbd5e1;border-radius:10px;padding:.5rem .75rem;background:#f8fafc;cursor:grab;';
          return b;
        };

        // Tray
        const tray = mkCard('border:1px dashed #cbd5e1;border-radius:12px;padding:.75rem;background:#fafafa;');
        const trayTitle = document.createElement('div');
        trayTitle.textContent = 'Ítems';
        trayTitle.style.cssText = 'font-weight:600;margin-bottom:.5rem;';
        tray.appendChild(trayTitle);
        const trayWrap = document.createElement('div');
        trayWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem;';
        tray.appendChild(trayWrap);

        // Columns
        const grid = document.createElement('div');
        const colCount = Math.min(cols.length, Math.max(2, (playable.settings && playable.settings.max_columns) || 6));
        grid.style.cssText = 'display:grid;gap:.75rem;margin-top:.75rem;grid-template-columns:repeat(' + Math.min(colCount, cols.length) + ', minmax(0,1fr));';

        const colBoxes = {};
        cols.forEach(c => {
          const box = mkCard();
          box.dataset.col = c.id;
          box.style.minHeight = '110px';
          box.style.display = 'flex';
          box.style.flexDirection = 'column';
          box.style.gap = '.5rem';

          const lab = document.createElement('div');
          lab.textContent = c.label || c.id;
          lab.style.cssText = 'font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:.35rem .5rem;margin:-.25rem -.25rem .25rem;';
          box.appendChild(lab);

          const drop = document.createElement('div');
          drop.style.cssText = 'min-height:60px;display:flex;flex-wrap:wrap;gap:.5rem;';
          box.appendChild(drop);

          // DnD events
          ;[box, drop].forEach(el => {
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.background = '#f8fafc'; });
            el.addEventListener('dragleave', () => { el.style.background = '#fff'; });
            el.addEventListener('drop', (e) => {
              e.preventDefault();
              el.style.background = '#fff';
              const id = e.dataTransfer.getData('text/plain');
              const chip = containerEl.querySelector('[data-item-id="' + id + '"]');
              if (chip) drop.appendChild(chip);
            });
          });

          grid.appendChild(box);
          colBoxes[c.id] = drop;
        });

        // Build item chips
        items.forEach(it => {
          const chip = mkBtn(it.text || it.id);
          chip.setAttribute('draggable', 'true');
          chip.dataset.itemId = it.id;
          chip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', it.id);
            chip.style.opacity = '0.6';
          });
          chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });
          // Hint (optional)
          if (playable.settings && playable.settings.show_hints && it.hint) {
            chip.title = it.hint;
          }
          trayWrap.appendChild(chip);
        });

        // Controls
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;gap:.5rem;margin-top:.75rem;';
        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn btn-primary';
        submitBtn.type = 'button';
        submitBtn.textContent = 'Enviar';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn';
        resetBtn.type = 'button';
        resetBtn.textContent = 'Reiniciar';

        controls.appendChild(submitBtn);
        controls.appendChild(resetBtn);

        // Mount
        containerEl.appendChild(tray);
        containerEl.appendChild(grid);
        containerEl.appendChild(controls);

        // Helpers
        function allPlaced() {
          const chips = Array.from(containerEl.querySelectorAll('[data-item-id]'));
          return chips.every(ch => ch.parentElement && ch.parentElement !== trayWrap);
        }

        resetBtn.addEventListener('click', () => {
          // Move all chips back to tray
          Array.from(containerEl.querySelectorAll('[data-item-id]')).forEach(ch => {
            ch.style.borderColor = '#cbd5e1';
            ch.style.background = '#f8fafc';
            ch.textContent = (items.find(i => i.id === ch.dataset.itemId)?.text) || ch.textContent;
            trayWrap.appendChild(ch);
          });
          // remove any summary if exists
          const old = containerEl.querySelector('.pp-dnd-summary');
          if (old) old.remove();
        });

        submitBtn.addEventListener('click', () => {
          if (!playable.settings.allow_partial_submit && !allPlaced()) {
            alert('Completá todas las ubicaciones antes de enviar.');
            return;
          }
          // grade
          let correct = 0;
          items.forEach(it => {
            const chip = containerEl.querySelector('[data-item-id="' + it.id + '"]');
            let placedCol = '';
            if (chip) {
              const box = chip.closest('[data-col]');
              placedCol = box ? box.dataset.col : '';
            }
            const ok = placedCol && it.correct_column && placedCol === it.correct_column;
            if (ok) {
              chip.style.background = '#dcfce7';
              chip.style.borderColor = '#86efac';
              chip.textContent = '✅ ' + (it.text || it.id);
              correct++;
            } else {
              chip.style.background = '#fee2e2';
              chip.style.borderColor = '#fecaca';
              chip.textContent = '❌ ' + (it.text || it.id);
            }
          });

          // Summary page
          const summary = document.createElement('div');
          summary.className = 'pp-dnd-summary';
          summary.style.cssText = 'margin-top:1rem;border-top:1px dashed #e5e7eb;padding-top:.75rem;';

          const score = document.createElement('div');
          score.style.cssText = 'font-weight:700;margin-bottom:.5rem;';
          score.textContent = 'Resultado: ' + correct + ' / ' + items.length;
          summary.appendChild(score);

          const colsWrap = document.createElement('div');
          colsWrap.style.cssText = 'display:grid;gap:.75rem;grid-template-columns:repeat(' + Math.min(cols.length, 3) + ', minmax(0,1fr));';
          cols.forEach(c => {
            const card = mkCard();
            const h = document.createElement('div');
            h.textContent = c.label || c.id;
            h.style.cssText = 'font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:.35rem .5rem;margin:-.25rem -.25rem .25rem;';
            card.appendChild(h);

            const list = document.createElement('div');
            list.style.cssText = 'display:flex;flex-direction:column;gap:.35rem;';
            // collect items placed here
            const chips = Array.from(grid.querySelectorAll('[data-col="' + c.id + '"] [data-item-id]'));
            chips.forEach(ch => {
              const id = ch.dataset.itemId;
              const it = items.find(i => i.id === id);
              const ok = (it && it.correct_column === c.id);
              const row = document.createElement('div');
              row.style.cssText = 'display:flex;justify-content:space-between;gap:.5rem;';
              const txt = document.createElement('div');
              txt.textContent = (ok ? '✅ ' : '❌ ') + (it?.text || id);
              const fb = document.createElement('div');
              fb.className = 'tiny muted';
              fb.textContent = ok ? (it?.feedback_correct || '') : (it?.feedback_incorrect || '');
              row.appendChild(txt);
              row.appendChild(fb);
              list.appendChild(row);
            });
            card.appendChild(list);
            colsWrap.appendChild(card);
          });

          summary.appendChild(colsWrap);

          // replace trailing content if already there
          const old = containerEl.querySelector('.pp-dnd-summary');
          if (old) old.replaceWith(summary);
          else containerEl.appendChild(summary);
        });
      }

      // --- public player bootstrap (detect / optionally load) ---
      function getPublicCarouselFn() {
        const fn =
          (typeof window.renderCarousel === 'function') ? window.renderCarousel :
          (typeof window.PPRenderCarousel === 'function') ? window.PPRenderCarousel :
          null;
        const choiceReady = !!(window.PPTypes && typeof window.PPTypes.renderSingleChoice === 'function');
        return (fn && choiceReady) ? fn : null;
      }

      let __ppPlayerRequested = false;

      function ensurePublicPlayer() {
        return new Promise((resolve) => {
          const tick = () => {
            const fn = getPublicCarouselFn();
            if (fn) { resolve(fn); return; }

            if (!__ppPlayerRequested) {
              const hintedSrc =
                window.PP_PUBLIC_PLAYER_SRC ||
                document.documentElement.getAttribute('data-pp-player-src');

              if (hintedSrc) {
                __ppPlayerRequested = true;
                const s = document.createElement('script');
                s.src = hintedSrc;
                s.async = true;
                s.onload = () => setTimeout(() => resolve(getPublicCarouselFn()), 0);
                s.onerror = () => resolve(null);
                document.head.appendChild(s);
                return;
              }
            }

            setTimeout(tick, 100);
          };
          tick();
        });
      }

      // Keep polling until both the public carousel AND PPTypes are ready, then upgrade.
      function upgradeWhenReady(targetEl, playable, maxMs = 8000) {
        const started = Date.now();
        (function loop(){
          const fn = getPublicCarouselFn(); // now requires PPTypes.renderSingleChoice too
          if (fn) {
            try {
              try { fn(targetEl, playable); }
              catch (_) { fn(window.PPAdminModal.getPPModalEls().modal, playable); }
            } catch (err) {
              console.error('Carousel upgrade error (retrying):', err);
              if (Date.now() - started < maxMs) return setTimeout(loop, 120);
            }
            return; // upgraded successfully
          }
          if (Date.now() - started < maxMs) setTimeout(loop, 120);
        })();
      }

      function renderExercise(exercise) {
        const { modal, titleEl, bodyEl } = window.PPAdminModal.getPPModalEls();
        if (!modal) return;

        if (titleEl) titleEl.textContent = (exercise && exercise.title) ? exercise.title : 'Vista previa';

        // Normalize to the playable shape
        const playable =
          exercise && exercise.type === 'tf'        ? adaptTF(exercise)        :
          exercise && exercise.type === 'mcq'       ? adaptMCQ(exercise)       :
          exercise && exercise.type === 'cloze'     ? adaptCloze(exercise)     :
          exercise && exercise.type === 'dictation' ? adaptDictation(exercise) :
          exercise && exercise.type === 'dnd_text'  ? adaptDND(exercise)       :
          exercise;

        // Helper to inject the instructions box at the very top of the modal body
        function injectInstructions() {
          const els = window.PPAdminModal.getPPModalEls();
          const be = els && els.bodyEl;
          if (!be) return;
          // avoid duplicating
          if (be.querySelector('.pp-ex-instructions')) return;
          if (exercise && typeof exercise.instructions === 'string' && exercise.instructions.trim() !== '') {
            const box = document.createElement('div');
            box.className = 'pp-ex-instructions';
            box.innerHTML = exercise.instructions; // allow basic HTML
            box.style.cssText = 'margin-bottom:1rem;padding:.75rem 1rem;background:#f8fafc;border-left:4px solid #2563eb;border-radius:8px;color:#0f172a;line-height:1.5;';
            be.insertAdjacentElement('afterbegin', box);
          }
        }

        // Detect CLOZE quickly
        const isCloze = !!(playable && (
          playable.type === 'cloze' || playable.type === 'dictation' ||
          (Array.isArray(playable.items) && playable.items.some(it => it.type === 'cloze' || it.type === 'dictation'))
        ));

        // CLOZE → always use our local carousel (we control the body; inject instructions first)
        if (isCloze) {
          if (bodyEl) {
            bodyEl.innerHTML = '';
            injectInstructions();
            // mount after instructions
            const mount = document.createElement('div');
            bodyEl.appendChild(mount);
            renderClozeCarousel(mount, playable);
          }
          return;
        }

        // TF / MCQ → try the public carousel first (never for DnD/Cloze)
        const wantsPublic = !!(exercise && (exercise.type === 'tf' || exercise.type === 'mcq'));
        const playerFn = wantsPublic ? getPublicCarouselFn() : null;
        if (wantsPublic && playerFn) {
          try {
            playerFn(modal, playable);
            // Try a few times in case the player renders asynchronously
            injectInstructions();
            setTimeout(injectInstructions, 50);
            setTimeout(injectInstructions, 200);
          } catch (err) {
            console.error('Public carousel threw; falling back to minimal preview:', err);
            if (bodyEl) {
              bodyEl.innerHTML = '';
              injectInstructions();
              const mount = document.createElement('div');
              bodyEl.appendChild(mount);
              if (exercise && exercise.type === 'tf') renderTFMinimal(mount, playable);
              else renderMCQMinimal(mount, playable);
            }
          }
          return;
        }

        // No public player yet → show minimal preview immediately and auto-upgrade later.
        if (bodyEl) {
          bodyEl.innerHTML = '';
          injectInstructions();
          const mount = document.createElement('div');
          bodyEl.appendChild(mount);
          if (exercise && exercise.type === 'tf') {
            renderTFMinimal(mount, playable);
          } else if (exercise && exercise.type === 'mcq') {
            renderMCQMinimal(mount, playable);
          } else if (exercise && exercise.type === 'dnd_text') {
            if (window.PPTypes && typeof window.PPTypes.renderDnDText === 'function') {
              window.PPTypes.renderDnDText(mount, playable);
            } else {
              renderDNDMinimal(mount, playable);
            }
          } else {
            renderMCQMinimal(mount, playable);
          }
          const shouldUpgrade = !!(exercise && (exercise.type === 'tf' || exercise.type === 'mcq'));
          if (shouldUpgrade) upgradeWhenReady(modal, playable);
        }
      }

      // ✅ EXPORT and close PPAdminPreview IIFE
      return { renderExercise };
    })();
  }

  // ---------------------------------------------------
  // Biblioteca handlers (open modal + fetch + render)
  // ---------------------------------------------------
  (function wireLibraryActions(){
    const { openPPModal, getPPModalEls } = window.PPAdminModal;
    const { renderExercise } = window.PPAdminPreview;

    // Preview (diagnostic + no-hang)
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-ex-preview="true"]');
      if (!btn) return;

      const exId = btn.getAttribute('data-ex-id');
      if (!exId) return;

      const { titleEl, bodyEl } = getPPModalEls();
      if (titleEl) titleEl.textContent = 'Vista previa';
      if (bodyEl) {
        bodyEl.innerHTML =
          '<div class="tiny muted" style="display:flex;align-items:center;gap:.5rem;">' +
          '<span style="font-size:1.1rem;">⏳</span> Cargando vista previa…' +
          '</div>';
      }
      openPPModal();

      window.PP_ADMIN_PREVIEW_DEBUG = true;

      const dataUrl = btn.getAttribute('data-ex-preview-url');
      const tmpl = window.PP_ADMIN_PREVIEW_URL_TMPL;
      const url = dataUrl
        ? dataUrl
        : (tmpl ? tmpl.replace('__ID__', exId) : '/admin/exercises/' + encodeURIComponent(exId) + '/preview');

      let finished = false;
      try {
        if (window.PP_ADMIN_PREVIEW_DEBUG) {
          console.log('[preview] fetching:', url, 'exId=', exId);
        }

        const res = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });

        if (window.PP_ADMIN_PREVIEW_DEBUG) {
          console.log('[preview] response:', res.status, res.statusText);
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error('HTTP ' + res.status + ' while fetching preview. ' + text.slice(0,180));
        }

        let data;
        try {
          data = await res.json();
        } catch (jsonErr) {
          const raw = await res.text().catch(() => '');
          throw new Error('La respuesta no es JSON válido. Primeros 200 chars:\n' + raw.slice(0,200));
        }

        const exercise = (data && (data.exercise || data)) || null;
        if (!exercise) {
          throw new Error('Respuesta sin "exercise".');
        }

        if (window.PP_ADMIN_PREVIEW_DEBUG) {
          console.log('[preview] exercise type:', exercise.type, exercise);
        }

        renderExercise(exercise);
        finished = true;

      } catch (err) {
        console.error('[preview] error:', err);
        const els = getPPModalEls();
        if (els.bodyEl) {
          els.bodyEl.innerHTML =
            '<div class="tiny muted" style="color:#b91c1c;white-space:pre-line">' +
            'Error al cargar vista previa.\n' +
            (err && err.message ? err.message : 'Desconocido') +
            '\nURL: ' + url +
            '</div>';
        }
      } finally {
        // Safety: if nothing replaced the spinner after ~2.5s, say so explicitly.
        setTimeout(() => {
          const els = getPPModalEls();
          if (!els || !els.bodyEl) return;
          const html = (els.bodyEl.innerHTML || '');
          const stillSpinner = html.indexOf('Cargando vista previa') >= 0;
          if (!finished && stillSpinner) {
            els.bodyEl.innerHTML =
              '<div class="tiny muted" style="color:#b91c1c;">' +
              'La vista previa está tardando demasiado o falló antes de actualizar la UI.<br>' +
              'Revisá la consola del navegador para ver el detalle.' +
              '</div>';
          }
        }, 2500);
      }
    });

    // Delete
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-ex-delete="true"]');
      if (!btn) return;

      const exId = btn.getAttribute('data-ex-id');
      if (!exId) return;

      const doDelete = window.confirm('¿Eliminar el ejercicio "' + exId + '"? Esta acción no se puede deshacer.');
      if (!doDelete) return;

      const purgeMedia = window.confirm('¿También querés borrar los archivos de media asociados? (Aceptar = sí, Cancelar = no)');

      try {
        const dataUrl = btn.getAttribute('data-ex-delete-url');
        const tmpl = window.PP_ADMIN_DELETE_URL_TMPL;
        const url = dataUrl
          ? dataUrl
          : (tmpl ? tmpl.replace('__ID__', exId) : '/admin/exercises/' + encodeURIComponent(exId) + '/delete');

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purge_media: !!purgeMedia })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data && data.success) {
          const card = btn.closest('.ex-item');
          if (card) card.remove();
          window.location.href = (window.PP_ADMIN_LIBRARY_URL || '/admin/exercises');
          return;
        }

        const msg = (data && data.error) ? data.error : 'No se pudo eliminar el ejercicio.';
        window.alert('❌ ' + msg);
      } catch (err) {
        console.error(err);
        window.alert('❌ Error de red al eliminar.');
      }
    });
  })();

})();