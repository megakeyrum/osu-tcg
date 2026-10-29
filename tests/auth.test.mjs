import assert from 'node:assert/strict';
import {auth,identity,hash,randomToken,setCookie} from '../worker/auth.mjs';
import {initialState,register} from '../lib/engine.mjs';
const env={SITE_URL:'https://arena.example',OSU_CLIENT_ID:'test',OSU_CLIENT_SECRET:'test-secret'};
const state=randomToken();assert.equal(state.length,64);assert.notEqual(await hash(state),state);
assert.match(setCookie(env,'test','value',10),/HttpOnly; SameSite=Lax; Max-Age=10; Secure/);
assert.equal(await identity(new Request('https://arena.example',{headers:{'oai-authenticated-user-id':'15336211'}}),env),null);
assert.equal((await auth(new Request('https://arena.example/auth/osu/callback?state='+state+'&code=x'),env)).status,400);
assert.equal((await auth(new Request('https://arena.example/auth/logout',{method:'POST',headers:{Origin:'https://evil.example'}}),env)).status,403);
assert.equal((await auth(new Request('https://arena.example/auth/osu'),{SITE_URL:env.SITE_URL})).status,503);
let stored=[];env.DB={batch:async()=>[],prepare(sql){return {bind(...args){return {run:async()=>{stored.push({sql,args});},first:async()=>sql.startsWith('DELETE')?{token_hash:'valid'}:null};}};}};
const start=await auth(new Request('https://arena.example/auth/osu'),env);assert.equal(start.status,302);const redirect=new URL(start.headers.get('location'));assert.equal(redirect.origin,'https://osu.ppy.sh');assert.equal(redirect.searchParams.get('redirect_uri'),'https://arena.example/auth/osu/callback');assert.equal(redirect.searchParams.get('scope'),'identify');
const oldFetch=globalThis.fetch;globalThis.fetch=async(url)=>Response.json(String(url).endsWith('/oauth/token')?{access_token:'temporary'}:{id:15336211,username:'megakeyrum'});
try{const result=await auth(new Request('https://arena.example/auth/osu/callback?state='+state+'&code=code',{headers:{Cookie:'arena_oauth='+state}}),env);assert.equal(result.status,302);assert.match(result.headers.get('set-cookie'),/arena_session=/);assert(stored.some(x=>x.sql.startsWith('INSERT INTO sessions')&&x.args[1]==='15336211'));}finally{globalThis.fetch=oldFetch;}
const game=initialState([]);assert.equal(register(game,'999','First visitor').role,'player');
console.log('PASS: login state, CSRF, missing config, untrusted headers, secure cookies, OAuth callback, no first-visitor owner.');
