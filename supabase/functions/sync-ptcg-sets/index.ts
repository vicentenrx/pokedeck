// Mantém ptcg_cards em dia com coleções novas do dataset aberto
// PokemonTCG/pokemon-tcg-data, sem depender de alguém rodar SQL manualmente
// toda vez que uma coleção nova sai. Roda periodicamente via pg_cron (ver
// supabase/migrations) — idempotente de propósito (upsert, não insert puro),
// então rodar de novo por engano ou reprocessar uma coleção já importada
// nunca quebra nem duplica nada.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GITHUB_RAW = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master'

Deno.serve(async () => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // distinct_ptcg_set_ids() em vez de "select set_id from ptcg_cards" direto
  // -- a tabela tem ~20 mil linhas, e o limite padrão de linhas por request
  // do PostgREST cortaria o resultado antes de cobrir todas as coleções já
  // importadas, fazendo coleções antigas parecerem "novas" de novo.
  const { data: knownRows, error: knownErr } = await admin.rpc('distinct_ptcg_set_ids')
  if (knownErr) {
    return new Response(JSON.stringify({ error: 'falha ao ler coleções já importadas: ' + knownErr.message }), { status: 500 })
  }
  const knownSetIds = new Set((knownRows ?? []).map((r) => (typeof r === 'string' ? r : r.distinct_ptcg_set_ids)))

  const setsRes = await fetch(`${GITHUB_RAW}/sets/en.json`)
  if (!setsRes.ok) {
    return new Response(JSON.stringify({ error: `falha ao buscar sets/en.json: HTTP ${setsRes.status}` }), { status: 502 })
  }
  const allSets = await setsRes.json()
  const newSets = allSets.filter((s) => !knownSetIds.has(s.id))

  const summary = { setsChecked: allSets.length, newSets: newSets.map((s) => s.id), cardsUpserted: 0, errors: [] }

  for (const set of newSets) {
    try {
      const cardsRes = await fetch(`${GITHUB_RAW}/cards/en/${set.id}.json`)
      if (!cardsRes.ok) { summary.errors.push(`${set.id}: HTTP ${cardsRes.status} ao buscar cartas`); continue }
      const cards = await cardsRes.json()
      const rows = cards.map((c) => ({
        id: c.id,
        name: c.name,
        number: c.number ?? null,
        set_id: set.id,
        set_name: set.name,
        set_code: set.ptcgoCode ?? null,
        supertype: c.supertype ?? null,
        rarity: c.rarity ?? null,
        image_small: c.images?.small ?? null,
        image_large: c.images?.large ?? null,
      }))
      const { error: upsertErr } = await admin.from('ptcg_cards').upsert(rows, { onConflict: 'id' })
      if (upsertErr) { summary.errors.push(`${set.id}: ${upsertErr.message}`); continue }
      summary.cardsUpserted += rows.length
    } catch (err) {
      summary.errors.push(`${set.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
