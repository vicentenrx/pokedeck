// ═══════════════════════════════════════════════════════════════
// MOBILE SIDEBAR
// ═══════════════════════════════════════════════════════════════
function openSidebar()  { $('sidebar').classList.add('open'); $('sb-backdrop').classList.add('show'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sb-backdrop').classList.remove('show'); }

// ═══════════════════════════════════════════════════════════════
// COLOR PICKER
// ═══════════════════════════════════════════════════════════════
function buildColorPicker() {
  const row = $('color-row');
  row.innerHTML = '';
  COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'cswatch'+(c===selColor?' sel':'');
    sw.style.background = c;
    sw.addEventListener('click', () => {
      selColor = c;
      row.querySelectorAll('.cswatch').forEach(s=>s.classList.remove('sel'));
      sw.classList.add('sel');
    });
    row.appendChild(sw);
  });
}

// ═══════════════════════════════════════════════════════════════
// EDIT CARD MODAL
// ═══════════════════════════════════════════════════════════════
function openEditCard(deckId, cardId) {
  const deck = state.decks.find(d=>d.id===deckId);
  const card = deck?.cards.find(c=>c.id===cardId);
  if (!card) return;
  $('ec-id').value    = cardId;
  $('ec-name').value  = card.name;
  $('ec-set').value   = card.set || '';
  $('ec-qty').value   = card.qty;
  $('ec-qty').max     = card.type === 'Energia' ? 60 : 4;
  $('ec-type').value  = card.type;
  $('ec-search').value = '';
  $('ec-set-filter').value = '';
  pendingEditCardMeta = null;
  hideEcSugg();
  openModal('m-edit-card');
  populateSetFilter($('ec-set-filter'));
}

$('ec-type').addEventListener('change', () => {
  $('ec-qty').max = $('ec-type').value === 'Energia' ? 60 : 4;
});
$('m-edit-card-cancel').addEventListener('click', () => closeModal('m-edit-card'));

// Busca de correção — mesmo padrão do Adicionar Carta (autocomplete na API).
// Escolher uma sugestão aqui já resolve o "gostaria de ajeitar manualmente":
// grava a impressão exata (imagem/preço/raridade) na hora, sem depender de
// a busca por nome+coleção calhar de achar a carta certa sozinha.
function showEcSugg() {
  $('ec-sugg').classList.remove('hidden');
  $('ec-sugg').closest('.mf').style.marginBottom = '244px';
}
function hideEcSugg() {
  $('ec-sugg').classList.add('hidden');
  $('ec-sugg').closest('.mf').style.marginBottom = '';
}
$('ec-search').addEventListener('input', () => {
  clearTimeout(editSearchTmr);
  pendingEditCardMeta = null;
  const q = $('ec-search').value.trim();
  const sugg = $('ec-sugg');
  if (q.length < 2) { hideEcSugg(); return; }
  sugg.innerHTML = '<div class="cs-load">Buscando...</div>';
  showEcSugg();
  editSearchTmr = setTimeout(async () => {
    const results = await apiSearch(q, 20, $('ec-set-filter').value);
    if (results === null) { sugg.innerHTML='<div class="cs-load">Não conseguimos buscar agora — a API do Pokémon TCG está instável. Tente de novo em instantes.</div>'; return; }
    if (!results.length) { sugg.innerHTML='<div class="cs-load">Nenhuma carta encontrada.</div>'; return; }
    sugg.innerHTML = '';
    results.forEach(card => {
      const img = card.images?.small || '';
      const item = document.createElement('div');
      item.className = 'cs-item';
      item.innerHTML = img
        ? `<img class="cs-th" src="${esc(img)}" alt="${esc(card.name)}">`
        : `<div class="cs-th" style="display:flex;align-items:center;justify-content:center;font-size:18px">🃏</div>`;
      item.innerHTML += `<div class="cs-info"><div class="cs-n">${esc(card.name)}</div><div class="cs-s">${esc(card.set?.name||'')} ${esc(card.number||'')}</div></div>`;
      item.addEventListener('click', () => {
        $('ec-name').value   = card.name;
        $('ec-set').value    = (card.set?.ptcgoCode||card.set?.id||'') + ' ' + (card.number||'');
        $('ec-type').value   = apiType(card.supertype||'');
        $('ec-search').value = card.name;
        pendingEditCardMeta  = cardToMeta(card); // consumido em m-edit-card-save
        hideEcSugg();
      });
      sugg.appendChild(item);
    });
  }, 350);
});
document.addEventListener('click', e => { if (!e.target.closest('#m-edit-card')) hideEcSugg(); });

