import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchId,fetchMatch,normalizeGames,loadMatch,MatchError} from '../worker/osu-match.mjs';

const ev=(id,gameId,scores,ended=true)=>({id,detail:{type:'other'},game:{id:gameId,beatmap:{id:gameId*10,version:'Hard',beatmapset:{title:'Song '+gameId}},end_time:ended?'2026-10-29T00:00:00Z':null,scores}});
const sc=(user_id,score,accuracy,passed=true)=>({user_id,score,accuracy,passed,mods:[]});
const players=[{id:'111',name:'Alice'},{id:'222',name:'Bob'}];
const users=new Map([[111,'Alice'],[222,'Bob']]);

test('parseMatchId accepts links, mp_ ids and bare ids',()=>{
  assert.equal(parseMatchId('https://osu.ppy.sh/community/matches/12345678'),'12345678');
  assert.equal(parseMatchId('mp_12345678'),'12345678');
  assert.equal(parseMatchId(' 12345678 '),'12345678');
  assert.equal(parseMatchId('hello'),null);
});

test('warmups are flagged, unfinished games skipped, excluded games dropped',()=>{
  const events=[
    ev(1,100,[sc(111,900000,0.95),sc(222,800000,0.97)]),
    ev(2,101,[sc(111,950000,0.96),sc(222,970000,0.94)]),
    ev(3,102,[sc(111,1,0.5)],false),
    ev(4,103,[sc(111,700000,0.9),sc(222,720000,0.99)])
  ];
  const g=normalizeGames(events,users,players,{warmups:1,exclude:['103']});
  assert.equal(g.length,2);
  assert.equal(g[0].warmup,true);
  assert.equal(g[1].warmup,false);
  assert.equal(g[1].scores[0].playerName,'Alice');
});

test('accuracy given as a percentage is normalized to 0-1; unknown users have no player',()=>{
  const g=normalizeGames([ev(1,100,[sc(111,5,98.5),sc(999,6,0.9)])],users,players);
  assert.equal(g[0].scores[0].accuracy,0.985);
  assert.equal(g[0].scores[1].playerId,null);
});

test('fetchMatch pages backwards until the first event is reached',async()=>{
  const realFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,opts)=>{
    const u=String(url);
    if(u.includes('/oauth/token'))return Response.json({access_token:'t',expires_in:3600});
    calls.push(u);
    if(u.includes('before=3'))return Response.json({match:{name:'T'},users:[],events:[ev(1,100,[sc(111,1,1)]),ev(2,101,[sc(111,2,1)])],first_event_id:1});
    return Response.json({match:{name:'T'},users:[{id:111,username:'Alice'}],events:[ev(3,102,[sc(111,3,1)])],first_event_id:1});
  };
  try{
    const m=await fetchMatch({OSU_CLIENT_ID:'1',OSU_CLIENT_SECRET:'s'},'555');
    assert.equal(m.events.length,3);
    assert.equal(calls.length,2);
  }finally{globalThis.fetch=realFetch;}
});

test('loadMatch validates input',async()=>{
  await assert.rejects(()=>loadMatch({},new URLSearchParams({id:'nope'}),[]),MatchError);
  await assert.rejects(()=>loadMatch({},new URLSearchParams({id:'12345',warmups:'-1'}),[]),MatchError);
});
