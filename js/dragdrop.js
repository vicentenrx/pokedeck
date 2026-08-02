// ═══════════════════════════════════════════════════════════════
// SIDEBAR DRAG-AND-DROP
// ═══════════════════════════════════════════════════════════════
// Usa Pointer Events (não a API nativa HTML5 dragstart/drop) porque
// a API nativa não funciona em touch em nenhum navegador mobile —
// Pointer Events unifica mouse, touch e caneta no mesmo código.
// O gatilho é só a alcinha (.dk-handle), não o card inteiro, pra não
// conflitar com o toque que seleciona o deck.
let _dragEl = null, _dragFrom = -1, _dragStartY = 0, _dragPointerId = null;

function initDragDrop() {
  const container = $('deck-list');
  container.querySelectorAll('.dk-handle').forEach(handle => {
    handle.addEventListener('pointerdown', e => {
      if (_dragEl) return; // já tem um arraste em andamento com outro ponteiro
      const item = handle.closest('.dk-item');
      if (!item) return;
      e.preventDefault();
      _dragEl = item;
      _dragFrom = parseInt(item.dataset.idx, 10);
      _dragStartY = e.clientY;
      _dragPointerId = e.pointerId;
      handle.setPointerCapture(e.pointerId);
      item.classList.add('dragging');
    });
  });
}

// Só reage ao pointerId que de fato iniciou o arraste — sem isso, um
// segundo toque (ex: a palma da mão encostando na tela enquanto se segura
// o celular) também dispara pointermove/pointerup no document inteiro e
// podia mover a carta errada ou encerrar o arraste no meio do gesto.
document.addEventListener('pointermove', e => {
  if (!_dragEl || e.pointerId !== _dragPointerId) return;
  _dragEl.style.transform = `translateY(${e.clientY - _dragStartY}px)`;

  const container = $('deck-list');
  container.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  const siblings = [...container.querySelectorAll('.dk-item')].filter(x => x !== _dragEl);
  for (const sib of siblings) {
    const r = sib.getBoundingClientRect();
    if (e.clientY > r.top && e.clientY < r.bottom) { sib.classList.add('drag-over'); break; }
  }
});

function endDrag(e) {
  if (!_dragEl || (e && e.pointerId !== _dragPointerId)) return;
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
  _dragEl = null; _dragFrom = -1; _dragPointerId = null;
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ═══════════════════════════════════════════════════════════════
// REORDENAR CARTAS NA GRADE (modo de ordenar)
// ═══════════════════════════════════════════════════════════════
// Só liga quando o toggle "Ordenar" (curEditMode) está ativo. No touch, o
// toque só vira arraste depois de segurar ~280ms sem mover muito — antes
// disso o dedo ainda pode rolar a tela normalmente (touch-action:pan-y no
// CSS permite isso; é o mesmo padrão do Google Keep / reorder do iOS). No
// mouse não existe esse conflito com rolagem, então arma no primeiro
// movimento (limiar bem pequeno, só pra não confundir com um clique).
//
// Enquanto arrasta, um placeholder tracejado (.c-thumb-ghost) marca o lugar
// da carta e os outros cards são de fato reordenados no DOM conforme o
// dedo/mouse passa por cima deles — animados com a técnica FLIP (mede a
// posição antes de mover, move, anima a diferença) — funciona em qualquer
// layout de grade sem precisar calcular linha/coluna manualmente. A carta
// arrastada em si vira position:fixed e simplesmente segue o cursor.
//
// Reordena por card.id preservando os "slots" ocupados pela lista filtrada
// dentro de deck.cards, porque a grade pode estar filtrada (busca/coleção/
// tenho-falta) — a posição na tela não bate com o índice real nesse caso.
const CARD_HOLD_MS = 280, CARD_MOVE_CANCEL_PX = 10, CARD_ARM_PX = 6;
let _cardDown = null;                       // {el,id,pointerId,x,y,pointerType,timer} — antes de armar
let _cardDragEl = null, _cardDragId = null, _cardDragPointerId = null; // depois de armar
let _cardOffsetX = 0, _cardOffsetY = 0, _cardPlaceholder = null, _cardLastUnder = null;

function initCardDragDrop() {
  if (!curEditMode) return;
  document.querySelectorAll('#card-grid .c-thumb').forEach(el => {
    el.addEventListener('pointerdown', e => {
      if (_cardDown || _cardDragEl) return;
      const down = { el, id: el.dataset.cardId, pointerId: e.pointerId, x: e.clientX, y: e.clientY, pointerType: e.pointerType, timer: null };
      _cardDown = down;
      if (e.pointerType !== 'mouse') {
        down.timer = setTimeout(() => { if (_cardDown === down) armCardDrag(down, down.x, down.y); }, CARD_HOLD_MS);
      }
    });
  });
}

function armCardDrag(down, x, y) {
  clearTimeout(down.timer);
  _cardDown = null;
  const el = down.el;
  const rect = el.getBoundingClientRect();
  try { el.setPointerCapture(down.pointerId); } catch {} // pode falhar se o ponteiro já não está mais ativo

  _cardDragEl = el;
  _cardDragId = down.id;
  _cardDragPointerId = down.pointerId;
  _cardOffsetX = x - rect.left;
  _cardOffsetY = y - rect.top;
  _cardLastUnder = null;

  _cardPlaceholder = document.createElement('div');
  _cardPlaceholder.className = 'c-thumb-ghost';
  _cardPlaceholder.style.width  = rect.width + 'px';
  _cardPlaceholder.style.height = rect.height + 'px';
  el.parentNode.insertBefore(_cardPlaceholder, el);

  el.style.position = 'fixed';
  el.style.left   = rect.left + 'px';
  el.style.top    = rect.top + 'px';
  el.style.width  = rect.width + 'px';
  el.style.height = rect.height + 'px';
  el.style.pointerEvents = 'none'; // senão elementFromPoint acha a própria carta embaixo do cursor
  el.style.touchAction = 'none';
  el.classList.add('dragging');
}

// Cada bloco só reage ao pointerId que de fato originou o gesto — sem
// isso, um segundo dedo tocando a tela (ex: a palma da mão segurando o
// celular) podia cancelar o "segurar pra armar" do primeiro dedo, ou mover
// a carta já armada pra posição de um dedo que não é o que está arrastando.
document.addEventListener('pointermove', e => {
  if (_cardDown && !_cardDragEl && e.pointerId === _cardDown.pointerId) {
    const dist = Math.hypot(e.clientX - _cardDown.x, e.clientY - _cardDown.y);
    if (_cardDown.pointerType === 'mouse') {
      if (dist > CARD_ARM_PX) armCardDrag(_cardDown, e.clientX, e.clientY);
    } else if (dist > CARD_MOVE_CANCEL_PX) {
      clearTimeout(_cardDown.timer);
      _cardDown = null; // o gesto virou rolagem, não arraste
    }
  }
  if (!_cardDragEl || e.pointerId !== _cardDragPointerId) return;
  e.preventDefault();
  _cardDragEl.style.left = (e.clientX - _cardOffsetX) + 'px';
  _cardDragEl.style.top  = (e.clientY - _cardOffsetY) + 'px';
  updateCardFlipTarget(e.clientX, e.clientY);
}, { passive: false });

function updateCardFlipTarget(x, y) {
  const grid = $('card-grid');
  const under = document.elementFromPoint(x, y)?.closest('.c-thumb, .c-thumb-ghost');
  if (!under || under === _cardDragEl || under === _cardPlaceholder) return;

  const r = under.getBoundingClientRect();
  const insertAfter = x > r.left + r.width / 2;
  // A chave inclui o lado (antes/depois), não só o card — senão, depois de
  // mover o placeholder pra depois de um card, voltar o dedo pra cima do
  // mesmo card (agora do lado esquerdo dele) não recalculava nada, porque
  // "under" não tinha mudado. Isso travava o arraste bem nas pontas: dava
  // pra mover pra direita mas não pra voltar pra esquerda sobre o mesmo card.
  const key = under.dataset.cardId + ':' + (insertAfter ? 'a' : 'b');
  if (key === _cardLastUnder) return;
  _cardLastUnder = key;

  const rects = new Map();
  grid.querySelectorAll('.c-thumb, .c-thumb-ghost').forEach(el => {
    if (el !== _cardDragEl) rects.set(el, el.getBoundingClientRect());
  });

  grid.insertBefore(_cardPlaceholder, insertAfter ? under.nextSibling : under);

  rects.forEach((oldRect, el) => {
    if (el === _cardPlaceholder) return;
    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left, dy = oldRect.top - newRect.top;
    if (!dx && !dy) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = 'transform .18s ease';
      el.style.transform = '';
    });
  });
}

