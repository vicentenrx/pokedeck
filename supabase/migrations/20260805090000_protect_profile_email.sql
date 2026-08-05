-- A policy update_own de public.profiles (20260804065203_username_login.sql)
-- não tem WITH CHECK, então o Postgres reusa a mesma USING pra validar a
-- linha nova -- isso impede trocar user_id (não bate mais com auth.uid()),
-- mas não protege NENHUMA outra coluna. Um usuário autenticado consegue
-- fazer PATCH direto em /rest/v1/profiles?user_id=eq.<próprio id> com
-- {"email":"qualquer coisa"} e a RLS libera, porque é a própria linha dele.
--
-- Isso quebra a única garantia que essa tabela existe pra manter: email
-- sincronizado com auth.users.email (só é gravado uma vez, no signup, via
-- handle_new_user() -- nada re-sincroniza depois). Duas consequências: (1)
-- se o e-mail real mudar um dia (fluxo nativo de trocar e-mail), o profiles
-- fica com o antigo e o login por username passa a falhar silenciosamente
-- (erro genérico, sem pista de que a causa é essa); (2) o usuário pode
-- apontar o próprio username pra um e-mail de terceiro (não dá acesso à
-- conta de ninguém -- login continua exigindo a senha certa -- mas ainda
-- assim não deveria ser possível).
--
-- Um trigger (não dá pra referenciar a linha OLD dentro de um WITH CHECK)
-- bloqueia qualquer update que tente mudar email, com erro claro em vez de
-- falhar quieto.
create or replace function public.protect_profile_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is distinct from old.email then
    raise exception 'email do perfil não pode ser alterado diretamente -- ele é sincronizado automaticamente no cadastro';
  end if;
  return new;
end;
$$;

create trigger protect_profile_email
  before update on public.profiles
  for each row execute function public.protect_profile_email();
