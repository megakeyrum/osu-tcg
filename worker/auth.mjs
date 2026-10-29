export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export function cookie(req,name){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
export function origin(env){const u=new URL(env.SITE_URL);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('SITE_URL must use HTTPS.');return u.origin;}
export function setCookie(env,name,value,age){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${origin(env).startsWith('https:')?'; Secure':''}`;}
export async function identity(req,env){const token=cookie(req,'arena_session');if(!/^[a-f0-9]{64}$/.test(token))return null;return await env.DB.prepare('SELECT osu_id, username FROM sessions WHERE token_hash=? AND expires>?').bind(await hash(token),Date.now()).first();}
export async function auth(req,env){const u=new URL(req.url),base=origin(env);const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});const redirect=(location)=>{headers.set('Location',location);return new Response(null,{status:302,headers});};
 if(u.pathname==='/auth/logout'&&req.method==='POST'){if(req.headers.get('origin')!==base)return new Response('Invalid origin',{status:403});const token=cookie(req,'arena_session');if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();headers.append('Set-Cookie',setCookie(env,'arena_session','',0));return redirect('/');}
 if(req.method!=='GET')return new Response('Method not allowed',{status:405});
 if(!env.OSU_CLIENT_ID||!env.OSU_CLIENT_SECRET)return new Response('osu! login is not configured yet. Add OSU_CLIENT_ID and OSU_CLIENT_SECRET in Cloudflare, then redeploy.',{status:503,headers});
 const callback=base+'/auth/osu/callback';
 if(u.pathname==='/auth/osu'){
  const state=randomToken();await env.DB.batch([env.DB.prepare('DELETE FROM oauth_states WHERE expires<?').bind(Date.now()),env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),env.DB.prepare('INSERT INTO oauth_states (token_hash,expires) VALUES (?,?)').bind(await hash(state),Date.now()+600000)]);
  headers.append('Set-Cookie',setCookie(env,'arena_oauth',state,600));const url=new URL('https://osu.ppy.sh/oauth/authorize');url.search=new URLSearchParams({client_id:env.OSU_CLIENT_ID,redirect_uri:callback,response_type:'code',scope:'identify',state}).toString();return redirect(url.toString());
 }
 if(u.pathname!=='/auth/osu/callback')return new Response('Not found',{status:404});
 const state=u.searchParams.get('state'),code=u.searchParams.get('code');if(!state||!/^[a-f0-9]{64}$/.test(state)||state!==cookie(req,'arena_oauth'))return new Response('Login verification failed. Start again.',{status:400,headers});
 const used=await env.DB.prepare('DELETE FROM oauth_states WHERE token_hash=? AND expires>? RETURNING token_hash').bind(await hash(state),Date.now()).first();headers.append('Set-Cookie',setCookie(env,'arena_oauth','',0));if(!used||!code)return new Response('Login expired or cancelled. Start again.',{status:400,headers});
 const tokenResponse=await fetch('https://osu.ppy.sh/oauth/token',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({client_id:env.OSU_CLIENT_ID,client_secret:env.OSU_CLIENT_SECRET,code,grant_type:'authorization_code',redirect_uri:callback})});
 if(!tokenResponse.ok)throw Error('OAuth exchange failed');const tokens=await tokenResponse.json();
 const profileResponse=await fetch('https://osu.ppy.sh/api/v2/me',{headers:{Authorization:`Bearer ${tokens.access_token}`,Accept:'application/json'}});if(!profileResponse.ok)throw Error('Profile request failed');const profile=await profileResponse.json();
 if(!Number.isSafeInteger(profile.id)||!profile.username||profile.is_restricted)return new Response('This osu! account cannot sign in.',{status:403,headers});
 const session=randomToken();await env.DB.prepare('INSERT INTO sessions (token_hash,osu_id,username,expires) VALUES (?,?,?,?)').bind(await hash(session),String(profile.id),String(profile.username),Date.now()+604800000).run();headers.append('Set-Cookie',setCookie(env,'arena_session',session,604800));return redirect('/');
}
