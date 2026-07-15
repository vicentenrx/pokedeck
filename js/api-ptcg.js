// ═══════════════════════════════════════════════════════════════
// PTCG API
// ═══════════════════════════════════════════════════════════════
// A API do Pokémon TCG às vezes trava por dezenas de segundos (ou nunca
// responde). Sem um limite de tempo, a tela fica "carregando" pra sempre —
// por isso todo fetch aqui tem um timeout curto e falha de forma graciosa
// (os catches de cada função tratam isso como "sem resultado").
function ptcgFetch(url, timeoutMs=7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { headers: { 'X-Api-Key': PTCG_KEY }, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function apiSearch(q, limit=20, setCode='') {
  if (!q || q.length < 2) return [];
  try {
    let query = `name:"${q.trim()}"`;
    if (setCode) query += ` set.ptcgoCode:${setCode}`;
    const res = await ptcgFetch(`${PTCG}/cards?q=${encodeURIComponent(query)}&pageSize=${limit}`);
    const d = await res.json();
    return d.data || [];
  } catch { return []; }
}

async function fetchImg(name, setCode='') {
  const key = (name+setCode).toLowerCase().trim();
  if (imgCache[key] !== undefined) return imgCache[key];
  try {
    let q = `name:"${name.trim()}"`;
    if (setCode) {
      const parts = setCode.trim().split(/\s+/);
      const num = parts[parts.length-1];
      if (/^\w+$/.test(num)) q += ` number:${num}`;
    }
    const res = await ptcgFetch(`${PTCG}/cards?q=${encodeURIComponent(q)}&pageSize=1`);
    const d = await res.json();
    const url = d.data?.[0]?.images?.small || '';
    imgCache[key] = url;
    return url;
  } catch { imgCache[key]=''; return ''; }
}

async function loadSetsMap() {
  if (Object.keys(setsMap).length > 0) return; // já carregou
  try {
    const res = await ptcgFetch(`${PTCG}/sets?select=name,ptcgoCode&pageSize=250`, 10000);
    const d   = await res.json();
    (d.data || []).forEach(s => {
      if (s.ptcgoCode) setsMap[s.ptcgoCode] = s.name;
    });
  } catch { /* API lenta/fora do ar: fica com código só */ }
}

function apiType(supertype) {
  if (supertype==='Pokémon') return 'Pokémon';
  if (supertype==='Trainer') return 'Treinador';
  if (supertype==='Energy')  return 'Energia';
  return 'Pokémon';
}

function guessType(name) {
  const l = name.toLowerCase();
  if (/\benergy\b/.test(l)) return 'Energia';
  if (/professor|research|boss.?s order|arven|iono|colress|marnie|judge|hop|nanu|\bball\b|rare candy|switch|escape rope|potion|town|path|stadium|gate|nest|quick|ultra|great|level|heavy|master|premier|friend|counter|pal pad|tool\b|item\b|supporter/.test(l)) return 'Treinador';
  return 'Pokémon';
}
