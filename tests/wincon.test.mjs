import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,register,mutate,mapWincon,suggestMod,view} from '../lib/engine.mjs';

const catalog=[
  {id:'plain',name:'Plain',type:'Card',cost:1,kind:'percent',value:10,text:'+10%',rarity:'Common'},
  {id:'acc',name:'Precision',type:'Card',cost:1,kind:'accuracy',value:0,text:'Accuracy decides this map',rarity:'Common'}
];

// Builds a started match between players "111" (organizer) and "222", ready for the referee to score.
function setup(cardFor1,cardFor2){
  const s=initialState(structuredClone(catalog));
  const a=register(s,'111','Alice'),b=register(s,'222','Bob');a.role='admin';
  for(const p of [a,b]){for(let i=0;i<6;i++)p.cards.push({uid:p.id+i,card:'plain'});p.deck=p.cards.map(c=>c.uid);}
  mutate(s,'111',{type:'matchCreate',p1:'111',p2:'222'});
  const m=s.matches[0];
  // put chosen cards into each hand deterministically
  m.players[0].hand=[{uid:'h1',card:cardFor1}];m.players[1].hand=[{uid:'h2',card:cardFor2}];
  mutate(s,'111',{type:'play',match:m.id,copy:'h1'});mutate(s,'222',{type:'play',match:m.id,copy:'h2'});
  mutate(s,'111',{type:'ready',match:m.id});mutate(s,'222',{type:'ready',match:m.id});
  return {s,m};
}

test('default win condition is Score V2 and uses buffed scores',()=>{
  const {s,m}=setup('plain','plain');
  assert.equal(mapWincon(m),'scorev2');
  mutate(s,'111',{type:'score',match:m.id,s1:100000,s2:110000,mod:'NM'}); // both +10%, Bob higher
  const h=m.history[0];
  assert.equal(h.wincon,'scorev2');
  assert.equal(h.winner,'Bob');
});

test('an accuracy card switches only that map to accuracy',()=>{
  const {s,m}=setup('plain','acc');
  assert.equal(mapWincon(m),'accuracy');
  // Alice has the higher score but Bob has higher accuracy, so Bob wins
  mutate(s,'111',{type:'score',match:m.id,s1:900000,s2:500000,acc1:0.95,acc2:0.97,mod:'NM'});
  assert.equal(m.history[0].wincon,'accuracy');
  assert.equal(m.history[0].winner,'Bob');
  assert.deepEqual(m.history[0].raw,[900000,500000]); // raw scores are still stored
  // next map goes back to the default
  assert.equal(mapWincon(m),'scorev2');
});

test('an accuracy map requires both accuracies and rejects ties and bad values',()=>{
  const {s,m}=setup('acc','plain');
  assert.throws(()=>mutate(s,'111',{type:'score',match:m.id,s1:1,s2:2,mod:'NM'}),/both accuracies/);
  assert.throws(()=>mutate(s,'111',{type:'score',match:m.id,s1:1,s2:2,acc1:0.9,acc2:0.9,mod:'NM'}),/Tied accuracy/);
  assert.throws(()=>mutate(s,'111',{type:'score',match:m.id,s1:1,s2:2,acc1:98,acc2:0.9,mod:'NM'}),/between 0% and 100%/);
});

test('referee can override the win condition',()=>{
  const {s,m}=setup('plain','plain');
  mutate(s,'111',{type:'score',match:m.id,s1:900000,s2:500000,acc1:0.80,acc2:0.99,wincon:'accuracy',mod:'NM'});
  assert.equal(m.history[0].winner,'Bob');
  assert.throws(()=>mutate(s,'111',{type:'score',match:m.id,s1:1,s2:2,wincon:'bogus',mod:'NM'}),/Invalid win condition|lock/);
});

test('the same osu! game cannot be recorded twice',()=>{
  const {s,m}=setup('plain','plain');
  mutate(s,'111',{type:'score',match:m.id,s1:100000,s2:90000,gameId:643471914,mod:'NM'});
  for(const p of m.players){mutate(s,p.id,{type:'ready',match:m.id});}
  assert.throws(()=>mutate(s,'111',{type:'score',match:m.id,s1:1,s2:2,gameId:643471914,mod:'NM'}),/already recorded/);
});

test('only organizers can score or link a match',()=>{
  const {s,m}=setup('plain','plain');
  assert.throws(()=>mutate(s,'222',{type:'score',match:m.id,s1:1,s2:2,mod:'NM'}),/Organizer/);
  assert.throws(()=>mutate(s,'222',{type:'matchLink',match:m.id,mp:'122084482',warmups:1}),/Organizer/);
});

test('matchLink stores the mp id and warmups, accepting links and bare ids',()=>{
  const {s,m}=setup('plain','plain');
  mutate(s,'111',{type:'matchLink',match:m.id,mp:'https://osu.ppy.sh/community/matches/122084482',warmups:2});
  assert.equal(m.mp,'122084482');assert.equal(m.warmups,2);
  assert.throws(()=>mutate(s,'111',{type:'matchLink',match:m.id,mp:'nope',warmups:0}),/valid mp/);
  assert.throws(()=>mutate(s,'111',{type:'matchLink',match:m.id,mp:'122084482',warmups:99}),/valid nonnegative/);
  assert.equal(view(s,'222').matches[0].mp,'122084482');
});

test('suggestMod picks a mod category from both players mods',()=>{
  assert.equal(suggestMod(['NF'],['NF']),'NM');
  assert.equal(suggestMod(['NF','HD'],['NF','HD']),'HD');
  assert.equal(suggestMod(['NF','HR'],['NF','HR']),'HR');
  assert.equal(suggestMod(['NC'],['DT']),'DT');
  assert.equal(suggestMod(['NF','HR'],['NF','HD']),'FM');
  assert.equal(suggestMod(['HD','HR'],['HD','HR']),'FM');
});
