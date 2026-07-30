// ═══════════════════════════════════════════════════════════════
// AUTH GATE (tela de login / cadastro antes do app)
// ═══════════════════════════════════════════════════════════════
function showAuthGate() {
  switchAgTab('signin');
  $('ag-in-email').value = ''; $('ag-in-password').value = '';
  $('ag-up-email').value = ''; $('ag-up-password').value = ''; $('ag-up-password2').value = '';
  $('auth-gate').classList.remove('hidden');
}
function hideAuthGate() {
  $('auth-gate').classList.add('hidden');
}

// Todas as "telas" dentro do cartão de auth — sign in, cadastro, aviso de
// confirmação de e-mail, e agora o fluxo de recuperação de senha (pedido +
// aviso de envio + definir nova senha + sucesso). Só uma fica visível por vez.
const AG_VIEWS = [
  'ag-form-signin', 'ag-form-signup', 'ag-verify',
  'ag-form-forgot', 'ag-fg-sent', 'ag-form-reset', 'ag-rs-done',
];
function showAgView(id) {
  AG_VIEWS.forEach(v => $(v).classList.toggle('hidden', v !== id));
  // As abas Entrar/Criar Conta só fazem sentido durante login/cadastro —
  // no fluxo de recuperação de senha elas ficam escondidas.
  const isAuthTab = id === 'ag-form-signin' || id === 'ag-form-signup';
  $('ag-tabs').classList.toggle('hidden', !isAuthTab);
  $('ag-tab-signin').classList.toggle('active', id === 'ag-form-signin');
  $('ag-tab-signup').classList.toggle('active', id === 'ag-form-signup');
}

function switchAgTab(tab) {
  showAgView(tab === 'signin' ? 'ag-form-signin' : 'ag-form-signup');
  setAgError('ag-in-error', '');
  setAgError('ag-up-error', '');
}

function setAgError(id, message) {
  const el = $(id);
  if (!message) { el.classList.add('hidden'); el.textContent = ''; return; }
  el.textContent = message;
  el.classList.remove('hidden');
  const form = el.closest('.ag-form');
  form.classList.remove('ag-shake');
  void form.offsetWidth; // reinicia a animação
  form.classList.add('ag-shake');
}

function friendlyAuthError(msg) {
  if (/rate limit/i.test(msg))                                  return 'Muitos e-mails enviados recentemente. Aguarde alguns minutos e tente de novo.';
  if (/invalid login credentials/i.test(msg))                   return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg))                         return 'Confirme seu e-mail antes de entrar — veja sua caixa de entrada.';
  if (/already registered|already been registered/i.test(msg))  return 'Esse e-mail já tem uma conta. Tente entrar.';
  if (/password.*(least|characters)/i.test(msg))                return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/error sending confirmation email/i.test(msg))            return 'Não conseguimos enviar o e-mail de confirmação agora (problema no servidor de e-mail). Tente de novo em alguns minutos.';
  return msg || 'Algo deu errado. Tente novamente.';
}

$('ag-tab-signin').addEventListener('click', () => switchAgTab('signin'));
$('ag-tab-signup').addEventListener('click', () => switchAgTab('signup'));
$('ag-back-to-login').addEventListener('click', () => switchAgTab('signin'));

$('ag-form-signin').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = $('ag-in-email').value.trim();
  const password = $('ag-in-password').value;
  if (!email || !password) { setAgError('ag-in-error', 'Preencha e-mail e senha.'); return; }
  const btn = $('ag-in-submit');
  btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    await signIn(email, password);
    await loadSb();
    await enterApp();
    toast('Bem-vindo de volta!');
  } catch (err) {
    setAgError('ag-in-error', friendlyAuthError(err.message));
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
});

$('ag-form-signup').addEventListener('submit', async e => {
  e.preventDefault();
  const email     = $('ag-up-email').value.trim();
  const password  = $('ag-up-password').value;
  const password2 = $('ag-up-password2').value;
  if (!email || !password)    { setAgError('ag-up-error', 'Preencha e-mail e senha.'); return; }
  if (password.length < 6)    { setAgError('ag-up-error', 'A senha precisa ter pelo menos 6 caracteres.'); return; }
  if (password !== password2) { setAgError('ag-up-error', 'As senhas não coincidem.'); return; }
  const btn = $('ag-up-submit');
  btn.disabled = true; btn.textContent = 'Criando...';
  try {
    const r = await signUp(email, password);
    if (r.needsConfirmation) {
      $('ag-verify-email').textContent = email;
      showAgView('ag-verify');
    } else {
      await syncSb();
      await enterApp();
      toast('Conta criada!');
    }
  } catch (err) {
    setAgError('ag-up-error', friendlyAuthError(err.message));
  } finally {
    btn.disabled = false; btn.textContent = 'Criar Conta';
  }
});

// ── Recuperação de senha ──────────────────────────────────────
let _recoveryToken = null;

// O Supabase manda o usuário de volta com os tokens no #fragmento da URL
// (não em ?query), no formato "#access_token=...&type=recovery&...".
function parseRecoveryHash() {
  if (!location.hash.includes('type=recovery')) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const access_token = params.get('access_token');
  return access_token ? { access_token } : null;
}

// Chamado no boot (main.js) se o link do e-mail de recuperação trouxe o
// usuário de volta pro app. Precisa vir antes de qualquer outra lógica de
// sessão — esse token só serve pra trocar a senha, não é um login normal.
function initRecoveryFlow() {
  const recovery = parseRecoveryHash();
  if (!recovery) return false;
  _recoveryToken = recovery.access_token;
  history.replaceState(null, '', location.pathname); // tira o token da URL visível
  $('auth-gate').classList.remove('hidden');
  showAgView('ag-form-reset');
  return true;
}

$('ag-forgot-link').addEventListener('click', () => {
  $('ag-fg-email').value = $('ag-in-email').value.trim();
  showAgView('ag-form-forgot');
  setTimeout(() => $('ag-fg-email').focus(), 60);
});
$('ag-fg-back').addEventListener('click', () => switchAgTab('signin'));
$('ag-fg-sent-back').addEventListener('click', () => switchAgTab('signin'));
$('ag-rs-done-back').addEventListener('click', () => switchAgTab('signin'));

$('ag-form-forgot').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('ag-fg-email').value.trim();
  if (!email) { setAgError('ag-fg-error', 'Preencha seu e-mail.'); return; }
  const btn = $('ag-fg-submit');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    await requestPasswordReset(email);
    $('ag-fg-sent-email').textContent = email;
    showAgView('ag-fg-sent');
  } catch (err) {
    setAgError('ag-fg-error', friendlyAuthError(err.message));
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar link de recuperação';
  }
});

$('ag-form-reset').addEventListener('submit', async e => {
  e.preventDefault();
  const p1 = $('ag-rs-password').value;
  const p2 = $('ag-rs-password2').value;
  if (p1.length < 6)  { setAgError('ag-rs-error', 'A senha precisa ter pelo menos 6 caracteres.'); return; }
  if (p1 !== p2)      { setAgError('ag-rs-error', 'As senhas não coincidem.'); return; }
  const btn = $('ag-rs-submit');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    await confirmPasswordReset(_recoveryToken, p1);
    showAgView('ag-rs-done');
  } catch (err) {
    setAgError('ag-rs-error', friendlyAuthError(err.message));
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar nova senha';
  }
});
