import {identity,auth,origin} from './auth.mjs';
import catalog from '../lib/catalog.json';
import {initialState,register,mutate,view} from '../lib/engine.mjs';
import {updateCatalog} from '../lib/catalog-update.mjs';
import {loadMatch,MatchError} from './osu-match.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function syncPlayer(s,user,owner){let p=s.players.find(p=>p.id===user.osu_id);if(!p)p=register(s,user.osu_id,user.username);if(user.osu_id===owner)p.role='owner';else if(p.role==='owner')p.role='player';return p;}
export default {async fetch(req,env){try{
 const path=new URL(req.url).pathname;
 if(path.startsWith('/auth/'))return await auth(req,env);
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(path!=='/api/arena'&&path!=='/api/match')return json({error:'Not found.'},404);
 const user=await identity(req,env);if(!user)return json({error:'Sign in with osu! to save your collection.'},401);
 if(!/^\d+$/.test(env.OWNER_OSU_ID||''))return json({error:'Owner configuration is missing.'},503);
 if(path==='/api/match'){
  // Organizers only: pulls scores from a stable mp link. Read-only; it never changes tournament state.
  if(req.method!=='GET')return json({error:'Method not allowed.'},405);
  const mrow=await env.DB.prepare('SELECT body FROM arena WHERE id=?').bind('main').first();
  if(!mrow)return json({error:'Load your account first.'},400);
  const ms=JSON.parse(mrow.body);
  const me=ms.players.find(p=>String(p.id)===String(user.osu_id));
  const isOwner=String(user.osu_id)===String(env.OWNER_OSU_ID);
  if(!isOwner&&!(me&&me.role==='admin'))return json({error:'Organizers only.'},403);
  try{return json(await loadMatch(env,new URL(req.url).searchParams,ms.players));}
  catch(e){if(e instanceof MatchError)return json({error:e.message},e.status);return json({error:'Could not load the match.'},502);}
 }
 if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed.'},405);
 const load=()=>env.DB.prepare('SELECT body,version FROM arena WHERE id=?').bind('main').first();let row=await load();
 if(req.method==='GET'){
  if(!row){const s=initialState(catalog);syncPlayer(s,user,env.OWNER_OSU_ID);await env.DB.prepare('INSERT OR IGNORE INTO arena (id,body,version) VALUES (?,?,0)').bind('main',JSON.stringify(s)).run();row=await load();}
  const s=JSON.parse(row.body),before=JSON.stringify(s);updateCatalog(s,catalog);syncPlayer(s,user,env.OWNER_OSU_ID);
  if(JSON.stringify(s)!==before){const r=await env.DB.prepare('UPDATE arena SET body=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(s),'main',row.version).run();if(!r.meta.changes)return json({error:'Another update completed. Refresh and try again.'},409);row.version++;}
  return json({...view(s,user.osu_id),version:row.version});
 }
 if(req.headers.get('origin')!==origin(env))return json({error:'Invalid request origin.'},403);
 if(!row)return json({error:'Load your account first.'},400);
 const body=await req.text();if(body.length>20000)return json({error:'Request too large.'},413);let a;try{a=JSON.parse(body);}catch{return json({error:'Invalid JSON.'},400);}
 if(!a||a.version!==row.version)return json({error:'Someone updated the tournament. Refresh and try again.'},409);
 const s=JSON.parse(row.body);if(s.catalogVersion!=='modernized-v1')return json({error:'Refresh to load the new catalog.'},409);syncPlayer(s,user,env.OWNER_OSU_ID);
 let result;try{result=mutate(s,user.osu_id,a);}catch(e){return json({error:e.message},400);}
 const saved=await env.DB.prepare('UPDATE arena SET body=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(s),'main',row.version).run();if(!saved.meta.changes)return json({error:'Another action completed first. Refresh before retrying.'},409);
 return json({...view(s,user.osu_id),version:row.version+1,result});
 }catch{return json({error:'The request could not complete. Check Cloudflare configuration and database migrations.'},500);}}};
