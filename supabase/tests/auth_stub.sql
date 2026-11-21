-- Minimal stand-in for the parts of Supabase the migrations use (owner: Waddah). Test-only:
-- never run this on a real Supabase project, which already has these.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
-- Supabase reads the signed-in user from the request's JWT; tests set it with set_config.
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
-- No default table grants: like newer Supabase projects, tables are only reachable from the app
-- if a migration grants them explicitly (this caught "permission denied for table" on a real project).