$('m-edit-card-save').addEventListener('click', async () => {
  const deck = activeDeck();
  const card = deck?.cards.find(c=>c.id===$('ec-id').value);
  if (!card) return;
  const origName = card.name, origSet = card.set;
  const max    = $('ec-type').value === 'Energia' ? 60 : 4;
  card.name    = $('ec-name').value.trim() || card.name;
  card.set     = $('ec-set').value.trim();
  card.type    = $('ec-type').value;
  card.qty     = Math.max(1, Math.min(max, parseInt($('ec-qty').value)||1));
  if (card.owned > card.qty) card.owned = card.qty;

  const usedSuggestion = !!pendingEditCardMeta;
  if (usedSuggestion) {
    applyCardMeta(card, pendingEditCardMeta);
    card.priceUpdatedAt = new Date().toISOString();
    pendingEditCardMeta = null;
  }
  save(); closeModal('m-edit-card'); renderAll();
  toast('Carta atualizada!');

  if (!usedSuggestion && (card.name !== origName || card.set !== origSet)) {
    // Editou nome/coleção manualmente (sem escolher sugestão): tenta achar a imagem certa em segundo plano.
    const meta = await fetchCardMeta(card.name, card.set);
    applyCardMeta(card, meta);
    if (meta.img) card.priceUpdatedAt = new Date().toISOString();
    save(); renderAll();
  }
});

// ═══════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

// Sidebar / menu
$('mob-menu').addEventListener('click', openSidebar);
$('sb-backdrop').addEventListener('click', closeSidebar);

// New deck buttons (all of them)
function openNewDeckModal() {
  editDeckId = null;
  $('m-deck-ttl').textContent = 'Novo Deck';
  $('d-name').value = '';
  $('d-fmt').value  = 'Standard';
  selColor = COLORS[0];
  buildColorPicker();
  openModal('m-deck');
  setTimeout(() => $('d-name').focus(), 60);
}
$('btn-new-deck').addEventListener('click',   openNewDeckModal);
$('btn-first-deck').addEventListener('click', openNewDeckModal);

// Edit deck
function openEditDeckModal() {
  const deck = activeDeck();
  if (!deck) return;
  editDeckId = deck.id;
  $('m-deck-ttl').textContent = 'Editar Deck';
  $('d-name').value = deck.name;
  $('d-fmt').value  = deck.format || 'Standard';
  selColor = deck.color;
  buildColorPicker();
  openModal('m-deck');
  setTimeout(() => $('d-name').focus(), 60);
}
$('btn-edit-deck').addEventListener('click', openEditDeckModal);
// Mobile: tap the deck name/format in the topbar to edit (Import/Export/Edit
// buttons are hidden there below 720px — see responsive.css — in favor of the
// bottom action bar, so the heading itself becomes the edit affordance).
$('dk-head').addEventListener('click', openEditDeckModal);

// Save deck modal
$('m-deck-cancel').addEventListener('click', () => closeModal('m-deck'));
$('m-deck-save').addEventListener('click', () => {
  const name = $('d-name').value.trim();
  if (!name) { $('d-name').focus(); return; }
  const format = $('d-fmt').value;
  if (editDeckId) {
    const deck = state.decks.find(d=>d.id===editDeckId);
    if (deck) { deck.name=name; deck.format=format; deck.color=selColor; }
    toast('Deck atualizado!');
  } else {
    state.decks.push({ id:uid(), name, format, color:selColor, cards:[] });
    state.activeId = state.decks[state.decks.length-1].id;
    toast('Deck criado!');
  }
  save(); closeModal('m-deck'); renderAll();
});

// Mobile bottom bar reusa o mesmo fluxo dos botões da topbar (evita duplicar lógica)
$('btn-add-card-fab').addEventListener('click', () => $('btn-add-card').click());
$('btn-import-mobile').addEventListener('click', () => $('btn-import').click());
$('btn-export-mobile').addEventListener('click', () => $('btn-export').click());

