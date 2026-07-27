// ═══════════════════════════════════════════════════════════════
// PAINEL DE INFORMAÇÕES DA CARTA (preço, raridade, número, coleção)
// ═══════════════════════════════════════════════════════════════
let infoDeckId = null;
let infoCardId = null;
// true quando a tentativa de buscar preço/raridade desta abertura do painel já
// terminou (com ou sem sucesso) — separado de card.priceUpdatedAt, que só é
// gravado quando a busca realmente encontra a carta (guia se vale a pena
// tentar de novo da próxima vez, já que a API já ficou fora do ar por minutos).
let infoFetchDone = false;

function currentInfoCard() {
  const deck = state.decks.find(d => d.id === infoDeckId);
  return deck?.cards.find(c => c.id === infoCardId) || null;
}

// "OBF 125" → { code:"OBF", number:"125" } — mesma convenção usada no resto do app.
function splitSetCode(set) {
  const trimmed = (set || '').trim();
  const m = trimmed.match(/^(.*?)\s+([\w-]+)$/);
  return m ? { code: m[1], number: m[2] } : { code: trimmed, number: '' };
}

function openCardInfo(deckId, cardId) {
  const card = state.decks.find(d => d.id === deckId)?.cards.find(c => c.id === cardId);
  if (!card) return;
  infoDeckId = deckId;
  infoCardId = cardId;
  infoFetchDone = !!card.priceUpdatedAt;
  renderCardInfo(card);
  openModal('m-info');
  if (!card.priceUpdatedAt) refreshCardInfoMeta(card); // carta antiga/manual: tenta achar dados uma vez
}

function renderCardInfo(card) {
  const img = card.imgLarge || card.img;
  $('info-img-wrap').innerHTML = img
    ? `<img src="${esc(img)}" alt="${esc(card.name)}">`
    : `<div class="info-no-img">${pkball(64)}</div>`;
  $('info-name').textContent = card.name;
  const { code, number } = splitSetCode(card.set);
  $('info-set').textContent = setsMap[code] ? `${setsMap[code]} (${code})` : (code || '—');
  $('info-number').textContent = card.number || number || '—';
  $('info-rarity').value = card.rarity || '';
  renderCardInfoPrice(card);
}

async function renderCardInfoPrice(card) {
  const el  = $('info-price');
  const sub = $('info-price-sub');
  if (card.priceUsd == null && card.priceEur == null) {
    el.textContent = infoFetchDone ? 'Sem preço disponível' : 'Buscando...';
    sub.textContent = '';
    return;
  }
  el.textContent = '···';
  sub.textContent = '';
  let brl = null, source = '';
  if (card.priceUsd != null) {
    const rate = await getRateToBrl('USD');
    if (rate) { brl = card.priceUsd * rate; source = `US$ ${card.priceUsd.toFixed(2)} · TCGplayer`; }
  }
  if (brl == null && card.priceEur != null) {
    const rate = await getRateToBrl('EUR');
    if (rate) { brl = card.priceEur * rate; source = `€ ${card.priceEur.toFixed(2)} · Cardmarket`; }
  }
  if (currentInfoCard()?.id !== card.id) return; // painel já fechou ou trocou de carta
  if (brl == null) { el.textContent = 'Preço indisponível no momento'; return; }
  el.textContent = formatBrl(brl);
  sub.textContent = source + (card.priceUpdatedAt
    ? ` · atualizado ${new Date(card.priceUpdatedAt).toLocaleDateString('pt-BR')}` : '');
}

async function refreshCardInfoMeta(card) {
  const meta = await fetchCardMeta(card.name, card.set);
  const c = currentInfoCard();
  if (!c || c.id !== card.id) return; // usuário já fechou/trocou de carta
  Object.assign(c, meta);
  if (meta.img) c.priceUpdatedAt = new Date().toISOString(); // achou: não precisa tentar de novo depois
  infoFetchDone = true;
  save();
  renderCardInfo(c);
}

$('m-info-close').addEventListener('click', () => closeModal('m-info'));

$('info-rarity').addEventListener('change', async () => {
  const card = currentInfoCard();
  if (!card) return;
  const sel = $('info-rarity');
  const newRarity = sel.value;
  sel.disabled = true;
  $('info-price').textContent = 'Buscando...';
  $('info-price-sub').textContent = '';
  const match = await fetchCardForRarity(card.name, newRarity);
  if (match) {
    const meta = cardToMeta(match);
    const setCode = match.set?.ptcgoCode || match.set?.id || '';
    Object.assign(card, meta, {
      rarity: newRarity,
      set: setCode ? `${setCode} ${match.number || ''}`.trim() : card.set,
      priceUpdatedAt: new Date().toISOString(),
    });
    toast('Carta atualizada para essa raridade!');
  } else {
    card.rarity = newRarity;
    toast('Não encontrei uma carta dessa raridade — raridade salva mesmo assim.');
  }
  save(); renderAll(); renderCardInfo(card);
  sel.disabled = false;
});
