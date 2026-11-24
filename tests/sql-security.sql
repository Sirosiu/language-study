-- Isolated Postgres fixture only. Do not apply these stubs to a Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
\i /tmp/language-study-migration.sql
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ declare result jsonb; begin
  result:=public.language_study_put_item('note:fr','fr','note','{"markdown":"hello"}',0,false,'test');
  if not (result->>'ok')::boolean or result->'item'->>'revision'<>'1' then raise exception 'create failed'; end if;
  result:=public.language_study_put_item('note:fr','fr','note','{"markdown":"hello"}',0,false,'test');
  if result->'item'->>'revision'<>'1' then raise exception 'idempotence failed'; end if;
  result:=public.language_study_put_item('note:fr','fr','note','{"markdown":"updated"}',0,false,'test');
  if result->>'conflict'<>'true' then raise exception 'stale revision was accepted'; end if;
  result:=public.language_study_put_item('note:fr','fr','note','{"markdown":"updated"}',1,false,'test');
  if result->'item'->>'revision'<>'2' then raise exception 'update failed'; end if;
  begin
    insert into public.language_study_items(user_id,key,language,kind,data) values ('00000000-0000-4000-8000-000000000002','note:fr','fr','note','{}');
    raise exception 'direct write was permitted';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.language_study_items)<>1 then raise exception 'owner cannot read'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ declare result jsonb; begin
  if (select count(*) from public.language_study_items)<>0 then raise exception 'cross-user read leaked'; end if;
  result:=public.language_study_put_item('note:fr','fr','note','{"markdown":"other user"}',0,false,'test');
  if result->'item'->>'revision'<>'1' then raise exception 'cross-user isolation failed'; end if;
  result:=public.language_study_put_item('note:fr','fr','note','{"markdown":"other user"}',1,true,'test');
  if result->'item'->>'deleted'<>'true' then raise exception 'tombstone failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
  begin
    perform public.language_study_put_item('note:fr','fr','note','{"markdown":"anonymous"}',0,false,'test');
    raise exception 'anonymous write was permitted';
  exception when insufficient_privilege then null; end;
end $$;
set role anon;
do $$ begin
  begin
    perform * from public.language_study_items;
    raise exception 'anonymous table read was permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.language_study_put_item('note:fr','fr','note','{"markdown":"anonymous"}',0,false,'test');
    raise exception 'anonymous RPC execute was permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Language Study SQL: ownership, anonymous denial, CAS, idempotence and tombstones passed.' as result;
