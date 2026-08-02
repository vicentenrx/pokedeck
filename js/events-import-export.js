// Busca metadado (imagem/preço/raridade) de várias cartas em paralelo, em
// lotes pequenos — usado por Importar e "Buscar novamente" abaixo. Um
// Promise.all com a lista inteira de uma vez seria mais rápido ainda, mas a
// API do Pokémon TCG já se mostrou instável sozinha; lotes de 4 aceleram
// bastante uma lista de 30+ cartas sem virar uma rajada de requisições
// simultâneas. onBatch roda depois de cada lote (não a cada N encontradas,
// já que processar em grupos de 4 já dá uma cadência natural) pra quem
// chama poder aplicar os resultados e fazer save()/renderAll() periódicos.
async function fetchCardMetaInBatches(cards, batchSize, onBatch) {
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map(card => fetchCardMeta(card.name, card.set)));
    await onBatch(batch, metas);
  }
}

// ═══════════════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════════════
$('btn-import').addEventListener('click', () => {
  $('imp-txt').value = '';
  openModal('m-import');
  setTimeout(() => $('imp-txt').focus(), 60);
});
$('m-import-cancel').addEventListener('click', () => closeModal('m-import'));
$('m-import-save').addEventListener('click', async () => {
  const text = $('imp-txt').value.trim();
  if (!text) return;
  const parsed = parseDeckList(text);
  if (!parsed.length) { toast('Nenhuma carta reconhecida. Verifique o formato.'); return; }
  const deck = activeDeck();
  const newCards = parsed.map(p => ({
    id:uid(), ...p, owned:0, img:'', imgLarge:'', number:'', rarity:'', priceUsd:null, priceEur:null,
    priceUpdatedAt:null, condition:'NM', notes:'',
  }));
  deck.cards.push(...newCards);
  save(); closeModal('m-import'); renderAll();
  toast(`${parsed.length} cartas importadas! Buscando imagens e preços...`);
  let fetched = 0;
  await fetchCardMetaInBatches(newCards, 4, async (batch, metas) => {
    batch.forEach((card, i) => {
      const meta = metas[i];
      if (meta.img) {
        const c = deck.cards.find(x=>x.id===card.id);
        if (c) { applyCardMeta(c, meta); c.priceUpdatedAt = new Date().toISOString(); fetched++; }
      }
    });
    save(); renderAll();
  });
  save(); renderAll();
  if (fetched>0) toast(`✓ ${fetched} imagens carregadas!`);
});

// ═══════════════════════════════════════════════════════════════
// BUSCAR DE NOVO IMAGENS QUE FALTAM
// ═══════════════════════════════════════════════════════════════
// Buscar de novo imagens que faltam — a API do Pokémon TCG é instável o
// bastante pra uma importação inteira ficar sem foto numa hora ruim; esse
// botão deixa tentar de novo depois, sem precisar reimportar ou editar
// carta por carta. Sempre olha o deck inteiro (deck.cards), não só o que
// está visível no filtro/busca atual.
let retryingImages = false;
function updateRetryImagesButton(deck) {
  if (retryingImages) return; // não mexe no estado enquanto uma busca em massa já está rodando
  const missing = deck.cards.filter(c => !c.img).length;
  $('retry-images-count').textContent = missing ? ` (${missing})` : '';
  $('btn-retry-images').disabled = missing === 0;
}
$('btn-retry-images').addEventListener('click', async () => {
  const deck = activeDeck();
  const missing = deck?.cards.filter(c => !c.img) || [];
  if (!missing.length) return;
  retryingImages = true;
  const btn = $('btn-retry-images');
  btn.disabled = true;
  btn.classList.add('loading');
  toast(`Buscando imagem de ${missing.length} carta${missing.length!==1?'s':''}...`);
  let found = 0;
  await fetchCardMetaInBatches(missing, 4, async (batch, metas) => {
    batch.forEach((card, i) => {
      const meta = metas[i];
      if (meta.img) {
        const c = deck.cards.find(x=>x.id===card.id);
        if (c) { applyCardMeta(c, meta); c.priceUpdatedAt = new Date().toISOString(); found++; }
      }
    });
    save(); renderAll();
  });
  save();
  retryingImages = false;
  btn.classList.remove('loading');
  renderAll();
  toast(found ? `✓ ${found} imagem${found!==1?'s':''} encontrada${found!==1?'s':''}!` : 'Nenhuma imagem encontrada dessa vez — tente de novo mais tarde.');
});

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════
$('btn-export').addEventListener('click', () => {
  const deck = activeDeck();
  if (!deck) return;
  document.querySelectorAll('#exp-format-tog .flt').forEach(b=>b.classList.remove('active'));
  document.querySelector('#exp-format-tog .flt[data-fmt="tcglive"]').classList.add('active');
  $('exp-area').textContent = exportList(deck);
  openModal('m-export');
});
$('m-export-cancel').addEventListener('click', () => closeModal('m-export'));
$('m-export-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('exp-area').textContent); toast('Lista copiada!'); }
  catch { toast('Selecione o texto e copie com Ctrl+C'); }
});

// Export format toggle
document.querySelectorAll('#exp-format-tog .flt').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#exp-format-tog .flt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const deck = activeDeck();
  if (!deck) return;
  $('exp-area').textContent = btn.dataset.fmt === 'liga' ? exportListLiga(deck) : exportList(deck);
}));
