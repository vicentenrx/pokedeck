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
  - `deck-logic.js`, `render.js`, `dragdrop.js`, `auth-gate.js`, `card-info.js`, `main.js`.
  - `events-*.js` — listeners de UI, um arquivo por responsabilidade (ordem
    no `index.html` importa só entre eles: `events-card-search.js`, com o
    helper de autocomplete compartilhado, precisa carregar antes de
    `events-card-add.js`/`events-card-edit.js`): `events-sidebar.js`
    (sidebar mobile + color picker), `events-deck.js` (modal criar/editar
    deck), `events-card-search.js` (autocomplete + filtro de coleção
    compartilhados), `events-card-add.js`/`events-card-edit.js` (modais de
    carta), `events-import-export.js` (import/export de lista + retry de
    imagens), `events-filters.js` (filtros/busca/ordenar da grade),
    `events-misc.js` (logout, ESC, barra de ações mobile).

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
ver `CONDITION_MULT` em `constants.js`) é o único campo de
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
JS/CSS antigo mesmo depois de editar — inclusive arquivo por arquivo (o
HTML pode recarregar fresco enquanto um `.js` específico continua vindo do
cache). Se um teste mostrar comportamento que não bate com o código atual,
suspeite de cache antes de assumir que há um bug de verdade. Formas de
confirmar: mudar a porta em `launch.json` (bytes vindos de uma porta nova
nunca têm cache prévio) ou injetar o arquivo específico de novo com um
parâmetro de cache-bust (`<script src="js/arquivo.js?bust=123">`) via
console — mais rápido que reiniciar o servidor quando é só um arquivo.

Contas de teste descartáveis (não são de usuário real, inbox pública do
Mailinator — qualquer um pode ler, nunca usar pra algo sensível):
`pokedeck.verify.test@mailinator.com` e variações como
`pokedeck.verify.test.<algo>@mailinator.com` (endereços Mailinator são
válidos com qualquer texto antes do @, cada um é uma inbox pública própria).

**Testando fluxos de e-mail (confirmação de cadastro, recuperação de senha)
de ponta a ponta, com e-mail de verdade:**
1. Adicionar `http://localhost:<porta>/*` em Supabase → Authentication →
   URL Configuration → Redirect URLs (a lista vem vazia por padrão; sem
   isso o Supabase ignora o redirect local e manda pro Site URL de
   produção). Pode deixar essa entrada lá, é aditivo e não atrapalha nada.
2. Disparar o fluxo (`signUp`/`requestPasswordReset`) com um e-mail
   Mailinator.
3. Buscar o e-mail via API pública da Mailinator (não precisa abrir
   navegador): `curl -s https://api.mailinator.com/api/v2/domains/public/inboxes/<inbox>`
   pra pegar o `id` da mensagem, depois
   `curl -s https://api.mailinator.com/api/v2/domains/public/inboxes/<inbox>/messages/<id>`
   pro conteúdo completo (JSON com `parts[].body` em HTML).
4. O link dentro do e-mail é um redirect de rastreamento da Brevo
   (`*.sendibt*.com/tr/cl/...`), não o link do Supabase direto. Resolver com
   `curl -s -L -o /dev/null -w '%{url_effective}' "<link>"` — o resultado é
   a URL final do app com o hash de verdade
   (`#access_token=...&type=recovery` ou `type=signup`). **Esse link também
   consome (single-use)** — só resolver uma vez, senão o próximo teste cai
   em `otp_expired`.
5. Abrir essa URL final no navegador (ou aplicar o hash direto) — só
   funciona como navegação de página nova de verdade (mudar só o hash numa
   aba já aberta não recarrega o JS, então `init()` não roda de novo).

## Lições de UI mobile (já viraram bug de verdade uma vez cada)

- **Nada essencial pode depender só de `:hover`.** Touch não tem hover. Já
  aconteceu com o botão de excluir deck (`opacity:0` até `:hover`) — ficava
  literalmente invisível e inacessível no celular. Qualquer ação necessária
  (excluir, editar, etc.) precisa estar visível/tocável sem hover; hover no
  máximo estiliza um estado, nunca é a única forma de revelar o elemento.
- **Alvo de toque mínimo ~40px**, não o tamanho visual do ícone. A alcinha
  de arrastar deck (`.dk-handle`) tinha só ~19x17px de área clicável (ícone
  de 13px + 2-3px de padding) — fácil de errar com o dedo, mesmo com a
  lógica de arrastar 100% correta por trás. Aumentar padding/área sem
  necessariamente aumentar o ícone visual resolve sem mudar o design.
- **Foco automático de campo de texto sobe o teclado na hora** — se o
  elemento focado ficar perto do topo de um modal centralizado, o teclado
  cobre o resto do modal inteiro. Evitar `.focus()` automático em campos de
  busca/texto ao abrir modal no mobile; deixar a pessoa tocar quando quiser.
