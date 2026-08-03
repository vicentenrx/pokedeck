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
let pendingCardMeta = null; // metadados (preço/raridade/número) da sugestão de busca clicada
let curEditMode = false; // "modo de ordenar": ativa o arraste livre das cartas na grade (ver dragdrop.js)
let editSearchTmr = null;
let pendingEditCardMeta = null; // metadados da sugestão clicada no modal Editar Carta

// Token de geração por carta: evita que uma busca de metadado em segundo
// plano (disparada depois de salvar Adicionar/Editar Carta ou durante um
// Importar/"Buscar de novo") aplique um resultado desatualizado por cima de
// uma edição manual mais recente da MESMA carta. Incrementa toda vez que
// name/set mudam por edição manual — quem disparou uma busca antes disso
// compara a geração capturada no início contra a atual e descarta o
// resultado se elas não baterem mais.
let cardMetaGen = new Map(); // cardId -> geração atual
function bumpCardMetaGen(cardId) {
  const gen = (cardMetaGen.get(cardId) || 0) + 1;
  cardMetaGen.set(cardId, gen);
  return gen;
}

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

// save() é chamado a cada mutação pequena (marcar posse, ajustar
// quantidade, arrastar carta...). Sem fila, cada chamada disparava seu
// próprio POST pro Supabase, concorrente e sem ordem garantida: como é um
// upsert simples (substitui a coluna "data" inteira), se uma requisição
// mais antiga responder DEPOIS de uma mais nova, ela "vence" e regride o
// que está salvo na nuvem — e o próximo carregamento (outro
// dispositivo, ou só um F5) puxa essa versão desatualizada de volta.
// saveLocal() continua instantâneo e síncrono (nada muda pro dispositivo
// atual); só a sincronização com a nuvem é adiada um pouco e nunca roda
// mais de uma vez em paralelo — uma mutação que chega enquanto a
// sincronização anterior ainda está em voo só dispara de novo (já com o
// estado mais atual) assim que a anterior terminar.
let _syncTimer = null, _syncInFlight = false, _syncPending = false;

function save() {
  saveLocal();
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(runSync, 500);
}

async function runSync() {
  if (_syncInFlight) { _syncPending = true; return; }
  _syncInFlight = true;
  try {
    await syncSb();
  } finally {
    _syncInFlight = false;
    if (_syncPending) { _syncPending = false; runSync(); }
  }
}

// Se a aba for escondida (troca de app, fecha) com uma sincronização ainda
// esperando o atraso do debounce, manda na hora em vez de arriscar perder
// essa última mutação por causa do atraso artificial.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
    runSync();
  }
});

function saveSession(sess) {
  session = sess;
  if (sess) localStorage.setItem(SB_SESSION_K, JSON.stringify(sess));
  else      localStorage.removeItem(SB_SESSION_K);
}