// Popula um <select> de coleções (mais recente primeiro), usado tanto no
// Adicionar Carta quanto no Editar Carta — cada um busca só uma vez (fica
// vazio de novo só se a página recarregar).
async function populateSetFilter(sel) {
  if (sel.options.length > 1) return;
  try {
    const res = await ptcgFetch(`${PTCG}/sets?select=name,ptcgoCode&pageSize=250&orderBy=-releaseDate`, 10000);
    const d   = await res.json();
    (d.data || []).forEach(s => {
      if (!s.ptcgoCode) return;
      const opt = document.createElement('option');
      opt.value       = s.ptcgoCode;
      opt.textContent = `${s.name} (${s.ptcgoCode})`;
      sel.appendChild(opt);
    });
  } catch {}
}

$('btn-add-card').addEventListener('click', async () => {
  $('c-search').value=''; $('c-name').value=''; $('c-set').value='';
  $('c-qty').value='1'; $('c-type').value='Pokémon'; $('c-img').value='';
  pendingCardMeta = null;
  hideSugg();
  openModal('m-card');
  // Sem foco automático: no mobile o teclado sobe na hora e tampa quase a
  // tela inteira do modal antes da pessoa nem ver os campos. Ela toca pra buscar quando quiser.
  // Atualiza limite do campo qty conforme tipo selecionado
  $('c-type').addEventListener('change', () => {
    const isEnergy = $('c-type').value === 'Energia';
    $('c-qty').max = isEnergy ? 60 : 4;
  });
  await populateSetFilter($('api-set-filter'));
});
$('m-card-cancel').addEventListener('click', () => closeModal('m-card'));

// Card search suggestions
// A lista de sugestões é position:absolute (flutua sobre o formulário). Sem isso,
// ela cobre os campos de preenchimento manual logo abaixo. showSugg()/hideSugg()
// reservam o espaço empurrando o restante do formulário para baixo.
function showSugg() {
  $('c-sugg').classList.remove('hidden');
  $('c-sugg').closest('.mf').style.marginBottom = '244px';
}
function hideSugg() {
  $('c-sugg').classList.add('hidden');
  $('c-sugg').closest('.mf').style.marginBottom = '';
}

$('c-search').addEventListener('input', () => {
  clearTimeout(searchTmr);
  pendingCardMeta = null; // digitar de novo invalida o preço/raridade da sugestão anterior
  const q = $('c-search').value.trim();
  const sugg = $('c-sugg');
  if (q.length < 2) { hideSugg(); return; }
  sugg.innerHTML = '<div class="cs-load">Buscando...</div>';
  showSugg();
  searchTmr = setTimeout(async () => {
    const results = await apiSearch(q, 20, $('api-set-filter').value);
    if (results === null) { sugg.innerHTML='<div class="cs-load">Não conseguimos buscar agora — a API do Pokémon TCG está instável. Tente de novo em instantes ou preencha manualmente.</div>'; return; }
    if (!results.length) { sugg.innerHTML='<div class="cs-load">Nenhuma carta encontrada. Preencha manualmente.</div>'; return; }
    sugg.innerHTML = '';
    results.forEach(card => {
      const img = card.images?.small || '';
      const item = document.createElement('div');
      item.className = 'cs-item';
      item.innerHTML = img
        ? `<img class="cs-th" src="${esc(img)}" alt="${esc(card.name)}">`
        : `<div class="cs-th" style="display:flex;align-items:center;justify-content:center;font-size:18px">🃏</div>`;
      item.innerHTML += `<div class="cs-info"><div class="cs-n">${esc(card.name)}</div><div class="cs-s">${esc(card.set?.name||'')} ${esc(card.number||'')}</div></div>`;
      item.addEventListener('click', () => {
        $('c-name').value  = card.name;
        $('c-set').value   = (card.set?.ptcgoCode||card.set?.id||'') + ' ' + (card.number||'');
        $('c-type').value  = apiType(card.supertype||'');
        $('c-img').value   = img;
        $('c-search').value = card.name;
        pendingCardMeta = cardToMeta(card); // consumido em m-card-save
        hideSugg();
      });
      sugg.appendChild(item);
    });
  }, 350);
});
document.addEventListener('click', e => { if (!e.target.closest('#m-card')) hideSugg(); });

