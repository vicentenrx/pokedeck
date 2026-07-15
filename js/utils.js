// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
const $   = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const esc = s  => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

let _toastTmr;
function toast(msg, dur=2400) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTmr);
  _toastTmr = setTimeout(() => el.classList.remove('show'), dur);
}

function openModal(id)  { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }
function ownedClass(owned, qty) {
  if (owned === 0)    return 'st-none';
  if (owned >= qty)   return 'st-full';
  return 'st-part';
}
function activeDeck() { return state.decks.find(d => d.id === state.activeId) ?? null; }
