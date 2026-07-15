// ═══════════════════════════════════════════════════════════════
// SUPABASE AUTH
// ═══════════════════════════════════════════════════════════════
async function authRequest(path, body) {
  const res = await fetch(`${SB_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: { 'apikey': SB_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Não foi possível autenticar.');
  return data;
}

function sessionFromAuthResponse(data) {
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Date.now() + (data.expires_in * 1000),
    user: { id: data.user.id, email: data.user.email }
  };
}

async function signUp(email, password) {
  const data = await authRequest('/signup', { email, password });
  if (!data.access_token) return { needsConfirmation: true };
  saveSession(sessionFromAuthResponse(data));
  return { needsConfirmation: false };
}

async function signIn(email, password) {
  const data = await authRequest('/token?grant_type=password', { email, password });
  saveSession(sessionFromAuthResponse(data));
}

async function signOut() {
  if (session?.access_token) {
    try {
      await fetch(`${SB_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SB_ANON_KEY, 'Authorization': 'Bearer ' + session.access_token }
      });
    } catch {}
  }
  saveSession(null);
  // Limpa os decks locais também — o dispositivo pode ser compartilhado e o
  // próximo login (de outra conta) não deve herdar dados de quem saiu.
  state = { decks: [], activeId: null };
  saveLocal();
}

async function refreshSessionIfNeeded() {
  if (!session) return;
  if (Date.now() < session.expires_at - 60000) return; // ainda válida (margem de 1min)
  try {
    const data = await authRequest('/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    saveSession(sessionFromAuthResponse(data));
  } catch { saveSession(null); }
}
