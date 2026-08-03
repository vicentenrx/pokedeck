// ═══════════════════════════════════════════════════════════════
// SUPABASE SYNC (dados do deck, por usuário autenticado)
// ═══════════════════════════════════════════════════════════════
async function syncSb() {
  if (!session) return;
  await refreshSessionIfNeeded();
  if (!session) return; // refresh falhou e derrubou a sessão
  try {
    await fetch(`${SB_URL}/rest/v1/pokedeck`, {
      method:'POST',
      headers:{
        'apikey':SB_ANON_KEY,
        'Authorization':'Bearer '+session.access_token,
        'Content-Type':'application/json',
        'Prefer':'resolution=merge-duplicates'
      },
      body: JSON.stringify({ user_id: session.user.id, data:state, updated_at:new Date().toISOString() })
    });
  } catch(e) { console.warn('[sb] sync failed',e); }
}

// Retorna 'loaded' (achou deck salvo), 'empty' (conta confirmada sem deck
// salvo ainda — genuinamente nova) ou 'error' (não deu pra confirmar nem
// uma coisa nem outra, ex: falha de rede ou HTTP de erro). Essa distinção
// importa de verdade: antes essa função devolvia só true/false, e "false"
// tanto pra conta vazia quanto pra falha de rede — quem chamava tratava os
// dois casos como "pode criar o deck de demonstração", e o próximo save()
// sobrescrevia os decks reais na nuvem com a demonstração. Tenta 2x porque
// é exatamente o tipo de leitura que não pode "supor vazio" por causa de
// uma falha passageira.
async function loadSb() {
  if (!session) return 'error';
  await refreshSessionIfNeeded();
  if (!session) return 'error';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/pokedeck?user_id=eq.${session.user.id}&select=data`, {
        headers:{ 'apikey':SB_ANON_KEY,'Authorization':'Bearer '+session.access_token }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = await r.json();
      if (rows?.[0]?.data) { state = rows[0].data; saveLocal(); return 'loaded'; }
      return 'empty';
    } catch (e) {
      if (attempt === 2) { console.warn('[sb] load failed', e); return 'error'; }
    }
  }
}
