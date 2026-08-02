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

// ═══════════════════════════════════════════════════════════════
// BANCO LOCAL (ptcg_cards, importado do dataset aberto pokemon-tcg-data)
// ═══════════════════════════════════════════════════════════════
// Cópia local de ~20 mil cartas (nome/número/coleção/imagem/raridade/tipo)
// direto no nosso Supabase — não depende da instabilidade da API de
// terceiro pra isso. Só não tem preço (o dataset aberto não traz preço de
// mercado, que muda todo dia); preço continua vindo só da API de terceiro,
// ver fetchRemoteCardMeta.
async function searchLocalCards(q, limit=20, setCode='') {
  let url = `${SB_URL}/rest/v1/ptcg_cards?select=name,number,set_id,set_name,set_code,supertype,rarity,image_small,image_large`
    + `&name=ilike.*${encodeURIComponent(q.trim())}*&limit=${limit}`;
  if (setCode) url += `&set_code=eq.${encodeURIComponent(setCode)}`;
  try {
    const res = await fetch(url, { headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}` } });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(r => ({
      name: r.name, number: r.number, supertype: r.supertype, rarity: r.rarity,
      images: { small: r.image_small, large: r.image_large },
      set: { name: r.set_name, ptcgoCode: r.set_code, id: r.set_id },
    }));
  } catch { return []; }
}

async function fetchLocalCardMeta(name, setCode='') {
  let url = `${SB_URL}/rest/v1/ptcg_cards?select=number,rarity,supertype,image_small,image_large`
    + `&name=ilike.${encodeURIComponent(name.trim())}&order=id&limit=1`;
  if (setCode) {
    const parts = setCode.trim().split(/\s+/);
    const num  = parts[parts.length-1];
    const code = parts.length > 1 ? parts.slice(0,-1).join(' ') : '';
    if (/^[A-Za-z]{0,4}\d+[A-Za-z]?$/.test(num))  url += `&number=eq.${encodeURIComponent(num)}`;
    if (/^[A-Za-z0-9]{2,8}$/.test(code)) url += `&set_code=eq.${encodeURIComponent(code)}`;
  }
  try {
    const res = await fetch(url, { headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${SB_ANON_KEY}` } });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows.length) return null;
    const r = rows[0];
    return {
      img: r.image_small||'', imgLarge: r.image_large||'', number: r.number||'',
      rarity: mapRarity(r.rarity), priceUsd: null, priceEur: null, type: apiType(r.supertype),
    };
  } catch { return null; }
}

// Retorna null quando a busca falhou de verdade (API fora do ar/erro HTTP),
// e um array (vazio ou não) quando a busca respondeu normalmente — o
// chamador precisa distinguir os dois casos ("API falhou" vs "carta não
// existe"), que antes mostravam a mesma mensagem pro usuário. Tenta 2 vezes
// porque a API já se mostrou instável a ponto de a mesma busca falhar e
// funcionar segundos depois.
async function apiSearch(q, limit=20, setCode='') {
  if (!q || q.length < 2) return [];
  const local = await searchLocalCards(q, limit, setCode);
  if (local.length) return local;
  // Não achou no banco local (coleção lançada depois da nossa última
  // importação, por exemplo) — cai pra API de terceiro como antes.
  let query = `name:"${q.trim()}"`;
  if (setCode) query += ` set.ptcgoCode:${setCode}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await ptcgFetch(`${PTCG}/cards?q=${encodeURIComponent(query)}&pageSize=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return d.data || [];
    } catch (err) {
      if (attempt === 2) { console.warn('[ptcg] apiSearch falhou:', err); return null; }
    }
  }
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

