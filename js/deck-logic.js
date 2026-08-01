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

// Mesma lista, no formato que o site Liga Pokémon usa pro próprio download de
// deck (seções "Pokemons - N" / "Trainers - N" / "Energias - N", cada carta
// como "QTD Nome CÓDIGO NÚMERO", rodapé com o total).
function exportListLiga(deck) {
  const groups = { 'Pokémon':[], 'Treinador':[], 'Energia':[] };
  deck.cards.forEach(c => { if (groups[c.type]) groups[c.type].push(c); });
  const labelMap = { 'Pokémon':'Pokemons', 'Treinador':'Trainers', 'Energia':'Energias' };
  const lines = ['****** Pokemon Trading Card Game Deck List ******', ''];
  for (const [key, cards] of Object.entries(groups)) {
    if (!cards.length) continue;
    const subtotal = cards.reduce((a,c)=>a+c.qty,0);
    lines.push(`${labelMap[key]} - ${subtotal}`, '');
    cards.forEach(c => lines.push(`${c.qty} ${c.name}${c.set?' '+c.set:''}`));
    lines.push('');
  }
  const total = deck.cards.reduce((a,c)=>a+c.qty,0);
  lines.push(`Total Cards - ${total}`, '');
  lines.push('****** Lista gerada pelo PokéDeck ******');
  return lines.join('\n');
}

// Reconhece tanto o formato do Pokémon TCG Live quanto o de download do Liga
// Pokémon — as linhas de carta são iguais nos dois ("QTD Nome CÓDIGO NÚMERO");
// só os cabeçalhos de seção mudam ("Pokémon" vs "Pokemons - 20"), e ambos já
// caem no filtro de cabeçalho abaixo por começarem com o mesmo prefixo.
function parseDeckList(text) {
  return text.split('\n').reduce((acc, raw) => {
    const line = raw.trim();
    if (!line || /^(\*{2,}|Pokémon|Pokemon|Trainer|Energy|Treinador|Energia|Total Cards|##|\/\/)/.test(line)) return acc;

    // Aceita "4 Nome" e "4x Nome" — listas escritas à mão (ex: legenda de
    // vídeo do YouTube) costumam usar "4x", diferente do formato de
    // exportação do PTCG Live/Liga Pokémon que essa função também lê.
    const qm = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (!qm) return acc;
    let rest = qm[2].trim();

    // Coleção entre parênteses — "Charizard ex (OBF 125)" ou só "(Obsidian
    // Flames)" — bem comum em listas feitas pra leitura humana, diferente
    // do "CÓDIGO NÚMERO" solto no fim que o formato de exportação usa. Sem
    // isso, o texto inteiro dentro do parêntese ia grudar no nome da carta
    // e a busca por imagem nunca achava nada (nome não bate com nenhuma
    // carta real).
    let set = '';
    const paren = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (paren) {
      rest = paren[1].trim();
      set  = paren[2].trim();
    } else {
      const suffix = rest.match(/^(.+?)\s+([A-Za-z0-9]{2,8})\s+([\w-]+)$/);
      if (suffix) { rest = suffix[1].trim(); set = `${suffix[2].toUpperCase()} ${suffix[3]}`; }
    }

    const name = rest;
    if (!name) return acc;
    const type = guessType(name);
    const qty  = Math.max(1, Math.min(type === 'Energia' ? 60 : 4, parseInt(qm[1],10)));
    acc.push({ name, set, qty, type });
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
