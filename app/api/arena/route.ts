import { updateCatalog } from '../../../lib/catalog-update.mjs';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import catalog from '../../../lib/catalog.json';
import { initialState, register, mutate, view } from '../../../lib/engine.mjs';
export const dynamic='force-dynamic';
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function load(){return await env.DB!.prepare('SELECT body, version FROM arena WHERE id = ?').bind('main').first<{body:string,version:number}>();}
export async function GET(){try{const user=await getChatGPTUser();if(!user)return response({error:'Sign in to access your collection.'},401);
 let row=await load();if(!row){const state=initialState(catalog);register(state,user.userId,user.fullName||'Tournament organizer');await env.DB!.prepare('INSERT OR IGNORE INTO arena (id,body,version) VALUES (?,?,0)').bind('main',JSON.stringify(state)).run();row=await load();}
 if(!row)throw Error('Database not ready.');let s=JSON.parse(row.body);
 if(updateCatalog(s,catalog)){const result=await env.DB!.prepare('UPDATE arena SET body=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(s),'main',row.version).run();if(!result.meta.changes)return response({error:'Catalog changed. Please refresh.'},409);row.version++;}
 if(!s.players.some((p:any)=>p.id===user.userId)){register(s,user.userId,user.fullName||'New player');const r=await env.DB!.prepare('UPDATE arena SET body=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(s),'main',row.version).run();if(!r.meta.changes)return response({error:'Collection changed. Please refresh.'},409);row.version++;}
 return response({...view(s,user.userId),version:row.version});
 }catch{return response({error:'Could not load the tournament database. Please try again.'},500);}}
export async function POST(req:Request){try{const u=await getChatGPTUser();if(!u)return response({error:'Sign in required.'},401);if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Invalid request origin.'},403);const a:any=await req.json();const row=await load();if(!row)return response({error:'Load your account first.'},400);if(a.version!==row.version)return response({error:'Someone updated the tournament. Refresh and try again.'},409);const s=JSON.parse(row.body);if(s.catalogVersion!=='modernized-v1')return response({error:'Card definitions updated. Refresh before continuing.'},409);let result;try{result=mutate(s,u.userId,a);}catch(e){return response({error:(e as Error).message},400);}const r=await env.DB!.prepare('UPDATE arena SET body=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(s),'main',row.version).run();if(!r.meta.changes)return response({error:'Another action completed first. Refresh and try again.'},409);return response({...view(s,u.userId),version:row.version+1,result});}catch{return response({error:'Unable to save. Refresh before retrying.'},500);}}
