// static/js/admin/builder_dictation.js
(function () {
  'use strict';

  // ---- DOM refs ----
  const itemsList  = document.getElementById('dictationItemsList');
  const btnAdd     = document.getElementById('btnAddDictationItem');
  const form       = document.getElementById('ex-dictation-form');
  const payload    = document.getElementById('dictationItemsPayload');

  const optCase    = document.getElementById('optCaseSensitive');
  const optPunct   = document.getElementById('optPunctSensitive');
  const optAccent  = document.getElementById('optAccentSensitive');

  const btnCancel  = document.getElementById('btnCancelDictation');

  // Modal bits (Admin exercises modal)
  const modal         = document.getElementById('ex-modal');
  const modalClose    = document.getElementById('ex-modal-close');
  const modalBackdrop = document.getElementById('ex-modal-backdrop');

  if (!form || !itemsList || !btnAdd || !payload) {
    console.error('Dictation builder: missing required elements.');
    return;
  }

  // ---- tiny helper to create elements ----
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'style') node.setAttribute('style', v);
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  // ---- accents helper (insert into a specific textarea) ----
  function makeAccentBar(targetTextarea) {
    const bar = el('div', { class: 'pp-accentbar', style: 'display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.25rem;' });
    const chars = ['á','é','í','ó','ú','ü','ö','¿','¡'];
    chars.forEach(ch => {
      const b = el('button', {
        type: 'button',
        class: 'accent-btn',
        style: 'padding:.3rem .55rem;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;cursor:pointer;font-size:1rem;'
      }, ch);
      b.dataset.ch = ch;
      b.addEventListener('click', () => {
        const ta = targetTextarea;
        const start = ta.selectionStart || 0;
        const end   = ta.selectionEnd   || 0;
        const val   = ta.value || '';
        ta.value = val.slice(0, start) + ch + val.slice(end);
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + ch.length;
        ta.dispatchEvent(new Event('input'));
      });
      bar.appendChild(b);
    });
    return bar;
  }

  // ---- per-item card ----
  function itemCard(idx) {
    const wrap = el('div', { class: 'dict-item', style: 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;' });
    wrap._rm = { audio:false, video:false, yt:false }; // track deletes (if needed later)

    const header = el('div', { style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;' });
    header.appendChild(el('div', { class:'muted' }, [`Ítem #${idx+1}`]));
    const btnDel = el('button', { type:'button', class:'btn tiny' }, 'Eliminar');
    btnDel.addEventListener('click', ()=>{ wrap.remove(); isDirty = true; renumber(); });
    header.appendChild(btnDel);

    // ===== Media (no image for dictation) =====
    const mediaBlock = el('div', { style:'border:1px dashed #d1d5db;border-radius:8px;padding:.5rem;margin:.25rem 0 .6rem;background:#f8fafc;' });
    const mediaHdr   = el('div', { style:'display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.25rem;' });
    const mediaTitle = el('div', { class:'muted', style:'font-weight:600;display:flex;align-items:center;gap:.4rem;' }, '🎧/🎬 Media (opcional)');
    const btnToggle  = el('button', { type:'button', class:'btn tiny', style:'padding:.3rem .55rem;border-radius:999px;' }, '+ Agregar media');
    mediaHdr.appendChild(mediaTitle); mediaHdr.appendChild(btnToggle);

    const mediaInner = el('div', { style:'display:none;border-top:1px dashed #d1d5db;margin-top:.4rem;padding-top:.5rem;' });

    // align uploads by index with server expectations
    const mediaIndex = el('input', { type:'hidden', name:'media_index[]', value:String(idx) });

    // Audio
    const audRow = el('div', { class:'row', style:'gap:.5rem;align-items:center;margin:.25rem 0;' }, [
      el('label', { class:'muted', style:'min-width:90px;' }, 'Audio'),
      el('input', { type:'file', accept:'audio/*', name:'media_audio[]' }),
      el('small', { class:'muted', style:'margin-left:.25rem;' }, '(MP3, WAV, etc.)')
    ]);

    // Video
    const vidRow = el('div', { class:'row', style:'gap:.5rem;align-items:center;margin:.25rem 0;' }, [
      el('label', { class:'muted', style:'min-width:90px;' }, 'Video'),
      el('input', { type:'file', accept:'video/*', name:'media_video[]' }),
      el('small', { class:'muted', style:'margin-left:.25rem;' }, '(MP4, WebM, etc.)')
    ]);

    // YouTube
    const ytRow = el('div', { class:'row', style:'gap:.5rem;align-items:center;margin:.25rem 0;' }, [
      el('label', { class:'muted', style:'min-width:90px;' }, 'YouTube'),
      el('input', { type:'url', placeholder:'https://www.youtube.com/watch?v=...', name:'media_youtube_url[]',
                    style:'flex:1;padding:.45rem;border:1px solid #cbd5e1;border-radius:8px;' })
    ]);

    mediaInner.appendChild(mediaIndex);
    mediaInner.appendChild(audRow);
    mediaInner.appendChild(vidRow);
    mediaInner.appendChild(ytRow);
    mediaBlock.appendChild(mediaHdr);
    mediaBlock.appendChild(mediaInner);

    // Open media section by default so Audio/Video/YouTube are visible immediately
    mediaInner.style.display = 'block';
    btnToggle.textContent = '− Ocultar media';

    btnToggle.addEventListener('click', ()=>{
      const open = mediaInner.style.display !== 'none';
      mediaInner.style.display = open ? 'none' : 'block';
      btnToggle.textContent = open ? '+ Agregar media' : '− Ocultar media';
    });

    // ===== Answers (supports alternatives as an array; one per line) =====
    const answersLabel = el('label', {}, [
      el('strong', {}, 'Respuestas correctas (una por línea)'),
    ]);
    const answers = el('textarea', {
      placeholder:'Escribí la respuesta exacta.\nPodés agregar alternativas en nuevas líneas.',
      rows:'2',
      style:'width:100%;padding:.6rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;'
    });
    answersLabel.appendChild(answers);

    // Optional hint
    const hintLabel = el('label', { style:'display:block;margin-top:.25rem;' }, [
      el('strong', {}, 'Pista (opcional)'),
    ]);
    const hint = el('textarea', {
      placeholder:'Texto de ayuda (mostrado al estudiante si presiona “Pista”).',
      rows:'2',
      style:'width:100%;padding:.6rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;'
    });
    hintLabel.appendChild(hint);

    // assemble card
    wrap.appendChild(header);
    wrap.appendChild(mediaBlock);
    wrap.appendChild(answersLabel);
    wrap.appendChild(hintLabel);

    // getter to serialize this card
    wrap._get = function () {
      // multi-answers: split by line, trim, drop empties, dedupe
      const list = (answers.value || '')
        .split(/\r?\n/)
        .map(s => (s || '').trim())
        .filter(Boolean);

      const dedup = Array.from(new Set(list));
      const hasAny = dedup.length > 0;

      // Existing media paths (if prefilling in edit) can be stored on the element:
      const m = wrap._existingMedia || {};
      // Inputs for fresh uploads/yt url
      const ytInput  = wrap.querySelector('input[name="media_youtube_url[]"]');
      const audInput = wrap.querySelector('input[name="media_audio[]"]');
      const vidInput = wrap.querySelector('input[name="media_video[]"]');

      const youtube_url = (ytInput && ytInput.value || '').trim() || (m.youtube_url || null);
      const audio       = (audInput && audInput.files && audInput.files.length ? '__UPLOAD__' : (m.audio || null));
      const video       = (vidInput && vidInput.files && vidInput.files.length ? '__UPLOAD__' : (m.video || null));

      return {
        // student sees media only; prompt not used for dictation
        answer: hasAny ? (dedup.length === 1 ? dedup[0] : dedup) : null,
        hint: (hint.value || '').trim() || null,
        media: { youtube_url, audio, video }
      };
    };

    // expose for prefill
    wrap._refs = { btnToggle, mediaInner, answers, hint };

    return wrap;
  }

  // ---- dirty + renumber ----
  let isDirty = false;
  form.addEventListener('input', ()=>{ isDirty = true; });
  btnAdd.addEventListener('click', ()=>{ isDirty = true; });

  function renumber() {
    const cards = [...itemsList.querySelectorAll('.dict-item')];
    cards.forEach((c, i) => {
      const title = c.querySelector('.muted');
      if (title) title.textContent = `Ítem #${i + 1}`;
      const idxHidden = c.querySelector('input[name="media_index[]"]');
      if (idxHidden) idxHidden.value = String(i);
    });
  }

  // ---- add item button ----
  btnAdd.addEventListener('click', ()=>{
    const idx = itemsList.querySelectorAll('.dict-item').length;
    const card = itemCard(idx);
    itemsList.appendChild(card);
    renumber();
  });

  // ---- prefill when editing ----
  // Expecting the template to set: window.PP_DICT_EDIT_EX (mirrors TF/MCQ/Cloze patterns)
  const ex = (typeof window !== 'undefined') ? window.PP_DICT_EDIT_EX : null;

  if (ex && ex.title) {
    const t = form.querySelector('input[name="title"]');
    if (t) t.value = ex.title;
  }
  if (ex && typeof ex.instructions === 'string' && ex.instructions.trim() !== '') {
    const instrField = form.querySelector('textarea[name="instructions"]');
    if (instrField) instrField.value = ex.instructions;
  }
  if (ex && ex.settings && typeof ex.settings === 'object') {
    // default false when not present
    if (optCase)   optCase.checked   = !!ex.settings.case_sensitive;
    if (optPunct)  optPunct.checked  = !!ex.settings.punctuation_sensitive;
    if (optAccent) optAccent.checked = !!ex.settings.accent_sensitive;
  }

  if (ex && Array.isArray(ex.items) && ex.items.length) {
    ex.items.forEach((it, idx) => {
      const card = itemCard(idx);
      itemsList.appendChild(card);

      // answers (support string or array)
      if (Array.isArray(it.answer)) {
        card._refs.answers.value = it.answer.join('\n');
      } else if (typeof it.answer === 'string') {
        card._refs.answers.value = it.answer;
      }
      if (it.hint) card._refs.hint.value = it.hint;

      // media prefill: keep existing paths used by _get()
      const m = (it.media && typeof it.media === 'object') ? it.media : it;
      card._existingMedia = {
        audio: m.audio || it.audio || null,
        video: m.video || it.video || null,
        youtube_url: m.youtube_url || it.youtube_url || null
      };

      // write YT input
      const ytInput = card.querySelector('input[name="media_youtube_url[]"]');
      if (ytInput) ytInput.value = card._existingMedia.youtube_url || '';

      // open media section if anything present
      const refs = card._refs || {};
      if ((card._existingMedia.audio || card._existingMedia.video || card._existingMedia.youtube_url) && refs.mediaInner) {
        refs.mediaInner.style.display = 'block';
        if (refs.btnToggle) refs.btnToggle.textContent = '− Ocultar media';
      }
    });
    renumber();
  } else {
    // seed with one empty item
    btnAdd.click();
  }

  // ---- cancel behavior ----
  function closeModalIfAny() {
    if (!modal) return false;
    modal.classList.remove('open');
    if (window.history && window.history.replaceState) {
      try { window.history.replaceState({}, document.title, window.location.pathname); } catch(_e) {}
    }
    if (modalClose) modalClose.removeEventListener('click', closeModalIfAny);
    if (modalBackdrop) modalBackdrop.removeEventListener('click', closeModalIfAny);
    return true;
  }
  if (btnCancel) {
    btnCancel.addEventListener('click', ()=>{
      if (!closeModalIfAny()) {
        // go back to library (same pattern as other builders)
        const back = (window.PP_ADMIN_LIBRARY_URL || '/admin/exercises');
        window.location.href = back;
      }
    });
  }
  if (modalClose)    modalClose.addEventListener('click', closeModalIfAny);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModalIfAny);

  // ---- toast helper ----
  function showToast(msg, isErr){
    let t = document.getElementById('pp-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pp-toast';
      t.setAttribute('style','position:fixed;bottom:16px;right:16px;padding:.6rem .8rem;border:2px solid #16a34a;border-radius:10px;background:#ecfdf5;box-shadow:0 8px 30px rgba(0,0,0,.12);color:#0f172a;font:14px/1.2 system-ui;display:none;z-index:99999;');
      document.body.appendChild(t);
    }
    t.style.borderColor = isErr ? '#dc2626' : '#16a34a';
    t.style.boxShadow   = isErr ? '0 8px 30px rgba(220,38,38,.25)' : '0 8px 30px rgba(22,163,74,.25)';
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(()=>{ t.style.display = 'none'; }, 2000);
  }

  // ---- submit: serialize items + settings, POST via fetch ----
  form.addEventListener('submit', async (e)=>{
    const cards = [...itemsList.querySelectorAll('.dict-item')];
    const items = cards.map(c => c._get()).filter(it => {
      const hasAns = (typeof it.answer === 'string' && it.answer.trim() !== '') ||
                     (Array.isArray(it.answer) && it.answer.length > 0);
      const hasMedia = !!(it.media && (it.media.audio || it.media.video || it.media.youtube_url));
      return hasAns && hasMedia; // require at least one media and one answer
    });

    if (!items.length) {
      e.preventDefault();
      alert('Agregá al menos 1 ítem con media (audio/video/YouTube) y una respuesta.');
      return;
    }

    const settings = {
      case_sensitive: !!(optCase && optCase.checked),
      punctuation_sensitive: !!(optPunct && optPunct.checked),
      accent_sensitive: !!(optAccent && optAccent.checked),
      // whitespace policy: we trim user input on evaluation regardless (recommended for dictation)
      trim_user_input: true
    };

    // Put items+settings into a single object so server can unpack
    payload.value = JSON.stringify({ items, settings });

    // Intercept submit → POST via fetch for consistent UX
    e.preventDefault();
    try {
      const res  = await fetch(form.action, { method:'POST', body:new FormData(form) });
      const data = await res.json().catch(()=>({ success:false, error:'Respuesta inválida' }));
      if (data && data.success) {
        showToast('✔️ Ejercicio guardado', false);
        setTimeout(()=>{ window.location.href = (window.PP_ADMIN_LIBRARY_URL || '/admin/exercises'); }, 350);
      } else {
        showToast('❌ Error al guardar', true);
        console.error('Save error:', data);
      }
    } catch (err) {
      showToast('❌ Error de red', true);
      console.error(err);
    }
  });

})();