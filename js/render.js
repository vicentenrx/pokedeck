// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function renderAll() {
  const deck = activeDeck();
  $('no-deck').style.display    = deck ? 'none' : '';
  const dv = $('deck-view');
  deck ? dv.classList.remove('hidden') : dv.classList.add('hidden');
  renderSidebar();
  if (deck) { renderTopbar(); renderCards(); }
  // Popular filtro de sets com os sets presentes no deck
  const setFilter = $('set-filter');
  const prevVal   = setFilter.value;
  const sets = deck ? [...new Set(
    deck.cards
      .map(c => (c.set||'').trim().replace(/\s+\d+$/,'').trim()) // pega só o código: "OBF"
      .filter(Boolean)
  )].sort() : [];
  setFilter.innerHTML = '<option value="">Todas as coleções</option>';
  sets.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = setsMap[s] ? `${setsMap[s]} (${s})` : s;
    if (s === prevVal) opt.selected = true;
    setFilter.appendChild(opt);
  });
  if (!sets.includes(prevVal)) curSet = '';
}

function renderSidebar() {
  const list = $('deck-list');
  list.innerHTML = '';
  state.decks.forEach((deck, idx) => {
    const owned = deck.cards.reduce((a,c) => a+Math.min(c.owned,c.qty), 0);
    const total = deck.cards.reduce((a,c) => a+c.qty, 0);
    const pct   = total ? Math.round(owned/total*100) : 0;
    const el    = document.createElement('div');
    el.className = 'dk-item' + (state.activeId===deck.id?' active':'');
    el.setAttribute('draggable','true');
    el.dataset.idx = idx;
    el.innerHTML = `
      <span class="dk-handle" title="Arrastar para reordenar">⠿</span>
      <div class="dk-dot" style="background:${deck.color}"></div>
      <div class="dk-body">
        <div class="dk-name">${esc(deck.name)}</div>
        <div class="dk-sub">${esc(deck.format)} · ${deck.cards.length} cartas · ${pct}%</div>
        <div class="dk-bar"><div class="dk-fill" style="width:${pct}%;background:${deck.color}"></div></div>
      </div>
      <button class="dk-del" data-id="${deck.id}" title="Excluir deck">✕</button>`;
    el.addEventListener('click', e => {
      if (e.target.classList.contains('dk-del') || e.target.classList.contains('dk-handle')) return;
      state.activeId = deck.id;
      save();
      renderAll();
      closeSidebar();

    });
    el.querySelector('.dk-del').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Excluir o deck "${deck.name}"?`)) return;
      state.decks = state.decks.filter(d => d.id!==deck.id);
      if (state.activeId===deck.id) state.activeId = state.decks[0]?.id ?? null;
      save(); renderAll();
    });
    list.appendChild(el);
  });
  initDragDrop();
}

function renderTopbar() {
  const deck = activeDeck();
  $('dk-head-name').textContent = deck.name;
  $('dk-head-fmt').textContent  = deck.format;
  const owned = deck.cards.reduce((a,c) => a+Math.min(c.owned,c.qty), 0);
  const total = deck.cards.reduce((a,c) => a+c.qty, 0);
  const miss  = total - owned;
  const pct   = total ? Math.round(owned/total*100) : 0;
  $('s-own').textContent = owned;
  $('s-mis').textContent = miss;
  $('s-tot').textContent = total;
  $('pb').style.width    = pct+'%';
  $('ppct').textContent  = pct+'%';
  const v = validateSize(deck);
  const w = $('size-warn');
  if (v.status==='none') { w.classList.add('hidden'); }
  else { w.classList.remove('hidden'); w.textContent=v.label;
    w.className = { ok:'warn-ok', under:'warn-under', over:'warn-over' }[v.status]; }
}

function renderCards() {
  const deck  = activeDeck();
  const grid  = $('card-grid');
  const list  = $('card-list');
  const listHead = $('card-list-head');
  const empty = $('empty-st');
  if (!deck) return;
  let cards = deck.cards;
  if (curFilter==='owned')   cards = cards.filter(c => c.owned>=c.qty);
  if (curFilter==='missing') cards = cards.filter(c => c.owned<c.qty);
  if (curSearch) { const q=curSearch.toLowerCase(); cards=cards.filter(c=>c.name.toLowerCase().includes(q)||(c.set||'').toLowerCase().includes(q)); }
  if (curSet) cards = cards.filter(c => (c.set||'').startsWith(curSet));
  grid.innerHTML = ''; list.innerHTML = '';
  if (!cards.length) { empty.classList.remove('hidden'); grid.style.display='none'; list.style.display='none'; listHead.style.display='none'; return; }
  empty.classList.add('hidden');
  if (viewMode==='grid') {
    grid.style.display='grid'; list.style.display='none'; listHead.style.display='none';
    cards.forEach(c => grid.appendChild(buildGridCard(c, deck.id)));
  } else {
    grid.style.display='none'; list.style.display='block'; listHead.style.display='grid';
    cards.forEach(c => list.appendChild(buildListCard(c, deck.id)));
  }
}

function pkball(size=44) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="22" fill="#2C2C2C" stroke="#383838" stroke-width="2"/>
    <path d="M2 24 Q2 2 24 2 Q46 2 46 24Z" fill="#E3350D"/>
    <rect x="2" y="21.5" width="44" height="5" fill="#0E0E0E"/>
    <circle cx="24" cy="24" r="8" fill="#0E0E0E" stroke="#383838" stroke-width="1.5"/>
    <circle cx="24" cy="24" r="4.5" fill="#2C2C2C"/></svg>`;
}

function imgOrPH(card) {
  if (card.img) return `<img class="c-img loading" src="${esc(card.img)}" alt="${esc(card.name)}" loading="lazy" onload="this.classList.remove('loading')" onerror="this.style.display='none'">`;
  return `<div class="c-no-img">${pkball()}<div class="c-no-name">${esc(card.name)}</div>${card.set?`<div class="c-no-set">${esc(card.set)}</div>`:''}</div>`;
}

function buildGridCard(card, deckId) {
  const isOwned   = card.owned >= card.qty;
  const isPartial = card.owned > 0 && card.owned < card.qty;
  const el = document.createElement('div');
  el.className = 'c-thumb '+(isOwned?'owned':'missing');
  el.innerHTML = `
    <div class="c-img-wrap">
      ${imgOrPH(card)}
      <div class="c-badge">✓</div>
      ${isPartial?`<div class="c-part">${card.owned}/${card.qty}</div>`:''}
      <button class="c-edit-btn" title="Editar carta">✎</button>
      <button class="c-del-btn" title="Excluir carta">✕</button>
    </div>
    <div class="c-foot">
      <div class="c-foot-name" title="${esc(card.name)}">${esc(card.name)}</div>
      <div class="c-foot-bot">
        <span class="c-set-tag">${esc(card.set||'')}</span>
        <div class="c-foot-acts">
          <button class="cq-btn" data-d="-1">−</button>
          <span class="cq-num ${ownedClass(card.owned,card.qty)}">${card.owned}/${card.qty}</span>
          <button class="cq-btn" data-d="1">+</button>
        </div>
      </div>
    </div>`;
  el.addEventListener('click', e => {
    if (e.target.closest('.cq-btn')||e.target.closest('.c-del-btn')) return;
    toggleOwned(deckId, card.id); renderAll();
  });
  el.querySelectorAll('.cq-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); adjustOwned(deckId, card.id, parseInt(b.dataset.d)); renderAll();
  }));
  el.querySelector('.c-del-btn').addEventListener('click', e => {
    e.stopPropagation(); deleteCard(deckId, card.id); renderAll();
  });
  el.querySelector('.c-edit-btn').addEventListener('click', e => {
    e.stopPropagation(); openEditCard(deckId, card.id);
  });
  return el;
}

