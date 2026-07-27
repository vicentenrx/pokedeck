// ═══════════════════════════════════════════════════════════════
// CÂMBIO (USD/EUR → BRL)
// ═══════════════════════════════════════════════════════════════
// Cache em memória por 1h — cotação não precisa ser buscada a cada carta aberta.
const RATE_TTL_MS = 60 * 60 * 1000;
let rateCache = {}; // { USD: {value, at}, EUR: {value, at} }

async function getRateToBrl(currency) {
  const cached = rateCache[currency];
  if (cached && (Date.now() - cached.at) < RATE_TTL_MS) return cached.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${currency}&to=BRL`, { signal: controller.signal });
    clearTimeout(timer);
    const d = await res.json();
    const value = d?.rates?.BRL;
    if (typeof value === 'number') {
      rateCache[currency] = { value, at: Date.now() };
      return value;
    }
  } catch { /* sem internet ou API fora do ar: quem chamou decide o que mostrar */ }
  return cached?.value ?? null; // usa cotação velha antes de mostrar "indisponível"
}

function formatBrl(value) {
  return value.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}
