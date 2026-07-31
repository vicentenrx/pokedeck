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

// ═══════════════════════════════════════════════════════════════
// REORDENAR CARTAS NA GRADE (modo de ordenar)
// ═══════════════════════════════════════════════════════════════
// Só liga quando o toggle "Ordenar" (curEditMode) está ativo — arraste
// livre o tempo todo seria fácil de disparar sem querer (ex: tentando só
// rolar a lista). Diferente do arraste da sidebar (1D, compara só a
// posição vertical), aqui é uma grade 2D — por isso usa elementFromPoint
// pra achar o card embaixo do dedo, em vez de comparar coordenadas.
// Reordena por card.id, não por posição visual, porque a grade pode estar
// filtrada (busca/coleção/tenho-falta) — a posição na tela não bate com o
// índice real em deck.cards nesse caso.
let _cardDragEl = null, _cardDragStartX = 0, _cardDragStartY = 0;

function initCardDragDrop() {
  if (!curEditMode) return;
  document.querySelectorAll('#card-grid .c-thumb').forEach(el => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      _cardDragEl = el;
      _cardDragStartX = e.clientX;
      _cardDragStartY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      // Sem isso, elementFromPoint (usado no pointermove) acha o próprio
      // card arrastado embaixo do dedo — ele é que acabou de se mover pra
      // lá — em vez do card que está por baixo de verdade.
      el.style.pointerEvents = 'none';
    });
  });
}

document.addEventListener('pointermove', e => {
  if (!_cardDragEl) return;
  _cardDragEl.style.transform = `translate(${e.clientX - _cardDragStartX}px, ${e.clientY - _cardDragStartY}px)`;

  const grid = $('card-grid');
  grid.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.c-thumb');
  if (under && under !== _cardDragEl) under.classList.add('drag-over');
});

function endCardDrag() {
  if (!_cardDragEl) return;
  const grid = $('card-grid');
  const target = grid.querySelector('.drag-over');
  _cardDragEl.style.transform = '';
  _cardDragEl.style.pointerEvents = '';
  _cardDragEl.classList.remove('dragging');
  grid.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  if (target) {
    const deck = activeDeck();
    const fromIdx = deck.cards.findIndex(c => c.id === _cardDragEl.dataset.cardId);
    const toIdx   = deck.cards.findIndex(c => c.id === target.dataset.cardId);
    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
      const [item] = deck.cards.splice(fromIdx, 1);
      deck.cards.splice(toIdx, 0, item);
      save(); renderCards();
    }
  }
  _cardDragEl = null;
}
document.addEventListener('pointerup', endCardDrag);
document.addEventListener('pointercancel', endCardDrag);