function buildListCard(card, deckId) {
  const isOwned = card.owned >= card.qty;
  const el = document.createElement('div');
  el.className = 'c-row '+(isOwned?'owned':'missing');
  const tc = TC[card.type]||'#888';
  el.innerHTML = `
    <div class="r-thumb">
      ${card.img?`<img src="${esc(card.img)}" alt="${esc(card.name)}" loading="lazy">`:`<div class="r-thumb-ph">${TE[card.type]||'🃏'}</div>`}
    </div>
    <div class="r-check">${isOwned?'✓':''}</div>
    <div class="r-name" title="${esc(card.name)}">${esc(card.name)}</div>
    <div class="r-set" title="${esc(card.set||'')}">${esc(card.set||'')}</div>
    <span class="type-pill" style="background:${tc}22;color:${tc}">${esc(card.type)}</span>
    <div class="r-qty">
      <button class="rq-btn" data-d="-1">−</button>
      <span class="rq-num ${ownedClass(card.owned,card.qty)}">${card.owned}/${card.qty}</span>
      <button class="rq-btn" data-d="1">+</button>
    </div>
    <div class="r-acts">
      <button class="r-edit" title="Editar">✎</button>
      <button class="r-del" title="Excluir">✕</button>
    </div>`;
  el.addEventListener('click', e => {
    if (e.target.closest('.rq-btn')||e.target.closest('.r-acts')) return;
    toggleOwned(deckId, card.id); renderAll();
  });
  el.querySelectorAll('.rq-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); adjustOwned(deckId, card.id, parseInt(b.dataset.d)); renderAll();
  }));
  el.querySelector('.r-del').addEventListener('click', e => {
    e.stopPropagation(); deleteCard(deckId, card.id); renderAll();
  });
  el.querySelector('.r-edit').addEventListener('click', e => {
    e.stopPropagation(); openEditCard(deckId, card.id);
  });
  return el;
}
