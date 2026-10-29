export const CATALOG_VERSION='modernized-v1';
export function updateCatalog(s,catalog){
 if(s.catalogVersion===CATALOG_VERSION)return false;
 const old=s.catalog;
 // Snapshot live match card definitions so a source update cannot change a hand mid-match.
 for(const m of s.matches||[])if(m.phase!=='finished')for(const p of m.players)for(const pile of ['hand','draw','discard'])for(const c of p[pile]||[])c.definition??=old.find(d=>d.id===c.card);
 const ids=new Set(catalog.map(c=>c.id));
 const preserved=old.filter(c=>!ids.has(c.id)).map(c=>({...c,type:c.original==='Custom tournament card'?c.type:'Legacy',archived:c.original!=='Custom tournament card',obtainable:false}));
 s.catalog=[...catalog,...preserved];s.catalogVersion=CATALOG_VERSION;
 const legal=new Set(s.catalog.filter(c=>c.type==='Card'&&!c.archived).map(c=>c.id));
 for(const p of s.players)p.deck=p.deck.filter(uid=>p.cards.some(c=>c.uid===uid&&legal.has(c.card)));
 s.audit.unshift({id:'catalog-modernized-v1',actor:'System',actorId:'system',event:'Imported Modernized Versions: updated definitions and costs; artifacts and old cards removed from saved decks. Owned copies preserved.',time:new Date().toISOString()});
 return true;
}
