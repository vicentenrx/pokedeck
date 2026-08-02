// ═══════════════════════════════════════════════════════════════
// CARD SEARCH AUTOCOMPLETE (fábrica compartilhada — Adicionar e Editar Carta)
// ═══════════════════════════════════════════════════════════════
// A lista de sugestões é position:absolute (flutua sobre o formulário). Sem
// isso ela cobre os campos de preenchimento manual logo abaixo — show()/hide()
// reservam o espaço empurrando o restante do formulário pra baixo.
// getTimer/setTimer são indireção porque cada modal debouncia num `let`
// global próprio (searchTmr / editSearchTmr, ver state.js) — um timer só
// faria um modal cancelar a busca do outro se os dois abrissem ao mesmo tempo.
function setupCardSuggest({ modalSel, searchId, suggId, setFilterId, getTimer, setTimer, clearPending, onSelect, emptyMsg, errorMsg }) {
  function show() {
    $(suggId).classList.remove('hidden');
    $(suggId).closest('.mf').style.marginBottom = '244px';
  }
  function hide() {
    $(suggId).classList.add('hidden');
    $(suggId).closest('.mf').style.marginBottom = '';
  }
  $(searchId).addEventListener('input', () => {
    clearTimeout(getTimer());
    clearPending();
    const q = $(searchId).value.trim();
    const sugg = $(suggId);
    if (q.length < 2) { hide(); return; }
    sugg.innerHTML = '<div class="cs-load">Buscando...</div>';
    show();
    setTimer(setTimeout(async () => {
      const results = await apiSearch(q, 20, $(setFilterId).value);
      if (results === null) { sugg.innerHTML = `<div class="cs-load">${errorMsg}</div>`; return; }
      if (!results.length) { sugg.innerHTML = `<div class="cs-load">${emptyMsg}</div>`; return; }
      sugg.innerHTML = '';
      results.forEach(card => {
        const img = card.images?.small || '';
        const item = document.createElement('div');
        item.className = 'cs-item';
        item.innerHTML = img
          ? `<img class="cs-th" src="${esc(img)}" alt="${esc(card.name)}">`
          : `<div class="cs-th" style="display:flex;align-items:center;justify-content:center;font-size:18px">🃏</div>`;
        item.innerHTML += `<div class="cs-info"><div class="cs-n">${esc(card.name)}</div><div class="cs-s">${esc(card.set?.name||'')} ${esc(card.number||'')}</div></div>`;
        item.addEventListener('click', () => { onSelect(card, img); hide(); });
        sugg.appendChild(item);
      });
    }, 350));
  });
  document.addEventListener('click', e => { if (!e.target.closest(modalSel)) hide(); });
  return { show, hide };
}

// ═══════════════════════════════════════════════════════════════
// FILTRO DE COLEÇÃO (dropdown compartilhado — Adicionar e Editar Carta)
// ═══════════════════════════════════════════════════════════════
// Popula um <select> de coleções (mais recente primeiro), usado tanto no
// Adicionar Carta quanto no Editar Carta — cada um busca só uma vez (fica
// vazio de novo só se a página recarregar). Tenta 3x: sem retry, um único
// 500 (a API já se mostrou instável a esse ponto) deixava o dropdown preso
// pra sempre em só "Todas as coleções", parecendo que a função tinha sumido.
async function populateSetFilter(sel) {
  if (sel.options.length > 1) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ptcgFetch(`${PTCG}/sets?select=name,ptcgoCode&pageSize=250&orderBy=-releaseDate`, 10000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      (d.data || []).forEach(s => {
        if (!s.ptcgoCode) return;
        const opt = document.createElement('option');
        opt.value       = s.ptcgoCode;
        opt.textContent = `${s.name} (${s.ptcgoCode})`;
        sel.appendChild(opt);
      });
      return;
    } catch (err) {
      if (attempt === 3) console.warn('[ptcg] populateSetFilter falhou 3x:', err);
    }
  }
}
