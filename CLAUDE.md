# PokéDeck

Organizador de decks e coleção de Pokémon TCG para uma comunidade real de
jogadores brasileiros (não é uma ferramenta pessoal). Site estático, sem
build step — servir a pasta (ou abrir `index.html`) já roda o app inteiro.

## Stack

- HTML/CSS/JS puro. Sem framework, sem bundler, sem `npm`/`node_modules`.
- Scripts carregados via `<script src>` simples, na ordem em que aparecem no
  final de `index.html` — tudo é global, um arquivo depende do anterior já
  ter rodado. Não introduzir módulos ES/build step sem necessidade real.
- Deploy: Netlify (`pokedecksv001.netlify.app`), automático a cada
  `git push` pro GitHub (`github.com/vicentenrx/pokedeck`, público).

## Estrutura

- `index.html` — só marcação. Cada modal é um `.overlay.hidden#id`.
- `css/` — um arquivo por área: `base` (reset/tokens), `layout`
  (sidebar/topbar/filtros), `cards` (grade + lista), `modals`, `auth-gate`,
  `card-info`, `responsive` (todas as media queries centralizadas aqui).
- `js/` — um arquivo por responsabilidade:
  - `constants.js` — chaves de API, cores, `CONDITION_MULT`.
  - `state.js` — estado global (`state`, `session`, variáveis de UI) + persistência em `localStorage`.
  - `utils.js` — `$`, `esc` (escapa aspas também, ver Segurança), `toast`, `openModal`/`closeModal`.
  - `api-ptcg.js` — tudo que fala com a API do Pokémon TCG, incluindo `ptcgFetch` (todo fetch tem timeout, ver Instabilidade Conhecida) e `applyCardMeta` (merge seguro, ver Segurança).
  - `api-auth.js` / `api-supabase.js` / `api-rates.js` — auth do Supabase, sync do deck, câmbio USD/EUR→BRL.
  - `deck-logic.js`, `render.js`, `dragdrop.js`, `events.js`, `auth-gate.js`, `card-info.js`, `main.js`.

## Infraestrutura (contas reais)

- **Supabase**: projeto `izaeernhfzmrulztouvd`, região US. URL e a chave
  "publishable" ficam hardcoded em `constants.js` — isso é intencional e
  seguro (a chave publishable é feita pra ser pública; a proteção real são
  as políticas de RLS na tabela `pokedeck`, usando `auth.uid() = user_id`).
  **Nunca** commitar a chave `service_role`.
- Tabela `pokedeck`: `user_id uuid primary key references auth.users`,
  `data jsonb`, `updated_at`. RLS cobre select/insert/update por dono; não
  tem policy de delete (lacuna conhecida, sem urgência — o app nunca deleta
  linha na nuvem).
- Confirmação de e-mail fica ativada de propósito (é pra comunidade, não uso
  pessoal). SMTP customizado via Brevo pra fugir do limite baixo do envio
  padrão do Supabase — confirmar status atual antes de assumir que funciona.
- **Pokémon TCG API**: chave grátis em `constants.js`. Já retorna preço real
  (TCGPlayer USD + Cardmarket EUR) em cada carta — é isso que alimenta o
  painel de informações, sem precisar de nenhuma API de preço adicional.

## Modelo de dados (card)

```js
{ id, name, set, qty, owned, type, img, imgLarge, number, rarity, priceUsd, priceEur, priceUpdatedAt, condition, notes }
```

`set` é sempre "CÓDIGO NÚMERO" combinado (ex: `"OBF 125"`) — várias partes
do código fazem parse disso de volta (ver `splitSetCode` em `card-info.js`).
`rarity` é só leitura, vem da API. `condition` (`M`/`NM`/`SP`/`MP`/`HP`/`D`,
ver `CONDITION_LABEL`/`CONDITION_MULT` em `constants.js`) é o único campo de
"qualidade" editável pelo usuário, e só aplica um multiplicador local —
nunca dispara busca na rede. `notes` é texto livre do usuário (ex: "comprada
na loja X"); nunca é tocado por `applyCardMeta`, só pelo próprio usuário.

## Segurança — regras que não podem regredir

- `esc()` escapa `&`, `<`, `>` **e aspas** — todo uso cai dentro de atributo
  HTML entre aspas duplas. Se reescrever `esc()`, manter o escape de aspas.
- **Nunca sobrescrever um campo da carta com um valor vazio só porque uma
  busca falhou.** Use `applyCardMeta(card, meta)` (só aplica campo que
  realmente veio preenchido) em vez de `Object.assign` direto com o
  resultado de `fetchCardMeta`/`cardToMeta`. Isso já causou perda real de
  dados do usuário uma vez (commit "Fix data-wiping bug").
- Toda sessão salva em `localStorage` é revalidada (`refreshSessionIfNeeded`)
  antes de liberar entrada no app — nunca confiar em `if (session)` sozinho.

## Instabilidade conhecida (não é bug do app)

A API do Pokémon TCG cai/trava com frequência — confirmado direto, por fora
do app, múltiplas vezes (500 em endpoints simples, timeouts de 10-30s+).
Por isso:
- Todo fetch usa `ptcgFetch()` com timeout (7-10s) — nunca remover isso.
- Toda função que consome uma busca trata "não achou nada" como resultado
  normal, nunca deveria lançar erro pra cima do chamador.

## Testando localmente

`.claude/launch.json` roda `python -m http.server` numa porta. **Cuidado:**
esse servidor não manda cache headers, então o navegador às vezes serve
JS/CSS antigo mesmo depois de editar. Se um teste mostrar comportamento que
não bate com o código atual, suspeite de cache antes de assumir que há um
bug de verdade — reinicie numa porta nova ou refaça o fetch com
`{cache:'no-store'}` pra confirmar.

Conta de teste descartável (não é do usuário real, inbox pública do
Mailinator, só serve pra fluxos de confirmação de e-mail):
`pokedeck.verify.test@mailinator.com`.

## Pendências conhecidas

- SMTP (Brevo): configurado, status de funcionamento não confirmado na
  última sessão.
- Migração de região do Supabase (US → São Paulo/`sa-east-1`): possível,
  mas trabalhosa (projeto novo + SQL de novo + migrar dados e usuários +
  trocar URL/chave). Discutido, não executado.
- Sem fluxo de "esqueci minha senha".
- Roteiro pra virar app mobile (PWA → polimento de UI → Capacitor): etapa
  PWA concluída (`manifest.json`, ícones, meta tags, CSS "cara de app" —
  sem service worker, de propósito, pra não conflitar com os headers
  anti-cache do `netlify.toml`). Capacitor ainda não iniciado.
- Importação/exportação de deck aceita dois formatos (TCG Live e Liga
  Pokémon) — ver `parseDeckList`/`exportList`/`exportListLiga` em
  `deck-logic.js`. A correção de `type` (Pokémon/Treinador/Energia) de
  cartas mal-classificadas pelo `guessType()` por palavra-chave depende da
  API do PTCG responder (`cardToMeta`/`applyCardMeta` em `api-ptcg.js`);
  se a API estiver fora do ar, o palpite por palavra-chave fica valendo.
