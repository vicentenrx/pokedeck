-- Login por username: tabela de perfis (username <-> user_id/email), disponibilizada
-- só o suficiente pro app funcionar sem nunca expor e-mail de ninguém publicamente.
--
-- Resolução username -> email pro login NÃO acontece aqui via RLS pública (isso seria
-- um vazamento de e-mail, o mesmo tipo de problema já corrigido pro fluxo de signup) --
-- acontece só dentro da Edge Function login-with-identifier, que usa a service_role
-- (nunca exposta ao cliente) pra fazer essa consulta e nunca devolve o e-mail resolvido
-- na resposta, só o resultado final do login (sessão ou erro genérico).

create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  email      text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profiles enable row level security;

-- Cada um só lê/edita o próprio perfil -- não expõe username de outras contas
-- (username em si não é segredo, mas não há necessidade de expor a lista toda).
create policy select_own on public.profiles for select using (auth.uid() = user_id);
create policy update_own on public.profiles for update using (auth.uid() = user_id);

-- Checagem de disponibilidade em tempo real no formulário de cadastro. Devolve só um
-- booleano -- nenhuma linha, nenhum e-mail, nenhum user_id. Username já é um identificador
-- público por natureza (aparece pra outras pessoas), então "existe ou não" não é vazamento
-- do mesmo jeito que confirmar um e-mail cadastrado seria.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Cria o perfil automaticamente no signup, lendo o username enviado em `data` no
-- corpo do POST /auth/v1/signup (raw_user_meta_data). Se por algum motivo não vier
-- username (ex: alguém criando conta por fora do formulário do app), não cria perfil
-- e não quebra o signup -- login por e-mail continua funcionando normalmente pra essa
-- conta, só o login por username fica indisponível até ela definir um.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
begin
  if v_username is not null then
    insert into public.profiles (user_id, username, email)
    values (new.id, v_username, new.email)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
