// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let setsMap = {}; // { ptcgoCode: "Nome Completo" }
let state    = { decks:[], activeId:null };
let session  = null; // { access_token, refresh_token, expires_at, user:{id,email} } ou null (deslogado)
let imgCache = {};

// UI state
let curFilter  = 'all';
let curSearch  = '';
let viewMode   = 'grid';
let editDeckId = null;
let selColor   = COLORS[0];
let searchTmr  = null;
let curSet     = '';

// ═══════════════════════════════════════════════════════════════
// PERSIST
// ═══════════════════════════════════════════════════════════════
function loadLocal() {
  try {
    const r = localStorage.getItem(STATE_KEY);
    if (r) state = JSON.parse(r);
  } catch {}
  try {
    const s = localStorage.getItem(SB_SESSION_K);
    if (s) session = JSON.parse(s);
  } catch {}
}

function saveLocal() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

function save() { saveLocal(); syncSb(); }

function saveSession(sess) {
  session = sess;
  if (sess) localStorage.setItem(SB_SESSION_K, JSON.stringify(sess));
  else      localStorage.removeItem(SB_SESSION_K);
}
