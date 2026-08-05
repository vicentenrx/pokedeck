// Mobile bottom bar reusa o mesmo fluxo dos botões da topbar (evita duplicar lógica)
$('btn-add-card-fab').addEventListener('click', () => $('btn-add-card').click());
$('btn-import-mobile').addEventListener('click', () => $('btn-import').click());
$('btn-export-mobile').addEventListener('click', () => $('btn-export').click());

// Logout (sidebar)
$('sb-logout-btn').addEventListener('click', async () => {
  await signOut();
  showAuthGate();
  toast('Você saiu da conta.');
});

// ESC
document.addEventListener('keydown', e => {
  if (e.key!=='Escape') return;
  ['m-deck','m-card','m-import','m-export'].forEach(closeModal);
  closeCardInfo(); // m-info tem limpeza própria (infoDeckId/infoCardId) -- ver card-info.js
});
