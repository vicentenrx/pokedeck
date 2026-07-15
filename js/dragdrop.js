// ═══════════════════════════════════════════════════════════════
// SIDEBAR DRAG-AND-DROP
// ═══════════════════════════════════════════════════════════════
function initDragDrop() {
  const container = $('deck-list');
  let dragFrom = -1;
  container.querySelectorAll('.dk-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragFrom = parseInt(el.dataset.idx);
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      container.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      const to = parseInt(el.dataset.idx);
      el.classList.remove('drag-over');
      if (to !== dragFrom && dragFrom >= 0) {
        const [item] = state.decks.splice(dragFrom, 1);
        state.decks.splice(to, 0, item);
        save(); renderSidebar();
      }
    });
    el.addEventListener('dragend', () => {
      container.querySelectorAll('.dragging,.drag-over').forEach(x=>{x.classList.remove('dragging');x.classList.remove('drag-over');});
      dragFrom = -1;
    });
  });
}
