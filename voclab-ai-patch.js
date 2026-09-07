/* VocLab AI vocabulary patch
   Keeps the existing UI, fixes OpenAI file input, and displays richer AI metadata. */
(function () {
  const MIME_BY_EXT = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    md: 'text/markdown'
  };

  function normalizeDataUrl(file, value) {
    let data = String(value || '');
    if (/^data:;base64,/i.test(data)) {
      const ext = (String(file && file.name || '').split('.').pop() || '').toLowerCase();
      const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
      data = data.replace(/^data:;base64,/i, `data:${mime};base64,`);
    }
    return data;
  }

  aiReadFile = function (input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 2500000) {
      const m = document.getElementById('aiStatus');
      if (m) m.textContent = 'File is too large. Maximum size is 2.5 MB.';
      input.value = '';
      return;
    }

    aiSetBusy(true, 'Reading and extracting vocabulary…');
    const r = new FileReader();
    r.onload = async () => {
      try {
        const fileData = normalizeDataUrl(file, r.result);
        if (!/^data:[^,]*;base64,/i.test(fileData)) throw { error: 'Could not encode this file. Please choose it again.' };
        const d = await aiPost({ mode: 'file', filename: file.name, fileData });
        aiDraft = d.words || [];
        aiNotice = '';
        renderAiPreview();
      } catch (e) {
        const m = document.getElementById('aiStatus');
        if (m) m.textContent = aiErrorMessage(e);
      } finally {
        input.value = '';
        aiSetBusy(false);
      }
    };
    r.onerror = () => {
      const m = document.getElementById('aiStatus');
      if (m) m.textContent = 'Could not read this file.';
      input.value = '';
      aiSetBusy(false);
    };
    r.readAsDataURL(file);
  };

  renderAiPreview = function () {
    const el = document.getElementById('aiPreview');
    if (!el) return;
    const status = document.getElementById('aiStatus');
    if (status) status.textContent = aiNotice || '';
    if (!aiDraft.length) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `<div class="myform" style="margin-top:12px">
      <h3>AI preview · ${aiDraft.length} word${aiDraft.length === 1 ? '' : 's'}</h3>
      <div class="mygrid" style="margin-bottom:12px">
        <select class="myin full" id="aiDeck">${aiDeckOptions()}</select>
      </div>
      <div style="display:grid;gap:10px;max-height:520px;overflow:auto;padding-right:2px">
        ${aiDraft.map((x, i) => `<div style="border:1px solid var(--line);border-radius:14px;padding:14px 15px;background:var(--card2)">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="spk" onclick="speak('${esc(String(x.word || ''))}')" title="Pronounce word">${SPK}</button>
            <b style="font-family:var(--en);font-size:20px">${aiSafe(x.word)}</b>
            <span class="t">${aiSafe(TY[x.type] || x.type)}</span>
            ${x.ipa ? `<span style="font-family:var(--en);font-size:13px;color:var(--mut);letter-spacing:.01em">${aiSafe(x.ipa)}</span>` : ''}
            <span style="font-family:var(--ar);direction:rtl;margin-left:auto">${aiSafe(x.arabic)}</span>
            <button class="delbtn" onclick="aiRemove(${i})" aria-label="Remove">✕</button>
          </div>
          ${x.english_definition ? `<div style="margin-top:10px;line-height:1.55;font-family:var(--en);font-size:14px"><span style="font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);margin-right:7px">Definition</span>${aiSafe(x.english_definition)}</div>` : ''}
          ${x.example ? `<div class="ex" style="margin-top:10px;display:flex;align-items:flex-start;gap:7px"><button class="spk" style="flex:0 0 auto" onclick="speak('${esc(String(x.example || ''))}')" title="Pronounce example">${SPK}</button><span>${aiSafe(x.example)}</span></div>` : ''}
          ${x.example_arabic ? `<div style="font-family:var(--ar);direction:rtl;text-align:right;color:var(--mut);font-size:14px;line-height:1.7;margin-top:5px">${aiSafe(x.example_arabic)}</div>` : ''}
        </div>`).join('')}
      </div>
      <button class="addbtn" style="width:100%;margin-top:12px" onclick="addAiDraft()">${aiDraft.length === 1 ? 'Add word' : 'Add all ' + aiDraft.length + ' words'}</button>
    </div>`;
  };

  addAiDraft = function () {
    if (!aiDraft.length) return;
    const sel = document.getElementById('aiDeck');
    const deck = sel ? sel.value : 'MY';
    let added = 0, skipped = 0;

    for (const x of aiDraft) {
      const word = String(x.word || '').trim();
      if (!word) continue;
      if (myWords.some(w => w[0] === deck && String(w[1] || '').toLowerCase() === word.toLowerCase())) {
        skipped++;
        continue;
      }
      myWords.unshift([
        deck,
        word,
        String(x.type || 'n'),
        String(x.arabic || '—'),
        String(x.example || ''),
        String(x.ipa || ''),
        String(x.english_definition || ''),
        String(x.example_arabic || '')
      ]);
      added++;
    }

    aiDraft = [];
    if (added) {
      saveMy();
      updProg();
      rebuildUnits();
    }
    aiNotice = added
      ? `✓ Added ${added} word${added === 1 ? '' : 's'}${skipped ? ` · ${skipped} already existed` : ''}`
      : (skipped ? 'All of these words already exist.' : 'No valid words found.');
    renderMy();
  };

  const originalRenderMy = renderMy;
  renderMy = function () {
    originalRenderMy();

    const fileInput = document.getElementById('aiFile');
    if (fileInput) fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.json,.md';

    const rows = document.querySelectorAll('#myList .row');
    rows.forEach((row, i) => {
      const w = myWords[i];
      if (!w) return;

      if (w[5]) {
        const wordEl = row.querySelector('.w');
        if (wordEl) wordEl.insertAdjacentHTML('afterend', `<span class="t" style="font-family:var(--en);font-weight:400">${aiSafe(w[5])}</span>`);
      }

      if (w[6]) {
        const d = document.createElement('div');
        d.style.cssText = 'font-family:var(--en);font-size:13px;line-height:1.55;color:var(--mut);margin-top:7px';
        d.innerHTML = `<span style="font-size:10px;text-transform:uppercase;letter-spacing:.09em;margin-right:7px">Definition</span>${aiSafe(w[6])}`;
        row.appendChild(d);
      }

      if (w[7]) {
        const a = document.createElement('div');
        a.style.cssText = 'font-family:var(--ar);direction:rtl;text-align:right;font-size:13px;line-height:1.7;color:var(--mut);margin-top:4px';
        a.textContent = w[7];
        row.appendChild(a);
      }
    });
  };

  // Refresh the Added Words panel once so the enhanced renderer is active immediately.
  try { renderMy(); } catch (_) {}
})();