// Comita o arraste em andamento (se houver) contra a grade ATUAL e limpa o
// estado, sem re-renderizar. Chamada tanto no soltar normal (endCardDrag)
// quanto no início de renderCards() — porque um re-render pode chegar no
// meio de um arraste por um motivo sem relação nenhuma (ex: uma busca de
// preço em segundo plano que termina bem nesse instante) e destruiria a
// grade por baixo do arraste em andamento se não comitarmos antes.
//
// pointerId é opcional: quando vem de um evento pointerup/pointercancel,
// só finaliza se for o mesmo ponteiro que armou o arraste (um segundo dedo
// não deveria conseguir encerrar o arraste do primeiro) — quando chamada
// sem argumento (do renderCards(), por um motivo não relacionado a nenhum
// ponteiro específico), finaliza de qualquer jeito, sem filtrar.
function finishCardDrag(pointerId) {
  if (_cardDown) {
    if (pointerId !== undefined && _cardDown.pointerId !== pointerId) return false;
    clearTimeout(_cardDown.timer);
    _cardDown = null;
  }
  if (!_cardDragEl) return false;
  if (pointerId !== undefined && _cardDragPointerId !== pointerId) return false;
  const grid = $('card-grid');
  const deck = activeDeck();
  const draggedId = _cardDragId;

  if (deck) {
    const visualIds = Array.from(grid.children)
      .map(el => el === _cardDragEl ? null : (el === _cardPlaceholder ? draggedId : el.dataset.cardId))
      .filter(Boolean);
    const idSet = new Set(visualIds);
    const slots = [];
    deck.cards.forEach((c, i) => { if (idSet.has(c.id)) slots.push(i); });
    const byId = new Map(deck.cards.map(c => [c.id, c]));
    visualIds.forEach((id, k) => { deck.cards[slots[k]] = byId.get(id); });
    save();
  }

  _cardPlaceholder?.remove();
  _cardDragEl.style.position = '';
  _cardDragEl.style.left = '';
  _cardDragEl.style.top = '';
  _cardDragEl.style.width = '';
  _cardDragEl.style.height = '';
  _cardDragEl.style.pointerEvents = '';
  _cardDragEl.style.touchAction = '';
  _cardDragEl.classList.remove('dragging');

  _cardDragEl = null; _cardDragId = null; _cardDragPointerId = null; _cardPlaceholder = null; _cardLastUnder = null;
  return true;
}
function endCardDrag(e) {
  if (finishCardDrag(e?.pointerId)) renderCards();
}
document.addEventListener('pointerup', endCardDrag);
document.addEventListener('pointercancel', endCardDrag);
