// ═══════════════════════════════════════════════════════════════
// MODAL: ADICIONAR CARTA
// ═══════════════════════════════════════════════════════════════
$('btn-add-card').addEventListener('click', async () => {
  $('c-search').value=''; $('c-name').value=''; $('c-set').value='';
  $('c-qty').value='1'; $('c-type').value='Pokémon'; $('c-img').value='';
  pendingCardMeta = null;
  hideSugg();
  openModal('m-card');
  // Sem foco automático: no mobile o teclado sobe na hora e tampa quase a
  // tela inteira do modal antes da pessoa nem ver os campos. Ela toca pra buscar quando quiser.
  await populateSetFilter($('api-set-filter'));
});
$('m-card-cancel').addEventListener('click', () => closeModal('m-card'));

// Atualiza limite do campo qty conforme tipo selecionado — registrado uma
// única vez (fora do handler de abertura do modal, que roda a cada clique)
$('c-type').addEventListener('change', () => {
  const isEnergy = $('c-type').value === 'Energia';
  $('c-qty').max = isEnergy ? 60 : 4;
});

// Card search suggestions
const { show: showSugg, hide: hideSugg } = setupCardSuggest({
  modalSel:    '#m-card',
  searchId:    'c-search',
  suggId:      'c-sugg',
  setFilterId: 'api-set-filter',
  getTimer:    () => searchTmr,
  setTimer:    t => searchTmr = t,
  clearPending: () => { pendingCardMeta = null; }, // digitar de novo invalida o preço/raridade da sugestão anterior
  errorMsg:    'Não conseguimos buscar agora — a API do Pokémon TCG está instável. Tente de novo em instantes ou preencha manualmente.',
  emptyMsg:    'Nenhuma carta encontrada. Preencha manualmente.',
  onSelect: (card, img) => {
    $('c-name').value  = card.name;
    $('c-set').value   = (card.set?.ptcgoCode||card.set?.id||'') + ' ' + (card.number||'');
    $('c-type').value  = apiType(card.supertype||'');
    $('c-img').value   = img;
    $('c-search').value = card.name;
    pendingCardMeta = cardToMeta(card); // consumido em m-card-save
  },
});

$('m-card-save').addEventListener('click', async () => {
  const name = ($('c-name').value || $('c-search').value).trim();
  if (!name) { $('c-search').focus(); return; }
  const isEnergy = $('c-type').value === 'Energia';
  const qty  = Math.max(1, Math.min(isEnergy ? 60 : 4, parseInt($('c-qty').value)||1));
  const card = createCard({
    name, set:$('c-set').value.trim(), qty, owned:0, type:$('c-type').value, img:$('c-img').value,
    priceUpdatedAt: pendingCardMeta ? new Date().toISOString() : null,
    ...(pendingCardMeta || {}),
  });
  const deck = activeDeck();
  deck.cards.push(card);
  save(); closeModal('m-card'); renderAll(); toast('Carta adicionada!');
  if (!pendingCardMeta) { // veio de preenchimento manual: tenta achar preço/raridade em segundo plano
    const gen = bumpCardMetaGen(card.id); // se essa carta for editada antes da busca voltar, o resultado é descartado
    const meta = await fetchCardMeta(card.name, card.set);
    if (cardMetaGen.get(card.id) === gen) {
      applyCardMeta(card, meta);
      if (meta.img) card.priceUpdatedAt = new Date().toISOString(); // achou: não precisa tentar de novo depois
      save(); renderAll();
    }
  }
});
