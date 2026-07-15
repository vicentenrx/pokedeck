// ═══════════════════════════════════════════════════════════════
// AUTH GATE (tela de login / cadastro antes do app)
// ═══════════════════════════════════════════════════════════════
function showAuthGate() {
  switchAgTab('signin');
  $('ag-in-email').value = ''; $('ag-in-password').value = '';
  $('ag-up-email').value = ''; $('ag-up-password').value = ''; $('ag-up-password2').value = '';
  $('ag-form-signup').classList.remove('hidden');
  $('ag-verify').classList.add('hidden');
  $('auth-gate').classList.remove('hidden');
}
function hideAuthGate() {
  $('auth-gate').classList.add('hidden');
}

function switchAgTab(tab) {
  const isSignin = tab === 'signin';
  $('ag-tab-signin').classList.toggle('active', isSignin);
  $('ag-tab-signup').classList.toggle('active', !isSignin);
  $('ag-form-signin').classList.toggle('hidden', !isSignin);
  $('ag-form-signup').classList.toggle('hidden', isSignin);
  $('ag-verify').classList.add('hidden');
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
      $('ag-form-signup').classList.add('hidden');
      $('ag-verify').classList.remove('hidden');
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
