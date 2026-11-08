-- Run the WHOLE file in Supabase SQL Editor as the project database owner.
-- No service-role key or database password is used by the application.
-- Transactional and repeatable for this schema; existing rows are never deleted.
begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  created_at timestamptz not null default now()
);
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  state text not null check (state in ('in_progress', 'completed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create table if not exists public.viewed_signs (
  user_id uuid not null references auth.users(id) on delete cascade,
  sign_slug text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, sign_slug)
);
create table if not exists public.favorite_signs (
  user_id uuid not null references auth.users(id) on delete cascade,
  sign_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, sign_slug)
);
create table if not exists public.practice_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  sign_slug text not null,
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object'),
  completed_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.quiz_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  lesson_id text not null,
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  submitted_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.study_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  activity_type text not null check (activity_type in ('lesson', 'practice', 'quiz')),
  resource_id text not null,
  occurred_at timestamptz not null default now(),
  primary key (user_id, event_key)
);
create index if not exists sh_activities_user_time
  on public.study_activities (user_id, occurred_at desc);

-- Own-row reads; mutations are only available through the narrow RPC below.
-- This prevents a browser from backdating activity timestamps through REST.
do $$
declare tab text;
begin
  foreach tab in array array['profiles','lesson_progress','viewed_signs','favorite_signs',
                            'practice_sessions','quiz_attempts','study_activities'] loop
    -- Existing permissive policies combine with OR and could defeat own-row access.
    -- Stop atomically for manual reconciliation rather than erase an unknown policy.
    if exists (select 1 from pg_policies where schemaname = 'public'
               and tablename = tab and policyname <> 'sh_select_own') then
      raise exception 'Existing policies on public.% require review before this migration', tab;
    end if;
    execute format('alter table public.%I enable row level security', tab);
    execute format('alter table public.%I force row level security', tab);
    execute format('revoke all on public.%I from anon, authenticated', tab);
    execute format('revoke all on public.%I from public', tab);
    execute format('grant select on public.%I to authenticated', tab);
    execute format('drop policy if exists sh_select_own on public.%I', tab);
    execute format('create policy sh_select_own on public.%I for select to authenticated
                    using ((select auth.uid()) = user_id)', tab);
  end loop;
end $$;

-- Auth owns user creation; registration does not create a second identity system.
create or replace function public.sh_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, display_name, created_at)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name',''),80), new.created_at)
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.sh_create_profile() from public, anon, authenticated;
drop trigger if exists sh_auth_user_created on auth.users;
create trigger sh_auth_user_created after insert on auth.users
for each row execute function public.sh_create_profile();
-- Also supports users who signed up before this migration.
insert into public.profiles(user_id, display_name, created_at)
select id, left(coalesce(raw_user_meta_data->>'display_name',''),80), created_at from auth.users
on conflict (user_id) do nothing;

