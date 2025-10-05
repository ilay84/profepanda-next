(function () {
    try {
        const itemsList = document.getElementById('itemsList');
        const btnAdd = document.getElementById('btnAddItem');
        const form = document.getElementById('ex-tf-form');
        const payload = document.getElementById('itemsPayload');

        const btnCancel = document.getElementById('btnCancel');
        const modal = document.getElementById('ex-modal');
        const modalClose = document.getElementById('ex-modal-close');
        const modalBackdrop = document.getElementById('ex-modal-backdrop');

        // Simple helper to create elements
        function el(tag, attrs = {}, children = []) {
            const node = document.createElement(tag);
            Object.entries(attrs).forEach(([k, v]) => {
                if (k === 'class') node.className = v;
                else if (k === 'style') node.setAttribute('style', v);
                else node.setAttribute(k, v);
            });
            (Array.isArray(children) ? children : [children]).forEach(c => {
                if (typeof c === 'string') node.appendChild(document.createTextNode(c)); else if (c) node.appendChild(c);
            });
            return node;
        }

        function itemCard(idx) {
            const wrap = el('div', { class: 'tf-item', style: 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;' });
            wrap._rm = { image: false, audio: false, video: false, yt: false, alt: false }; // track deletes
            const header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;' });
            header.appendChild(el('div', { class: 'muted' }, [`Pregunta #${idx + 1}`]));
            const btnDel = el('button', { type: 'button', class: 'btn' }, 'Eliminar');
            btnDel.addEventListener('click', () => { wrap.remove(); isDirty = true; });
            header.appendChild(btnDel);

            const prompt = el('textarea', {
                placeholder: 'Enunciado de la afirmación…',
                rows: '2',
                style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;'
            });

            const answerRow = el('div', { class: 'row tf-radio', style: 'gap:1rem;align-items:center;margin:.25rem 0;' });
            const radioName = 'ans-' + (
                (window.crypto && typeof window.crypto.randomUUID === 'function')
                    ? window.crypto.randomUUID()
                    : (Date.now() + '-' + Math.random().toString(36).slice(2))
            );

            const trueOpt = el('label', {}, [
                el('input', { type: 'radio', name: radioName, value: 'true' }),
                el('span', {}, 'Verdadero')
            ]);
            const falseOpt = el('label', {}, [
                el('input', { type: 'radio', name: radioName, value: 'false' }),
                el('span', {}, 'Falso')
            ]);
            answerRow.appendChild(el('div', { class: 'muted' }, 'Respuesta correcta:'));

            // Ensure both radios share the same name group
            falseOpt.firstChild.name = trueOpt.firstChild.name;
            answerRow.appendChild(trueOpt);
            answerRow.appendChild(falseOpt);

            const fbOk = el('textarea', {
                placeholder: 'Feedback para respuesta correcta (opcional)',
                rows: '2',
                style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;'
            });
            const fbBad = el('textarea', {
                placeholder: 'Feedback para respuesta incorrecta (opcional)',
                rows: '2',
                style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;'
            });
            const hint = el('textarea', {
                placeholder: 'Pista (opcional; si hay pista, el botón “Ver pista” aparecerá)',
                rows: '2',
                style: 'width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:8px;margin:.25rem 0;'
            });

            // --- NEW (final): Media at TOP with compact header, progressive disclosure, DnD, validation ---
            const mediaBlock = el('div', {
                class: 'tf-media',
                style: [
                    'border:1px dashed #cbd5e1',
                    'border-radius:12px',
                    'padding:.5rem',
                    'margin:.25rem 0 .6rem',
                    'background:#f8fafc'
                ].join(';')
            });

            // header row with toggle button
            const mediaHdr = el('div', {
                style: 'display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.25rem;'
            });
            const mediaTitle = el('div', {
                class: 'muted',
                style: 'font-weight:700;letter-spacing:.2px;display:flex;align-items:center;gap:.4rem;'
            }, '🖼️🎧 Media (opcional)');
            const btnToggle = el('button', {
                type: 'button',
                class: 'btn tiny',
                style: 'padding:.3rem .55rem;border-radius:999px;'
            }, '+ Agregar media');
            mediaHdr.appendChild(mediaTitle);
            mediaHdr.appendChild(btnToggle);

            // container that expands/collapses
            const mediaInner = el('div', {
                style: [
                    'display:none',
                    'border-top:1px dashed #d1d5db',
                    'margin-top:.4rem',
                    'padding-top:.5rem'
                ].join(';')
            });

            // Keep index alignment for uploaded files on the server
            const mediaIndex = el('input', { type: 'hidden', name: 'media_index[]', value: String(idx) });

            // Row 1: Imagen (label above, button + filename + delete) + Alt
            const rowImg = el('div', { style: 'display:grid;grid-template-columns: 1fr 1fr;gap:.6rem;align-items:start;' });

            const imgWrap = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem;' });
            const imgLabel = el('label', { class: 'tiny muted' }, '📷 Imagen');

            // button + filename + delete
            const imgCtl = el('div', { style: 'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
            const imgBtn = el('label', {
                style: [
                    'display:inline-flex', 'align-items:center', 'gap:.4rem',
                    'padding:.35rem .65rem', 'background:#f8fafc', 'color:#0f172a',
                    'border:1px solid #cbd5e1', 'border-radius:8px', 'cursor:pointer',
                    'font-size:.9rem', 'line-height:1'
                ].join(';')
            }, 'Elegir archivo');
            const imgInput = el('input', {
                type: 'file',
                name: 'media_image[]',
                accept: 'image/*',
                style: 'display:none;'
            });
            imgBtn.appendChild(imgInput);

            const imgName = el('span', { class: 'tiny muted' }, '');
            const delImgBtn = el('button', {
                type: 'button',
                class: 'btn tiny',
                style: 'padding:.25rem .5rem;'
            }, 'Quitar');

            imgCtl.appendChild(imgBtn);
            imgCtl.appendChild(imgName);
            imgCtl.appendChild(delImgBtn);

            imgWrap.appendChild(imgLabel);
            imgWrap.appendChild(imgCtl);

            const altWrap = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem;' });
            const altLabel = el('label', { class: 'tiny muted' }, '🔤 Alt text (para lectores de pantalla)');
            const imgAlt = el('input', {
                type: 'text',
                name: 'media_image_alt[]',
                placeholder: 'Breve descripción de la imagen',
                style: 'padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;width:100%;'
            });
            altWrap.appendChild(altLabel);
            altWrap.appendChild(imgAlt);

            rowImg.appendChild(imgWrap);
            rowImg.appendChild(altWrap);

            // reflect chosen file name
            imgInput.addEventListener('change', () => {
                imgName.textContent = (imgInput.files[0] && imgInput.files[0].name) || '';
                if (wrap._rm) wrap._rm.image = false; // user picked a new one; cancel delete
            });
            // delete existing image or clear newly chosen one
            delImgBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!wrap._rm) wrap._rm = { image: false, audio: false, video: false, yt: false, alt: false };
                // clear <input type="file">
                const dt = new DataTransfer();
                imgInput.files = dt.files;
                // clear chip + mark for deletion
                imgName.textContent = '';
                wrap._rm.image = true;
                // also clear the existing media so preview reflects removal
                if (wrap._existingMedia) wrap._existingMedia.image = null;
            });

            // Row 2: Audio (stacked; subtle button + filename)
            const rowAud = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem;margin-top:.4rem;' });
            const audLabel = el('label', { class: 'tiny muted' }, '🎤 Audio');

            const audCtl = el('div', { style: 'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
            const audBtn = el('label', {
                style: [
                    'display:inline-flex', 'align-items:center', 'gap:.4rem',
                    'padding:.35rem .65rem', 'background:#f8fafc', 'color:#0f172a',
                    'border:1px solid #cbd5e1', 'border-radius:8px', 'cursor:pointer',
                    'font-size:.9rem', 'line-height:1'
                ].join(';')
            }, 'Elegir archivo');
            const audInput = el('input', {
                type: 'file',
                name: 'media_audio[]',
                accept: 'audio/*',
                style: 'display:none;'
            });
            audBtn.appendChild(audInput);
            const audName = el('span', { class: 'tiny muted' }, '');
            const audDel = el('button', { type: 'button', class: 'btn tiny', style: 'padding:.25rem .5rem;' }, 'Quitar');

            audDel.addEventListener('click', () => {
                wrap._rm.audio = true;
                audInput.value = '';
                audName.textContent = '(eliminado)';
            });
            audInput.addEventListener('change', () => {
                if (audInput.files[0]) {
                    wrap._rm.audio = false;           // new file cancels deletion
                    audName.textContent = audInput.files[0].name;
                } else if (!wrap._existingMedia?.audio) {
                    audName.textContent = '';
                }
            });

            audCtl.appendChild(audBtn);
            audCtl.appendChild(audName);
            audCtl.appendChild(audDel);

            rowAud.appendChild(audLabel);
            rowAud.appendChild(audCtl);

            // Row 3: Video + YouTube (two columns; subtle button + filename)
            const rowVid = el('div', { style: 'display:grid;grid-template-columns: 1fr 1fr;gap:.6rem;align-items:start;margin-top:.4rem;' });

            const vidWrap = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem;' });
            const vidLabel = el('label', { class: 'tiny muted' }, '🎬 Video (archivo)');

            const vidCtl = el('div', { style: 'display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;' });
            const vidBtn = el('label', {
                style: [
                    'display:inline-flex', 'align-items:center', 'gap:.4rem',
                    'padding:.35rem .65rem', 'background:#f8fafc', 'color:#0f172a',
                    'border:1px solid #cbd5e1', 'border-radius:8px', 'cursor:pointer',
                    'font-size:.9rem', 'line-height:1'
                ].join(';')
            }, 'Elegir archivo');
            const vidInput = el('input', {
                type: 'file',
                name: 'media_video[]',
                accept: 'video/*',
                style: 'display:none;'
            });
            vidBtn.appendChild(vidInput);
            const vidName = el('span', { class: 'tiny muted' }, '');
            const vidDel = el('button', { type: 'button', class: 'btn tiny', style: 'padding:.25rem .5rem;' }, 'Quitar');

            vidDel.addEventListener('click', () => {
                wrap._rm.video = true;
                vidInput.value = '';
                vidName.textContent = '(eliminado)';
            });
            vidInput.addEventListener('change', () => {
                if (vidInput.files[0]) {
                    wrap._rm.video = false;           // new file cancels deletion
                    vidName.textContent = vidInput.files[0].name;
                } else if (!wrap._existingMedia?.video) {
                    vidName.textContent = '';
                }
            });

            vidCtl.appendChild(vidBtn);
            vidCtl.appendChild(vidName);
            vidCtl.appendChild(vidDel);

            vidWrap.appendChild(vidLabel);
            vidWrap.appendChild(vidCtl);

            const ytWrap = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem;' });
            const ytLabel = el('label', { class: 'tiny muted' }, '🔗 YouTube URL');
            const ytRow = el('div', { style: 'display:flex;gap:.5rem;align-items:center;' });
            const ytInput = el('input', {
                type: 'url',
                name: 'media_youtube_url[]',
                placeholder: 'https://www.youtube.com/watch?v=…',
                style: 'flex:1;padding:.45rem .55rem;border:1px solid #cbd5e1;border-radius:8px;'
            });
            const ytDel = el('button', { type: 'button', class: 'btn tiny', style: 'padding:.25rem .5rem;white-space:nowrap;' }, 'Borrar');
            ytDel.addEventListener('click', () => { wrap._rm.yt = true; ytInput.value = ''; ytInput.dispatchEvent(new Event('input')); });
            ytRow.appendChild(ytInput);
            ytRow.appendChild(ytDel);
            ytWrap.appendChild(ytLabel);
            ytWrap.appendChild(ytRow);

            rowVid.appendChild(vidWrap);
            rowVid.appendChild(ytWrap);

            // filename reflectors
            imgInput.addEventListener('change', () => { imgName.textContent = (imgInput.files[0] && imgInput.files[0].name) || ''; });
            audInput.addEventListener('change', () => { audName.textContent = (audInput.files[0] && audInput.files[0].name) || ''; });
            vidInput.addEventListener('change', () => { vidName.textContent = (vidInput.files[0] && vidInput.files[0].name) || ''; });

            // Row 4: formats hint
            const rowHint = el('div', {
                class: 'tiny muted',
                style: 'margin-top:.4rem;'
            }, 'Formatos soportados: JPG/PNG, MP3, MP4. Podés arrastrar archivos a esta caja.');

            // assemble collapsible inner
            mediaInner.appendChild(rowImg);
            mediaInner.appendChild(rowAud);
            mediaInner.appendChild(rowVid);
            mediaInner.appendChild(rowHint);
            mediaInner.appendChild(mediaIndex);

            // add header + inner to block
            mediaBlock.appendChild(mediaHdr);
            mediaBlock.appendChild(mediaInner);

            // Toggle behavior
            let open = false;
            btnToggle.addEventListener('click', () => {
                open = !open;
                mediaInner.style.display = open ? 'block' : 'none';
                btnToggle.textContent = open ? '− Ocultar media' : '+ Agregar media';
            });

            // Drag & drop to assign files automatically
            function acceptDrop(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            mediaBlock.addEventListener('dragover', acceptDrop);
            mediaBlock.addEventListener('dragenter', acceptDrop);
            mediaBlock.addEventListener('drop', (e) => {
                acceptDrop(e);
                const files = e.dataTransfer && e.dataTransfer.files ? [...e.dataTransfer.files] : [];
                if (!files.length) return;
                // Open the panel if closed
                if (!open) { btnToggle.click(); }

                for (const f of files) {
                    const mt = (f.type || '').toLowerCase();
                    if (mt.startsWith('image/') && imgInput && !imgInput.files.length) {
                        const dt = new DataTransfer(); dt.items.add(f); imgInput.files = dt.files;
                    } else if (mt.startsWith('audio/') && audInput && !audInput.files.length) {
                        const dt = new DataTransfer(); dt.items.add(f); audInput.files = dt.files;
                    } else if (mt.startsWith('video/') && vidInput && !vidInput.files.length) {
                        const dt = new DataTransfer(); dt.items.add(f); vidInput.files = dt.files;
                    }
                }
            });

            // YouTube URL validation (live)
            function validYouTube(u) {
                if (!u) return true;
                try {
                    const url = new URL(u);
                    const host = url.hostname.replace(/^www\./, '');
                    if (host === 'youtube.com' || host === 'youtu.be') return true;
                } catch (_) { }
                return false;
            }
            ytInput.addEventListener('input', () => {
                const ok = validYouTube(ytInput.value.trim());
                ytInput.style.borderColor = ok ? '#cbd5e1' : '#dc2626';
            });
            // --- END NEW ---

            // Order: header → media → prompt → radios → feedbacks → hint
            wrap.appendChild(header);
            wrap.appendChild(mediaBlock);
            wrap.appendChild(prompt);
            wrap.appendChild(answerRow);
            wrap.appendChild(fbOk);
            wrap.appendChild(fbBad);
            wrap.appendChild(hint);

            // expose getters for serialization (preserve existing media if not re-uploaded or mark for deletion)
            wrap._existingMedia = wrap._existingMedia || {};
            wrap._rm = wrap._rm || { image: false, audio: false, video: false, yt: false, alt: false };
            wrap._get = () => {
                const ansTrue = trueOpt.querySelector('input').checked;
                const ansFalse = falseOpt.querySelector('input').checked;
                const hasAnswer = ansTrue || ansFalse;

                const prev = wrap._existingMedia || {};

                const hasImg = !!(imgInput && imgInput.files && imgInput.files.length);
                const hasAud = !!(audInput && audInput.files && audInput.files.length);
                const hasVid = !!(vidInput && vidInput.files && vidInput.files.length);

                const ytVal = (ytInput && ytInput.value || '').trim();
                const altVal = (imgAlt && imgAlt.value || '').trim();

                const image = wrap._rm.image ? '__DELETE__'
                    : hasImg ? '__UPLOAD__'
                        : (prev.image || null);

                const audio = wrap._rm.audio ? '__DELETE__'
                    : hasAud ? '__UPLOAD__'
                        : (prev.audio || null);

                const video = wrap._rm.video ? '__DELETE__'
                    : hasVid ? '__UPLOAD__'
                        : (prev.video || null);

                const youtube_url = wrap._rm.yt ? '__DELETE__'
                    : (ytVal || prev.youtube_url || null);

                const image_alt = wrap._rm.alt ? '__DELETE__'
                    : (altVal || prev.image_alt || null);

                return {
                    prompt: (prompt.value || '').trim(),
                    answer: hasAnswer ? ansTrue : null,
                    feedback_correct: (fbOk.value || '').trim() || null,
                    feedback_incorrect: (fbBad.value || '').trim() || null,
                    hint: (hint.value || '').trim() || null,
                    media: { youtube_url, image_alt, image, audio, video }
                };
            };

            // expose refs for prefill/edit
            wrap._refs = {
                btnToggle, mediaInner,
                imgInput, audInput, vidInput,
                imgName, audName, vidName,
                ytInput, imgAlt
            };
            return wrap;
        } // ← closes function itemCard(idx)

        // Dirty tracking
        let isDirty = false;
        form.addEventListener('input', () => { isDirty = true; });
        btnAdd.addEventListener('click', () => { isDirty = true; });

        function renumber() {
            const cards = [...itemsList.querySelectorAll('.tf-item')];
            cards.forEach((c, i) => {
                const title = c.querySelector('.muted');
                if (title) title.textContent = `Pregunta #${i + 1}`;
                const idxHidden = c.querySelector('input[name="media_index[]"]');
                if (idxHidden) idxHidden.value = String(i);
            });
        }

        btnAdd.addEventListener('click', () => {
            const idx = itemsList.querySelectorAll('.tf-item').length;
            itemsList.appendChild(itemCard(idx));
            renumber();
            togglePreview(true);
            refreshPreview();
        });

        // Prefill from global (set by template) or seed one item
        const ex = (typeof window !== 'undefined') ? window.PP_TF_EDIT_EX : null;
        if (ex && ex.title) {
            form.querySelector("input[name=title]").value = ex.title;
        }
        if (ex && Array.isArray(ex.items) && ex.items.length) {
            ex.items.forEach((it, idx) => {
                const card = itemCard(idx);
                itemsList.appendChild(card);

                // text + answer
                card.querySelector("textarea").value = it.prompt || "";
                const radios = card.querySelectorAll("input[type=radio]");
                radios.forEach(r => { if ((r.value === "true") === !!it.answer) r.checked = true; });
                const ta = card.querySelectorAll("textarea");
                if (ta[1]) ta[1].value = it.feedback_correct || "";
                if (ta[2]) ta[2].value = it.feedback_incorrect || "";
                if (ta[3]) ta[3].value = it.hint || "";

                // media prefill + keep existing paths used by _get()
                const m = (it.media && typeof it.media === 'object') ? it.media : it;
                card._existingMedia = {
                    image: m.image || it.image || null,
                    audio: m.audio || it.audio || null,
                    video: m.video || it.video || it.video_mp4 || null,
                    youtube_url: m.youtube_url || it.youtube || it.video_iframe || null,
                    image_alt: m.image_alt || it.image_alt || it.image_caption || null
                };

                // write YT + alt inputs
                const ytInput = card.querySelector('input[name="media_youtube_url[]"]');
                const altInput = card.querySelector('input[name="media_image_alt[]"]');
                if (ytInput) ytInput.value = card._existingMedia.youtube_url || '';
                if (altInput) altInput.value = card._existingMedia.image_alt || '';

                // show filename chips + open media section when there is media
                const refs = card._refs || {};
                const base = (p) => (p ? String(p).split('/').pop() : '');
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
            // Seed with one empty item for convenience
            btnAdd.click();
        }

        // Cancel = close modal or go back to library
        function closeModal() {
            modal.classList.remove('open');
            // Optional: clean the query string when closing
            if (window.history && window.history.replaceState) {
                const url = new URL(window.location);
                url.searchParams.delete('type');
                url.searchParams.delete('id');
                window.history.replaceState({}, '', url.pathname + url.search);
            }
        }
        btnCancel.addEventListener('click', () => {
            if (isDirty && !confirm('¿Descartar cambios no guardados?')) return;
            closeModal();
        });
        modalClose.addEventListener('click', () => {
            if (isDirty && !confirm('¿Descartar cambios no guardados?')) return;
            closeModal();
        });
        modalBackdrop.addEventListener('click', () => {
            if (isDirty && !confirm('¿Descartar cambios no guardados?')) return;
            closeModal();
        });

        // ========= Preview logic (self-building, safe) =========
        // Build the preview panel dynamically and insert it just above the buttons row
        let prevWrap, prevBody, prevContent, btnPrevToggle, btnPrevRefresh;

        function ensurePreviewPanel() {
            if (prevWrap) return;

            // Panel
            prevWrap = el('div', {
                id: 'ex-preview-wrap',
                class: 'ex-panel',
                style: 'border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-top:.5rem;'
            });

            // Header
            const header = el('header', {
                style: 'display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:.6rem .8rem;border-bottom:1px solid #e5e7eb;'
            });
            const title = el('div', { class: 'muted', style: 'font-weight:600;' }, '👀 Vista previa');
            const controls = el('div', { class: 'row', style: 'gap:.4rem;' });
            btnPrevToggle = el('button', { type: 'button', class: 'btn tiny' }, '+ Mostrar');
            btnPrevRefresh = el('button', { type: 'button', class: 'btn tiny' }, 'Actualizar vista');
            controls.appendChild(btnPrevToggle);
            controls.appendChild(btnPrevRefresh);
            header.appendChild(title);
            header.appendChild(controls);

            // Body
            prevBody = el('div', { id: 'ex-preview-body', style: 'display:none;padding:.75rem;background:#fff;' });
            prevBody.appendChild(el('div', { class: 'tiny muted', style: 'margin-bottom:.5rem;' },
                'Esta vista previa no guarda cambios. Usa “Actualizar vista” para refrescar.'));
            prevContent = el('div', { id: 'ex-preview-content', style: 'display:flex;flex-direction:column;gap:.75rem;' });

            prevBody.appendChild(prevContent);
            prevWrap.appendChild(header);
            prevWrap.appendChild(prevBody);

            // Insert before the buttons row if present; else at end of form
            const submitBtn = form.querySelector('button[type="submit"]');
            const buttonsRow = submitBtn ? submitBtn.closest('.row') : null;
            if (buttonsRow && buttonsRow.parentNode) {
                buttonsRow.parentNode.insertBefore(prevWrap, buttonsRow);
            } else {
                form.appendChild(prevWrap);
            }

            // Wire listeners after elements exist
            btnPrevToggle.addEventListener('click', () => {
                togglePreview();
                // if we just opened it, render a fresh preview
                if (prevBody && prevBody.style.display !== 'none') {
                    refreshPreview();
                }
            });
            btnPrevRefresh.addEventListener('click', () => {
                togglePreview(true);
                refreshPreview();
            });
        }

        function togglePreview(open) {
            ensurePreviewPanel();
            const isOpen = (prevBody.style.display !== 'none');
            const next = (typeof open === 'boolean') ? open : !isOpen;
            prevBody.style.display = next ? 'block' : 'none';
            btnPrevToggle.textContent = next ? '− Ocultar' : '+ Mostrar';
        }

        function buildItemsSnapshot() {
            const toAbs = (p) => {
                if (!p) return null;
                p = String(p);

                // already absolute? (http/https/blob/data)
                if (/^(https?:|blob:|data:)/i.test(p)) return p;

                // normalize "static/..." → "/static/..."
                if (p.startsWith('static/')) p = '/' + p;

                // now make absolute from site origin
                if (p.startsWith('/')) {
                    return window.location.origin + p;
                }
                return window.location.origin + '/' + p;
            };

            const cards = [...itemsList.querySelectorAll('.tf-item')];
            return cards.map((card, i) => {
                const snap = (typeof card._get === 'function') ? card._get() : null;
                if (!snap) return null;
                snap._idx = i;

                const m = (snap.media && typeof snap.media === 'object') ? snap.media : {};
                const prev = card._existingMedia || {};

                // resolve placeholders coming from _get()
                if (m.image === '__UPLOAD__') m.image = prev.image || null;
                if (m.audio === '__UPLOAD__') m.audio = prev.audio || null;
                if (m.video === '__UPLOAD__') m.video = prev.video || null;

                // absolute-ize saved /static paths
                m.image = toAbs(m.image);
                m.audio = toAbs(m.audio);
                m.video = toAbs(m.video);

                // local blob previews if new files were picked
                const imgInput = card.querySelector('input[name="media_image[]"]');
                const audInput = card.querySelector('input[name="media_audio[]"]');
                const vidInput = card.querySelector('input[name="media_video[]"]');
                if (imgInput && imgInput.files && imgInput.files[0]) m.image = URL.createObjectURL(imgInput.files[0]);
                if (audInput && audInput.files && audInput.files[0]) m.audio = URL.createObjectURL(audInput.files[0]);
                if (vidInput && vidInput.files && vidInput.files[0]) m.video = URL.createObjectURL(vidInput.files[0]);

                snap.media = m;
                return snap;
            }).filter(Boolean);
        }

        function renderTFPreview(items) {
            ensurePreviewPanel();
            prevContent.innerHTML = '';
            if (!items || !items.length) {
                prevContent.appendChild(el('div', { class: 'tiny muted' }, 'No hay preguntas aún.'));
                return;
            }

            items.forEach((it) => {
                const card = el('div', { style: 'border:1px solid #e5e7eb;border-radius:12px;padding:.75rem;background:#fff;display:flex;flex-direction:column;gap:.5rem;' });

                // Media (if any)
                const m = it.media || {};
                const mediaRow = el('div', { style: 'display:flex;gap:.75rem;flex-wrap:wrap;align-items:flex-start;' });
                let hasMedia = false;

                if (m.image) {
                    hasMedia = true;
                    mediaRow.appendChild(el('img', {
                        src: m.image, alt: m.image_alt || '',
                        style: 'max-width:220px;border:1px solid #e5e7eb;border-radius:8px;'
                    }));
                }
                if (m.audio) {
                    hasMedia = true;
                    const aud = el('audio', { controls: '', style: 'display:block;min-width:220px;' });
                    aud.src = m.audio;
                    mediaRow.appendChild(aud);
                }
                if (m.video) {
                    hasMedia = true;
                    const vid = el('video', { controls: '', style: 'display:block;max-width:320px;border-radius:6px;' });
                    vid.src = m.video;
                    mediaRow.appendChild(vid);
                }
                if (m.youtube_url) {
                    hasMedia = true;
                    try {
                        const url = new URL(m.youtube_url, window.location.href);
                        let id = url.searchParams.get('v');
                        if (!id) id = url.pathname.split('/').pop();
                        const iframe = el('iframe', {
                            src: `https://www.youtube.com/embed/${id}`,
                            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                            allowfullscreen: '', style: 'width:320px;height:180px;border:0;border-radius:6px;'
                        });
                        mediaRow.appendChild(iframe);
                    } catch (_) { }
                }
                if (hasMedia) card.appendChild(mediaRow);

                // Prompt
                card.appendChild(el('div', { style: 'font-weight:600;color:#0f172a;' }, it.prompt || '(sin enunciado)'));

                // True/False actions
                const actions = el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;' });
                const btnV = el('button', { type: 'button', class: 'btn tiny' }, 'Verdadero');
                const btnF = el('button', { type: 'button', class: 'btn tiny' }, 'Falso');
                actions.appendChild(btnV);
                actions.appendChild(btnF);
                card.appendChild(actions);

                // Hint + feedback
                if (it.hint) {
                    const hintBtn = el('button', { type: 'button', class: 'btn tiny' }, 'Ver pista');
                    const hintBox = el('div', { class: 'tiny muted', style: 'display:none;margin-top:.25rem;' }, it.hint);
                    hintBtn.addEventListener('click', () => {
                        hintBox.style.display = (hintBox.style.display === 'none') ? 'block' : 'none';
                    });
                    card.appendChild(hintBtn);
                    card.appendChild(hintBox);
                }
                const fbBox = el('div', { style: 'margin-top:.25rem;' });
                card.appendChild(fbBox);

                function grade(answer) {
                    const correct = !!it.answer;
                    const ok = (answer === correct);
                    fbBox.textContent = ok ? (it.feedback_correct || '¡Correcto!') : (it.feedback_incorrect || 'No es correcto.');
                    fbBox.style.color = ok ? '#15803d' : '#b91c1c';
                }
                btnV.addEventListener('click', () => grade(true));
                btnF.addEventListener('click', () => grade(false));

                prevContent.appendChild(card);
            });
        }

        function refreshPreview() {
            renderTFPreview(buildItemsSnapshot());
        }

        // Build panel immediately (collapsed) so the button is always visible
        ensurePreviewPanel();

        // Throttled auto-refresh when fields change (only if preview is open)
        function _throttle(fn, wait) {
            let t = 0, last = 0;
            return function (...args) {
                const now = Date.now();
                const remain = wait - (now - last);
                clearTimeout(t);
                if (remain <= 0) {
                    last = now;
                    fn.apply(this, args);
                } else {
                    t = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, remain);
                }
            };
        }
        const _autoPreview = _throttle(() => {
            if (prevBody && prevBody.style.display !== 'none') {
                refreshPreview();
            }
        }, 250);

        form.addEventListener('input', _autoPreview);
        itemsList.addEventListener('click', (e) => {
            // catch add/remove item actions and re-render if open
            const target = e.target;
            if (target && (target.id === 'btnAddItem' || target.textContent === 'Eliminar')) {
                setTimeout(_autoPreview, 0);
            }
        });

        // ========= /Preview logic =========

        // Submit
        form.addEventListener('submit', async (e) => {
            // Build items array
            const cards = [...itemsList.querySelectorAll('.tf-item')];
            const items = cards.map(c => c._get()).filter(it => (it.prompt && it.answer !== null));
            if (items.length === 0) {
                e.preventDefault();
                alert('Agregá al menos 1 pregunta y marcá su respuesta correcta (V/F).');
                return;
            }
            payload.value = JSON.stringify(items);

            // Intercept submit to show a toast and stay on page
            e.preventDefault();

            // Tiny toast helper (created once)
            function showToast(msg, isErr) {
                let t = document.getElementById('pp-toast');
                if (!t) {
                    t = document.createElement('div');
                    t.id = 'pp-toast';
                    t.setAttribute('style',
                        'position:fixed;bottom:16px;right:16px;z-index:99999;padding:10px 12px;border-radius:10px;' +
                        'border:1px solid #e5e7eb;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.12);' +
                        'color:#0f172a;font:14px/1.2 system-ui;display:none;'
                    );
                    document.body.appendChild(t);
                }
                t.style.borderColor = isErr ? '#dc2626' : '#16a34a';
                t.style.boxShadow = isErr ? '0 8px 30px rgba(220,38,38,.25)' : '0 8px 30px rgba(22,163,74,.25)';
                t.textContent = msg;
                t.style.display = 'block';
                setTimeout(() => { t.style.display = 'none'; }, 2000);
            }

            try {
                const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
                const data = await res.json().catch(() => ({ success: false, error: 'Respuesta inválida' }));
                if (data && data.success) {
                    showToast('✔️ Ejercicio guardado', false);
                    // brief pause, then return to library
                    setTimeout(() => { window.location.href = (window.PP_ADMIN_LIBRARY_URL || '/admin/exercises'); }, 600);
                } else {
                    showToast('❌ ' + (data && data.error ? data.error : 'Error al guardar'), true);
                }
            } catch (err) {
                showToast('❌ Error de red al guardar', true);
            }
        });
    } catch (err) {
        console.error('Exercises admin error:', err);
        // show a quick, non-blocking toast so you see the error message in the UI
        try {
            let t = document.getElementById('pp-toast');
            if (!t) {
                t = document.createElement('div');
                t.id = 'pp-toast';
                t.setAttribute('style',
                    'position:fixed;bottom:16px;right:16px;z-index:99999;padding:10px 12px;border-radius:10px;' +
                    'border:1px solid #dc2626;background:#fff;box-shadow:0 8px 30px rgba(220,38,38,.25);' +
                    'color:#0f172a;font:14px/1.2 system-ui;'
                );
                document.body.appendChild(t);
            }
            t.textContent = 'Editor error: ' + (err && err.message ? err.message : String(err));
            t.style.display = 'block';
            setTimeout(() => { t.style.display = 'none'; }, 5000);
        } catch (_) { }
    }
})();