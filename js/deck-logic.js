// ═══════════════════════════════════════════════════════════════
// DECK LOGIC
// ═══════════════════════════════════════════════════════════════
function validateSize(deck) {
  if (!['Standard','Expanded'].includes(deck.format))
    return { status:'none', label:'' };
  const total = deck.cards.reduce((a,c) => a+c.qty, 0);
  if (total === 60) return { status:'ok',    label:'✓ 60 cartas' };
  if (total  < 60) return { status:'under', label:`⚠ Faltam ${60-total} carta${60-total!==1?'s':''}` };
  return              { status:'over',  label:`✕ ${total-60} carta${total-60!==1?'s':''} a mais` };
}

function exportList(deck) {
  const groups = { 'Pokémon':[], 'Treinador':[], 'Energia':[] };
  deck.cards.forEach(c => { if (groups[c.type]) groups[c.type].push(c); });
  const lines = [`// ${deck.name} — ${deck.format}`, ''];
  for (const [lbl, cards] of Object.entries(groups)) {
    if (!cards.length) continue;
    lines.push(lbl);
    cards.forEach(c => lines.push(`${c.qty} ${c.name}${c.set?' '+c.set:''}`));
    lines.push('');
  }
  const total = deck.cards.reduce((a,c)=>a+c.qty,0);
  lines.push(`// Total: ${total} cartas`);
  return lines.join('\n');
}

function parseDeckList(text) {
  return text.split('\n').reduce((acc, raw) => {
    const line = raw.trim();
    if (!line || /^(Pokémon|Pokemon|Trainer|Energy|Treinador|Energia|##|\/\/)/.test(line)) return acc;
    const m = line.match(/^(\d+)\s+(.+?)(?:\s+([A-Z]{2,6})\s+([\w-]+))?$/);
    if (!m) return acc;
    const type = guessType(m[2].trim());
    const qty  = Math.max(1, Math.min(type === 'Energia' ? 60 : 4, parseInt(m[1],10)));
    const name = m[2].trim();
    const set  = m[3] && m[4] ? `${m[3]} ${m[4]}` : '';
    acc.push({ name, set, qty, type: guessType(name) });
    return acc;
  }, []);
}

// ═══════════════════════════════════════════════════════════════
// CARD MUTATIONS
// ═══════════════════════════════════════════════════════════════
function toggleOwned(deckId, cardId) {
  const deck = state.decks.find(d=>d.id===deckId);
  const card = deck?.cards.find(c=>c.id===cardId);
  if (!card) return;
  card.owned = card.owned>=card.qty ? 0 : card.qty;
  save();
}
function adjustOwned(deckId, cardId, delta) {
  const deck = state.decks.find(d=>d.id===deckId);
  const card = deck?.cards.find(c=>c.id===cardId);
  if (!card) return;
  card.owned = Math.max(0, Math.min(card.owned+delta, card.qty));
  save();
}
function deleteCard(deckId, cardId) {
  const deck = state.decks.find(d=>d.id===deckId);
  if (!deck) return;
  deck.cards = deck.cards.filter(c=>c.id!==cardId);
  save();
}
