// static/js/admin/builder_dnd_text.js
(function () {
  'use strict';

  // ---------- Root elements ----------
  const form        = document.getElementById('ex-dnd-form');
  const payloadEl   = document.getElementById('itemsPayload');
  const columnsWrap = document.getElementById('columnsList');
  const itemsWrap   = document.getElementById('itemsList');

  const btnAddColumn = document.getElementById('btnAddColumn');
  const btnAddItem   = document.getElementById('btnAddItem');
  const btnCancel    = document.getElementById('btnCancel');

  // Exercise-level media inputs (collapsible block) — match template names
  const mediaImage    = document.querySelector('input[name="media_image"]');
  const mediaImageAlt = document.querySelector('input[name="media_image_alt"]');
  const mediaAudio    = document.querySelector('input[name="media_audio"]');
  const mediaVideo    = document.querySelector('input[name="media_video"]');
  const mediaYouTube  = document.querySelector('input[name="media_youtube_url"]');

  // Settings
  const setShuffle  = document.getElementById('setShuffle');
  const setPartial  = document.getElementById('setPartial');
  const setHints    = document.getElementById('setHints');
  const setMaxCols  = document.getElementById('setMaxCols');

  // Modal bits (if present) — align with PPAdminModal selectors
  const exModal =
    document.getElementById('pp-ex-modal') ||
    document.querySelector('.pp-ex-modal') ||
    document.getElementById('pp-exercise-modal');

  // Also grab the builder modal (create/edit) ids
  const builderModal = document.getElementById('ex-modal');
  const builderClose = document.getElementById('ex-modal-close');
  const builderBackdrop = document.getElementById('ex-modal-backdrop');

  // Ensure ✕ and backdrop close the builder modal too
  if (builderClose) {
    builderClose.addEventListener('click', () => {
      if (builderModal) builderModal.classList.remove('open');
    });
  }
  if (builderBackdrop) {
    builderBackdrop.addEventListener('click', () => {
      if (builderModal) builderModal.classList.remove('open');
    });
  }

  const exModalClose =
    exModal && (exModal.querySelector('.pp-ex-modal__close') || exModal.querySelector('[data-close]'));

  const exModalBackdrop =
    exModal && (exModal.querySelector('.pp-ex-modal__overlay') || exModal.querySelector('.pp-ex-modal__backdrop') || exModal.querySelector('[data-close]'));

  // Preloaded edit object (if editing)
  const EDIT = (typeof window !== 'undefined' && window.PP_DND_EDIT_EX) ? window.PP_DND_EDIT_EX : null;

  // ---------- Utilities ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'style') node.style.cssText = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  function slugify(str) {
    return (str || '')
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 40);
  }

  function up(array, idx) {
    if (idx <= 0) return;
    const t = array[idx - 1]; array[idx - 1] = array[idx]; array[idx] = t;
  }
  function down(array, idx) {
    if (idx >= array.length - 1) return;
    const t = array[idx + 1]; array[idx + 1] = array[idx]; array[idx] = t;
  }

  // ---------- State ----------
  /** @type {{id:string,label:string}[]} */
  let columns = [];
  /** @type {{id:string,text:string,correct_column:string,hint?:string,feedback_correct?:string,feedback_incorrect?:string}[]} */
  let items = [];

  // ---------- Renderers ----------
  function renderAll() {
    renderColumns();
    renderItems();
  }

  function renderColumns() {
    columnsWrap.innerHTML = '';
    columns.forEach((col, idx) => {
      const row = el('div', { class: 'ex-row', style: 'display:flex;gap:.5rem;align-items:center;' }, [
        el('input', {
          type: 'text',
          value: col.label,
          placeholder: 'Etiqueta de columna (ej.: SER)',
          style: 'flex:1;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
          oninput: (e) => {
            col.label = e.target.value;
            // auto-sync id if it was empty or matched previous slug
            if (!col._touchedId) {
              col.id = slugify(col.label);
              idInput.value = col.id;
              syncItemColumnOptions();
            }
          }
        }),
        el('input', {
          type: 'text',
          value: col.id,
          placeholder: 'id (auto)',
          style: 'width:180px;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
          oninput: (e) => { col.id = slugify(e.target.value); col._touchedId = true; e.target.value = col.id; syncItemColumnOptions(); }
        }),
        (function () {
          const g = el('div', { class: 'row', style: 'display:flex;gap:.25rem;' }, [
            el('button', { type: 'button', class: 'btn tiny', style: 'padding:.35rem .5rem;', onclick: () => { up(columns, idx); renderColumns(); syncItemColumnOptions(); } }, '↑'),
            el('button', { type: 'button', class: 'btn tiny', style: 'padding:.35rem .5rem;', onclick: () => { down(columns, idx); renderColumns(); syncItemColumnOptions(); } }, '↓'),
            el('button', { type: 'button', class: 'btn tiny', style: 'padding:.35rem .5rem;background:#fee2e2;border-color:#fecaca;', onclick: () => {
              const removed = columns.splice(idx, 1)[0];
              // Clear items pointing to removed column
              items.forEach(it => { if (it.correct_column === removed.id) it.correct_column = ''; });
              renderAll();
            } }, 'Eliminar')
          ]);
          return g;
        })()
      ]);
      const idInput = row.querySelectorAll('input')[1];
      columnsWrap.appendChild(row);
    });
  }

  function renderItems() {
    itemsWrap.innerHTML = '';
    items.forEach((it, idx) => {
      const card = el('div', {
        class: 'ex-card',
        style: 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;display:flex;flex-direction:column;gap:.5rem;background:#fff;'
      }, [
        // top row: text + actions
        el('div', { class: 'row', style: 'display:flex;gap:.5rem;align-items:flex-start;' }, [
          el('textarea', {
            rows: 2,
            placeholder: 'Texto del ítem (arrastrable)',
            style: 'flex:1;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
            oninput: e => it.text = e.target.value
          }, it.text || ''),
          el('div', { class: 'col-actions', style: 'display:flex;flex-direction:column;gap:.25rem;' }, [
            el('button', { type: 'button', class: 'btn tiny', style: 'padding:.35rem .5rem;', onclick: () => { up(items, idx); renderItems(); } }, '↑'),
            el('button', { type: 'button', class: 'btn tiny', style: 'padding:.35rem .5rem;', onclick: () => { down(items, idx); renderItems(); } }, '↓'),
            el('button', { type: 'button', class: 'btn tiny', style: 'padding:.35rem .5rem;background:#fee2e2;border-color:#fecaca;', onclick: () => {
              items.splice(idx, 1);
              renderItems();
            } }, 'Eliminar')
          ])
        ]),

        // correct column select
        el('label', {}, [
          el('span', { style: 'display:block;font-weight:600;margin-bottom:.25rem;' }, 'Columna correcta'),
          (function makeSelect() {
            const sel = el('select', {
              style: 'width:100%;max-width:320px;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;'
            });
            sel.appendChild(el('option', { value: '' }, '-- Elegí una columna --'));
            columns.forEach(c => { sel.appendChild(el('option', { value: c.id }, c.label || c.id)); });
            sel.value = it.correct_column || '';
            sel.addEventListener('change', e => { it.correct_column = e.target.value; });
            return sel;
          })()
        ]),

        // optional hint + feedbacks
        el('div', { class: 'grid', style: 'display:grid;grid-template-columns:1fr 1fr;gap:.5rem;' }, [
          el('label', {}, [
            el('span', { class: 'muted tiny', style: 'display:block;margin-bottom:.25rem;' }, 'Pista (opcional)'),
            el('input', {
              type: 'text',
              value: it.hint || '',
              placeholder: 'Se mostrará al pedir una pista',
              style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
              oninput: e => it.hint = e.target.value
            })
          ]),
          el('label', {}, [
            el('span', { class: 'muted tiny', style: 'display:block;margin-bottom:.25rem;' }, 'Feedback — correcto (opcional)'),
            el('input', {
              type: 'text',
              value: it.feedback_correct || '',
              placeholder: 'Mensaje al acertar',
              style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
              oninput: e => it.feedback_correct = e.target.value
            })
          ]),
          el('label', { style: 'grid-column:1 / span 2;' }, [
            el('span', { class: 'muted tiny', style: 'display:block;margin-bottom:.25rem;' }, 'Feedback — incorrecto (opcional)'),
            el('input', {
              type: 'text',
              value: it.feedback_incorrect || '',
              placeholder: 'Mensaje al equivocarse',
              style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
              oninput: e => it.feedback_incorrect = e.target.value
            })
          ])
        ]),

        // MEDIA (optional)
        (function mediaBlock(){
          const block = el('div', { class: 'ex-media', style: 'border-top:1px dashed #e5e7eb;margin-top:.25rem;padding-top:.5rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem;' });

          const imgUrl = el('input', {
            type: 'text',
            value: it.image || '',
            placeholder: 'URL de imagen (opcional)',
            style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
            oninput: e => it.image = e.target.value
          });
          const imgAlt = el('input', {
            type: 'text',
            value: it.image_alt || '',
            placeholder: 'Texto alternativo de la imagen',
            style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
            oninput: e => it.image_alt = e.target.value
          });
          const audUrl = el('input', {
            type: 'text',
            value: it.audio || '',
            placeholder: 'URL de audio (opcional)',
            style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
            oninput: e => it.audio = e.target.value
          });
          const vidUrl = el('input', {
            type: 'text',
            value: it.video || '',
            placeholder: 'URL de video (opcional)',
            style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
            oninput: e => it.video = e.target.value
          });
          const ytUrl = el('input', {
            type: 'text',
            value: it.youtube_url || '',
            placeholder: 'URL de YouTube (opcional)',
            style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;',
            oninput: e => it.youtube_url = e.target.value
          });

          block.appendChild(el('label', {}, [
            el('span', { class: 'muted tiny', style:'display:block;margin-bottom:.25rem;' }, 'Imagen (URL)'),
            imgUrl
          ]));
          block.appendChild(el('label', {}, [
            el('span', { class: 'muted tiny', style:'display:block;margin-bottom:.25rem;' }, 'Alt de imagen'),
            imgAlt
          ]));
          block.appendChild(el('label', {}, [
            el('span', { class: 'muted tiny', style:'display:block;margin-bottom:.25rem;' }, 'Audio (URL)'),
            audUrl
          ]));
          block.appendChild(el('label', {}, [
            el('span', { class: 'muted tiny', style:'display:block;margin-bottom:.25rem;' }, 'Video (URL)'),
            vidUrl
          ]));
          block.appendChild(el('label', { style:'grid-column:1 / span 2;' }, [
            el('span', { class: 'muted tiny', style:'display:block;margin-bottom:.25rem;' }, 'YouTube (URL)'),
            ytUrl
          ]));

          return block;
        })()
      ]);
      itemsWrap.appendChild(card);
    });
  }

  function syncItemColumnOptions() {
    // Re-render items to refresh <select> with new column ids/labels
    renderItems();
  }

  // ---------- Adders ----------
  function addColumn(initial) {
    const next = initial || { id: '', label: '' };
    if (!next.id && next.label) next.id = slugify(next.label);
    columns.push(next);
    renderColumns();
    syncItemColumnOptions();
  }

  function addItem(initial) {
    const next = Object.assign({
      id: 'i' + (items.length + 1),
      text: '',
      correct_column: '',
      hint: '',
      feedback_correct: '',
      feedback_incorrect: '',
      // media fields (flat in builder; packed to media{} on save)
      image: '',
      image_alt: '',
      audio: '',
      video: '',
      youtube_url: ''
    }, initial || {});
    items.push(next);
    renderItems();
  }

  // ---------- Load edit data (if any) ----------
  function hydrateFromEdit() {
    if (!EDIT) return;
    try {
      // title + instructions (standard fields on the form)
      if (EDIT.title) form.querySelector('input[name="title"]').value = EDIT.title;
      if (EDIT.instructions) form.querySelector('textarea[name="instructions"]').value = EDIT.instructions;

      // columns/items/settings from saved payload
      if (Array.isArray(EDIT.columns)) columns = EDIT.columns.map(c => ({ id: c.id || slugify(c.label), label: c.label || c.id }));
      if (Array.isArray(EDIT.items)) {
        items = EDIT.items.map(it => {
          const m = it.media || {};
          return {
            id: it.id || ('i' + Math.random().toString(36).slice(2, 8)),
            text: it.text || '',
            correct_column: it.correct_column || '',
            hint: it.hint || '',
            feedback_correct: it.feedback_correct || '',
            feedback_incorrect: it.feedback_incorrect || '',
            image: m.image || '',
            image_alt: m.image_alt || '',
            audio: m.audio || '',
            video: m.video || '',
            youtube_url: m.youtube_url || ''
          };
        });
      }
      if (EDIT.settings) {
        setShuffle.checked = !!EDIT.settings.shuffle_items;
        setPartial.checked = !!EDIT.settings.allow_partial_submit;
        setHints.checked   = (EDIT.settings.show_hints !== false);
        if (typeof EDIT.settings.max_columns === 'number') setMaxCols.value = EDIT.settings.max_columns;
      }

      // --- NEW: hydrate exercise-level media (what browsers allow) ---
      if (EDIT.media) {
        if (mediaImageAlt && EDIT.media.image_alt) mediaImageAlt.value = EDIT.media.image_alt || '';
        if (mediaYouTube && EDIT.media.youtube_url) mediaYouTube.value = EDIT.media.youtube_url || '';

        // File inputs can't be set programmatically; show saved paths as placeholders if present.
        if (mediaImage && EDIT.media.image && !mediaImage.value) mediaImage.placeholder = EDIT.media.image;
        if (mediaAudio && EDIT.media.audio && !mediaAudio.value) mediaAudio.placeholder = EDIT.media.audio;
        if (mediaVideo && EDIT.media.video && !mediaVideo.value) mediaVideo.placeholder = EDIT.media.video;
      }
    } catch (e) {
      console.error('DND hydrate error:', e);
    }
  }

  // ---------- Validation & Serialization ----------
  function validate() {
    const title = form.querySelector('input[name="title"]').value.trim();
    if (!title) return { ok: false, msg: 'Falta el título.' };

    const cols = columns.filter(c => (c.label || '').trim());
    if (cols.length < 2) return { ok: false, msg: 'Agregá al menos 2 columnas.' };

    for (const c of cols) {
      c.id = slugify(c.id || c.label);
      if (!c.id) return { ok: false, msg: 'Cada columna necesita un id válido.' };
    }
    // duplicate id guard
    const ids = new Set();
    for (const c of cols) {
      if (ids.has(c.id)) return { ok: false, msg: `Ids de columna duplicados: ${c.id}` };
      ids.add(c.id);
    }

    if (items.length === 0) return { ok: false, msg: 'Agregá al menos 1 ítem.' };
    for (const it of items) {
      if (!it.text || !it.text.trim()) return { ok: false, msg: 'Cada ítem necesita texto.' };
      if (!it.correct_column) return { ok: false, msg: 'Cada ítem necesita una columna correcta.' };
      if (!ids.has(it.correct_column)) return { ok: false, msg: `Ítem apunta a columna inexistente: ${it.correct_column}` };
    }
    return { ok: true, cols };
  }

  function serialize() {
    const ok = validate();
    if (!ok.ok) throw new Error(ok.msg);

    const instructions = (form.querySelector('textarea[name="instructions"]').value || '').trim();

    // Build exercise-level media (client sends only text/url fields)
    // File inputs (image/audio/video) are uploaded via form-data; server will write final paths into JSON.
    const media = {};
    if (mediaImageAlt && mediaImageAlt.value.trim()) media.image_alt = mediaImageAlt.value.trim();
    if (mediaYouTube && mediaYouTube.value.trim())   media.youtube_url = mediaYouTube.value.trim();

    const data = {
      // NOTE: id is set on the server (slug from title) unless editing
      type: 'dnd_text',
      title: form.querySelector('input[name="title"]').value.trim(),
      instructions: instructions || undefined,
      media: Object.keys(media).length ? media : undefined,
      columns: ok.cols.map(c => ({ id: c.id, label: c.label })),
      items: items.map(it => {
        const media = {};
        if (it.image) media.image = it.image;
        if (it.image_alt) media.image_alt = it.image_alt;
        if (it.audio) media.audio = it.audio;
        if (it.video) media.video = it.video;
        if (it.youtube_url) media.youtube_url = it.youtube_url;

        const out = {
          id: it.id,
          text: it.text,
          correct_column: it.correct_column,
          hint: it.hint || undefined,
          feedback_correct: it.feedback_correct || undefined,
          feedback_incorrect: it.feedback_incorrect || undefined
        };
        if (Object.keys(media).length) out.media = media;
        return out;
      }),
      settings: {
        shuffle_items: !!setShuffle.checked,
        allow_partial_submit: !!setPartial.checked,
        show_hints: !!setHints.checked,
        max_columns: Math.max(2, Math.min(12, parseInt(setMaxCols.value || '6', 10) || 6))
      }
    };
    return data;
  }

  // ---------- Events ----------
  if (btnAddColumn) {
    btnAddColumn.addEventListener('click', () => {
      if (columns.length >= 12) return;
      addColumn({ id: '', label: '' });
    });
  }
  if (btnAddItem) {
    btnAddItem.addEventListener('click', () => addItem());
  }
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      // Close the builder modal (create/edit)
      if (builderModal) {
        builderModal.classList.remove('open');
        return;
      }
      // Else try preview modal
      if (window.PPAdminModal && typeof window.PPAdminModal.closePPModal === 'function') {
        window.PPAdminModal.closePPModal();
        return;
      }
      window.history.back();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); // prevent navigating to a JSON page
      // build the dynamic payload first
      try {
        const data = serialize();
        payloadEl.value = JSON.stringify({
          // Only put the dynamic payload here; server reads other form fields normally
          columns: data.columns,
          items: data.items,
          settings: data.settings
        });
      } catch (err) {
        alert(err.message || 'Hay errores en el formulario.');
        return;
      }

      // tiny toast helper (inline)
      function toast(msg, isErr) {
        let t = document.getElementById('pp-toast');
        if (!t) {
          t = document.createElement('div');
          t.id = 'pp-toast';
          t.style.cssText = 'position:fixed;right:16px;bottom:16px;padding:.6rem .8rem;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font:600 14px system-ui;display:none;z-index:9999';
          document.body.appendChild(t);
        }
        t.style.borderColor = isErr ? '#dc2626' : '#16a34a';
        t.style.boxShadow   = isErr ? '0 8px 30px rgba(220,38,38,.25)' : '0 8px 30px rgba(22,163,74,.25)';
        t.textContent = msg;
        t.style.display = 'block';
        setTimeout(()=>{ t.style.display = 'none'; }, 2000);
      }

      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
        const data = await res.json().catch(() => ({ success:false, error:'Respuesta inválida' }));
        if (data && data.success) {
          toast('✔️ Ejercicio guardado', false);
          // redirect to the library like other builders do
          setTimeout(() => {
            window.location.href = (window.PP_ADMIN_LIBRARY_URL || '/admin/exercises');
          }, 600);
        } else {
          toast('❌ ' + (data && data.error ? data.error : 'Error al guardar'), true);
        }
      } catch (err) {
        toast('❌ Error de red al guardar', true);
      }
    });
  }

  // ---------- Init ----------
  (function init() {
    // If creating new, start with two empty columns to guide the user
    if (!EDIT) {
      columns = [
        { id: 'col-1', label: 'Columna 1' },
        { id: 'col-2', label: 'Columna 2' }
      ];
      items = [];
    }
    hydrateFromEdit();
    renderAll();
  })();

  // ---------- Media toggle (capture + direct + delegated) + filename chips from existing media + delete markers ----------
  (function () {
    let wired = false;

    function setEnabled(button, on) {
      if (!button) return;
      button.disabled = !on;
      button.style.opacity = on ? '1' : '.6';
      button.style.pointerEvents = on ? 'auto' : 'none';
    }

    function doToggle(btn, box) {
      const open = (box.style.display !== 'none');
      box.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '+ Agregar media' : '– Ocultar media';
      btn.setAttribute('aria-expanded', String(!open));
    }

    function baseName(url) {
      try {
        const u = (url || '').split('?')[0].split('#')[0];
        return u.substring(u.lastIndexOf('/') + 1) || u;
      } catch (_) { return url || ''; }
    }

    function ensureHidden(name) {
      const f = document.getElementById('ex-dnd-form') || document.querySelector('#ex-dnd-form, form');
      if (!f) return null;
      let h = f.querySelector(`input[name="${name}"]`);
      if (!h) {
        h = document.createElement('input');
        h.type = 'hidden';
        h.name = name;
        f.appendChild(h);
      }
      return h;
    }

    function wireOnce() {
      if (wired) return;
      const box = document.getElementById('dnd-media-box');
      const btn = document.getElementById('dnd-media-toggle');
      if (!box || !btn) return; // try again later

      // start collapsed + button text
      box.style.display = 'none';
      btn.textContent = '+ Agregar media';
      btn.setAttribute('aria-expanded', 'false');

      // inputs & labels
      const imgInput = document.getElementById('dnd-media-image');
      const audInput = document.getElementById('dnd-media-audio');
      const vidInput = document.getElementById('dnd-media-video');
      const ytInput  = document.getElementById('dnd-media-youtube');

      const imgName  = document.getElementById('dnd-media-image-name');
      const audName  = document.getElementById('dnd-media-audio-name');
      const vidName  = document.getElementById('dnd-media-video-name');

      const imgClear = document.getElementById('dnd-media-image-clear');
      const audClear = document.getElementById('dnd-media-audio-clear');
      const vidClear = document.getElementById('dnd-media-video-clear');
      const ytClear  = document.getElementById('dnd-media-youtube-clear');

      // filename + clear wiring
      function wireFile(input, label, clearBtn, fieldKey) {
        if (!input || !label || !clearBtn) return;
        const update = () => {
          if (input.files && input.files.length > 0) {
            label.textContent = input.files[0].name;
            clearBtn.dataset.existing = ''; // now it's a new file, not existing
            setEnabled(clearBtn, true);
            // clear any delete marker for this field if present
            const del = document.querySelector(`input[name="media_${fieldKey}_delete"]`);
            if (del) del.value = '';
          } else if (clearBtn.dataset.existing) {
            // keep showing existing name until explicitly cleared
            setEnabled(clearBtn, true);
          } else {
            label.textContent = '';
            setEnabled(clearBtn, false);
          }
        };
        input.addEventListener('change', update);
        update();
      }

      function wireClear(clearBtn, targetEl, labelEl, fieldKey) {
        if (!clearBtn || !targetEl) return;
        clearBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          // If this was an existing file (no file chosen, just a stored one), mark delete
          if (clearBtn.dataset.existing) {
            const del = ensureHidden(`media_${fieldKey}_delete`);
            if (del) del.value = '1';
            clearBtn.dataset.existing = ''; // consumed
          }
          targetEl.value = '';
          if (labelEl) labelEl.textContent = '';
          setEnabled(clearBtn, false);
        });
      }

      // --- prefill filename chips from existing EDIT.media (if any) ---
      const EDIT_MEDIA = (typeof window !== 'undefined' && window.PP_DND_EDIT_EX && window.PP_DND_EDIT_EX.media) ? window.PP_DND_EDIT_EX.media : null;
      if (EDIT_MEDIA) {
        if (EDIT_MEDIA.image && imgName) {
          imgName.textContent = baseName(EDIT_MEDIA.image);
          if (imgClear) { imgClear.dataset.existing = '1'; setEnabled(imgClear, true); }
        }
        if (EDIT_MEDIA.audio && audName) {
          audName.textContent = baseName(EDIT_MEDIA.audio);
          if (audClear) { audClear.dataset.existing = '1'; setEnabled(audClear, true); }
        }
        if (EDIT_MEDIA.video && vidName) {
          vidName.textContent = baseName(EDIT_MEDIA.video);
          if (vidClear) { vidClear.dataset.existing = '1'; setEnabled(vidClear, true); }
        }
        if (EDIT_MEDIA.youtube_url && ytInput) {
          ytInput.value = EDIT_MEDIA.youtube_url || '';
          if (ytClear) setEnabled(ytClear, true);
        }
        // Alt text:
        if (EDIT_MEDIA.image_alt && document.querySelector('input[name="media_image_alt"]')) {
          document.querySelector('input[name="media_image_alt"]').value = EDIT_MEDIA.image_alt;
        }
      }

      // bind file & clear behaviors (field keys: image, audio, video, youtube)
      wireFile(imgInput, imgName, imgClear, 'image');
      wireFile(audInput, audName, audClear, 'audio');
      wireFile(vidInput, vidName, vidClear, 'video');

      // youtube url: enable clear only when there is a value; also support delete marker
      if (ytInput && ytClear) {
        const updateYT = () => {
          const has = !!ytInput.value.trim();
          setEnabled(ytClear, has || !!ytClear.dataset.existing);
          if (!has && ytClear.dataset.existing) {
            // nothing typed but there is an existing url: keep enabled until cleared
            setEnabled(ytClear, true);
          }
        };
        ytInput.addEventListener('input', () => {
          // user typed a new URL; clear delete marker if any
          const del = document.querySelector('input[name="media_youtube_delete"]');
          if (del) del.value = '';
          ytClear.dataset.existing = '';
          updateYT();
        });
        // prefill existing youtube state
        if (EDIT_MEDIA && EDIT_MEDIA.youtube_url) {
          ytClear.dataset.existing = '1';
        }
        // clear wiring
        ytClear.addEventListener('click', (ev) => {
          ev.preventDefault();
          if (ytClear.dataset.existing) {
            const del = ensureHidden('media_youtube_delete');
            if (del) del.value = '1';
            ytClear.dataset.existing = '';
          }
          ytInput.value = '';
          setEnabled(ytClear, false);
        });
        updateYT();
      }

      // also wire clears for files (after prefill so initial state is respected)
      wireClear(imgClear, imgInput, imgName, 'image');
      wireClear(audClear, audInput, audName, 'audio');
      wireClear(vidClear, vidInput, vidName, 'video');

      // direct bind on the button (bypasses stopPropagation in parents)
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        doToggle(btn, box);
      }, true); // CAPTURE PHASE

      wired = true;
    }

    // Delegated fallback (click anywhere in the doc; handles re-renders)
    document.addEventListener('click', function (e) {
      const hit = e.target && e.target.closest ? e.target.closest('#dnd-media-toggle') : null;
      if (!hit) return;

      wireOnce();
      const box = document.getElementById('dnd-media-box');
      const btn = document.getElementById('dnd-media-toggle');
      if (!box || !btn) return;

      e.preventDefault();
      doToggle(btn, box);
    }, true); // CAPTURE PHASE

    // Try wiring on DOM ready too
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireOnce, { once: true });
    } else {
      wireOnce();
    }
  })();

})();