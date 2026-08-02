// ═══════════════════════════════════════════════════════════════
// MODAL DE DECK (criar / editar)
// ═══════════════════════════════════════════════════════════════

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
