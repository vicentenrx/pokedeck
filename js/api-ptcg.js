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

// ═══════════════════════════════════════════════════════════════
// PREÇO E RARIDADE
// ═══════════════════════════════════════════════════════════════
// A API tem raridades bem específicas ("Rare Holo VMAX", "Illustration Rare"...).
// O app só expõe 6 categorias simples pro usuário — isso aqui aproxima uma na outra.
function mapRarity(apiRarity) {
  if (!apiRarity) return '';
  const r = apiRarity.toLowerCase();
  if (r.includes('ace spec'))  return 'ACE SPEC';
  if (r.includes('promo'))     return 'Promo';
  if (r === 'common')          return 'Comum';
  if (r === 'uncommon')        return 'Incomum';
  if (r === 'rare')            return 'Rara';
  return 'Ultra Rara'; // qualquer coisa acima de "Rare" simples (holo, ultra, secreta, ilustração...)
}

function extractUsdPrice(card) {
  const variants = card?.tcgplayer?.prices;
  if (!variants) return null;
  const order = ['holofoil','reverseHolofoil','1stEditionHolofoil','normal','1stEdition','unlimitedHolofoil','unlimited'];
  for (const key of order) if (typeof variants[key]?.market === 'number') return variants[key].market;
  for (const key in variants) if (typeof variants[key]?.market === 'number') return variants[key].market;
  return null;
}

function extractEurPrice(card) {
  const p = card?.cardmarket?.prices?.averageSellPrice;
  return typeof p === 'number' && p > 0 ? p : null;
}

function cardToMeta(card) {
  if (!card) return { img:'', imgLarge:'', number:'', rarity:'', priceUsd:null, priceEur:null, type:'' };
  return {
    img:       card.images?.small || '',
    imgLarge:  card.images?.large || '',
    number:    card.number || '',
    rarity:    mapRarity(card.rarity),
    priceUsd:  extractUsdPrice(card),
    priceEur:  extractEurPrice(card),
    // A API sabe com certeza se é Pokémon/Treinador/Energia — mais confiável
    // que o guessType() por palavra-chave usado ao importar uma lista de texto.
    type:      apiType(card.supertype),
  };
}

async function fetchCardMeta(name, setCode='') {
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
    const meta = cardToMeta(d.data?.[0]);
    // Só guarda em cache um resultado de verdade — a API já se mostrou instável
    // (fora do ar por minutos seguidos); cachear uma falha faria o app nunca
    // mais tentar de novo pra essa carta na mesma sessão.
    if (meta.img) imgCache[key] = meta;
    return meta;
  } catch { return cardToMeta(null); }
}

// Aplica só os campos que a busca realmente trouxe. Nunca apaga uma imagem,
// preço ou raridade que a carta já tinha por causa de uma busca que não achou
// nada (a API já se mostrou instável) — isso já causou perda de dados real.
function applyCardMeta(card, meta) {
  if (meta.img)              card.img = meta.img;
  if (meta.imgLarge)         card.imgLarge = meta.imgLarge;
  if (meta.number)           card.number = meta.number;
  if (meta.rarity)           card.rarity = meta.rarity;
  if (meta.priceUsd != null) card.priceUsd = meta.priceUsd;
  if (meta.priceEur != null) card.priceEur = meta.priceEur;
  if (meta.type)             card.type = meta.type;
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
