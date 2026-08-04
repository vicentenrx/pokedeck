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

async function signUp(email, password, username) {
  // Sem isso, o Supabase usa a "Site URL" configurada no painel como destino
  // do link de confirmação — se estiver desatualizada (ex: localhost), o link
  // do e-mail leva pra um endereço morto. Aponta sempre pro endereço atual.
  const redirectTo = encodeURIComponent(location.origin + location.pathname);
  // `data` vira raw_user_meta_data em auth.users — um trigger no banco (ver
  // supabase/migrations) lê username de lá pra criar a linha em `profiles`
  // sozinho, sem precisar de um segundo request daqui.
  const data = await authRequest(`/signup?redirect_to=${redirectTo}`, { email, password, data: { username } });
  if (!data.access_token) return { needsConfirmation: true };
  saveSession(sessionFromAuthResponse(data));
  return { needsConfirmation: false };
}

// Login por e-mail OU username. A resolução de username pra e-mail acontece
// só dentro da Edge Function (com a service_role, que nunca chega aqui) —
// esta função nunca vê nem manuseia o e-mail real por trás de um username,
// só recebe de volta a sessão pronta (ou um erro genérico, igual a uma senha
// errada) exatamente como um login direto por e-mail sempre devolveu.
async function signInWithIdentifier(identifier, password) {
  const res = await fetch(`${SB_URL}/functions/v1/login-with-identifier`, {
    method: 'POST',
    headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Não foi possível autenticar.');
  saveSession(sessionFromAuthResponse(data));
}

// Checagem em tempo real no cadastro — devolve só true/false, nunca uma
// linha/e-mail (ver username_available() na migração). Falha de rede conta
// como "não sei", não como "indisponível" — quem chama decide o que mostrar.
async function checkUsernameAvailable(username) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/username_available`, {
    method: 'POST',
    headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_username: username }),
  });
  if (!res.ok) return null;
  return res.json();
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

// E-mail de recuperação de senha. O Supabase sempre responde 200 aqui,
// exista ou não a conta — evita que alguém descubra e-mails cadastrados
// testando essa tela. A tela precisa refletir essa ambiguidade também.
async function requestPasswordReset(email) {
  const redirectTo = encodeURIComponent(location.origin + location.pathname);
  await authRequest(`/recover?redirect_to=${redirectTo}`, { email });
}

// Chamado depois que o usuário clica no link do e-mail de recuperação —
// accessToken vem do fragmento da URL (#...&type=recovery), não de um login normal.
async function confirmPasswordReset(accessToken, newPassword) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': SB_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Não foi possível atualizar a senha.');
  return data;
}

async function refreshSessionIfNeeded() {
  if (!session) return;
  if (Date.now() < session.expires_at - 60000) return; // ainda válida (margem de 1min)
  try {
    const data = await authRequest('/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    saveSession(sessionFromAuthResponse(data));
  } catch { saveSession(null); }
}
