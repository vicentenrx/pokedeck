// ═══════════════════════════════════════════════════════════════
// PTCG API
// ═══════════════════════════════════════════════════════════════
function ptcgFetch(url) {
  return fetch(url, { headers: { 'X-Api-Key': PTCG_KEY } });
}

async function apiSearch(q, limit=20, setCode='') {
  if (!q || q.length < 2) return [];
  try {
    let query = `name:"${q.trim()}"`;
    if (setCode) query += ` set.ptcgoCode:${setCode}`;
    const res = await ptcgFetch(`${PTCG}/cards?q=${encodeURIComponent(query)}&pageSize=${limit}&select=id,name,images,set,number,supertype`);
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
    const res = await ptcgFetch(`${PTCG}/cards?q=${encodeURIComponent(q)}&pageSize=1&select=images`);
    const d = await res.json();
    const url = d.data?.[0]?.images?.small || '';
    imgCache[key] = url;
    return url;
  } catch { imgCache[key]=''; return ''; }
}

async function loadSetsMap() {
  if (Object.keys(setsMap).length > 0) return; // já carregou
  try {
    const res = await ptcgFetch(`${PTCG}/sets?select=name,ptcgoCode&pageSize=250`);
    const d   = await res.json();
    (d.data || []).forEach(s => {
      if (s.ptcgoCode) setsMap[s.ptcgoCode] = s.name;
    });
  } catch { /* sem internet: fica com código só */ }
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
