import {initialState,register,mutate,view,adjusted} from '../lib/engine.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const s=initialState(JSON.parse(fs.readFileSync(new URL('../lib/catalog.json',import.meta.url))));register(s,'a','Alice');register(s,'b','Bob');
assert.throws(()=>mutate(s,'b',{type:'award',player:'b',amount:2,resource:'packs',reason:'test'}));
for(const p of s.players){mutate(s,'a',{type:'award',player:p.id,amount:5,resource:'card',card:'modern-card-01',reason:'test'});mutate(s,p.id,{type:'deck',cards:p.cards.map(c=>c.uid)});}
mutate(s,'a',{type:'matchCreate',p1:'a',p2:'b'});const m=s.matches[0];assert.equal(view(s,'a').matches[0].players[1].hand.length,0);
for(let i=0;i<3;i++)mutate(s,'a',{type:'play',match:m.id,copy:m.players[0].hand[0].uid});assert.equal(m.players[0].energy,0);assert.throws(()=>mutate(s,'a',{type:'play',match:m.id,copy:m.players[0].hand[0].uid}));
mutate(s,'a',{type:'ready',match:m.id});mutate(s,'b',{type:'ready',match:m.id});mutate(s,'a',{type:'score',match:m.id,s1:100000,s2:110000,mod:'NM',slot:'other'});assert.equal(m.players[0].points,1);assert.equal(m.players[0].energy,3);assert.equal(m.players[0].played.length,0);assert.equal(m.players[0].hand.length,5);
assert.equal(adjusted(100000,[{kind:'percent',value:6},{kind:'flat',value:15000}],'NM','1'),121000);
assert.throws(()=>mutate(s,'a',{type:'open'}));mutate(s,'a',{type:'award',player:'a',amount:1,resource:'packs',reason:'test'});assert.equal(mutate(s,'a',{type:'open'}).length,3);assert.equal(s.players[0].packs,0);
mutate(s,'a',{type:'finish',match:m.id});const offer=s.players[0].cards[0].uid,request=s.players[1].cards[0].uid;mutate(s,'a',{type:'trade',player:'b',offer,request});assert.throws(()=>mutate(s,'a',{type:'tradeResolve',trade:s.trades[0].id,accept:true}));mutate(s,'b',{type:'tradeResolve',trade:s.trades[0].id,accept:true});assert(s.players[1].cards.some(c=>c.uid===offer));assert(!s.players[0].deck.includes(offer));assert.throws(()=>mutate(s,'b',{type:'tradeResolve',trade:s.trades[0].id,accept:true}));
console.log('PASS: role enforcement, hidden hands, energy, one-map reset, scoring, packs, accepted trades.');
