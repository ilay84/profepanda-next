// static/js/admin/builder_mcq.js
(function () {
  'use strict';

  const itemsList   = document.getElementById('itemsList');
  const btnAdd      = document.getElementById('btnAddItem');
  const form        = document.getElementById('ex-mcq-form');
  const payload     = document.getElementById('itemsPayload');
  const btnCancel   = document.getElementById('btnCancel');
  const modal       = document.getElementById('ex-modal');
  const modalClose  = document.getElementById('ex-modal-close');
  const modalBackdrop = document.getElementById('ex-modal-backdrop');

  if (!form || !itemsList || !btnAdd || !payload) {
    console.error('MCQ builder: missing required elements.');
    return;
  }

  // ---------- tiny helper ----------
  function el(tag, attrs={}, children=[]) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if (k === 'class') node.className = v;
      else if (k === 'style') node.setAttribute('style', v);
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c=>{
      if (c == null) return;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  // ---------- MCQ item card ----------
  function mcqItemCard(idx) {
    const wrap = el('div', { class: 'mcq-item', style: 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.5rem;' });
    wrap._rm = { image:false, audio:false, video:false, yt:false, alt:false };

    // header
    const header = el('div', { style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem;' });
    header.appendChild(el('div', { class:'muted' }, `Pregunta #${idx+1}`));
    const btnDel = el('button', { type:'button', class:'btn tiny' }, 'Eliminar');
    btnDel.addEventListener('click', () => { wrap.remove(); isDirty = true; renumber(); _autoPreview(); });
    header.appendChild(btnDel);
    wrap.appendChild(header);

    // MEDIA block (same pattern as TF)
    const mediaBlock = el('div', { class:'mcq-media', style:'border:1px dashed #cbd5e1;border-radius:12px;padding:.5rem;background:#f8fafc;' });
    const hdr = el('div', { style:'display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.25rem;' });
    hdr.appendChild(el('div', { class:'muted', style:'font-weight:700;letter-spacing:.2px;display:flex;align-items:center;gap:.4rem;' }, '🖼️🎧 Media (opcional)'));
    const btnToggle = el('button', { type:'button', class:'btn tiny', style:'padding:.3rem .55rem;border-radius:999px;' }, '+ Agregar media');
    hdr.appendChild(btnToggle);
    const mediaInner = el('div', { style:'display:none;border-top:1px dashed #d1d5db;margin-top:.4rem;padding-top:.5rem;' });

    const mediaIndex = el('input', { type:'hidden', name:'media_index[]', value:String(idx) });

    // Row 1: Image + alt
    const rowImg = el('div', { style:'display:grid;grid-template-columns: 1fr 1fr;gap:.6rem;align-items:start;' });
    const imgWrap = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
    imgWrap.appendChild(el('label', { class:'tiny muted' }, '📷 Imagen'));
    const imgCtl = el('div', { style:'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
    const imgBtn = el('label', { style:'display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .65rem;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:.9rem;line-height:1;' }, 'Elegir archivo');
    const imgInput = el('input', { type:'file', name:'media_image[]', accept:'image/*', style:'display:none;' });
    imgBtn.appendChild(imgInput);
    const imgName = el('span', { class:'tiny muted' }, '');
    const imgDel  = el('button', { type:'button', class:'btn tiny', style:'padding:.25rem .5rem;' }, 'Quitar');
    imgCtl.appendChild(imgBtn); imgCtl.appendChild(imgName); imgCtl.appendChild(imgDel);
    imgWrap.appendChild(imgCtl);

    const altWrap = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
    altWrap.appendChild(el('label', { class:'tiny muted' }, '🔤 Alt text (para lectores de pantalla)'));
    const imgAlt = el('input', { type:'text', name:'media_image_alt[]', placeholder:'Breve descripción de la imagen', style:'padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;width:100%;' });
    altWrap.appendChild(imgAlt);

    rowImg.appendChild(imgWrap);
    rowImg.appendChild(altWrap);

    // Row 2: Audio
    const rowAud = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;margin-top:.4rem;' });
    rowAud.appendChild(el('label', { class:'tiny muted' }, '🎤 Audio'));
    const audCtl = el('div', { style:'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
    const audBtn = el('label', { style:'display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .65rem;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:.9rem;line-height:1;' }, 'Elegir archivo');
    const audInput = el('input', { type:'file', name:'media_audio[]', accept:'audio/*', style:'display:none;' });
    audBtn.appendChild(audInput);
    const audName = el('span', { class:'tiny muted' }, '');
    const audDel  = el('button', { type:'button', class:'btn tiny', style:'padding:.25rem .5rem;' }, 'Quitar');
    audCtl.appendChild(audBtn); audCtl.appendChild(audName); audCtl.appendChild(audDel);
    rowAud.appendChild(audCtl);

    // Row 3: Video + YouTube
    const rowVid = el('div', { style:'display:grid;grid-template-columns: 1fr 1fr;gap:.6rem;align-items:start;margin-top:.4rem;' });

    const vidWrap = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
    vidWrap.appendChild(el('label', { class:'tiny muted' }, '🎬 Video (archivo)'));
    const vidCtl = el('div', { style:'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
    const vidBtn = el('label', { style:'display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .65rem;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:.9rem;line-height:1;' }, 'Elegir archivo');
    const vidInput = el('input', { type:'file', name:'media_video[]', accept:'video/*', style:'display:none;' });
    vidBtn.appendChild(vidInput);
    const vidName = el('span', { class:'tiny muted' }, '');
    const vidDel  = el('button', { type:'button', class:'btn tiny', style:'padding:.25rem .5rem;' }, 'Quitar');
    vidCtl.appendChild(vidBtn); vidCtl.appendChild(vidName); vidCtl.appendChild(vidDel);
    vidWrap.appendChild(vidCtl);

    const ytWrap = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
    ytWrap.appendChild(el('label', { class:'tiny muted' }, '🔗 YouTube URL'));
    const ytRow = el('div', { style:'display:flex;gap:.5rem;align-items:center;' });
    const ytInput = el('input', { type:'url', name:'media_youtube_url[]', placeholder:'https://www.youtube.com/watch?v=…', style:'flex:1;padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;' });
    const ytDel   = el('button', { type:'button', class:'btn tiny', style:'padding:.25rem .5rem;white-space:nowrap;' }, 'Borrar');
    ytRow.appendChild(ytInput); ytRow.appendChild(ytDel);
    ytWrap.appendChild(ytRow);

    rowVid.appendChild(vidWrap);
    rowVid.appendChild(ytWrap);

    // filenames + deletes
    imgInput.addEventListener('change', ()=>{ imgName.textContent = imgInput.files[0]?.name || ''; wrap._rm.image = false; });
    imgDel.addEventListener('click', (e)=>{ e.preventDefault(); const dt=new DataTransfer(); imgInput.files=dt.files; imgName.textContent=''; wrap._rm.image=true; if (wrap._existingMedia) wrap._existingMedia.image=null; });
    audInput.addEventListener('change', ()=>{ audName.textContent = audInput.files[0]?.name || ''; wrap._rm.audio = false; });
    audDel.addEventListener('click', ()=>{ wrap._rm.audio = true; audInput.value=''; audName.textContent='(eliminado)'; });
    vidInput.addEventListener('change', ()=>{ vidName.textContent = vidInput.files[0]?.name || ''; wrap._rm.video = false; });
    vidDel.addEventListener('click', ()=>{ wrap._rm.video = true; vidInput.value=''; vidName.textContent='(eliminado)'; });
    ytDel.addEventListener('click', ()=>{ wrap._rm.yt = true; ytInput.value=''; ytInput.dispatchEvent(new Event('input')); });

    // YT simple validation
    ytInput.addEventListener('input', ()=>{
      let ok = true;
      const v = ytInput.value.trim();
      if (v) {
        try {
          const u = new URL(v);
          const host = u.hostname.replace(/^www\./,'');
          ok = (host === 'youtube.com' || host === 'youtu.be');
        } catch(_){ ok = false; }
      }
      ytInput.style.borderColor = ok ? '#cbd5e1' : '#dc2626';
    });

    // collapse toggle
    let open = false;
    btnToggle.addEventListener('click', ()=>{
      open = !open;
      mediaInner.style.display = open ? 'block' : 'none';
      btnToggle.textContent = open ? '− Ocultar media' : '+ Agregar media';
    });

    // assemble media
    mediaInner.appendChild(rowImg);
    mediaInner.appendChild(rowAud);
    mediaInner.appendChild(rowVid);
    mediaInner.appendChild(el('div', { class:'tiny muted', style:'margin-top:.4rem;' }, 'Formatos soportados: JPG/PNG, MP3, MP4. Podés arrastrar archivos a esta caja.'));
    mediaInner.appendChild(mediaIndex);
    mediaBlock.appendChild(hdr);
    mediaBlock.appendChild(mediaInner);
    wrap.appendChild(mediaBlock);

    // PROMPT
    const prompt = el('textarea', { placeholder:'Enunciado de la pregunta…', rows:'2', style:'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;' });
    wrap.appendChild(prompt);

    // CHOICES (A-D) — with per-option feedback + indicator pill
    const choicesWrap = el('div', { style:'display:flex;flex-direction:column;gap:.4rem;' });
    choicesWrap.appendChild(el('div', { class:'muted' }, 'Opciones'));
    const opts = [];
    const letters = ['A','B','C','D'];
    letters.forEach((L,i)=>{
      // Row: label+radio + option text
      const row = el('div', { style:'display:grid;grid-template-columns: 140px 1fr; gap:.6rem; align-items:center; margin:.4rem 0;' });
      const lab = el('label', { class:'tiny muted', style:'display:flex;align-items:center;gap:.4rem;' });
      const radio = el('input', { type:'radio', name:`ans-${idx}-${Date.now()}`, value:L, style:'transform:translateY(1px);' });
      lab.appendChild(radio);
      lab.appendChild(el('span', {}, `Correcta`));
      const input = el('input', { type:'text', placeholder:`Opción ${L}`, style:'padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;width:100%;' });
      row.appendChild(lab);
      row.appendChild(input);

      // Indicator row (shows only when this option has feedback)
      const indRow = el('div', { style:'display:grid;grid-template-columns: 140px 1fr; gap:.6rem; align-items:center; margin:-.25rem 0 .1rem;' });
      indRow.appendChild(el('div', {}, '')); // spacer
      const fbBadge = el('span', {
        class:'tiny',
        style:'display:none;width:max-content;padding:.15rem .55rem;border:1px solid #e2e8f0;border-radius:999px;background:#f1f5f9;color:#475569;'
      }, '💬 Con feedback');
      indRow.appendChild(fbBadge);

      // Row (feedback for this option): label spacer + small textarea
      const fbRow = el('div', { style:'display:grid;grid-template-columns: 140px 1fr; gap:.6rem; align-items:start; margin:-.1rem 0 .4rem;' });
      fbRow.appendChild(el('div', {}, '')); // spacer under the radio
      const fb = el('textarea', {
        rows: '1',
        placeholder: '💬 Feedback si eligen esta opción (opcional)',
        style:'padding:.4rem .55rem;border:1px solid #cbd5e1;border-radius:8px;width:100%;min-height:2.25rem;resize:vertical;'
      });
      // Live toggle of the badge based on textarea content
      fb.addEventListener('input', () => {
        const has = !!fb.value.trim();
        fbBadge.style.display = has ? 'inline-block' : 'none';
      });
      fbRow.appendChild(fb);

      choicesWrap.appendChild(row);
      choicesWrap.appendChild(indRow);
      choicesWrap.appendChild(fbRow);

      opts.push({ radio, input, fb, fbBadge, key:L });
    });
    wrap.appendChild(choicesWrap);

    // HINT ONLY (per-choice feedback lives under each option now)
    const hint = el('textarea', { placeholder:'Pista (opcional; si hay pista, el botón “Ver pista” aparecerá)', rows:'2', style:'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;' });
    wrap.appendChild(hint);

    // getter
    wrap._existingMedia = wrap._existingMedia || {};
    wrap._get = () => {
      const mprev = wrap._existingMedia || {};
      const hasImg = !!(imgInput.files && imgInput.files.length);
      const hasAud = !!(audInput.files && audInput.files.length);
      const hasVid = !!(vidInput.files && vidInput.files.length);
      const ytVal  = (ytInput.value || '').trim();
      const altVal = (imgAlt.value || '').trim();

      const image = wrap._rm.image ? '__DELETE__' : hasImg ? '__UPLOAD__' : (mprev.image || null);
      const audio = wrap._rm.audio ? '__DELETE__' : hasAud ? '__UPLOAD__' : (mprev.audio || null);
      const video = wrap._rm.video ? '__DELETE__' : hasVid ? '__UPLOAD__' : (mprev.video || null);
      const youtube_url = wrap._rm.yt ? '__DELETE__' : (ytVal || mprev.youtube_url || null);
      const image_alt   = wrap._rm.alt ? '__DELETE__' : (altVal || mprev.image_alt || null);

      const choices = opts.map(o => ({
        key: o.key,
        text: (o.input.value || '').trim(),
        feedback: (o.fb && o.fb.value ? o.fb.value.trim() : '') || null
      })).filter(c => c.text); // drop empties

      const picked = opts.find(o => o.radio.checked);
      const answer = picked ? picked.key : null;

      return {
        prompt: (prompt.value || '').trim(),
        choices,
        answer,
        hint: (hint.value || '').trim() || null,
        media: { youtube_url, image, image_alt: altVal, audio, video }
      };
    };

    // refs for prefill
    wrap._refs = { btnToggle, mediaInner, imgInput, audInput, vidInput, imgName, audName, vidName, ytInput, imgAlt, opts };
    return wrap;
  }

  // ---------- form plumbing ----------
  let isDirty = false;
  form.addEventListener('input', ()=>{ isDirty = true; });
  btnAdd.addEventListener('click', ()=>{ isDirty = true; });

  function renumber(){
    [...itemsList.querySelectorAll('.mcq-item')].forEach((c,i)=>{
      const title = c.querySelector('.muted');
      if (title) title.textContent = `Pregunta #${i+1}`;
      const idxHidden = c.querySelector('input[name="media_index[]"]');
      if (idxHidden) idxHidden.value = String(i);
    });
  }

  btnAdd.addEventListener('click', ()=>{
    const idx = itemsList.querySelectorAll('.mcq-item').length;
    itemsList.appendChild(mcqItemCard(idx));
    renumber();
    togglePreview(true);
    refreshPreview();
  });

  // Prefill from template global or seed one empty
  const ex = (typeof window !== 'undefined') ? window.PP_MCQ_EDIT_EX : null;
  if (ex && ex.title) {
    form.querySelector('input[name=title]').value = ex.title;
  }
  // NEW: prefill optional instructions
  if (ex && typeof ex.instructions === 'string' && ex.instructions.trim() !== '') {
    const instrField = form.querySelector('textarea[name="instructions"]');
    if (instrField) instrField.value = ex.instructions;
  }
  if (ex && Array.isArray(ex.items) && ex.items.length) {
    ex.items.forEach((it, idx) => {
      const card = mcqItemCard(idx);
      itemsList.appendChild(card);

      // prompt
      card.querySelector('textarea').value = it.prompt || '';

    // choices
    const refs = card._refs || {};
    const opts = refs.opts || [];
    const choices = Array.isArray(it.choices) ? it.choices : [];
    choices.forEach((c, i) => {
      if (opts[i]) opts[i].input.value = c.text || c.label || c.html || '';
      if (opts[i] && opts[i].fb) {
        opts[i].fb.value = c.feedback || '';
        const has = !!(c && c.feedback && String(c.feedback).trim());
        if (opts[i].fbBadge) opts[i].fbBadge.style.display = has ? 'inline-block' : 'none';
      }
    });

      // answer
      const ans = (it.answer || '').toString().trim().toUpperCase();
      const hit = opts.find(o => o.key === ans);
      if (hit) hit.radio.checked = true;

      // media existing
      const m = (it.media && typeof it.media === 'object') ? it.media : it;
      card._existingMedia = {
        image:       m.image || it.image || null,
        audio:       m.audio || it.audio || null,
        video:       m.video || it.video || it.video_mp4 || null,
        youtube_url: m.youtube_url || it.youtube || it.video_iframe || null,
        image_alt:   m.image_alt || it.image_alt || it.image_caption || null
      };

      // write yt/alt
      if (refs.ytInput) refs.ytInput.value = card._existingMedia.youtube_url || '';
      if (refs.imgAlt)  refs.imgAlt.value  = card._existingMedia.image_alt || '';

      // show names + open media section if existing
      const base = (p) => p ? String(p).split('/').pop() : '';
      if (refs.imgName && card._existingMedia.image) refs.imgName.textContent = base(card._existingMedia.image);
      if (refs.audName && card._existingMedia.audio) refs.audName.textContent = base(card._existingMedia.audio);
      if (refs.vidName && card._existingMedia.video) refs.vidName.textContent = base(card._existingMedia.video);
      if ((card._existingMedia.image || card._existingMedia.audio || card._existingMedia.video || card._existingMedia.youtube_url) && refs.mediaInner) {
        refs.mediaInner.style.display = 'block';
        if (refs.btnToggle) refs.btnToggle.textContent = '− Ocultar media';
      }
    });
    renumber();
  } else {
    btnAdd.click();
  }

  // close modal
  function closeModal(){
    if (!modal) return;
    modal.classList.remove('open');
    if (window.history && window.history.replaceState) {
      const url = new URL(window.location);
      url.searchParams.delete('type');
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }
  if (btnCancel) btnCancel.addEventListener('click', ()=>{ if (isDirty && !confirm('¿Descartar cambios no guardados?')) return; closeModal(); });
  if (modalClose) modalClose.addEventListener('click', ()=>{ if (isDirty && !confirm('¿Descartar cambios no guardados?')) return; closeModal(); });
  if (modalBackdrop) modalBackdrop.addEventListener('click', ()=>{ if (isDirty && !confirm('¿Descartar cambios no guardados?')) return; closeModal(); });

  // ---------- Inline preview (DISABLED) ----------
  // The inline builder preview has been removed for MCQ.
  // We keep no-op stubs so existing calls (togglePreview, refreshPreview, _autoPreview) don't error.

  function ensurePreviewPanel(){ /* preview removed */ }
  function togglePreview(){ /* no-op */ }
  function refreshPreview(){ /* no-op */ }

  // No-op throttle and handler used by existing listeners
  function _throttle(fn, wait){ return function(){ /* no-op */ }; }
  const _autoPreview = function(){ /* no-op */ };

  // ---------- submit ----------
  form.addEventListener('submit', async (e)=>{
    // collect items
    const cards = [...itemsList.querySelectorAll('.mcq-item')];
    const items = cards.map(c => c._get()).filter(it => (it.prompt && Array.isArray(it.choices) && it.choices.length && it.answer));
    if (!items.length) {
      e.preventDefault();
      alert('Agregá al menos 1 pregunta con opciones y marcá la respuesta correcta.');
      return;
    }
    payload.value = JSON.stringify(items);

    // intercept and POST via fetch to keep UX consistent with TF
    e.preventDefault();

    function showToast(msg, isErr){
      let t = document.getElementById('pp-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'pp-toast';
        t.setAttribute('style','position:fixed;bottom:16px;right:16px;z-index:99999;padding:10px 12px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.12);color:#0f172a;font:14px/1.2 system-ui;display:none;');
        document.body.appendChild(t);
      }
      t.style.borderColor = isErr ? '#dc2626' : '#16a34a';
      t.style.boxShadow   = isErr ? '0 8px 30px rgba(220,38,38,.25)' : '0 8px 30px rgba(22,163,74,.25)';
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(()=>{ t.style.display = 'none'; }, 2000);
    }

    try {
      const res = await fetch(form.action, { method:'POST', body:new FormData(form) });
      const data = await res.json().catch(()=>({ success:false, error:'Respuesta inválida' }));
      if (data && data.success) {
        showToast('✔️ Ejercicio guardado', false);
        setTimeout(()=>{ window.location.href = (window.PP_ADMIN_LIBRARY_URL || '/admin/exercises'); }, 600);
      } else {
        showToast('❌ ' + (data && data.error ? data.error : 'Error al guardar'), true);
      }
    } catch (err) {
      showToast('❌ Error de red al guardar', true);
    }
  });

})();