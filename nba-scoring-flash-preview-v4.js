// V4 NBA scoring spotlight; preview-only. Seamless black background. Live queue fix. No Firebase writes or approved-board design changes.
(()=>{
'use strict';
const qs=new URLSearchParams(location.search);
if(qs.get('sport')!=='nba')return;
const team=qs.get('team')||'',eventId=qs.get('eventId')||'';
const preview=qs.get('preview')==='1';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const id=p=>String(p?.participants?.[0]?.athlete?.id||p?.participants?.[0]?.id||p?.athletesInvolved?.[0]?.id||p?.athletesInvolved?.[0]?.athlete?.id||p?.athletes?.[0]?.id||p?.athlete?.id||p?.athleteId||'');
const teamId=p=>String(p?.team?.id||p?.teamId||'');
const ft=p=>/free\s*throw/i.test((p?.text||'')+' '+(p?.type?.text||''));
const attempt=p=>!ft(p)&&(p?.shootingPlay===true||/\b(jumper|layup|dunk|hook shot|tip shot|three point|three-pointer)\b/i.test(p?.text||''));
const make=p=>attempt(p)&&p?.scoringPlay===true&&(Number(p?.scoreValue)===2||Number(p?.scoreValue)===3);
const loc=p=>{const x=val(p?.coordinate?.x??p?.coordinateX),y=val(p?.coordinate?.y??p?.coordinateY);return x!==null&&y!==null&&x>=0&&x<=50&&y>=-3&&y<=34?{x,y}:null};
const code=p=>String(p?.id||p?.sequenceNumber||p?.playId||'');
const ord=(p,i)=>val(p?.sequenceNumber??p?.orderNumber)??i;
const css=[
'#nbaFlash{position:fixed;top:17vh;bottom:0;left:0;right:0;z-index:500;background:#020204;display:none;overflow:hidden;color:white;border-top:4px solid var(--flash-accent,#24ddde);font-family:Arial,sans-serif}',
'#nbaFlash.active{display:flex;flex-direction:column;animation:flashIn .25s ease-out}',
'@keyframes flashIn{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:translateY(0)}}',
'#nbaFlash .f-top{background:#020204;padding:1.5vh 5vw;display:flex;justify-content:space-between;gap:8px;font-size:clamp(12px,1.6vh,22px);font-weight:900;letter-spacing:.1em}',
'#nbaFlash .f-person{display:flex;gap:4%;align-items:center;min-height:0;padding:1vh 5vw}',
'#nbaFlash .f-head{width:39%;aspect-ratio:1/1.08;flex-shrink:0;overflow:visible;display:flex;align-items:center;justify-content:center;border:0;border-radius:0;background:transparent;font-size:11px;text-align:center;color:#b4cbda}',
'#nbaFlash .f-head img{width:100%;height:100%;object-fit:contain;object-position:center center;transform:translateY(2%) scale(1.06);transform-origin:center center;will-change:transform}',
'#nbaFlash .f-name{font-weight:950;font-size:clamp(19px,3.2vh,44px);line-height:1.04;overflow-wrap:anywhere}',
'#nbaFlash .f-pts{font-weight:950;font-size:clamp(60px,10vh,125px);line-height:1}',
'#nbaFlash .f-pts small{font-size:.22em;margin-left:6px;color:#aac7d9}',
'#nbaFlash .f-plus{font-weight:900;color:var(--flash-accent,#43d);font-size:clamp(13px,2vh,26px)}',
'#nbaFlash .f-label{text-align:center;font-weight:900;letter-spacing:.13em;color:#b8d8ea;margin:.5vh 0;font-size:clamp(12px,1.5vh,19px)}',
'#nbaFlash .f-court{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 2vw}',
'#nbaFlash .f-court svg{height:100%;width:100%;max-width:64vh;filter:none}',
'#nbaFlash .f-last{animation:dotGlow 1s infinite}@keyframes dotGlow{50%{opacity:.35}}',
'#nbaFlash .f-stats{display:flex;justify-content:space-around;gap:4px;padding:1.1vh;background:#020204;border-top:1px solid #457082;text-align:center;font-size:clamp(16px,2.1vh,25px);font-weight:900}',
'#nbaFlash .f-stats small{display:block;font-size:.59em;color:#9abfd3;margin-top:.3em}',
'#nbaFlash .f-source{padding:.5vh;text-align:center;color:#a5becb;font-size:clamp(9px,1.1vh,15px)}',
'#nbaFlashTest{position:fixed;z-index:850;bottom:8px;left:8px;right:8px;border-radius:10px;background:#020204ed;padding:8px;display:flex;gap:7px;align-items:center;justify-content:center;flex-wrap:wrap;color:#d8e7f2;font:11px Arial;border:1px solid #42879c}',
'#nbaFlashTest button{border:0;border-radius:7px;padding:10px;font-weight:900;font-size:12px;background:#3dcfe6;color:#0b1b2c}'
].join('');
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const overlay=document.createElement('div');overlay.id='nbaFlash';document.body.appendChild(overlay);
let latest=null,last=null,seen=new Set(),maxOrder=-1,loaded=false,busy=false,phase='',failure='',timer=null,usingArchive=false;
const pending=[];
let testPanel=null;
if(preview){
 testPanel=document.createElement('div');testPanel.id='nbaFlashTest';
 testPanel.innerHTML='<button id="nbaReplay" type="button">Replay latest basket</button><button id="nbaLeader" type="button">Replay top scorer</button><button id="nbaDemo" type="button">Sample animation</button><span id="nbaFeedStatus">Loading…</span>';
 document.body.appendChild(testPanel);
}
function findPlayer(c,p){
 const pid=id(p);
 if(pid&&c.players.has(pid))return c.players.get(pid);
 return null; // Never guess a scorer by parsing commentary text.
}
function build(data){
 const match=(data?.header?.competitions?.[0]?.competitors||[]).find(x=>norm(x.team?.displayName)===norm(team)||norm(x.team?.name)===norm(team));
 const selectedId=String(match?.team?.id||'');
 const players=new Map();
 for(const group of data?.boxscore?.players||[]){
  for(const block of group.statistics||[]){
   const cols=(block.keys?.length?block.keys:block.labels||[]).map(norm),idx=cols.findIndex(x=>x==='points'||x==='pts');
   for(const r of block.athletes||[]){
    const a=r.athlete||{},pid=String(a.id||'');
    if(pid)players.set(pid,{id:pid,name:a.displayName||a.fullName||'Unknown player',headshot:a.headshot?.href||'',teamId:String(group.team?.id||''),points:idx<0?null:val(r.stats?.[idx])});
   }
  }
 }
 const all=(Array.isArray(data.plays)?data.plays:[]).map((p,i)=>({p,i,key:code(p)||'i'+i,order:ord(p,i)})).sort((a,b)=>a.order-b.order);
 const shooter=e=>findPlayer({players},e.p);
 const shots=all.filter(e=>attempt(e.p)&&String(teamId(e.p)||shooter(e)?.teamId||'')===selectedId);
 return {selectedId,players,all,shots,shooter,shotMakes:shots.filter(e=>make(e.p)&&shooter(e))};
}
function plot(shots,lastKey){
 // Reference-inspired current-game shot plot: one dot per REAL recorded attempt.
 // NBA ESPN coordinates: x 0–50 across the floor; y 0–34 from the hoop toward midcourt.
 // Make = neon green; miss = neon red. Never invent or interpolate locations.
 const points=shots.map(entry=>{
  const p=loc(entry.p);
  if(!p)return '';
  const x=(30+p.x*5.2).toFixed(1), y=(169-p.y*4.25).toFixed(1);
  const madeShot=make(entry.p),isLatest=entry.key===lastKey;
  const color=madeShot?'#37ff8e':'#ff405c';
  const filterId=madeShot?'nbaChartGreenGlow':'nbaChartRedGlow';
  return '<g transform="translate('+x+' '+y+')">'+
    // Glow backing gives the bright dot-matrix feel of the supplied reference.
    '<circle r="7.7" fill="'+color+'" opacity=".22" filter="url(#'+filterId+')"/>'+
    '<circle r="'+(isLatest?'5.7':'4.7')+'" fill="'+color+'" stroke="#030508" stroke-width=".7"'+(isLatest?' class="f-last"':'')+'/>'+
    (isLatest?'<circle r="9" fill="none" stroke="#f6fffa" stroke-width="1.25" opacity=".95"/>':'')+
    '</g>';
 }).join('');
 const located=shots.filter(entry=>loc(entry.p)).length;
 return '<svg viewBox="0 0 320 210" role="img" aria-label="Individual player shot map: bright green makes, bright red misses; each dot is a recorded shot">'+
  '<defs>'+
   '<filter id="nbaChartGreenGlow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3.8"/></filter>'+
   '<filter id="nbaChartRedGlow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3.8"/></filter>'+
  '</defs>'+
  // Pure black court and fine white linework, matching the visual language of the image.
  '<rect width="320" height="210" rx="7" fill="#020204"/>'+
  '<g fill="none" stroke="#e8ebee" stroke-width="1.2" opacity=".76" stroke-linecap="round" stroke-linejoin="round">'+
   '<path d="M16 190 H304"/>'+                         // Baseline
   '<path d="M38 190 V120 A130 130 0 0 1 282 120 V190"/>'+ // Corner lines and 3-point arc
   '<path d="M113 190 V104 H207 V190"/>'+           // Key / paint
   '<path d="M113 104 A47 47 0 0 1 207 104"/>'+     // Top of free-throw circle
   '<path d="M113 104 A47 47 0 0 0 207 104" stroke-dasharray="5 6" opacity=".78"/>'+
   '<circle cx="160" cy="169" r="7.5"/>'+           // Rim
   '<path d="M143 180 H177" stroke-width="2.2"/>'+ // Backboard
   '<path d="M142 170 A18 18 0 0 1 178 170" opacity=".7"/>'+ // Restricted arc
  '</g>'+
  points+
  (located===0?
   '<text x="160" y="75" fill="#e2edf1" font-size="10.3" font-family="Arial" text-anchor="middle" font-weight="bold">SHOT LOCATIONS UNAVAILABLE</text>':'')+
  '<g font-family="Arial" font-weight="bold" font-size="9.5">'+
   '<circle cx="22" cy="14" r="3.8" fill="#37ff8e"/><text x="31" y="17" fill="#e5e5e5">MAKES</text>'+
   '<circle cx="235" cy="14" r="3.8" fill="#ff405c"/><text x="244" y="17" fill="#e5e5e5">MISSES</text>'+
  '</g>'+
 '</svg>';
}
function display(entry,c,sample=false){
 const p=entry?.p,player=c?.shooter(entry);
 if(!p||!player)return;
 const attempts=c.shots.filter(x=>id(x.p)===player.id&&x.order<=entry.order);
 const makes=attempts.filter(x=>make(x.p));
 const threes=attempts.filter(x=>Number(x.p.pointsAttempted)===3||/3-pt|three point|three-pointer/i.test(x.p.text||''));
 const ptsScored=c.all.filter(x=>id(x.p)===player.id&&x.order<=entry.order&&x.p.scoringPlay===true);
 const pts=sample?player.points:(ptsScored.length?ptsScored.reduce((sum,x)=>sum+(val(x.p.scoreValue)||0),0):player.points);
 const isThree=Number(p.scoreValue)===3;
 const photo=/^https:\/\//.test(player.headshot)?player.headshot:/^\d+$/.test(player.id)?'https://a.espncdn.com/i/headshots/nba/players/full/'+player.id+'.png':'';
 overlay.style.setProperty('--flash-accent',getComputedStyle(document.getElementById('app')||document.body).getPropertyValue('--accent').trim()||'#54cee5');
 const quarter=p.period?.displayValue||('Q'+(p.period?.number||'')),clock=p.clock?.displayValue||'';
 overlay.innerHTML='<div class="f-top"><span>'+(isThree?'THREE-POINTER':'MADE BASKET')+'</span><span>'+esc(quarter+' '+clock)+'</span></div>'+
 '<div class="f-person"><div class="f-head">'+(photo?'<img alt="" src="'+esc(photo)+'" onerror="this.style.display=\'none\';this.parentElement.textContent=\'HEADSHOT UNAVAILABLE\'">':'HEADSHOT UNAVAILABLE')+'</div>'+
 '<div><div class="f-name">'+esc(player.name)+'</div><div class="f-pts">'+(pts===null?'—':esc(pts))+'<small>PTS</small></div>'+
 '<div class="f-plus">+'+(isThree?'3':'2')+' POINTS</div></div></div>'+
 '<div class="f-label">PLAYER SHOT CHART</div><div class="f-court">'+plot(attempts,entry.key)+'</div>'+
 '<div class="f-stats"><span>'+makes.length+'/'+attempts.length+'<small>FG</small></span>'+
 '<span>'+threes.filter(x=>make(x.p)).length+'/'+threes.length+'<small>3PT</small></span>'+
 '<span>'+attempts.filter(x=>loc(x.p)).length+'<small>LOCATED</small></span></div>'+
 '<div class="f-source">'+(sample?'SAMPLE GRAPHIC · NOT LIVE':usingArchive?'RECORDED ESPN GAME · ARCHIVE REPLAY':'ESPN PLAY BY PLAY · PROVIDER DELAY POSSIBLE')+'</div>';
 overlay.classList.add('active');
 if(timer)clearTimeout(timer);
 timer=setTimeout(()=>{overlay.classList.remove('active');if(pending.length){const next=pending.shift();display(next.entry,next.c);}},isThree?8000:6000);
}
function process(data){
 const c=build(data);latest=c;
 phase=String(data?.header?.competitions?.[0]?.status?.type?.state||data?.header?.status?.type?.state||'').toLowerCase();
 const lab=document.getElementById('nbaFeedStatus');if(lab)lab.textContent=c.selectedId?'NBA '+(phase||'loaded')+' · '+c.shots.length+' shots':'Team not found in game';
 if(!c.selectedId)return;
 last=c.shotMakes[c.shotMakes.length-1]||last;
 if(!loaded){
  loaded=true;
  // Baseline all already-scored baskets: never flash historical plays on load.
  // Do not mark *unscored* plays as seen; a late ESPN scoring correction
  // must remain eligible for a genuine new-basket flash.
  seen=new Set(c.shotMakes.map(e=>e.key));
  maxOrder=Math.max(-1,...c.all.map(e=>e.order));
  return;
 }
 const fresh=c.shotMakes.filter(e=>!seen.has(e.key)&&e.order>=maxOrder-3)
   .sort((a,b)=>a.order-b.order);
 c.shotMakes.forEach(e=>seen.add(e.key));
 maxOrder=Math.max(maxOrder,...c.all.map(e=>e.order));
 if(phase!=='in'||!fresh.length)return;
 // Process *every* newly identified scoring play, in game order. The older
 // implementation silently dropped all but the newest basket per ESPN poll.
 // Cap the queue only to prevent an old/backfilled feed overwhelming the TV.
 for(const entry of fresh){
  pending.push({entry,c});
  if(pending.length>6)pending.shift();
 }
 if(!overlay.classList.contains('active')){
  const next=pending.shift();
  if(next)display(next.entry,next.c);
 }
}
async function poll(){
 if(!/^\d{6,15}$/.test(eventId)||busy||document.hidden||(loaded&&phase==='post'))return;
 busy=true;
 try{
  // Use the locally archived historical game in design review only, no network dependency.
  // The physical TV receivers never load this archive unless explicitly given the archive ID + preview=1.
  if(eventId==='401585607'&&preview){
   try{
    const saved=await fetch('./nba-scoring-archive-401585607.json',{cache:'force-cache'});
    if(!saved.ok)throw Error('Archive HTTP '+saved.status);
    usingArchive=true;process(await saved.json());failure='';
    const lab=document.getElementById('nbaFeedStatus');
    if(lab)lab.textContent='Historical ESPN game ready · Replay latest basket';
    return;
   }catch(error){
    // Try the ESPN historical summary only if our archived test fixture cannot be read.
    failure='Archive unavailable: '+String(error.message||error);
   }
  }
  const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='+encodeURIComponent(eventId),{cache:'no-store'});
  if(!res.ok)throw Error('ESPN HTTP '+res.status);
  usingArchive=false;process(await res.json());failure='';
 }catch(e){
  failure=String(e.message||e);
  const lab=document.getElementById('nbaFeedStatus');if(lab)lab.textContent='Play-by-play unavailable: '+failure;
 }
 finally{busy=false;}
}
const api={
 status:()=>({eventId,team,phase,initialized:loaded,error:failure,knownEvents:seen.size}),
 replay:()=>{if(!last||!latest)return false;display(last,latest);return true;},
 leader:()=>{
  if(!latest)return false;
  const top=[...latest.players.values()].filter(p=>p.teamId===latest.selectedId)
   .sort((a,b)=>(b.points??-1)-(a.points??-1));
  for(const player of top){
   const scoring=latest.shotMakes.filter(x=>id(x.p)===player.id);
   if(scoring.length){display(scoring[scoring.length-1],latest);return true;}
  }
  return false;
 },
 demo:()=>{
  const player={id:'demo',name:'SAMPLE PLAYER',headshot:'',points:24,teamId:'demo'};
  const shot=[
   {p:{athleteId:'demo',shootingPlay:true,scoringPlay:true,scoreValue:2,coordinate:{x:25,y:4},period:{number:4},clock:{displayValue:'03:24'}},key:'1',order:1},
   {p:{athleteId:'demo',shootingPlay:true,scoringPlay:false,scoreValue:0,coordinate:{x:40,y:17}},key:'2',order:2},
   {p:{athleteId:'demo',shootingPlay:true,scoringPlay:true,scoreValue:3,pointsAttempted:3,coordinate:{x:4,y:4},text:'makes three point jumper',period:{number:4},clock:{displayValue:'02:10'}},key:'3',order:3}
  ];
  const c={shots:shot,all:shot,shooter:()=>player};display(shot[2],c,true);
 }
};
window.ManCaveNbaFlash=Object.freeze(api);
document.getElementById('nbaReplay')?.addEventListener('click',()=>{if(!api.replay())document.getElementById('nbaFeedStatus').textContent='No confirmed made basket loaded yet';});
document.getElementById('nbaLeader')?.addEventListener('click',()=>{if(!api.leader())document.getElementById('nbaFeedStatus').textContent='No scored shots available for this team';});
document.getElementById('nbaDemo')?.addEventListener('click',api.demo);
poll();setInterval(poll,12000);
})();