- **HTML5 drag-and-drop nativo (`draggable="true"` + `dragstart`/`drop`) não
  funciona em touch em nenhum navegador mobile.** Qualquer reordenação por
  arrastar precisa ser Pointer Events (`pointerdown`/`pointermove`/
  `pointerup`, unifica mouse e touch) — ver `dragdrop.js`.

## Pendências conhecidas

- SMTP (Brevo): **confirmado funcionando** (2026-07-29, testado de ponta a
  ponta com e-mail real). Os dois problemas eram: (1) Username no Supabase
  estava com o e-mail do remetente em vez do login SMTP de verdade da Brevo
  (formato `bXXXXXXX@smtp-brevo.com`, visível em Brevo → SMTP & API → SMTP,
  não confundir com o e-mail da conta); (2) a Brevo tinha "IP autorizado"
  ativado pro SMTP, e o Supabase não usa IP fixo — precisa ficar desativado.
  Erro no log do Supabase (`Authentication → Logs`, evento `/signup` ou
  `/recover`, aba Raw) aparecia como `535 Authentication failed` (causa 1) ou
  `525 Unauthorized IP address` (causa 2) — diagnóstico direto pelo log, não
  pela mensagem genérica que o app mostra.
- "Esqueci minha senha": **implementado** (`requestPasswordReset`/
  `confirmPasswordReset` em `api-auth.js`, telas nos ids `ag-form-forgot`/
  `ag-fg-sent`/`ag-form-reset`/`ag-rs-done` em `index.html`, lógica em
  `auth-gate.js`). Reaproveita o endpoint `/auth/v1/recover` do Supabase.
- Mensagem "Bem-vindo de volta!" no login mostrada até pra quem tá entrando
  pela primeira vez de verdade: arquitetura já desenhada (não implementada)
  — generalizar `parseRecoveryHash()` pra `parseAuthRedirectHash()`, tratando
  também `type=signup` (confirmado por teste real: link de confirmação de
  cadastro sempre volta com `#access_token=...&type=signup`, igual ao
  `type=recovery` já tratado). Como a confirmação de e-mail é obrigatória
  neste projeto, **todo primeiro login de verdade passa por esse redirect**
  (testado: login sem confirmar retorna 400 `email_not_confirmed`) — então
  dá pra usar isso como sinal 100% confiável, sem heurística de data/hora.
  Decisão já tomada: pré-preencher o e-mail e deixar a pessoa digitar a
  senha normalmente (não logar automaticamente construindo uma sessão à
  mão — isso duplicaria o caminho de login de verdade sem necessidade).
- Migração de região do Supabase (US → São Paulo/`sa-east-1`): possível,
  mas trabalhosa (projeto novo + SQL de novo + migrar dados e usuários +
  trocar URL/chave). **Análise de impacto já feita**: `save()` em `state.js`
  chama `syncSb()` sem `await` (fire-and-forget) — ou seja, a região do
  Supabase **não afeta** a sensação de resposta ao tocar numa carta/deck, só
  afeta o que é de fato esperado (`await`): login (`signIn`) e carregamento
  inicial (`loadSb` em `enterApp`/`init`). Vale a pena, mas o ganho real é
  só nesses dois momentos, não no uso do dia a dia. Discutido, não executado.
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

## Como trabalhar nesse projeto (processo, não código)

- **Esta pasta é o clone git de verdade** (tem `.git`, é a mesma que está no
  GitHub). Editar, commitar e dar push sempre a partir daqui — nunca deixar
  o local divergir do repositório remoto. Se em algum momento existir outra
  cópia da pasta em outro lugar, ela é rascunho velho, não a fonte da
  verdade — confirmar com `git status`/`git log` antes de assumir qual é.
- **Verificar antes de afirmar.** Bug "corrigido" ou feature "funcionando"
  só depois de testar de verdade (navegador automatizado, conta de teste
  real, log de erro real) — não só ler o código e assumir que está certo.
  Já aconteceu mais de uma vez o código parecer óbvio e o comportamento real
  ser diferente (cache do navegador, API de terceiro instável, etc.).
- **Mudança de infraestrutura (Supabase, Brevo, migração de região, etc.)
  sempre se discute antes de executar**, mesmo com acesso liberado — são
  ações difíceis de reverter e existem contas/usuários reais.
- **Ao final de uma sessão** (quando a pessoa der um "boa noite" ou
  equivalente), perguntar o que ela quer resolver na próxima sessão antes de
  encerrar, e guardar a resposta (memória do Claude e/ou aqui no CLAUDE.md,
  conforme o tipo de informação) — evita perder contexto se a conversa
  reiniciar do zero.
