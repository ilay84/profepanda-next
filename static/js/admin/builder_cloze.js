// static/js/admin/builder_cloze.js
(function () {
  'use strict';

  const itemsList   = document.getElementById('clozeItemsList');
  const btnAdd      = document.getElementById('btnAddClozeItem');
  const form        = document.getElementById('ex-cloze-form');
  const payload     = document.getElementById('clozeItemsPayload');

  const btnCancel   = document.getElementById('btnCancelCloze');
  const modal       = document.getElementById('ex-modal');
  const modalClose  = document.getElementById('ex-modal-close');
  const modalBackdrop = document.getElementById('ex-modal-backdrop');

  if (!form || !itemsList || !btnAdd || !payload) {
    console.error('Cloze builder: missing required elements.');
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

  // ---------- Cloze card ----------
  function clozeCard(idx){
    const wrap = el('div', { class:'cloze-item', style:'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;' });
    wrap._rm = { image:false, audio:false, video:false, yt:false, alt:false };

    // header
    const header = el('div', { style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;' });
    const title  = el('div', { class:'muted' }, `Oración #${idx+1}`);
    const btnDel = el('button', { type:'button', class:'btn tiny' }, 'Eliminar');
    btnDel.addEventListener('click', ()=>{ wrap.remove(); isDirty = true; renumber(); _autoPreview(); });
    header.appendChild(title); header.appendChild(btnDel);

    // ===== Media (same pattern as TF/MCQ) =====
    const mediaBlock = el('div', { class:'cloze-media', style:'border:1px dashed #cbd5e1;border-radius:12px;padding:.5rem;margin:.25rem 0 .6rem;background:#f8fafc;' });
    const mediaHdr   = el('div', { style:'display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.25rem;' });
    const mediaTitle = el('div', { class:'muted', style:'font-weight:700;letter-spacing:.2px;display:flex;align-items:center;gap:.4rem;' }, '🖼️🎧 Media (opcional)');
    const btnToggle  = el('button', { type:'button', class:'btn tiny', style:'padding:.3rem .55rem;border-radius:999px;' }, '+ Agregar media');
    mediaHdr.appendChild(mediaTitle); mediaHdr.appendChild(btnToggle);

    const mediaInner = el('div', { style:'display:none;border-top:1px dashed #d1d5db;margin-top:.4rem;padding-top:.5rem;' });
    const mediaIndex = el('input', { type:'hidden', name:'media_index[]', value:String(idx) });

    // Image + Alt
    const rowImg = el('div', { style:'display:grid;grid-template-columns:1fr 1fr;gap:.6rem;align-items:start;' });
    const imgWrap = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
    imgWrap.appendChild(el('label', { class:'tiny muted' }, '📷 Imagen'));
    const imgCtl  = el('div', { style:'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
    const imgBtn  = el('label', { style:'display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .65rem;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:.9rem;line-height:1;' }, 'Elegir archivo');
    const imgInput= el('input', { type:'file', name:'media_image[]', accept:'image/*', style:'display:none;' });
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

    // Audio
    const rowAud = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;margin-top:.4rem;' });
    rowAud.appendChild(el('label', { class:'tiny muted' }, '🎤 Audio'));
    const audCtl  = el('div', { style:'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
    const audBtn  = el('label', { style:'display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .65rem;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:.9rem;line-height:1;' }, 'Elegir archivo');
    const audInput= el('input', { type:'file', name:'media_audio[]', accept:'audio/*', style:'display:none;' });
    audBtn.appendChild(audInput);
    const audName = el('span', { class:'tiny muted' }, '');
    const audDel  = el('button', { type:'button', class:'btn tiny', style:'padding:.25rem .5rem;' }, 'Quitar');
    audCtl.appendChild(audBtn); audCtl.appendChild(audName); audCtl.appendChild(audDel);
    rowAud.appendChild(audCtl);

    // Video + YouTube
    const rowVid = el('div', { style:'display:grid;grid-template-columns:1fr 1fr;gap:.6rem;align-items:start;margin-top:.4rem;' });
    const vidWrap = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
    vidWrap.appendChild(el('label', { class:'tiny muted' }, '🎬 Video (archivo)'));
    const vidCtl  = el('div', { style:'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
    const vidBtn  = el('label', { style:'display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .65rem;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:.9rem;line-height:1;' }, 'Elegir archivo');
    const vidInput= el('input', { type:'file', name:'media_video[]', accept:'video/*', style:'display:none;' });
    vidBtn.appendChild(vidInput);
    const vidName = el('span', { class:'tiny muted' }, '');
    const vidDel  = el('button', { type:'button', class:'btn tiny', style:'padding:.25rem .5rem;' }, 'Quitar');
    vidCtl.appendChild(vidBtn); vidCtl.appendChild(vidName); vidCtl.appendChild(vidDel);
    vidWrap.appendChild(vidCtl);

    const ytWrap = el('div', { style:'display:flex;flex-direction:column;gap:.35rem;' });
    ytWrap.appendChild(el('label', { class:'tiny muted' }, '🔗 YouTube URL'));
    const ytRow  = el('div', { style:'display:flex;gap:.5rem;align-items:center;' });
    const ytInput= el('input', { type:'url', name:'media_youtube_url[]', placeholder:'https://www.youtube.com/watch?v=…', style:'flex:1;padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;' });
    const ytDel  = el('button', { type:'button', class:'btn tiny', style:'padding:.25rem .5rem;white-space:nowrap;' }, 'Borrar');
    ytRow.appendChild(ytInput); ytRow.appendChild(ytDel);
    ytWrap.appendChild(ytRow);

    rowVid.appendChild(vidWrap);
    rowVid.appendChild(ytWrap);

    // filenames + deletes + validation
    imgInput.addEventListener('change', ()=>{ imgName.textContent = imgInput.files[0]?.name || ''; wrap._rm.image = false; });
    imgDel.addEventListener('click', (e)=>{ e.preventDefault(); const dt=new DataTransfer(); imgInput.files = dt.files; imgName.textContent=''; wrap._rm.image = true; if (wrap._existingMedia) wrap._existingMedia.image=null; });
    audInput.addEventListener('change', ()=>{ audName.textContent = audInput.files[0]?.name || ''; wrap._rm.audio=false; });
    audDel.addEventListener('click', ()=>{ wrap._rm.audio=true; audInput.value=''; audName.textContent='(eliminado)'; });
    vidInput.addEventListener('change', ()=>{ vidName.textContent = vidInput.files[0]?.name || ''; wrap._rm.video=false; });
    vidDel.addEventListener('click', ()=>{ wrap._rm.video=true; vidInput.value=''; vidName.textContent='(eliminado)'; });
    ytDel.addEventListener('click', ()=>{ wrap._rm.yt=true; ytInput.value=''; ytInput.dispatchEvent(new Event('input')); });
    ytInput.addEventListener('input', ()=>{
      let ok = true;
      const v = ytInput.value.trim();
      if (v) {
        try { const u=new URL(v); const h=u.hostname.replace(/^www\./,''); ok=(h==='youtube.com'||h==='youtu.be'); }
        catch(_){ ok=false; }
      }
      ytInput.style.borderColor = ok ? '#cbd5e1' : '#dc2626';
    });

    // assemble media
    mediaInner.appendChild(rowImg);
    mediaInner.appendChild(rowAud);
    mediaInner.appendChild(rowVid);
    mediaInner.appendChild(el('div', { class:'tiny muted', style:'margin-top:.4rem;' }, 'Formatos soportados: JPG/PNG, MP3, MP4. Podés arrastrar archivos a esta caja.'));
    mediaInner.appendChild(mediaIndex);
    mediaBlock.appendChild(mediaHdr);
    mediaBlock.appendChild(mediaInner);

    // toggle
    let open = false;
    btnToggle.addEventListener('click', ()=>{
      open = !open;
      mediaInner.style.display = open ? 'block' : 'none';
      btnToggle.textContent = open ? '− Ocultar media' : '+ Agregar media';
    });
    // dnd
    function acceptDrop(e){ e.preventDefault(); e.stopPropagation(); }
    mediaBlock.addEventListener('dragover', acceptDrop);
    mediaBlock.addEventListener('dragenter', acceptDrop);
    mediaBlock.addEventListener('drop', (e)=>{
      acceptDrop(e);
      const files = e.dataTransfer?.files ? [...e.dataTransfer.files] : [];
      if (!files.length) return;
      if (!open) btnToggle.click();
      for (const f of files) {
        const mt = (f.type||'').toLowerCase();
        if (mt.startsWith('image/') && !imgInput.files.length) { const dt=new DataTransfer(); dt.items.add(f); imgInput.files=dt.files; }
        else if (mt.startsWith('audio/') && !audInput.files.length) { const dt=new DataTransfer(); dt.items.add(f); audInput.files=dt.files; }
        else if (mt.startsWith('video/') && !vidInput.files.length) { const dt=new DataTransfer(); dt.items.add(f); vidInput.files=dt.files; }
      }
    });

    // ===== Prompt + toolbar =====
    const prompt = el('textarea', { placeholder:'Escribí el enunciado y marcá huecos con [[B1]], [[B2]], …', rows:'3', style:'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;' });

    const tools = el('div', { class:'row', style:'gap:.5rem;align-items:center;margin:.25rem 0;' });
    const btnInsBlank = el('button', { type:'button', class:'btn tiny' }, '+ Agregar hueco');
    const btnValidate = el('button', { type:'button', class:'btn tiny' }, 'Validar tokens');
    tools.appendChild(btnInsBlank); tools.appendChild(btnValidate);

    // ===== Blanks table =====
    const blanksWrap = el('div', { style:'border:1px dashed #e5e7eb;border-radius:10px;padding:.5rem;margin:.25rem 0;' });
    const blanksHead = el('div', { class:'muted', style:'margin-bottom:.5rem;font-weight:600;' }, 'Definí las respuestas correctas por hueco');
    const blanksList = el('div', {});

    function nextBlankKey(){ return 'B' + (blanksList.children.length + 1); }

    function makeBlankRow(key){
      // Card-ish wrapper for each blank
      const row = el('div', { style:'border:1px solid #e5e7eb;border-radius:10px;padding:.6rem;background:#f9fafb;margin:.5rem 0;display:flex;flex-direction:column;gap:.5rem;' });

      // Top row: Badge, answers, flags, delete
      const top = el('div', { style:'display:grid;grid-template-columns:64px minmax(220px, 1fr) auto auto auto;column-gap:.6rem;row-gap:.35rem;align-items:center;' });

      const keyBox = el('div', {
        class:'muted',
        style:'text-align:center;font-weight:700;background:#eef2f7;border:1px solid #dbe3ed;border-radius:8px;padding:.35rem 0;'
      }, key);

      // Answers with a tiny label above for clarity
      const ansWrap = el('div', { style:'display:flex;flex-direction:column;gap:.25rem;' }, [
        el('div', { class:'tiny muted' }, 'Respuestas (separadas por coma)'),
      ]);
      const ans = el('input', {
        type:'text',
        placeholder:'ej.: soy, yo soy',
        style:'width:100%;max-width:460px;box-sizing:border-box;padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;'
      });
      ansWrap.appendChild(ans);

      const csWrap = el('label', { class:'tiny muted', style:'display:inline-flex;gap:.35rem;align-items:center;justify-content:flex-start;white-space:nowrap;' }, [
        (function(){ const x=document.createElement('input'); x.type='checkbox'; return x; })(),
        document.createTextNode('May/min')
      ]);

      const acWrap = el('label', { class:'tiny muted', style:'display:inline-flex;gap:.35rem;align-items:center;justify-content:flex-start;white-space:nowrap;' }, [
        (function(){ const x=document.createElement('input'); x.type='checkbox'; x.checked = true; return x; })(),
        document.createTextNode('Acentos')
      ]);

      const del = el('button', { type:'button', class:'btn tiny' }, 'Eliminar');
      del.addEventListener('click', ()=>{ row.remove(); renumberBlanks(); isDirty = true; _autoPreview(); });

      top.appendChild(keyBox);
      top.appendChild(ansWrap);
      top.appendChild(csWrap);
      top.appendChild(acWrap);
      top.appendChild(del);

      // Bottom row: three labeled fields, responsive (no overlap)
      const bottom = el('div', { style:'display:flex;flex-wrap:wrap;gap:.6rem;' });

      function labeledArea(labelText, placeholder){
        const wrap = el('div', { style:'flex:1 1 260px;min-width:240px;display:flex;flex-direction:column;gap:.25rem;' });
        wrap.appendChild(el('div', { class:'tiny muted' }, labelText));
        const ta = el('textarea', {
          rows:'2',
          placeholder,
          style:'width:100%;box-sizing:border-box;padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;'
        });
        wrap.appendChild(ta);
        return { wrap, ta };
      }

      const hint     = labeledArea('Pista (opcional)', 'Consejito breve…').ta;
      const fbOk     = labeledArea('Feedback si es correcto (opcional)', 'Lo que querés reforzar…').ta;
      const fbBad    = labeledArea('Feedback si es incorrecto (opcional)', 'Una ayuda o corrección…').ta;

      bottom.appendChild(hint.parentNode);
      bottom.appendChild(fbOk.parentNode);
      bottom.appendChild(fbBad.parentNode);

      row.appendChild(top);
      row.appendChild(bottom);

      // Getter
      row._get = () => {
        const answers = (ans.value || '').split(',').map(s=>s.trim()).filter(Boolean);
        const cs = !!csWrap.querySelector('input').checked;
        const na = !!acWrap.querySelector('input').checked;
        return {
          key,
          answers,
          case_sensitive: cs,
          normalize_accents: na,
          hint: (hint.value || '').trim() || null,
          feedback_correct: (fbOk.value || '').trim() || null,
          feedback_incorrect: (fbBad.value || '').trim() || null
        };
      };
      return row;
    }

    function renumberBlanks(){
      [...blanksList.children].forEach((row, i)=>{
        const key = 'B' + (i+1);
        const keyBox = row.querySelector('.muted');
        if (keyBox) keyBox.textContent = key;
        // rebind getter with new key
        const ansInput = row.querySelector('input[type="text"]');
        const cbs = row.querySelectorAll('input[type="checkbox"]');
        const csInput = cbs[0], naInput = cbs[1];
        row._get = () => {
          const answers = (ansInput.value || '').split(',').map(s=>s.trim()).filter(Boolean);
          return { key, answers, case_sensitive: !!csInput.checked, normalize_accents: !!naInput.checked };
        };
      });
    }

    blanksWrap.appendChild(blanksHead);
    blanksWrap.appendChild(blanksList);

    // Insert token + row
    btnInsBlank.addEventListener('click', ()=>{
      const key = nextBlankKey();
      const token = `[[${key}]]`;
      const start = prompt.selectionStart || 0;
      const end   = prompt.selectionEnd || 0;
      const val   = prompt.value || '';
      prompt.value = val.slice(0,start) + token + val.slice(end);
      blanksList.appendChild(makeBlankRow(key));
      isDirty = true; renumberBlanks(); _autoPreview();
    });

    // Validate tokens vs rows
    btnValidate.addEventListener('click', ()=>{
      const text = prompt.value || '';
      const tokens = (text.match(/\[\[B\d+\]\]/g) || []).map(t=>t.replace(/\[|\]/g,''));
      const need = new Set(tokens);
      const have = new Set([...blanksList.children].map((_,i)=>'B'+(i+1)));
      if (need.size !== have.size) alert(`Cantidad de tokens (${need.size}) no coincide con filas (${have.size}).`);
      else alert('¡Tokens y filas coinciden!');
    });

    // assemble card
    wrap.appendChild(header);
    wrap.appendChild(mediaBlock);
    wrap.appendChild(tools);
    wrap.appendChild(prompt);
    wrap.appendChild(blanksWrap);

    // (removed) item-level feedback + hint fields — we now use per-blank fields only

    // serialization
    wrap._existingMedia = wrap._existingMedia || {};
    wrap._get = () => {
      const prev = wrap._existingMedia || {};
      const hasImg = !!(imgInput.files && imgInput.files.length);
      const hasAud = !!(audInput.files && audInput.files.length);
      const hasVid = !!(vidInput.files && vidInput.files.length);
      const ytVal  = (ytInput.value || '').trim();
      const altVal = (imgAlt.value  || '').trim();

      const image = wrap._rm.image ? '__DELETE__' : hasImg ? '__UPLOAD__' : (prev.image || null);
      const audio = wrap._rm.audio ? '__DELETE__' : hasAud ? '__UPLOAD__' : (prev.audio || null);
      const video = wrap._rm.video ? '__DELETE__' : hasVid ? '__UPLOAD__' : (prev.video || null);
      const youtube_url = wrap._rm.yt ? '__DELETE__' : (ytVal || prev.youtube_url || null);
      const image_alt   = wrap._rm.alt ? '__DELETE__' : (altVal || prev.image_alt || null);

      const blanks = [...blanksList.children].map(row => row._get());
      return {
        prompt: (prompt.value || '').trim(),
        blanks,
        // item-level fallbacks removed from UI; keep nulls for backward compatibility
        feedback_correct: null,
        feedback_incorrect: null,
        hint: null,
        media: { youtube_url, image_alt, image, audio, video }
      };
    };

    // refs for prefill (item-level fb/hint removed)
    wrap._refs = { imgName, audName, vidName, imgInput, audInput, vidInput, ytInput, imgAlt, mediaInner, btnToggle, prompt, blanksList };
    return wrap;
  }

  // ---------- form plumbing ----------
  let isDirty = false;
  form.addEventListener('input', ()=>{ isDirty = true; });

  function renumber(){
    [...itemsList.querySelectorAll('.cloze-item')].forEach((c,i)=>{
      const title = c.querySelector('.muted');
      if (title) title.textContent = `Oración #${i+1}`;
      const idxHidden = c.querySelector('input[name="media_index[]"]');
      if (idxHidden) idxHidden.value = String(i);
    });
  }

  btnAdd.addEventListener('click', ()=>{
    const idx = itemsList.querySelectorAll('.cloze-item').length;
    itemsList.appendChild(clozeCard(idx));
    renumber();
    togglePreview(true);
    refreshPreview();
  });

  // ---------- Prefill from template global or seed one ----------
  const ex = (typeof window !== 'undefined') ? window.PP_CLOZE_EDIT_EX : null;
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
      const card = clozeCard(idx);
      itemsList.appendChild(card);

      // prompt
      if (card._refs?.prompt) card._refs.prompt.value = it.prompt || '';

      // blanks
      const blanks = Array.isArray(it.blanks) ? it.blanks : [];
      blanks.forEach((b, i) => {
        const r = document.createElement('div');
        r.setAttribute('style','border:1px solid #e5e7eb;border-radius:10px;padding:.6rem;background:#f9fafb;margin:.5rem 0;display:flex;flex-direction:column;gap:.5rem;');

        // Top row
        const top = document.createElement('div');
        top.setAttribute('style','display:grid;grid-template-columns:64px minmax(220px, 1fr) auto auto auto;column-gap:.6rem;row-gap:.35rem;align-items:center;');

        const key = 'B' + (i+1);

        const keyBox = document.createElement('div');
        keyBox.className = 'muted';
        keyBox.setAttribute('style','text-align:center;font-weight:700;background:#eef2f7;border:1px solid #dbe3ed;border-radius:8px;padding:.35rem 0;');
        keyBox.textContent = key;

        const ansWrap = document.createElement('div');
        ansWrap.setAttribute('style','display:flex;flex-direction:column;gap:.25rem;');
        const ansLbl = document.createElement('div'); ansLbl.className='tiny muted'; ansLbl.textContent='Respuestas (separadas por coma)';
        const ans = document.createElement('input'); ans.type='text';
        ans.placeholder='ej.: soy, yo soy';
        ans.setAttribute('style','width:100%;max-width:460px;box-sizing:border-box;padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;');
        ans.value = (Array.isArray(b.answers) ? b.answers : []).join(', ');
        ansWrap.appendChild(ansLbl); ansWrap.appendChild(ans);

        const csWrap = document.createElement('label'); csWrap.className='tiny muted';
        csWrap.setAttribute('style','display:inline-flex;gap:.35rem;align-items:center;justify-content:flex-start;white-space:nowrap;');
        const csInp = document.createElement('input'); csInp.type='checkbox'; csInp.checked = !!b.case_sensitive;
        csWrap.appendChild(csInp); csWrap.appendChild(document.createTextNode('May/min'));

        const acWrap = document.createElement('label'); acWrap.className='tiny muted';
        acWrap.setAttribute('style','display:inline-flex;gap:.35rem;align-items:center;justify-content:flex-start;white-space:nowrap;');
        const acInp = document.createElement('input'); acInp.type='checkbox'; acInp.checked = (b.normalize_accents !== false);
        acWrap.appendChild(acInp); acWrap.appendChild(document.createTextNode('Acentos'));

        const del = document.createElement('button'); del.type='button'; del.className='btn tiny'; del.textContent='Eliminar';
        del.addEventListener('click', ()=>{ r.remove(); isDirty = true; _autoPreview(); });

        top.appendChild(keyBox);
        top.appendChild(ansWrap);
        top.appendChild(csWrap);
        top.appendChild(acWrap);
        top.appendChild(del);

        // Bottom row (responsive, no overlap)
        const bottom = document.createElement('div');
        bottom.setAttribute('style','display:flex;flex-wrap:wrap;gap:.6rem;');

        function labeledArea(label, value){
          const w = document.createElement('div');
          w.setAttribute('style','flex:1 1 260px;min-width:240px;display:flex;flex-direction:column;gap:.25rem;');
          const l = document.createElement('div'); l.className='tiny muted'; l.textContent = label;
          const ta = document.createElement('textarea');
          ta.setAttribute('rows','2');
          ta.setAttribute('style','width:100%;box-sizing:border-box;padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;');
          ta.value = value || '';
          w.appendChild(l); w.appendChild(ta);
          return { w, ta };
        }

        const hint     = labeledArea('Pista (opcional)', b.hint).ta;
        const fbOk     = labeledArea('Feedback si es correcto (opcional)', b.feedback_correct).ta;
        const fbBad    = labeledArea('Feedback si es incorrecto (opcional)', b.feedback_incorrect).ta;

        bottom.appendChild(hint.parentNode);
        bottom.appendChild(fbOk.parentNode);
        bottom.appendChild(fbBad.parentNode);

        r.appendChild(top);
        r.appendChild(bottom);

        r._get = () => {
          const answers = (ans.value || '').split(',').map(s=>s.trim()).filter(Boolean);
          return {
            key,
            answers,
            case_sensitive: !!csInp.checked,
            normalize_accents: !!acInp.checked,
            hint: (hint.value || '').trim() || null,
            feedback_correct: (fbOk.value || '').trim() || null,
            feedback_incorrect: (fbBad.value || '').trim() || null
          };
        };

        card._refs.blanksList.appendChild(r);
      });

      // feedback + hint
      if (card._refs?.fbOk)  card._refs.fbOk.value  = it.feedback_correct || '';
      if (card._refs?.fbBad) card._refs.fbBad.value = it.feedback_incorrect || '';
      if (card._refs?.hint)  card._refs.hint.value  = it.hint || '';

      // media existing
      const m = (it.media && typeof it.media === 'object') ? it.media : it;
      card._existingMedia = {
        image:       m.image || it.image || null,
        audio:       m.audio || it.audio || null,
        video:       m.video || it.video || it.video_mp4 || null,
        youtube_url: m.youtube_url || it.youtube || it.video_iframe || null,
        image_alt:   m.image_alt || it.image_alt || it.image_caption || null
      };

      const refs = card._refs || {};
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
    // Seed with one empty sentence
    btnAdd.click();
  }

  // ---------- close modal ----------
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

  // ---------- Preview (inline) ----------
  let prevWrap, prevBody, prevContent, btnPrevToggle, btnPrevRefresh;

  function ensurePreviewPanel() {
    if (prevWrap) return;
    prevWrap = el('div', { id:'cloze-preview-wrap', class:'ex-panel', style:'border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-top:.5rem;' });
    const header = el('header', { style:'display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:.6rem .8rem;border-bottom:1px solid #e5e7eb;' });
    const title  = el('div', { class:'muted', style:'font-weight:600;' }, '👀 Vista previa');
    const controls= el('div', { class:'row', style:'gap:.4rem;' });
    btnPrevToggle  = el('button', { type:'button', class:'btn tiny' }, '+ Mostrar');
    btnPrevRefresh = el('button', { type:'button', class:'btn tiny' }, 'Actualizar vista');
    controls.appendChild(btnPrevToggle); controls.appendChild(btnPrevRefresh);
    header.appendChild(title); header.appendChild(controls);

    prevBody = el('div', { id:'cloze-preview-body', style:'display:none;padding:.75rem;background:#fff;' });
    prevBody.appendChild(el('div', { class:'tiny muted', style:'margin-bottom:.5rem;' }, 'Esta vista previa no guarda cambios. Usa “Actualizar vista” para refrescar.'));
    prevContent = el('div', { id:'cloze-preview-content', style:'display:flex;flex-direction:column;gap:1rem;' });

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

    const cards = [...itemsList.querySelectorAll('.cloze-item')];
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

  function stripAccents(s){ try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); } catch(_){ return s; } }

  function renderClozePreview(items){
    ensurePreviewPanel();
    prevContent.innerHTML = '';

    // NEW: show instructions (if any) above the preview cards
    try {
      const instrNode = form ? form.querySelector('textarea[name="instructions"]') : null;
      const instrHtml = (instrNode && typeof instrNode.value === 'string') ? instrNode.value.trim() : '';
      if (instrHtml) {
        const box = el('div', {
          class: 'pp-ex-instructions',
          style: 'margin-bottom:1rem;padding:.75rem 1rem;background:#f8fafc;border-left:4px solid #2563eb;border-radius:8px;color:#0f172a;line-height:1.5;'
        });
        box.innerHTML = instrHtml; // allow simple HTML (bold/italics)
        prevContent.appendChild(box);
      }
    } catch (_) { /* non-blocking */ }
    if (!items || !items.length) {
      prevContent.appendChild(el('div', { class:'tiny muted' }, 'No hay oraciones aún.'));
      return;
    }

    items.forEach((it) => {
      const card = el('div', { style:'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.6rem;' });

      // media
      const m = it.media || {};
      const mediaRow = el('div', { style:'display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;' });
      let hasMedia = false;
      if (m.image){ hasMedia = true; mediaRow.appendChild(el('img',{src:m.image,alt:m.image_alt||'',style:'max-width:220px;border:1px solid #e5e7eb;border-radius:8px;'})); }
      if (m.audio){ hasMedia = true; const a=el('audio',{controls:'',style:'display:block;min-width:220px;'}); a.src=m.audio; mediaRow.appendChild(a); }
      if (m.video){ hasMedia = true; const v=el('video',{controls:'',style:'display:block;max-width:320px;border-radius:6px;'}); v.src=m.video; mediaRow.appendChild(v); }
      if (m.youtube_url){
        hasMedia = true;
        try {
          const url = new URL(m.youtube_url, window.location.href);
          let id = url.searchParams.get('v'); if(!id) id = url.pathname.split('/').pop();
          mediaRow.appendChild(el('iframe', { src:`https://www.youtube.com/embed/${id}`, allow:'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen:'', style:'width:320px;height:180px;border:0;border-radius:6px;' }));
        } catch(_) {}
      }
      if (hasMedia) card.appendChild(mediaRow);

      // prompt with inputs (now each blank has its own hint + feedback box)
      const text = it.prompt || '';
      const container = el('div', { style:'line-height:1.6;color:#0f172a;' });
      const parts = text.split(/\[\[(B\d+)\]\]/g);

      // controls: [{ key, input, hintBtn, hintBox, fbBox }]
      const controls = [];

      for (let i=0;i<parts.length;i++){
        if (i % 2 === 0) {
          container.appendChild(document.createTextNode(parts[i]));
        } else {
          const key = parts[i];

          // wrapper keeps input + hint + feedback together inline
          const wrap = el('span', { style:'display:inline-flex;flex-direction:column;gap:.25rem;align-items:flex-start;margin:0 .25rem;' });

          const input = el('input', {
            type:'text',
            'data-key': key,
            style:'padding:.35rem .5rem;border:1px solid #cbd5e1;border-radius:8px;min-width:120px;'
          });

          // per-blank hint (content filled on grade; prefers blank-level, falls back to item-level)
          const hintBtn = el('button', { type:'button', class:'btn tiny' }, 'Ver pista');
          const hintBox = el('div', { class:'tiny muted', style:'display:none;margin-top:.15rem;' });
          hintBtn.addEventListener('click', ()=>{
            hintBox.style.display = (hintBox.style.display === 'none') ? 'block' : 'none';
          });

          // per-blank feedback
          const fbBox = el('div', { class:'tiny', style:'display:none;margin-top:.15rem;' });

          wrap.appendChild(input);
          wrap.appendChild(hintBtn);
          wrap.appendChild(hintBox);
          wrap.appendChild(fbBox);

          controls.push({ key, input, hintBtn, hintBox, fbBox });
          container.appendChild(wrap);
        }
      }
      card.appendChild(container);

      // checker — grade per blank; show overall line + collapsible summary
      const overallBox = el('div', { class:'tiny', style:'margin-top:.25rem;' });
      const checkBtn = el('button', { type:'button', class:'btn tiny' }, 'Comprobar');

      // Collapsible "Resumen" container
      const sumWrap = el('details', { style:'margin-top:.4rem;border:1px solid #e5e7eb;border-radius:10px;background:#fff;' });
      const sumHead = el('summary', { style:'cursor:pointer;list-style:none;padding:.45rem .6rem;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:.4rem;' }, [
        document.createTextNode('📋 Resumen')
      ]);
      const sumBody = el('div', { style:'padding:.5rem .6rem;border-top:1px solid #e5e7eb;display:flex;flex-direction:column;gap:.45rem;' });
      sumWrap.appendChild(sumHead);
      sumWrap.appendChild(sumBody);

      checkBtn.addEventListener('click', ()=>{
        const blanks = Array.isArray(it.blanks) ? it.blanks : [];
        const byKey = new Map(blanks.map(b => [b.key, b]));
        let allOk = true;

        // clear previous summary rows
        sumBody.innerHTML = '';

        controls.forEach(({ key, input, hintBox, fbBox }) => {
          const cfg = byKey.get(key);
          const raw = (input.value || '').trim();

          if (!cfg) {
            allOk = false;
            input.style.borderColor = '#b91c1c';
            fbBox.textContent = 'Este hueco no está configurado.';
            fbBox.style.color = '#b91c1c';
            fbBox.style.display = 'block';
            hintBox.textContent = (it.hint || '');

            // summary row
            const row = el('div', { style:'display:grid;grid-template-columns:70px 1fr;gap:.5rem;align-items:start;' });
            row.appendChild(el('div', { class:'tiny muted', style:'font-weight:700;text-align:right;' }, key));
            row.appendChild(el('div', { class:'tiny', style:'color:#b91c1c;' }, 'Hueco sin configurar.'));
            sumBody.appendChild(row);
            return;
          }

          // rules
          const caseSensitive = !!cfg.case_sensitive;
          const normAccents  = (cfg.normalize_accents !== false);
          const norm = (s) => {
            let o = s;
            if (!caseSensitive) o = o.toLowerCase();
            if (normAccents) o = stripAccents(o);
            return o;
          };

          const answers = Array.isArray(cfg.answers) ? cfg.answers : [];
          const valN = norm(raw);
          const ansN = answers.map(a => norm((a || '').trim())).filter(Boolean);
          const ok = ansN.includes(valN);
          if (!ok) allOk = false;

          // per-blank border + feedback
          input.style.borderColor = ok ? '#16a34a' : '#b91c1c';
          fbBox.textContent = ok
            ? (cfg.feedback_correct || '¡Correcto!')
            : (cfg.feedback_incorrect || 'Revisá esta respuesta.');
          fbBox.style.color = ok ? '#15803d' : '#b91c1c';
          fbBox.style.display = 'block';

          // per-blank hint: prefer blank-level, else item-level
          hintBox.textContent = (cfg.hint || '');

          // summary row
          const row = el('div', { style:'display:grid;grid-template-columns:70px 1fr;gap:.5rem;align-items:start;' });
          row.appendChild(el('div', { class:'tiny muted', style:'font-weight:700;text-align:right;' }, key));

          const right = el('div', { class:'tiny', style:'display:flex;flex-direction:column;gap:.2rem;' });

          const yourAns = el('div', {}, [
            el('span', { class:'muted' }, 'Tu respuesta: '),
            el('code', { style:`padding:.1rem .3rem;border:1px solid ${ok ? '#86efac' : '#fecaca'};border-radius:6px;background:${ok ? '#f0fdf4' : '#fef2f2'};` }, raw || '—')
          ]);

          const corr = el('div', {}, [
            el('span', { class:'muted' }, 'Correctas: '),
            el('code', { style:'padding:.1rem .3rem;border:1px solid #e5e7eb;border-radius:6px;background:#f8fafc;' }, (answers.join(', ') || '—'))
          ]);

          const fbLine = el('div', { style:`color:${ok ? '#15803d' : '#b91c1c'};` },
            ok ? (cfg.feedback_correct || '¡Correcto!') : (cfg.feedback_incorrect || 'Revisá esta respuesta.')
          );

          right.appendChild(yourAns);
          right.appendChild(corr);
          right.appendChild(fbLine);
          row.appendChild(right);

          sumBody.appendChild(row);
        });

        // open summary the first time user checks
        if (!sumWrap.hasAttribute('data-opened')) {
          sumWrap.open = true;
          sumWrap.setAttribute('data-opened','1');
        }

        overallBox.textContent = allOk ? '¡Todas correctas!' : 'Algunas respuestas necesitan revisión.';
        overallBox.style.color = allOk ? '#15803d' : '#b91c1c';
      });

      card.appendChild(checkBtn);
      card.appendChild(overallBox);
      card.appendChild(sumWrap);

      prevContent.appendChild(card);

      function gradeCloze(item, inputs){
        let allOk = true;
        const blanks = Array.isArray(item.blanks) ? item.blanks : [];
        const byKey = new Map(blanks.map(b => [b.key, b]));
        inputs.forEach(inp=>{
          const key = inp.getAttribute('data-key');
          const cfg = byKey.get(key);
          const valRaw = (inp.value || '').trim();
          let val = valRaw;
          let answers = (cfg && Array.isArray(cfg.answers)) ? cfg.answers.slice() : [];
          if (!cfg) { allOk = false; inp.style.borderColor='#b91c1c'; return; }
          if (!cfg.case_sensitive){ val = val.toLowerCase(); answers = answers.map(a => a.toLowerCase()); }
          if (cfg.normalize_accents !== false){ val = stripAccents(val); answers = answers.map(stripAccents); }
          const hit = answers.includes(val);
          inp.style.borderColor = hit ? '#16a34a' : '#b91c1c';
          if (!hit) allOk = false;
        });
        return { ok: allOk };
      }
    });
  }

  function refreshPreview(){ renderClozePreview(buildItemsSnapshot()); }

  // Build preview shell now (collapsed)
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
    if (t && (t.id === 'btnAddClozeItem' || t.textContent === 'Eliminar' || t.textContent === '+ Agregar hueco')) {
      setTimeout(_autoPreview, 0);
    }
  });

  // ---------- submit ----------
  form.addEventListener('submit', async (e)=>{
    // collect items
    const cards = [...itemsList.querySelectorAll('.cloze-item')];
    const items = cards.map(c => c._get()).filter(it => {
      const hasPrompt = !!it.prompt;
      const hasBlanks = Array.isArray(it.blanks) && it.blanks.length > 0 && it.blanks.every(b => Array.isArray(b.answers) && b.answers.length);
      const tokenCount = (it.prompt.match(/\[\[B\d+\]\]/g) || []).length;
      return hasPrompt && hasBlanks && tokenCount === it.blanks.length;
    });
    if (!items.length) {
      e.preventDefault();
      alert('Agregá al menos 1 oración con al menos 1 hueco y definí sus respuestas. Asegurate que los tokens [[B#]] coincidan con la lista.');
      return;
    }
    payload.value = JSON.stringify(items);

    // intercept and POST via fetch (consistent UX)
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