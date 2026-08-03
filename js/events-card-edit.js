// ═══════════════════════════════════════════════════════════════
// MODAL: EDITAR CARTA
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
const { show: showEcSugg, hide: hideEcSugg } = setupCardSuggest({
  modalSel:    '#m-edit-card',
  searchId:    'ec-search',
  suggId:      'ec-sugg',
  setFilterId: 'ec-set-filter',
  getTimer:    () => editSearchTmr,
  setTimer:    t => editSearchTmr = t,
  clearPending: () => { pendingEditCardMeta = null; },
  errorMsg:    'Não conseguimos buscar agora — a API do Pokémon TCG está instável. Tente de novo em instantes.',
  emptyMsg:    'Nenhuma carta encontrada.',
  onSelect: card => {
    $('ec-name').value   = card.name;
    $('ec-set').value    = (card.set?.ptcgoCode||card.set?.id||'') + ' ' + (card.number||'');
    $('ec-type').value   = apiType(card.supertype||'');
    $('ec-search').value = card.name;
    pendingEditCardMeta  = cardToMeta(card); // consumido em m-edit-card-save
  },
});

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

  const nameOrSetChanged = card.name !== origName || card.set !== origSet;
  // Nome/coleção mudaram: invalida qualquer busca de metadado antiga ainda em
  // voo pra essa carta (do Adicionar Carta ou de uma edição anterior) — senão
  // ela pode terminar depois dessa edição e sobrescrever com dados errados.
  if (nameOrSetChanged) bumpCardMetaGen(card.id);

  const usedSuggestion = !!pendingEditCardMeta;
  if (usedSuggestion) {
    applyCardMeta(card, pendingEditCardMeta);
    card.priceUpdatedAt = new Date().toISOString();
    pendingEditCardMeta = null;
  }
  save(); closeModal('m-edit-card'); renderAll();
  toast('Carta atualizada!');

  if (!usedSuggestion && nameOrSetChanged) {
    // Editou nome/coleção manualmente (sem escolher sugestão): tenta achar a imagem certa em segundo plano.
    const gen = cardMetaGen.get(card.id);
    const meta = await fetchCardMeta(card.name, card.set);
    if (cardMetaGen.get(card.id) === gen) {
      applyCardMeta(card, meta);
      if (meta.img) card.priceUpdatedAt = new Date().toISOString();
      save(); renderAll();
    }
  }
});
