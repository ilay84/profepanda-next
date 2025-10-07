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

  // ---------- Preview (inline) (DISABLED) ----------
  // The inline builder preview has been removed for Cloze.
  // We keep no-op stubs so existing calls (togglePreview, refreshPreview, _autoPreview) don't error.

  function ensurePreviewPanel() { /* preview removed */ }
  function togglePreview() { /* no-op */ }
  function refreshPreview() { /* no-op */ }

  // No-op throttle and handler kept for compatibility with any listeners or callers
  function _throttle(fn, wait) { return function () { /* no-op */ }; }
  const _autoPreview = function () { /* no-op */ };

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