create or replace function public.sh_record_learning_event(event jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  kind text := event->>'type';
  resource text := event->>'id';
  entry uuid;
  stamp timestamptz := statement_timestamp();
  changed integer;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(event) <> 'object' or resource is null or length(resource) not between 1 and 120
     or resource !~ '^[a-zA-Z0-9_-]+$' then
    raise exception 'invalid resource' using errcode = '22023';
  end if;
  -- Serialize one user's writes, including simultaneous quiz completion requests.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if kind = 'sign' then
    insert into public.viewed_signs values (uid, resource, stamp) on conflict do nothing;
  elsif kind = 'favorite' then
    if jsonb_typeof(event->'on') is distinct from 'boolean' then raise exception 'invalid favorite'; end if;
    if (event->>'on')::boolean then
      insert into public.favorite_signs values (uid, resource, stamp) on conflict do nothing;
    else
      delete from public.favorite_signs where user_id = uid and sign_slug = resource;
    end if;
  elsif kind = 'lesson' then
    if event->>'state' is null or event->>'state' not in ('in_progress','completed') then
      raise exception 'invalid lesson state';
    end if;
    if event->>'state' = 'completed' and not exists (
      select 1 from public.quiz_attempts where user_id = uid and lesson_id = resource
      and score::numeric / total >= 0.8
    ) then raise exception 'pass the lesson quiz first'; end if;
    insert into public.lesson_progress values (uid, resource, event->>'state', stamp)
    on conflict (user_id, lesson_id) do update
      set state = excluded.state, updated_at = excluded.updated_at
      where lesson_progress.state <> 'completed' and lesson_progress.state <> excluded.state;
    if event->>'state' = 'completed' then
      insert into public.study_activities values (uid, 'lesson:'||resource, 'lesson', resource, stamp)
      on conflict do nothing;
    end if;
  elsif kind = 'practice' then
    entry := (event->>'event_id')::uuid;
    if entry is null or jsonb_typeof(event->'checklist') is distinct from 'object'
       or (select count(*) from jsonb_object_keys(event->'checklist')) <> 5
       or not (event->'checklist' ?& array['handshape','location','orientation','movement','expression'])
       or exists (select 1 from jsonb_each(event->'checklist') p where jsonb_typeof(p.value) <> 'boolean')
    then raise exception 'invalid practice'; end if;
    insert into public.practice_sessions values (uid, entry, resource, event->'checklist', stamp)
    on conflict do nothing;
    get diagnostics changed = row_count;
    if changed = 1 then
      insert into public.study_activities values (uid, 'practice:'||entry, 'practice', resource, stamp);
    end if;
  elsif kind = 'quiz' then
    entry := (event->>'event_id')::uuid;
    if entry is null or event->>'score' is null or event->>'total' is null then
      raise exception 'invalid quiz';
    end if;
    insert into public.quiz_attempts values
      (uid, entry, resource, (event->>'score')::integer, (event->>'total')::integer, stamp)
    on conflict do nothing;
    get diagnostics changed = row_count;
    if changed = 1 then
      insert into public.study_activities values (uid, 'quiz:'||entry, 'quiz', resource, stamp);
      if resource <> 'video' and (event->>'score')::numeric / (event->>'total')::integer >= 0.8 then
        insert into public.lesson_progress values (uid, resource, 'completed', stamp)
        on conflict (user_id, lesson_id) do update set state = 'completed', updated_at = excluded.updated_at
          where lesson_progress.state <> 'completed';
        insert into public.study_activities values (uid, 'lesson:'||resource, 'lesson', resource, stamp)
        on conflict do nothing;
      end if;
    end if;
  else raise exception 'invalid event type' using errcode = '22023';
  end if;
end $$;
revoke all on function public.sh_record_learning_event(jsonb) from public, anon;
grant execute on function public.sh_record_learning_event(jsonb) to authenticated;

-- SECURITY INVOKER: every aggregate below is subject to the same own-row RLS.
create or replace function public.sh_learning_snapshot()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where user_id = auth.uid()),
    'lessons', coalesce((select jsonb_object_agg(lesson_id,
      jsonb_build_object('state',state,'at',updated_at)) from public.lesson_progress), '{}'::jsonb),
    'signs', coalesce((select jsonb_object_agg(sign_slug,
      jsonb_build_object('at',viewed_at)) from public.viewed_signs), '{}'::jsonb),
    'favorites', coalesce((select jsonb_agg(sign_slug order by created_at) from public.favorite_signs), '[]'::jsonb),
    'practice', coalesce((select jsonb_agg(jsonb_build_object('id',id,'slug',sign_slug,
      'checklist',checklist,'at',completed_at) order by completed_at, id) from public.practice_sessions), '[]'::jsonb),
    'quiz', coalesce((select jsonb_object_agg(lesson_id, records) from (
      select lesson_id, jsonb_agg(jsonb_build_object('id',id,'score',score,'total',total,
        'at',submitted_at) order by submitted_at, id) records from public.quiz_attempts group by lesson_id
    ) q), '{}'::jsonb),
    'activities', coalesce((select jsonb_agg(jsonb_build_object('type',activity_type,
      'id',resource_id,'at',occurred_at) order by occurred_at, event_key) from public.study_activities), '[]'::jsonb),
    'activity', (select jsonb_build_object('type',activity_type,'id',resource_id,'at',occurred_at)
      from public.study_activities order by occurred_at desc, event_key limit 1)
  );
$$;
revoke all on function public.sh_learning_snapshot() from public, anon;
grant execute on function public.sh_learning_snapshot() to authenticated;

commit;
