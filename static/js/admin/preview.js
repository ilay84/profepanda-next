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
              return { key, label, html };
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

      // ------- CLOZE carousel (auto-check on Next; no per-blank "Comprobar") -------
      function renderClozeCarousel(containerEl, playable) {
        if (!containerEl) return;

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
            var normAccents  = (cfg.normalize_accents !== false);
            var norm = function(s){
              var o = s;
              if (!caseSensitive) o = o.toLowerCase();
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
        var currentControls = []; // [{ key, input, fbBox }]

        function allInputsFilled() {
          return currentControls.every(function(c){ return ((c.input.value || '').trim().length > 0); });
        }

        function paintFeedback(per) {
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
        }

        function renderSummary(){
          var total = items.length;
          recalcCorrect();
          var passThreshold = (playable.settings && typeof playable.settings.pass_threshold === 'number') ? playable.settings.pass_threshold : 0;
          var pct = total ? Math.round((state.correct/total)*100) : 0;

          var reviewHTML = items.map(function(it, idx){
            var r = state.results[it.id] || { ok:false, blanks:{} };
            var tag = r.ok ? '✅' : '❌';

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

            return ''
              + '<div class="pp-summary-item" style="border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .6rem;">'
              +   '<div style="font-weight:600;display:inline-flex;align-items:center;gap:.25rem;">' + (idx + 1) + '<span>: ' + tag + '</span></div>'
              +   '<div style="margin-top:.35rem;color:#334155;">' + sentence + '</div>'
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
          nextBtn.disabled = false;
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

              // restore value if previously checked/saved
              var prev = state.results[it.id] && state.results[it.id].blanks && state.results[it.id].blanks[key];
              if (prev && typeof prev.value === 'string') inp.value = prev.value;

              var fbBox = document.createElement('div');
              fbBox.className = 'tiny';
              fbBox.style.cssText = 'display:none;margin-top:.15rem;';

              wrap.appendChild(inp);
              wrap.appendChild(fbBox);

              row.appendChild(wrap);
              currentControls.push({ key: key, input: inp, fbBox: fbBox, cfg: byKey[key] });
            }
          }

          // Card + (optional) media
          var card = document.createElement('div');
          card.style.cssText = 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.6rem;';
          var m = it.media || {};
          if (m && m.image){ var img=new Image(); img.src=m.image; img.alt=(m.image_alt||''); img.style.cssText='max-width:220px;border:1px solid #e5e7eb;border-radius:8px;'; card.appendChild(img); }
          if (m && m.audio){ var aud=document.createElement('audio'); aud.controls=true; aud.src=m.audio; aud.style.minWidth='220px'; card.appendChild(aud); }
          if (m && m.video){ var vid=document.createElement('video'); vid.controls=true; vid.src=m.video; vid.style.cssText='display:block;max-width:320px;border-radius:6px;'; card.appendChild(vid); }
          card.appendChild(row);

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

          // Gate Next until all inputs are filled (or already checked)
          function gate(){
            var hasAll = allInputsFilled();
            nextBtn.disabled = !hasAll && !(state.results[it.id] && state.results[it.id].checked);
            syncBtn(nextBtn);
          }
          currentControls.forEach(function(c){ c.input.addEventListener('input', gate); });

          // If already checked before, repaint feedback & allow Next
          if (state.results[it.id] && state.results[it.id].checked) {
            paintFeedback(state.results[it.id]);
            nextBtn.disabled = false;
          } else {
            nextBtn.disabled = !allInputsFilled();
          }
          syncBtn(prevBtn); syncBtn(nextBtn);
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
          var it = items[state.i];
          if (it) {
            // Auto-check on Next
            var per = evaluateItem(it, currentControls);
            state.results[it.id] = per;
            recalcCorrect();
            save();
            paintFeedback(per);
          }
          if (state.i < items.length - 1) {
            go(state.i + 1);
          } else {
            renderSummary();
          }
        });

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
            fb.textContent = isCorrect ? (it.feedback_correct || '¡Correcto!') : (it.feedback_incorrect || 'Revisá tu respuesta.');
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
              // If the player threw because something is still loading, keep waiting.
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
          exercise && exercise.type === 'tf'    ? adaptTF(exercise)   :
          exercise && exercise.type === 'mcq'   ? adaptMCQ(exercise)  :
          exercise && exercise.type === 'cloze' ? adaptCloze(exercise) :
          exercise;

        // Detect CLOZE quickly
        const isCloze = !!(playable && (
          playable.type === 'cloze' ||
          (Array.isArray(playable.items) && playable.items.some(it => it.type === 'cloze'))
        ));

        // CLOZE → always use our local carousel (one oración / slide + resumen final)
        if (isCloze) {
          if (bodyEl) bodyEl.innerHTML = '';
          renderClozeCarousel(bodyEl, playable);
          return;
        }

        // TF / MCQ → try the public carousel first
        const playerFn = getPublicCarouselFn();
        if (playerFn) {
          try {
            try { playerFn(modal, playable); }
            catch (_) { playerFn(bodyEl || document.body, playable); }
          } catch (err) {
            console.error('Public carousel threw; falling back to minimal preview:', err);
            if (exercise && exercise.type === 'tf') {
              renderTFMinimal(bodyEl, playable);
            } else {
              renderMCQMinimal(bodyEl, playable);
            }
          }
          return;
        }

        // No public player yet → show minimal preview immediately and auto-upgrade when ready
        if (exercise && exercise.type === 'tf') {
          renderTFMinimal(bodyEl, playable);
        } else {
          renderMCQMinimal(bodyEl, playable);
        }
        upgradeWhenReady(modal, playable);
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
        : (tmpl ? tmpl.replace('__ID__', exId) : '/admin/exercises/preview/' + encodeURIComponent(exId));

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