$('m-card-save').addEventListener('click', async () => {
  const name = ($('c-name').value || $('c-search').value).trim();
  if (!name) { $('c-search').focus(); return; }
  const isEnergy = $('c-type').value === 'Energia';
  const qty  = Math.max(1, Math.min(isEnergy ? 60 : 4, parseInt($('c-qty').value)||1));
  const card = {
    id:uid(), name, set:$('c-set').value.trim(), qty, owned:0, type:$('c-type').value, img:$('c-img').value,
    imgLarge:'', number:'', rarity:'', priceUsd:null, priceEur:null, condition:'NM', notes:'',
    priceUpdatedAt: pendingCardMeta ? new Date().toISOString() : null,
    ...(pendingCardMeta || {}),
  };
  const deck = activeDeck();
  deck.cards.push(card);
  save(); closeModal('m-card'); renderAll(); toast('Carta adicionada!');
  if (!pendingCardMeta) { // veio de preenchimento manual: tenta achar preço/raridade em segundo plano
    const meta = await fetchCardMeta(card.name, card.set);
    applyCardMeta(card, meta);
    if (meta.img) card.priceUpdatedAt = new Date().toISOString(); // achou: não precisa tentar de novo depois
    save(); renderAll();
  }
});

// Import
$('btn-import').addEventListener('click', () => {
  $('imp-txt').value = '';
  openModal('m-import');
  setTimeout(() => $('imp-txt').focus(), 60);
});
$('m-import-cancel').addEventListener('click', () => closeModal('m-import'));
$('m-import-save').addEventListener('click', async () => {
  const text = $('imp-txt').value.trim();
  if (!text) return;
  const parsed = parseDeckList(text);
  if (!parsed.length) { toast('Nenhuma carta reconhecida. Verifique o formato.'); return; }
  const deck = activeDeck();
  const newCards = parsed.map(p => ({
    id:uid(), ...p, owned:0, img:'', imgLarge:'', number:'', rarity:'', priceUsd:null, priceEur:null,
    priceUpdatedAt:null, condition:'NM', notes:'',
  }));
  deck.cards.push(...newCards);
  save(); closeModal('m-import'); renderAll();
  toast(`${parsed.length} cartas importadas! Buscando imagens e preços...`);
  let fetched = 0;
  for (const card of newCards) {
    const meta = await fetchCardMeta(card.name, card.set);
    if (meta.img) {
      const c = deck.cards.find(x=>x.id===card.id);
      if (c) { applyCardMeta(c, meta); c.priceUpdatedAt = new Date().toISOString(); fetched++; }
    }
    if (fetched%4===0 && fetched>0) { save(); renderAll(); }
  }
  save(); renderAll();
  if (fetched>0) toast(`✓ ${fetched} imagens carregadas!`);
});

// Export
$('btn-export').addEventListener('click', () => {
  const deck = activeDeck();
  if (!deck) return;
  document.querySelectorAll('#exp-format-tog .flt').forEach(b=>b.classList.remove('active'));
  document.querySelector('#exp-format-tog .flt[data-fmt="tcglive"]').classList.add('active');
  $('exp-area').textContent = exportList(deck);
  openModal('m-export');
});
$('m-export-cancel').addEventListener('click', () => closeModal('m-export'));
$('m-export-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('exp-area').textContent); toast('Lista copiada!'); }
  catch { toast('Selecione o texto e copie com Ctrl+C'); }
});

// Filters
document.querySelectorAll('#filterbar .flt').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#filterbar .flt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  curFilter = btn.dataset.f;
  renderCards();
}));

// Export format toggle
document.querySelectorAll('#exp-format-tog .flt').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#exp-format-tog .flt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const deck = activeDeck();
  if (!deck) return;
  $('exp-area').textContent = btn.dataset.fmt === 'liga' ? exportListLiga(deck) : exportList(deck);
}));
$('search').addEventListener('input', e => { curSearch=e.target.value.trim(); renderCards(); });
$('set-filter').addEventListener('change', e => { curSet=e.target.value; renderCards(); });

// View toggle
$('vt-grid').addEventListener('click', () => { viewMode='grid'; $('vt-grid').classList.add('active'); $('vt-list').classList.remove('active'); renderCards(); });
$('vt-list').addEventListener('click', () => { viewMode='list'; $('vt-list').classList.add('active'); $('vt-grid').classList.remove('active'); renderCards(); });

// Modo de ordenar (arrastar cartas na grade pra reorganizar)
$('edit-order-toggle').addEventListener('change', e => {
  curEditMode = e.target.checked;
  renderCards();
});

// Logout (sidebar)
$('sb-logout-btn').addEventListener('click', async () => {
  await signOut();
  showAuthGate();
  toast('Você saiu da conta.');
});

// ESC
document.addEventListener('keydown', e => {
  if (e.key==='Escape') ['m-deck','m-card','m-import','m-export','m-info'].forEach(closeModal);
});
