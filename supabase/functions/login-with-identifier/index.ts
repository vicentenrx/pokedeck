// Login por e-mail OU por username, sem nunca devolver o e-mail resolvido pro
// cliente. Se "identifier" já parece um e-mail, login normal. Senão, resolve
// username -> email aqui dentro (com a service_role, que só existe nesse
// runtime, nunca chega no navegador) e faz o login de verdade com o e-mail
// resolvido -- a resposta pro cliente é só a sessão (ou um erro genérico),
// igual ao login direto por e-mail já sempre foi. Username "não encontrado" e
// senha errada devolvem exatamente a mesma mensagem/status -- não dá pra usar
// esse endpoint pra descobrir se um username existe.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GENERIC_ERROR = { error_description: 'Invalid login credentials' }

// Piso de tempo mínimo pra QUALQUER resposta de erro deste endpoint. Sem
// isso, "username não existe" volta rápido (só uma consulta indexada) e
// "username existe, senha errada" volta bem mais devagar (round-trip até o
// GoTrue, que faz uma comparação de senha propositalmente cara/bcrypt) --
// mesmo com corpo/status idênticos, um atacante consegue distinguir os dois
// casos só pela latência e enumerar usernames válidos sem nem passar pelo
// rate-limit de login do GoTrue (que só existe no caminho lento). Padroniza
// as duas respostas de erro pro mesmo piso, absorvendo essa diferença.
const MIN_RESPONSE_MS = 600

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const startedAt = Date.now()
  // Devolve um erro genérico, mas só depois de garantir que passou o piso de
  // tempo mínimo desde o início da requisição -- usado em todo caminho de
  // falha abaixo, pra nenhum deles ficar rápido demais em relação ao outro.
  async function genericError() {
    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_RESPONSE_MS) await sleep(MIN_RESPONSE_MS - elapsed)
    return json(GENERIC_ERROR, 400)
  }

  let identifier: unknown, password: unknown
  try {
    ;({ identifier, password } = await req.json())
  } catch {
    return genericError()
  }
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier || !password) {
    return genericError()
  }

  const SB_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  let email = identifier.trim()
  if (!email.includes('@')) {
    // É um username, não um e-mail -- resolve com a service_role (bypassa RLS,
    // seguro porque isso roda só aqui dentro, nunca no cliente).
    const admin = createClient(SB_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data } = await admin
      .from('profiles')
      .select('email')
      .eq('username', email.toLowerCase())
      .maybeSingle()
    if (!data) return genericError() // mesma resposta de senha errada -- não confirma nem nega que o username existe (e o piso de tempo acima cobre a diferença de latência)
    email = data.email
  }

  // Login de verdade, com o e-mail resolvido -- o mesmo endpoint que o app já
  // usava antes de existir username. O e-mail nunca volta no corpo da resposta.
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return genericError()
  return json(data, 200)
})
