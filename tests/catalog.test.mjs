import assert from 'node:assert/strict';
import fs from 'node:fs';
import {updateCatalog} from '../lib/catalog-update.mjs';
import {initialState,register,mutate} from '../lib/engine.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../lib/catalog.json',import.meta.url)));
assert.equal(catalog.filter(c=>c.type==='Card').length,41);
assert.equal(catalog.filter(c=>c.type==='Artifact').length,27);
assert.equal(catalog.filter(c=>c.type==='Legacy').length,14);
assert.equal(new Set(catalog.map(c=>c.id)).size,catalog.length);
assert.equal(catalog.find(c=>c.name==='Point Bottle').cost,4);
assert.equal(catalog.find(c=>c.name==='Gaming Chair').type,'Artifact');
assert.equal(catalog.find(c=>c.name==='Stone').rarity,'Unobtainable');
const old={id:'c1',name:'Gaming Chair',type:'Card',cost:1,kind:'percent',value:6};
const state={catalog:[old],players:[{id:'a',cards:[{uid:'copy',card:'c1'}],deck:['copy']}],matches:[{phase:'cards',players:[{hand:[{uid:'copy',card:'c1'}],draw:[],discard:[]}]}],audit:[]};
assert(updateCatalog(state,catalog));assert.equal(state.players[0].cards.length,1);assert.equal(state.players[0].deck.length,0);assert.equal(state.matches[0].players[0].hand[0].definition.type,'Card');assert(!updateCatalog(state,catalog));
const s=initialState(catalog);register(s,'owner','Owner');s.players[0].packs=10;
for(let i=0;i<10;i++)for(const id of mutate(s,'owner',{type:'open'})){const c=catalog.find(c=>c.id===id);assert.equal(c.type,'Card');assert.notEqual(c.rarity,'Unobtainable');}
console.log('PASS: modernized catalog, source costs, artifacts, archive, migration preservation, pack eligibility.');
