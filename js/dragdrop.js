// ═══════════════════════════════════════════════════════════════
// SIDEBAR DRAG-AND-DROP
// ═══════════════════════════════════════════════════════════════
// Usa Pointer Events (não a API nativa HTML5 dragstart/drop) porque
// a API nativa não funciona em touch em nenhum navegador mobile —
// Pointer Events unifica mouse, touch e caneta no mesmo código.
// O gatilho é só a alcinha (.dk-handle), não o card inteiro, pra não
// conflitar com o toque que seleciona o deck.
let _dragEl = null, _dragFrom = -1, _dragStartY = 0;

function initDragDrop() {
  const container = $('deck-list');
  container.querySelectorAll('.dk-handle').forEach(handle => {
    handle.addEventListener('pointerdown', e => {
      const item = handle.closest('.dk-item');
      if (!item) return;
      e.preventDefault();
      _dragEl = item;
      _dragFrom = parseInt(item.dataset.idx, 10);
      _dragStartY = e.clientY;
      handle.setPointerCapture(e.pointerId);
      item.classList.add('dragging');
    });
  });
}

document.addEventListener('pointermove', e => {
  if (!_dragEl) return;
  _dragEl.style.transform = `translateY(${e.clientY - _dragStartY}px)`;

  const container = $('deck-list');
  container.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  const siblings = [...container.querySelectorAll('.dk-item')].filter(x => x !== _dragEl);
  for (const sib of siblings) {
    const r = sib.getBoundingClientRect();
    if (e.clientY > r.top && e.clientY < r.bottom) { sib.classList.add('drag-over'); break; }
  }
});

function endDrag() {
  if (!_dragEl) return;
  const container = $('deck-list');
  const target = container.querySelector('.drag-over');
  _dragEl.style.transform = '';
  _dragEl.classList.remove('dragging');
  container.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  if (target) {
    const to = parseInt(target.dataset.idx, 10);
    if (to !== _dragFrom) {
      const [item] = state.decks.splice(_dragFrom, 1);
      state.decks.splice(to, 0, item);
      save(); renderSidebar();
    }
  }
  _dragEl = null; _dragFrom = -1;
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
