'use client';
import {useEffect,useState} from 'react';
import {mapWincon,suggestMod} from '../lib/engine.mjs';

const blank={s1:'',s2:'',a1:'',a2:'',mod:'NM',slot:'other',wincon:'',gameId:null as number|null,label:'',manual:false};
const pct=(x:number|null)=>x==null?'':String(Math.round(x*1e6)/1e4);
const shown=(s:any)=>`${s.osuName??s.osuId}: ${Number(s.score).toLocaleString()} · ${s.accuracy==null?'?':(s.accuracy*100).toFixed(2)+'%'}${s.passed===false?' · failed':''}`;

export default function RefereeScore({match,busy,demo,act}:{match:any,busy:boolean,demo:boolean,act:(a:any)=>Promise<boolean>}){
 const [mp,setMp]=useState<string>(match.mp||'');
 const [warm,setWarm]=useState<string>(String(match.warmups??0));
 const [games,setGames]=useState<any[]|null>(null);
 const [err,setErr]=useState('');
 const [loading,setLoading]=useState(false);
 const [f,setF]=useState<any>(blank);
 const derived=mapWincon(match);
 const effective=f.wincon||derived;
 const done=new Set(match.history.map((h:any)=>h.gameId).filter((x:any)=>x!=null));
 useEffect(()=>{setF(blank);},[match.id,match.round]);

 async function pull(){
  const id=mp.trim().match(/(\d{3,})\/?$/)?.[1];
  if(!id){setErr('Enter a match link or ID.');return;}
  const w=Number(warm);
  if(!Number.isInteger(w)||w<0||w>20){setErr('Warmups must be a whole number from 0 to 20.');return;}
  setLoading(true);setErr('');
  try{
   if(id!==match.mp||w!==(match.warmups??0)){if(!(await act({type:'matchLink',match:match.id,mp:id,warmups:w})))return;}
   const r=await fetch(`/api/match?id=${id}&warmups=${w}`);
   const d=await r.json();
   if(!r.ok)throw Error(d.error);
   setGames(d.games);
  }catch(e){setErr((e as Error).message);}finally{setLoading(false);}
 }

 function use(g:any,s:any[]){
  setF({...f,s1:String(s[0].score),s2:String(s[1].score),a1:pct(s[0].accuracy),a2:pct(s[1].accuracy),mod:suggestMod(s[0].mods,s[1].mods),gameId:g.gameId,label:`Game ${g.order}: ${g.beatmap??'beatmap '+g.beatmapId}`});
 }

 async function submit(e:React.FormEvent){
  e.preventDefault();
  const p:any={type:'score',match:match.id,s1:Number(f.s1),s2:Number(f.s2),mod:f.mod,slot:f.slot,manualResolved:f.manual};
  if(f.wincon)p.wincon=f.wincon;
  if(f.a1!==''||f.a2!==''){p.acc1=f.a1===''?undefined:Number(f.a1)/100;p.acc2=f.a2===''?undefined:Number(f.a2)/100;}
  if(f.gameId)p.gameId=f.gameId;
  if(await act(p))setF(blank);
 }

 const open=(games||[]).filter((g:any)=>!g.warmup&&!done.has(g.gameId));
 const [p1,p2]=match.players;

 return <div className="panel"><h3>Referee controls</h3>
  <p className="muted">Win condition for this map: <b>{derived==='accuracy'?'Accuracy (set by a played card)':'Score V2 (default)'}</b></p>
  <div className="formrow">
   <input aria-label="osu! match link or ID" placeholder="mp link or match ID" value={mp} onChange={e=>setMp(e.target.value)}/>
   <input aria-label="Warmup maps to skip" type="number" min="0" max="20" value={warm} onChange={e=>setWarm(e.target.value)} style={{maxWidth:110}}/>
   <button type="button" disabled={busy||loading||demo||!mp.trim()} onClick={pull}>{loading?'Loading…':'Load games'}</button>
  </div>
  <p className="muted">Warmups are the first maps in the lobby that don&apos;t count. {demo&&'Loading games is unavailable in the sandbox.'}</p>
  {err&&<p className="muted" role="alert">{err}</p>}
  {games&&(open.length?open.map((g:any)=>{
   const s=match.players.map((pl:any)=>g.scores.find((x:any)=>String(x.playerId)===String(pl.id)));
   const ok=s.every(Boolean);
   const missing=g.scores.filter((x:any)=>!x.playerId).map((x:any)=>x.osuName??x.osuId);
   return <div className="logrow" key={g.gameId}>
    <span>Game {g.order} · {g.beatmap??g.beatmapId}<small className="trade-description">{g.scores.map(shown).join('   |   ')}{!ok&&missing.length>0?` · Not signed in on this site: ${missing.join(', ')}`:''}</small></span>
    {ok?<button type="button" disabled={busy} onClick={()=>use(g,s)}>{f.gameId===g.gameId?'Selected':'Use this game'}</button>:<b>Can&apos;t match players</b>}
   </div>;
  }):<p className="muted">No unrecorded, non-warmup games found yet.</p>)}
  <form onSubmit={submit}>
   {f.label&&<p className="muted">Filled from {f.label}. Review and edit before recording.</p>}
   <div className="formrow">
    <input required type="number" min="0" placeholder={p1.name+' raw score'} value={f.s1} onChange={e=>setF({...f,s1:e.target.value})}/>
    <input required type="number" min="0" placeholder={p2.name+' raw score'} value={f.s2} onChange={e=>setF({...f,s2:e.target.value})}/>
   </div>
   <div className="formrow">
    <input type="number" step="0.0001" min="0" max="100" required={effective==='accuracy'} placeholder={p1.name+' accuracy %'} value={f.a1} onChange={e=>setF({...f,a1:e.target.value})}/>
    <input type="number" step="0.0001" min="0" max="100" required={effective==='accuracy'} placeholder={p2.name+' accuracy %'} value={f.a2} onChange={e=>setF({...f,a2:e.target.value})}/>
   </div>
   <div className="formrow">
    <select aria-label="Mod" value={f.mod} onChange={e=>setF({...f,mod:e.target.value})}>{['NM','HD','HR','DT','FM'].map(x=><option key={x}>{x}</option>)}</select>
    <select aria-label="Slot" value={f.slot} onChange={e=>setF({...f,slot:e.target.value})}><option value="other">Other slot</option><option value="1">Slot 1</option></select>
    <select aria-label="Win condition" value={f.wincon} onChange={e=>setF({...f,wincon:e.target.value})}>
     <option value="">Win condition: auto ({derived==='accuracy'?'Accuracy':'Score V2'})</option>
     <option value="scorev2">Score V2</option>
     <option value="accuracy">Accuracy</option>
    </select>
   </div>
   <label className="check"><input type="checkbox" checked={f.manual} onChange={e=>setF({...f,manual:e.target.checked})}/> All manual effects have been resolved by the referee.</label>
   <button className="primary" disabled={busy||match.phase!=='map'}>Record map &amp; draw next hand</button>
   <p className="muted">Score V2 maps: raw score × (1 + total percentage buffs) + flat buffs. Accuracy maps: the higher accuracy wins and score buffs don&apos;t apply. Ties require a replay or referee resolution.</p>
  </form>
 </div>;
}
