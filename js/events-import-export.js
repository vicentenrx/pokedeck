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
    // Geração de cada carta capturada ANTES da busca sair — nada no fluxo de
    // Importar/"Buscar de novo" bloqueia o modal Editar Carta durante o lote
    // (m-import fecha antes deste loop começar; retryingImages só desabilita
    // o próprio botão), então uma edição manual concorrente é real aqui.
    const gens   = batch.map(card => cardMetaGen.get(card.id) || 0);
    const metas  = await Promise.all(batch.map(card => fetchCardMeta(card.name, card.set)));
    await onBatch(batch, metas, gens);
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
  const newCards = parsed.map(p => createCard({ ...p, owned:0 }));
  deck.cards.push(...newCards);
  save(); closeModal('m-import'); renderAll();
  toast(`${parsed.length} cartas importadas! Buscando imagens e preços...`);
  let fetched = 0;
  await fetchCardMetaInBatches(newCards, 4, async (batch, metas, gens) => {
    const byId = new Map(deck.cards.map(c => [c.id, c]));
    batch.forEach((card, i) => {
      const meta = metas[i];
      // (cardMetaGen.get(card.id) || 0), não só cardMetaGen.get(card.id): uma
      // carta que nunca foi editada não tem entrada nenhuma no Map (.get()
      // devolve undefined), enquanto gens[i] já veio normalizado pra 0 lá em
      // fetchCardMetaInBatches -- sem o "|| 0" aqui também, undefined !== 0
      // SEMPRE, e a carta nunca teria o resultado da busca aplicado.
      if (meta.img && (cardMetaGen.get(card.id) || 0) === gens[i]) { // descarta se a carta foi editada manualmente enquanto essa busca estava no ar
        const c = byId.get(card.id);
        if (c) { applyCardMeta(c, meta); c.priceUpdatedAt = new Date().toISOString(); fetched++; }
      }
    });
    save(); renderAll();
  });
  save(); renderAll();
  if (fetched>0) toast(`✓ ${fetched} imagens carregadas!`);
});

// ═══════════════════════════════════════════════════════════════
// BUSCAR DE NOVO DADOS QUE FALTAM (imagem e/ou preço)
// ═══════════════════════════════════════════════════════════════
// A API do Pokémon TCG é instável o bastante pra uma importação inteira
// ficar sem foto ou sem preço numa hora ruim; esse botão deixa tentar de
// novo depois, pro deck inteiro de uma vez, sem precisar abrir carta por
// carta e clicar em "tentar de novo" no painel de informações de cada uma
// (era assim antes — cobria só imagem, e preço faltando ficava de fora,
// exigindo esse clique manual repetido). Sempre olha o deck inteiro
// (deck.cards), não só o que está visível no filtro/busca atual.
//
// "Falta imagem" e "falta preço" têm fontes diferentes: fetchCardMeta()
// tenta o banco local primeiro (rápido, mas nunca tem preço — só imagem/
// raridade/número) e só cai pra API remota se o local não tiver imagem
// nenhuma. Uma carta que já tem imagem mas não tem preço faria
// fetchCardMeta() achar o mesmo resultado local de novo (sem preço) e
// nunca chegar na API remota — por isso o preço é sempre tentado direto
// via fetchRemoteCardMeta() quando ainda falta depois do primeiro passo.
let retryingImages = false;
function cardMissingData(c) { return !c.img || (c.priceUsd == null && c.priceEur == null); }
function updateRetryDataButton(deck) {
  if (retryingImages) return; // não mexe no estado enquanto uma busca em massa já está rodando
  const missing = deck.cards.filter(cardMissingData).length;
  $('retry-images-count').textContent = missing ? ` (${missing})` : '';
  $('btn-retry-images').disabled = missing === 0;
}
$('btn-retry-images').addEventListener('click', async () => {
  const deck = activeDeck();
  const missing = deck?.cards.filter(cardMissingData) || [];
  if (!missing.length) return;
  retryingImages = true;
  const btn = $('btn-retry-images');
  btn.disabled = true;
  btn.classList.add('loading');
  toast(`Buscando dados de ${missing.length} carta${missing.length!==1?'s':''}...`);
  let found = 0;
  await fetchCardMetaInBatches(missing, 4, async (batch, metas, gens) => {
    const byId = new Map(deck.cards.map(c => [c.id, c]));
    for (let i = 0; i < batch.length; i++) {
      const card = batch[i];
      // (cardMetaGen.get(card.id) || 0): uma carta nunca editada não tem
      // entrada no Map (undefined), enquanto gens[i] já vem normalizado pra
      // 0 -- sem o "|| 0" aqui, undefined !== 0 sempre, e NENHUMA carta
      // recém-criada teria o resultado da busca aplicado (achado ao vivo
      // testando esta correção — o import e o retry em massa já estavam
      // silenciosamente quebrados assim desde a guarda de geração de hoje).
      if ((cardMetaGen.get(card.id) || 0) !== gens[i]) continue; // carta editada manualmente enquanto a busca estava no ar -- descarta
      const c = byId.get(card.id);
      if (!c) continue;
      let meta = metas[i];
      let changed = false;
      if (meta.img) { applyCardMeta(c, meta); changed = true; }
      if (c.priceUsd == null && c.priceEur == null) {
        const remoteMeta = await fetchRemoteCardMeta(card.name, card.set);
        if ((cardMetaGen.get(card.id) || 0) !== gens[i]) continue; // idem, checado de novo -- essa segunda busca também é assíncrona
        if (remoteMeta.img || remoteMeta.priceUsd != null || remoteMeta.priceEur != null) { applyCardMeta(c, remoteMeta); changed = true; }
      }
      if (changed) { c.priceUpdatedAt = new Date().toISOString(); found++; }
    }
    save(); renderAll(); // renderAll() já recalcula o valor total do deck (renderTopbar -> renderDeckValue), sem precisar de F5
  });
  save();
  retryingImages = false;
  btn.classList.remove('loading');
  renderAll();
  toast(found ? `✓ ${found} carta${found!==1?'s':''} atualizada${found!==1?'s':''}!` : 'Nada encontrado dessa vez — tente de novo mais tarde.');
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