// Nome/imagem/raridade/tipo/número: tenta o banco local primeiro (rápido,
// não depende da API de terceiro — resolve a causa mais comum de "carta
// sem imagem"). Só cai pra API remota (com preço) se a carta genuinamente
// não estiver na nossa cópia. Preço em si nunca vem do banco local (o
// dataset aberto não traz preço de mercado) — quem precisa de preço de
// verdade (o painel de informações da carta) chama fetchRemoteCardMeta
// direto, não esta função.
async function fetchCardMeta(name, setCode='') {
  const local = await fetchLocalCardMeta(name, setCode);
  if (local && local.img) return local;
  return fetchRemoteCardMeta(name, setCode);
}

// Medido direto em 2026-07-30: de 15 nomes de carta comuns, 7 vieram com
// erro 500 na primeira tentativa (quase metade!). Era a causa real de "a
// maioria das cartas fica sem foto" antes do banco local existir — essa
// função tentava só uma vez. 3 tentativas (não 2, como em apiSearch) porque
// essa aqui roda em segundo plano sem ninguém esperando na tela, então vale
// gastar mais tempo pra não perder a imagem por causa de instabilidade
// momentânea da API.
async function fetchRemoteCardMeta(name, setCode='') {
  const key = (name+setCode).toLowerCase().trim();
  if (imgCache[key] !== undefined) return imgCache[key];
  let q = `name:"${name.trim()}"`;
  if (setCode) {
    const parts = setCode.trim().split(/\s+/);
    const num  = parts[parts.length-1];
    const code = parts.length > 1 ? parts.slice(0,-1).join(' ') : '';
    // Exige pelo menos um dígito (ex: "125", "TG05", "SWSH001", "125a") — não
    // basta ser "uma palavra qualquer". Sem isso, uma coleção escrita por
    // extenso (ex: "Obsidian Flames", vinda de uma lista importada com o
    // nome da coleção entre parênteses em vez do código) faria a busca
    // filtrar por "number:Flames", que não existe, e a carta nunca era achada.
    if (/^[A-Za-z]{0,4}\d+[A-Za-z]?$/.test(num)) q += ` number:${num}`;
    // Sem isso, "Riolu" + "MEG 76" virava só "number:76" — qualquer Riolu
    // (ou qualquer carta) numerada 76 em QUALQUER coleção batia, não
    // necessariamente a de MEG. É por isso que editar manualmente pra um
    // número que existe em mais de uma coleção podia trazer a carta errada
    // mesmo com a coleção certa digitada. Só aplica quando "code" parece
    // mesmo um código curto (ex: "MEG", "OBF") — não um nome de coleção por
    // extenso tipo "Obsidian Flames", que não teria sentido como filtro.
    if (/^[A-Za-z0-9]{2,8}$/.test(code)) q += ` set.ptcgoCode:${code}`;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ptcgFetch(`${PTCG}/cards?q=${encodeURIComponent(q)}&pageSize=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const meta = cardToMeta(d.data?.[0]);
      // Só guarda em cache um resultado de verdade — a API já se mostrou instável
      // (fora do ar por minutos seguidos); cachear uma falha faria o app nunca
      // mais tentar de novo pra essa carta na mesma sessão.
      if (meta.img) imgCache[key] = meta;
      return meta;
    } catch (err) {
      if (attempt === 3) { console.warn('[ptcg] fetchRemoteCardMeta falhou 3x:', err); return cardToMeta(null); }
    }
  }
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
  // Termina em "energy" (ex: "Fire Energy", "Double Turbo Energy") — não
  // basta *conter* a palavra, senão cartas de Treinador com "Energy" no
  // nome (ex: "Energy Recycler", "Energy Switch") viravam Energia errado.
  if (/\benergy$/.test(l)) return 'Energia';
  if (/professor|research|boss.?s order|arven|iono|colress|marnie|judge|hop|nanu|\bball\b|rare candy|switch|escape rope|potion|town|path|stadium|gate|nest|quick|ultra|great|level|heavy|master|premier|friend|counter|pal pad|tool\b|item\b|supporter/.test(l)) return 'Treinador';
  return 'Pokémon';
}
