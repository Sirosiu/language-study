-- Separate application tables: existing project tables and Auth settings are untouched.
create table if not exists public.language_study_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (length(key) between 1 and 512),
  language text not null check (language in ('ar','da','nl','en','fi','fr','de','ka','it','ja','ko','zh','ru','es','tr')),
  kind text not null check (kind in ('answer','note','question','word')),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2097152),
  revision bigint not null default 1 check (revision > 0),
  deleted boolean not null default false,
  origin text not null default '' check (length(origin) <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id,key)
);
alter table public.language_study_items enable row level security;
drop policy if exists "Read own language study records" on public.language_study_items;
create policy "Read own language study records" on public.language_study_items
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.language_study_items from anon, authenticated;
grant select on public.language_study_items to authenticated;

create or replace function public.language_study_put_item(
  p_key text, p_language text, p_kind text, p_data jsonb,
  p_expected_revision bigint default 0, p_deleted boolean default false, p_origin text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  previous public.language_study_items%rowtype;
  saved public.language_study_items%rowtype;
  valid_key boolean := false;
begin
  if owner_id is null then raise exception 'Sign in to save study records' using errcode='42501'; end if;
  if p_language is null or p_language not in ('ar','da','nl','en','fi','fr','de','ka','it','ja','ko','zh','ru','es','tr')
    or p_key is null or length(p_key)>512 or p_kind is null
    or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>2097152
    or p_expected_revision is null or p_expected_revision<0 or p_deleted is null
    or p_origin is null or length(p_origin)>100 then
    raise exception 'Invalid study record' using errcode='22023';
  end if;
  if p_kind='note' then
    valid_key := p_key='note:'||p_language and jsonb_typeof(p_data->'markdown')='string';
  elsif p_kind='answer' then
    valid_key := p_key ~ ('^answer:'||p_language||'-(Q(0[0-9]{3}|1000)|U-[0-9a-f-]{36}|E[0-9]{1,3}-[0-9]{1,3})$')
      and p_key !~ 'Q0000$' and jsonb_typeof(p_data->'answer')='string'
      and p_data->>'status' in ('draft','submitted') and p_data->>'mark' in ('','correct','review');
  elsif p_kind='question' then
    valid_key := p_key ~ ('^question:'||p_language||'-U-[0-9a-f-]{36}$')
      and p_data->>'type' in ('translate','explain','written') and jsonb_typeof(p_data->'answer')='string';
  elsif p_kind='word' then
    valid_key := starts_with(p_key,'word:'||p_language||':') and jsonb_typeof(p_data->'word')='string';
  end if;
  if valid_key is distinct from true then raise exception 'Invalid record key or content' using errcode='22023'; end if;
  -- Serialize creates and updates for this owner's item; clients cannot choose an owner.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text||':'||p_key,0));
  select * into previous from public.language_study_items where user_id=owner_id and key=p_key for update;
  if found then
    if previous.data=p_data and previous.deleted=p_deleted then
      return jsonb_build_object('ok',true,'item',to_jsonb(previous));
    end if;
    if previous.revision<>p_expected_revision then
      return jsonb_build_object('ok',false,'conflict',true,'current',to_jsonb(previous));
    end if;
    if previous.language<>p_language or previous.kind<>p_kind then raise exception 'Record kind cannot change' using errcode='22023'; end if;
    update public.language_study_items set data=p_data,deleted=p_deleted,revision=revision+1,origin=p_origin,updated_at=clock_timestamp()
      where user_id=owner_id and key=p_key returning * into saved;
  else
    if p_expected_revision<>0 then return jsonb_build_object('ok',false,'conflict',true,'current',null); end if;
    insert into public.language_study_items(user_id,key,language,kind,data,deleted,origin)
      values(owner_id,p_key,p_language,p_kind,p_data,p_deleted,p_origin) returning * into saved;
  end if;
  return jsonb_build_object('ok',true,'item',to_jsonb(saved));
end;
$$;
revoke all on function public.language_study_put_item(text,text,text,jsonb,bigint,boolean,text) from public, anon;
grant execute on function public.language_study_put_item(text,text,text,jsonb,bigint,boolean,text) to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='language_study_items') then
    alter publication supabase_realtime add table public.language_study_items;
  end if;
end $$;
