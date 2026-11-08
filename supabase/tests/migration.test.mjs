// PostgreSQL engine test, not a connection to a live Supabase project.
// npm install --prefix .runtime/sql-check @electric-sql/pglite
// node --test supabase/tests/migration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../../.runtime/sql-check/node_modules/@electric-sql/pglite/dist/index.js';

test('fresh migration, rerun, RLS, timestamp ownership and idempotent activity writes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    const migration = await readFile(new URL('../migrations/202611080001_learning_auth.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    await db.query(`insert into auth.users(id,raw_user_meta_data) values ($1,'{"display_name":"A"}'),($2,'{"display_name":"B"}')`, [a,b]);
    assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n, 2);
    const asUser = async id => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role authenticated');
    };
    const record = async event => db.query('select public.sh_record_learning_event($1::jsonb)', [JSON.stringify(event)]);
    const snapshot = async () => (await db.query('select public.sh_learning_snapshot() data')).rows[0].data;
    await asUser(a);
    assert.equal((await snapshot()).profile.display_name, 'A');
    assert.equal((await db.query('select * from public.profiles')).rows.length, 1);
    assert.equal((await snapshot()).activities.length, 0);
    await record({type:'lesson',id:'1',state:'in_progress'});
    await record({type:'sign',id:'am'});
    await record({type:'favorite',id:'am',on:true});
    assert.equal((await snapshot()).activities.length, 0);
    const practice = {type:'practice',id:'am',event_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      checklist:{handshape:true,location:true,orientation:false,movement:true,expression:false},
      at:'2000-01-01T00:00:00Z',user_id:b};
    await record(practice); await record(practice);
    let saved = await snapshot();
    assert.equal(saved.practice.length, 1);
    assert.equal(saved.activities.length, 1);
    assert.ok(new Date(saved.activities[0].at).getUTCFullYear() >= 2026);
    await assert.rejects(db.exec(`insert into public.study_activities values ('${a}','forged','quiz','1',now())`), /permission denied/);
    await assert.rejects(db.exec(`update public.profiles set display_name='forged'`), /permission denied/);
    await assert.rejects(record({type:'lesson',id:'1',state:'completed'}), /pass the lesson quiz/);
    const quiz = {type:'quiz',id:'1',score:4,total:5,event_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
    await record(quiz); await record(quiz);
    await record({type:'lesson',id:'1',state:'in_progress'});
    saved = await snapshot();
    assert.equal(saved.quiz['1'].length, 1);
    assert.equal(saved.lessons['1'].state, 'completed');
    assert.equal(saved.activities.length, 3);
    await record({type:'favorite',id:'am',on:false});
    assert.deepEqual((await snapshot()).favorites, []);
    await asUser(b);
    saved = await snapshot();
    assert.equal(saved.profile.display_name, 'B');
    assert.deepEqual(saved.practice, []); assert.deepEqual(saved.lessons, {});
    assert.deepEqual(saved.activities, []); assert.deepEqual(saved.signs, {});
    assert.equal((await db.query('select * from public.quiz_attempts')).rows.length, 0);
    await record({...practice,user_id:a});
    assert.equal((await snapshot()).practice.length, 1);
    await asUser(a);
    assert.equal((await snapshot()).practice.length, 1);
    await db.exec('reset role; set role anon');
    await assert.rejects(snapshot(), /permission denied/);
    await assert.rejects(record(practice), /permission denied/);
    await db.exec('reset role');
    const before = (await db.query('select count(*)::int n from public.study_activities')).rows[0].n;
    await db.exec(migration);
    assert.equal((await db.query('select count(*)::int n from public.study_activities')).rows[0].n, before);
    const rls = await db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relrowsecurity and relforcerowsecurity");
    assert.equal(rls.rows[0].n, 7);
  } finally { await db.close(); }
});
