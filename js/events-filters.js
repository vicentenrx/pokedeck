// Filters
document.querySelectorAll('#filterbar .flt').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#filterbar .flt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  curFilter = btn.dataset.f;
  renderCards();
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
