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

    // CHOICES (A-D)
    const choicesWrap = el('div', { style:'display:flex;flex-direction:column;gap:.4rem;' });
    choicesWrap.appendChild(el('div', { class:'muted' }, 'Opciones'));
    const opts = [];
    const letters = ['A','B','C','D'];
    letters.forEach((L,i)=>{
      const row = el('div', { style:'display:grid;grid-template-columns: 140px 1fr; gap:.6rem; align-items:center; margin:.4rem 0;' });
      const lab = el('label', { class:'tiny muted', style:'display:flex;align-items:center;gap:.4rem;' });
      const radio = el('input', { type:'radio', name:`ans-${idx}-${Date.now()}`, value:L, style:'transform:translateY(1px);' });
      // give more space between radio and text input
      lab.appendChild(radio);
      lab.appendChild(el('span', {}, `Correcta`));
      const input = el('input', { type:'text', placeholder:`Opción ${L}`, style:'padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;width:100%;' });
      row.appendChild(lab);
      row.appendChild(input);
      choicesWrap.appendChild(row);
      opts.push({ radio, input, key:L });
    });
    wrap.appendChild(choicesWrap);

    // FEEDBACK + HINT
    const fbOk   = el('textarea', { placeholder:'Feedback para respuesta correcta (opcional)', rows:'2', style:'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;' });
    const fbBad  = el('textarea', { placeholder:'Feedback para respuesta incorrecta (opcional)', rows:'2', style:'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;' });
    const hint   = el('textarea', { placeholder:'Pista (opcional; si hay pista, el botón “Ver pista” aparecerá)', rows:'2', style:'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;' });
    wrap.appendChild(fbOk);
    wrap.appendChild(fbBad);
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
        text: (o.input.value || '').trim()
      })).filter(c => c.text); // drop empties

      const picked = opts.find(o => o.radio.checked);
      const answer = picked ? picked.key : null;

      return {
        prompt: (prompt.value || '').trim(),
        choices,
        answer,
        feedback_correct: (fbOk.value || '').trim() || null,
        feedback_incorrect: (fbBad.value || '').trim() || null,
        hint: (hint.value || '').trim() || null,
        media: { youtube_url, image_alt, image, audio, video }
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

  // ---------- Inline preview (like TF) ----------
  let prevWrap, prevBody, prevContent, btnPrevToggle, btnPrevRefresh;

  function ensurePreviewPanel() {
    if (prevWrap) return;
    prevWrap = el('div', { id:'ex-preview-wrap', class:'ex-panel', style:'border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-top:.5rem;' });
    const header = el('header', { style:'display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:.6rem .8rem;border-bottom:1px solid #e5e7eb;' });
    const title  = el('div', { class:'muted', style:'font-weight:600;' }, '👀 Vista previa');
    const ctrls  = el('div', { class:'row', style:'gap:.4rem;' });
    btnPrevToggle  = el('button', { type:'button', class:'btn tiny' }, '+ Mostrar');
    btnPrevRefresh = el('button', { type:'button', class:'btn tiny' }, 'Actualizar vista');
    ctrls.appendChild(btnPrevToggle); ctrls.appendChild(btnPrevRefresh);
    header.appendChild(title); header.appendChild(ctrls);

    prevBody = el('div', { id:'ex-preview-body', style:'display:none;padding:.75rem;background:#fff;' });
    prevBody.appendChild(el('div', { class:'tiny muted', style:'margin-bottom:.5rem;' }, 'Esta vista previa no guarda cambios. Usa “Actualizar vista” para refrescar.'));
    prevContent = el('div', { id:'ex-preview-content', style:'display:flex;flex-direction:column;gap:.75rem;' });

    prevBody.appendChild(prevContent);
    prevWrap.appendChild(header);
    prevWrap.appendChild(prevBody);

    const submitBtn = form.querySelector('button[type="submit"]');
    const buttonsRow = submitBtn ? submitBtn.closest('.row') : null;
    if (buttonsRow && buttonsRow.parentNode) buttonsRow.parentNode.insertBefore(prevWrap, buttonsRow);
    else form.appendChild(prevWrap);

    btnPrevToggle.addEventListener('click', ()=>{ togglePreview(); if (prevBody && prevBody.style.display !== 'none') refreshPreview(); });
    btnPrevRefresh.addEventListener('click', ()=>{ togglePreview(true); refreshPreview(); });
  }

  function togglePreview(open){
    ensurePreviewPanel();
    const isOpen = (prevBody.style.display !== 'none');
    const next = (typeof open === 'boolean') ? open : !isOpen;
    prevBody.style.display = next ? 'block' : 'none';
    btnPrevToggle.textContent = next ? '− Ocultar' : '+ Mostrar';
  }

  function buildItemsSnapshot(){
    const toAbs = (p) => {
      if (!p) return null;
      p = String(p);
      if (/^(https?:|blob:|data:)/i.test(p)) return p;
      if (p.startsWith('static/')) p = '/' + p;
      if (p.startsWith('/')) return window.location.origin + p;
      return window.location.origin + '/' + p;
    };

    const cards = [...itemsList.querySelectorAll('.mcq-item')];
    return cards.map((card, i) => {
      const snap = (typeof card._get === 'function') ? card._get() : null;
      if (!snap) return null;
      snap._idx = i;

      const m = (snap.media && typeof snap.media === 'object') ? snap.media : {};
      const prev = card._existingMedia || {};

      if (m.image === '__UPLOAD__') m.image = prev.image || null;
      if (m.audio === '__UPLOAD__') m.audio = prev.audio || null;
      if (m.video === '__UPLOAD__') m.video = prev.video || null;

      m.image = toAbs(m.image);
      m.audio = toAbs(m.audio);
      m.video = toAbs(m.video);

      const imgIn = card.querySelector('input[name="media_image[]"]');
      const audIn = card.querySelector('input[name="media_audio[]"]');
      const vidIn = card.querySelector('input[name="media_video[]"]');
      if (imgIn?.files?.[0]) m.image = URL.createObjectURL(imgIn.files[0]);
      if (audIn?.files?.[0]) m.audio = URL.createObjectURL(audIn.files[0]);
      if (vidIn?.files?.[0]) m.video = URL.createObjectURL(vidIn.files[0]);

      snap.media = m;
      return snap;
    }).filter(Boolean);
  }

  function renderMCQPreview(items){
    ensurePreviewPanel();
    prevContent.innerHTML = '';
    if (!items || !items.length) {
      prevContent.appendChild(el('div', { class:'tiny muted' }, 'No hay preguntas aún.'));
      return;
    }

    items.forEach((it) => {
      const card = el('div', { style:'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.5rem;' });

      // media
      const m = it.media || {};
      const mediaRow = el('div', { style:'display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;' });
      let hasMedia = false;
      if (m.image) { hasMedia = true; mediaRow.appendChild(el('img', { src:m.image, alt:m.image_alt || '', style:'max-width:220px;border:1px solid #e5e7eb;border-radius:8px;' })); }
      if (m.audio) { hasMedia = true; const a = el('audio', { controls:'', style:'display:block;min-width:220px;' }); a.src = m.audio; mediaRow.appendChild(a); }
      if (m.video) { hasMedia = true; const v = el('video', { controls:'', style:'display:block;max-width:320px;border-radius:6px;' }); v.src = m.video; mediaRow.appendChild(v); }
      if (m.youtube_url) {
        hasMedia = true;
        try {
          const url = new URL(m.youtube_url, window.location.href);
          let id = url.searchParams.get('v'); if (!id) id = url.pathname.split('/').pop();
          mediaRow.appendChild(el('iframe', { src:`https://www.youtube.com/embed/${id}`, allow:'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen:'', style:'width:320px;height:180px;border:0;border-radius:6px;' }));
        } catch(_) {}
      }
      if (hasMedia) card.appendChild(mediaRow);

      // prompt
      card.appendChild(el('div', { style:'font-weight:600;color:#0f172a;' }, it.prompt || '(sin enunciado)'));

      // choices
      const list = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
      (Array.isArray(it.choices) ? it.choices : []).forEach(ch => {
        const row = el('div', { style:'display:grid;grid-template-columns: 48px 1fr; gap:.5rem; align-items:center;' });
        row.appendChild(el('span', { class:'tiny muted' }, ch.key || ''));
        row.appendChild(el('div', {}, ch.text || ch.label || ch.html || ''));
        list.appendChild(row);
      });
      card.appendChild(list);

      // hint/feedback + fake grading
      let selected = null;
      const radioRow = el('div', { style:'display:flex;gap:.5rem;flex-wrap:wrap;' });
      (Array.isArray(it.choices) ? it.choices : []).forEach(ch => {
        const b = el('button', { type:'button', class:'btn tiny' }, ch.key || '');
        b.addEventListener('click', ()=> { selected = (ch.key || '').toString().toUpperCase(); });
        radioRow.appendChild(b);
      });
      card.appendChild(radioRow);

      if (it.hint) {
        const hintBtn = el('button', { type:'button', class:'btn tiny' }, 'Ver pista');
        const hintBox = el('div', { class:'tiny muted', style:'display:none;margin-top:.25rem;' }, it.hint);
        hintBtn.addEventListener('click', ()=> {
          hintBox.style.display = (hintBox.style.display === 'none') ? 'block' : 'none';
        });
        card.appendChild(hintBtn);
        card.appendChild(hintBox);
      }

      const fbBox = el('div', { style:'margin-top:.25rem;' });
      const checkBtn = el('button', { type:'button', class:'btn tiny' }, 'Comprobar');
      checkBtn.addEventListener('click', ()=>{
        const ok = selected && (selected === String(it.answer || '').toUpperCase());
        fbBox.textContent = ok ? (it.feedback_correct || '¡Correcto!') : (it.feedback_incorrect || 'No es correcto.');
        fbBox.style.color = ok ? '#15803d' : '#b91c1c';
      });
      card.appendChild(checkBtn);
      card.appendChild(fbBox);

      prevContent.appendChild(card);
    });
  }

  function refreshPreview(){ renderMCQPreview(buildItemsSnapshot()); }

  // build preview shell now (collapsed)
  ensurePreviewPanel();

  // throttle preview
  function _throttle(fn, wait){
    let t=0, last=0;
    return function(...args){
      const now=Date.now(); const remain = wait - (now - last);
      clearTimeout(t);
      if (remain <= 0) { last = now; fn.apply(this, args); }
      else { t = setTimeout(()=>{ last = Date.now(); fn.apply(this, args); }, remain); }
    };
  }
  const _autoPreview = _throttle(()=>{ if (prevBody && prevBody.style.display !== 'none') refreshPreview(); }, 250);
  form.addEventListener('input', _autoPreview);
  itemsList.addEventListener('click', (e)=>{
    const t = e.target;
    if (t && (t.id === 'btnAddItem' || t.textContent === 'Eliminar')) setTimeout(_autoPreview, 0);
  });

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