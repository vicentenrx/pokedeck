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

async function loadSb() {
  if (!session) return false;
  await refreshSessionIfNeeded();
  if (!session) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/pokedeck?user_id=eq.${session.user.id}&select=data`, {
      headers:{ 'apikey':SB_ANON_KEY,'Authorization':'Bearer '+session.access_token }
    });
    const rows = await r.json();
    if (rows?.[0]?.data) { state = rows[0].data; saveLocal(); return true; }
  } catch(e) { console.warn('[sb] load failed',e); }
  return false;
}

function renderAccountBar() {
  if (!session) return;
  $('sb-account-email').textContent = session.user.email;
}
