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
// Mostra a tela de "não deu pra carregar seus decks, tenta de novo" — sem
// abas de Entrar/Criar Conta, porque a sessão já é válida nesse ponto (o
// problema foi ler os decks na nuvem, não autenticar).
function showLoadError() {
  $('auth-gate').classList.remove('hidden');
  showAgView('ag-load-error');
}

// Todas as "telas" dentro do cartão de auth — sign in, cadastro, aviso de
// confirmação de e-mail, e agora o fluxo de recuperação de senha (pedido +
// aviso de envio + definir nova senha + sucesso). Só uma fica visível por vez.
const AG_VIEWS = [
  'ag-form-signin', 'ag-form-signup', 'ag-verify',
  'ag-form-forgot', 'ag-fg-sent', 'ag-form-reset', 'ag-rs-done',
  'ag-load-error',
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
    const entered = await loadSbAndEnter();
    // Se não entrou (loadSbAndEnter mostrou a tela de "tentar de novo"
    // porque não deu pra confirmar se a conta tem deck salvo), não avisa
    // "bem-vindo" — ainda não estamos dentro do app.
    if (entered) {
      // _justConfirmedSignup só fica true quando esse login vem logo depois de
      // um redirect de confirmação de cadastro (type=signup) — ou seja, é
      // fisicamente o primeiro login de verdade dessa conta (sem confirmar,
      // o Supabase recusa o login normal). Fora desse caso específico,
      // "de volta" está sempre certo.
      toast(_justConfirmedSignup ? 'Conta confirmada! Bem-vindo ao PokéDeck!' : 'Bem-vindo de volta!');
      _justConfirmedSignup = false;
    }
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

// ── Redirect de e-mail (confirmação de cadastro / recuperação de senha) ──
let _recoveryToken = null;
let _justConfirmedSignup = false;

// O Supabase manda o usuário de volta com os tokens no #fragmento da URL
// (não em ?query). type=recovery é "esqueci minha senha" (já tratado);
// type=signup é a confirmação de e-mail do cadastro — e como a confirmação
// de e-mail é obrigatória neste projeto (testado: login sem confirmar
// retorna 400 "email_not_confirmed"), esse redirect é o único jeito de
// alguém completar o primeiro login de verdade. Um link expirado ou já
// usado volta como "#error=...&error_code=otp_expired", sem "type" —
// precisa ser checado antes, senão cai no fallback errado.
function parseAuthRedirectHash() {
  if (!location.hash) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('error')) return { error: params.get('error_code') || params.get('error') };
  const type = params.get('type');
  const access_token = params.get('access_token');
  if (!access_token || (type !== 'recovery' && type !== 'signup')) return null;
  return { type, access_token };
}

// Chamado no boot (main.js), antes de qualquer outra lógica de sessão —
// um desses tokens/erro tem prioridade sobre qualquer sessão salva.
function initAuthRedirect() {
  const result = parseAuthRedirectHash();
  if (!result) return false;
  history.replaceState(null, '', location.pathname); // tira o token/erro da URL visível
  $('auth-gate').classList.remove('hidden');

  if (result.error) {
    showAgView('ag-form-signin');
    setAgError('ag-in-error', 'Esse link expirou ou já foi usado. Tente entrar normalmente, ou peça um novo link se for o caso.');
    return true;
  }

  if (result.type === 'recovery') {
    _recoveryToken = result.access_token;
    showAgView('ag-form-reset');
    return true;
  }

  // type === 'signup': não loga sozinho construindo uma sessão à mão (isso
  // duplicaria o caminho de signIn() sem necessidade) — só pré-preenche o
  // e-mail (via esse mesmo token, que já revalida no servidor) e marca que
  // o próximo "Entrar" bem-sucedido é o primeiro de verdade dessa conta.
  fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${result.access_token}` } })
    .then(r => r.ok ? r.json() : null)
    .then(u => { if (u?.email) $('ag-in-email').value = u.email; })
    .catch(() => {}); // não bloqueia o fluxo se falhar — só perde o preenchimento automático
  _justConfirmedSignup = true;
  showAgView('ag-form-signin');
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

$('ag-load-error-retry').addEventListener('click', async () => {
  // Se a sessão morreu enquanto a pessoa olhava essa tela (raro, mas
  // possível), não adianta tentar carregar de novo — manda pro login normal.
  if (!session) { showAuthGate(); return; }
  const btn = $('ag-load-error-retry');
  btn.disabled = true; btn.textContent = 'Tentando de novo...';
  await loadSbAndEnter();
  btn.disabled = false; btn.textContent = 'Tentar de novo';
});

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
