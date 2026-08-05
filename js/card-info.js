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
  if (!card.priceUpdatedAt) fetchAndApplyMeta(deckId, card); // carta antiga/manual: tenta achar dados uma vez
}

// Fecha o painel E esquece qual carta estava aberta -- sem isso, closeModal
// sozinho só esconde via CSS, então uma busca em segundo plano ainda em voo
// (fetchAndApplyMeta) continuava achando currentInfoCard() com a carta certa
// mesmo com o painel fechado. Hoje isso já não causa sobrescrita (o token de
// geração em fetchAndApplyMeta cobre isso), mas ainda evita trabalho à toa
// (re-renderizar um painel escondido) e mantém o estado consistente.
function closeCardInfo() {
  closeModal('m-info');
  infoDeckId = null;
  infoCardId = null;
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
  $('info-rarity-value').textContent = card.rarity || '—';
  $('info-condition').value = card.condition || 'NM';
  $('info-notes').value = card.notes || '';
  renderCardInfoPrice(card);
}

async function renderCardInfoPrice(card) {
  const el     = $('info-price');
  const sub    = $('info-price-sub');
  const retry  = $('info-price-retry');
  retry.classList.add('hidden');
  if (card.priceUsd == null && card.priceEur == null) {
    el.textContent = infoFetchDone ? 'Sem preço disponível' : 'Buscando...';
    sub.textContent = '';
    if (infoFetchDone) retry.classList.remove('hidden');
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
  if (brl == null) { el.textContent = 'Preço indisponível no momento'; retry.classList.remove('hidden'); return; }
  const mult = CONDITION_MULT[card.condition] ?? 1;
  el.textContent = formatBrl(brl * mult);
  sub.textContent = `Base ${formatBrl(brl)} (${source}) · condição ${card.condition||'NM'}`
    + (card.priceUpdatedAt ? ` · atualizado ${new Date(card.priceUpdatedAt).toLocaleDateString('pt-BR')}` : '');
}

async function fetchAndApplyMeta(deckId, card) {
  // Geração capturada ANTES da busca sair, igual ao mesmo padrão já usado em
  // import/edição de carta/retry em massa (cardMetaGen) — sem isso, fechar o
  // painel (que só esconde via CSS, não cancela a busca) e editar a mesma
  // carta enquanto ela ainda está em voo deixava esse fetch antigo
  // sobrescrever a edição mais nova quando finalmente respondia (achado na
  // auditoria: card-info.js era o único caminho de busca em segundo plano
  // que não participava dessa guarda).
  const gen = cardMetaGen.get(card.id) || 0;
  // Direto na API remota (não fetchCardMeta) — é a única fonte de preço real,
  // o banco local não tem preço de mercado (muda todo dia, não faz parte do
  // dataset aberto importado).
  const meta = await fetchRemoteCardMeta(card.name, card.set);
  if ((cardMetaGen.get(card.id) || 0) !== gen) return; // carta editada manualmente enquanto a busca estava no ar -- descarta
  const deck = state.decks.find(d => d.id === deckId);
  const c = deck?.cards.find(x => x.id === card.id);
  if (!c) return; // carta (ou deck) removida enquanto a busca estava no ar
  applyCardMeta(c, meta);
  if (meta.img) c.priceUpdatedAt = new Date().toISOString(); // achou: não precisa tentar de novo depois
  save();
  if (currentInfoCard()?.id === c.id) { // painel ainda aberto nesta carta -- atualiza o próprio painel
    infoFetchDone = true;
    renderCardInfo(c);
  }
  // Sem isso, corrigir o preço aqui (clicando em "tentar de novo", ou pela
  // busca automática ao abrir o painel) só refletia no painel em si — o
  // valor total no topo e a carta na grade/lista ficavam desatualizados até
  // a página ser recarregada. updateCardMediaInPlace troca só o elemento
  // desta carta (mesmo builder do render normal, então imagem/raridade/tipo
  // saem corretos) em vez de reconstruir a grade/lista inteira a cada busca.
  updateCardMediaInPlace(deckId, c.id);
  renderDeckValue(activeDeck());
}

$('m-info-close').addEventListener('click', closeCardInfo);

$('info-price-retry').addEventListener('click', () => {
  const card = currentInfoCard();
  if (!card || !infoDeckId) return;
  $('info-price').textContent = 'Buscando...';
  $('info-price-retry').classList.add('hidden');
  fetchAndApplyMeta(infoDeckId, card);
});

// Condição não depende de nenhuma busca — é só um multiplicador local sobre
// o preço já obtido, então reage na hora, sem chamada de rede.
$('info-condition').addEventListener('change', () => {
  const card = currentInfoCard();
  if (!card) return;
  card.condition = $('info-condition').value;
  save();
  renderCardInfoPrice(card);
  renderDeckValue(activeDeck());
});

let notesSaveTimer = null;
$('info-notes').addEventListener('input', () => {
  const card = currentInfoCard();
  if (!card) return;
  card.notes = $('info-notes').value;
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(save, 500); // evita gravar a cada tecla digitada
});
