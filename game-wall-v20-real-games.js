// V20 · Actual ESPN games for approved Game Finder tab. No demo fallback.
import {auth,onAuthStateChanged} from './firebase.js';
(()=>{
'use strict';
const LEAGUES=[['NFL','football/nfl'],['NBA','basketball/nba'],['NHL','hockey/nhl'],
 ['MLB','baseball/mlb'],['WNBA','basketball/wnba'],['NCAAF','football/college-football'],
 ['NCAAB','basketball/mens-college-basketball']];
const HOST='https://man-cave-xfinity-bridge.onrender.com';
const TEAMS=Object.freeze(['Top Left','Top Right','Center','Side']);
const ALIASES={'ABC':'ABC · WLNE','CBS':'CBS · WPRI','FOX':'FOX · WNAC',
 'NBC':'NBC · WJAR','ION':'ION · WPXQ','CW':'The CW · WLWC','THE CW':'The CW · WLWC',
 'NBC SPORTS BOSTON':'NBC Sports Boston','NBCSB':'NBC Sports Boston',
 'NBC SPORTS BOSTON PLUS':'NBC Sports Boston Plus',
 'NESN':'NESN','NESN+':'NESN+','FOX SPORTS 1':'FS1','FOX SPORTS 2':'FS2',
 'BTN':'Big Ten Network','BIG TEN NETWORK':'Big Ten Network','ACCN':'ACC Network',
 'SECN':'SEC Network','CBSSN':'CBS Sports Network',
 'USA':'USA Network','TRUTV':'truTV','TRU TV':'truTV',
 'ESPN U':'ESPNU','ESPN NEWS':'ESPNEWS'};
const STREAM={'ESPN+':'espnplus','ESPN PLUS':'espnplus','PEACOCK':'peacock',
 'PARAMOUNT+':'paramount','PRIME VIDEO':'prime','AMAZON PRIME VIDEO':'prime','APPLE TV+':'appletv'};
const FAVORITES=new Set(['Denver Broncos','Boston Celtics','Boston Bruins','Boston Red Sox','Indiana Fever','Arizona Wildcats']);
const state={games:[],loading:false,loaded:false,errors:0,lastFetch:0,message:'Loading ESPN matchups…',
 user:null,selectedTV:'Center',paired:new Set(),pairChecked:false,pairError:'',
 lastCommand:'',busy:false};
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const norm=x=>String(x||'').trim().toUpperCase().replace(/\s+/g,' ');
function notify(){window.dispatchEvent(new Event('mancave-real-games-change'));}
function dayET(offset){
 const d=new Date(Date.now()+offset*86400000);
 const fields=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 return fields.year+fields.month+fields.day;
}
function broadcasters(e,c){
 const found=[];
 const add=x=>{if(typeof x==='string'&&x.trim())found.push(x.trim());else if(Array.isArray(x))x.forEach(add);};
 for(const b of [...(c.broadcasts||[]),...(e.broadcasts||[])]){
  if(typeof b==='string')add(b);
  else if(b){add(b.names);add(b.name);add(b.shortName);add(b.media?.shortName);add(b.media?.name);}
 }
 for(const b of [...(c.geoBroadcasts||[]),...(e.geoBroadcasts||[])])if(b){
  add(b.media?.shortName);add(b.media?.name);add(b.name);
 }
 add(c.broadcast);add(e.broadcast);
 return [...new Set(found)];
}
function cleanLogo(logo){
 return /^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/.+/i.test(String(logo||''))?logo:'';
}
function parse(event,league,path){
 const c=event.competitions?.[0],list=c?.competitors||[];
 const away=list.find(x=>x.homeAway==='away'),home=list.find(x=>x.homeAway==='home');
 if(!away?.team?.displayName||!home?.team?.displayName)return null;
 const stateRaw=event.status?.type?.state||c.status?.type?.state||'pre';
 const status=stateRaw==='in'?'live':stateRaw==='post'?'final':'upcoming';
 const when=event.date||c.date||'';
 if(!when||Number.isNaN(new Date(when).getTime()))return null;
 const aName=away.team.displayName,hName=home.team.displayName;
 function t(raw){
  const team=raw.team;
  return {name:team.shortDisplayName||team.name||team.displayName,
   fullName:team.displayName,abbr:team.abbreviation||team.shortDisplayName||'',
   logo:cleanLogo(team.logo||team.logos?.[0]?.href||''),
   score:raw.score??null,record:(raw.records||[]).find(x=>x.type==='total')?.summary||''};
 }
 return {id:league+'-'+event.id,eventId:String(event.id),league,path,state:status,
  away:t(away),home:t(home),start:when,
  detail:event.status?.type?.shortDetail||event.status?.type?.detail||'',
  broadcasts:broadcasters(event,c),
  favorite:FAVORITES.has(aName)||FAVORITES.has(hName),
  espnUrl:(event.links||[]).find(x=>/^https:\/\/www\.espn\.com\//.test(x.href||''))?.href||''};
}
async function refresh(force=false){
 if(state.loading)return;
 if(!force&&state.loaded&&Date.now()-state.lastFetch<90000)return;
 state.loading=true;state.message='Loading real ESPN games across seven sports…';notify();
 const dates=[...new Set([-1,0,1].map(dayET))];
 const work=LEAGUES.flatMap(([league,path])=>dates.map(date=>({league,path,date})));
 const responses=[];
 for(let i=0;i<work.length;i+=6){
  const batch=await Promise.allSettled(work.slice(i,i+6).map(async q=>{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),10000);
   try{
    const params='?dates='+q.date+'&limit=150'+(q.league==='NCAAF'?'&groups=80':q.league==='NCAAB'?'&groups=50':'');
    const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+q.path+'/scoreboard'+params,
     {cache:'no-store',signal:controller.signal});
    if(!res.ok)throw Error('ESPN HTTP '+res.status);
    const data=await res.json();
    return (data.events||[]).map(e=>parse(e,q.league,q.path)).filter(Boolean);
   }finally{clearTimeout(timeout);}
  }));
  responses.push(...batch);
 }
 const successes=responses.filter(r=>r.status==='fulfilled');
 state.errors=responses.length-successes.length;
 const games=new Map();
 for(const r of successes)for(const g of r.value)games.set(g.id,g);
 const priority={live:0,upcoming:1,final:2};
 state.games=[...games.values()].sort((a,b)=>priority[a.state]-priority[b.state]||
  Number(b.favorite)-Number(a.favorite)||new Date(a.start)-new Date(b.start));
 state.loaded=true;state.loading=false;state.lastFetch=Date.now();
 state.message=successes.length?
  state.games.length+' real games · '+successes.length+'/'+responses.length+' ESPN schedule feeds'+(state.errors?' · '+state.errors+' unavailable':''):
  'ESPN schedules could not be loaded. Retry — sample games will not be shown.';
 notify();
}
function ensureLoaded(){
 if(!state.loaded||Date.now()-state.lastFetch>90000)refresh();
}
function lineup(){return window.XfinityDirect?.getLineup?.()||[];}
function routeOptions(game){
 const all=lineup(),out=[],seen=new Set();
 for(const original of game.broadcasts){
  for(const part of String(original).split(/\s*[,/|]\s*/)){
   const name=norm(part),app=STREAM[name];
   const id=ALIASES[name]||all.find(n=>norm(n.id)===name||norm(n.voice)===name)?.id;
   const entry=app?{key:'app:'+app,kind:'app',name:part,app,reported:true}:
    id?(()=>{const ch=all.find(n=>n.id===id);return ch?{key:'ch:'+ch.id,kind:'channel',name:ch.id,ch,reported:true}:null;})():null;
   if(entry&&!seen.has(entry.key)){seen.add(entry.key);out.push(entry);}
  }
 }
 // Local regional channel first where it actually appears among ESPN broadcasters.
 if(/Boston Celtics|Boston Bruins|Boston Red Sox/.test(game.away.fullName+' '+game.home.fullName))
  out.sort((a,b)=>Number(/^(NESN|NBC Sports Boston)/.test(b.name))-Number(/^(NESN|NBC Sports Boston)/.test(a.name)));
 return out;
}
async function bridge(path,payload){
 if(!state.user)throw Error('Sign in through Screens → Live TV Link first.');
 const idToken=await state.user.getIdToken();
 const resp=await fetch(HOST+path,{method:payload?'POST':'GET',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},
  ...(payload?{body:JSON.stringify(payload)}:{})});
 const json=await resp.json().catch(()=>({}));
 if(!resp.ok)throw Error(json.error||'Xfinity '+resp.status);
 return json;
}
async function checkPairing(){
 if(!state.user)return;
 try{
  const status=await bridge('/api/boxes');
  state.paired=new Set((status.boxes||[]).filter(x=>x.paired&&TEAMS.includes(x.name)).map(x=>x.name));
  state.pairError='';
 }catch(err){state.paired.clear();state.pairError=err.message;}
 state.pairChecked=true;
}
function info(game){
 const away=game.away,home=game.home;
 const when=new Date(game.start).toLocaleString('en-US',{timeZone:'America/New_York',
  weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 return '<div style="font-size:12px;line-height:1.65;color:#cbdeee">'+
  '<strong>'+esc(away.fullName)+' at '+esc(home.fullName)+'</strong><br>'+
  'League: '+esc(game.league)+' · '+esc(game.state.toUpperCase())+'<br>'+
  'Scheduled: '+esc(when)+' Eastern<br>'+
  (game.state!=='upcoming'?'Score: '+esc(away.name)+' '+esc(away.score??'—')+' — '+esc(home.name)+' '+esc(home.score??'—')+'<br>':'')+
  'Broadcasts reported by ESPN: '+esc(game.broadcasts.join(' / ')||'Not listed')+'<br>'+
  'Game status: '+esc(game.detail||'Not available')+'</div>';
}
function popup(title,content){
 const shade=document.getElementById('modalShade'),body=document.getElementById('modalBody'),heading=document.getElementById('modalTitle');
 if(!shade||!body||!heading)return false;
 heading.textContent=title;body.innerHTML=content;shade.classList.add('open');return true;
}
function showStats(id){
 const game=state.games.find(g=>g.id===id);if(!game)return;
 popup('Real Game Details · '+game.league,
  info(game)+'<div class="note">These details come from ESPN’s live scoreboard. Detailed team statistics and box scores will be connected separately; unavailable values are not invented.</div>'+
  (game.espnUrl?'<a style="color:#7cdbef" target="_blank" rel="noopener noreferrer" href="'+esc(game.espnUrl)+'">View game details on ESPN</a>':''));
}
async function openAssign(id){
 const game=state.games.find(g=>g.id===id);if(!game)return;
 await checkPairing();
 const reported=routeOptions(game),all=lineup();
 const manual=all.filter(n=>!reported.some(x=>x.key==='ch:'+n.id));
 const options=[...reported,...manual.map(ch=>({key:'ch:'+ch.id,kind:'channel',name:ch.id,ch,reported:false}))];
 const lastTV=document.querySelector('.localDirectBoxes [data-v14-box].active')?.dataset.v14Box;
 if(TEAMS.includes(lastTV))state.selectedTV=lastTV;
 const selectBox='<label style="display:block;margin-top:12px">Destination Xfinity TV<select id="realGameTV" style="width:100%;padding:11px;margin-top:6px;background:#102235;color:#fff;border:1px solid #46667b;border-radius:9px">'+
  TEAMS.map(name=>'<option value="'+esc(name)+'"'+(name===state.selectedTV?' selected':'')+'>'+esc(name)+(state.paired.has(name)?' · Paired':' · Not confirmed paired')+'</option>').join('')+'</select></label>';
 const selectChannel='<label style="display:block;margin-top:12px">Broadcast or network<select id="realGameRoute" style="width:100%;padding:11px;margin-top:6px;background:#102235;color:#fff;border:1px solid #46667b;border-radius:9px">'+
  '<option value="">Choose a broadcaster</option>'+
  (reported.length?'<optgroup label="Reported by ESPN">'+reported.map(x=>'<option value="'+esc(x.key)+'">'+esc(x.name)+(x.kind==='app'?' · Opens app':'')+'</option>').join('')+'</optgroup>':'')+
  '<optgroup label="Manual — not confirmed for this game">'+manual.map(ch=>'<option value="ch:'+esc(ch.id)+'">'+esc(ch.id)+'</option>').join('')+'</optgroup></select></label>';
 if(!popup('Tune a Real Game · '+game.league,
  info(game)+selectBox+selectChannel+
  '<p class="note" id="realGameReceipt">'+(state.pairError?'Box status: '+esc(state.pairError):'ESPN broadcasts may differ locally. A streaming app launch does not select the game automatically.')+'</p>'+
  '<div class="modalActions"><button type="button" class="btn subtle" id="realGameCancel">Cancel</button><button type="button" class="btn primary" id="realGameTune">Tune selected TV</button></div>'))return;
 const routeSelect=document.getElementById('realGameRoute');
 if(reported.length)routeSelect.value=reported[0].key;
 document.getElementById('realGameCancel').onclick=()=>document.getElementById('modalShade')?.classList.remove('open');
 document.getElementById('realGameTune').onclick=async()=>{
  if(state.busy)return;
  const dest=document.getElementById('realGameTV')?.value;
  const key=routeSelect.value,route=options.find(x=>x.key===key),note=document.getElementById('realGameReceipt');
  if(!TEAMS.includes(dest)||!route){note.textContent='Select a TV and a broadcast first.';return;}
  if(!state.paired.has(dest)){note.textContent='That Xfinity box is not confirmed paired. Check the Cable tab.';return;}
  const ch=route.ch,channel=ch&&(ch.hd||ch.sd);
  const command=route.kind==='app'?{box:dest,kind:'app',value:route.app}:
    /^\d{1,5}$/.test(String(channel||''))?{box:dest,kind:'channel',value:String(channel)}:
    {box:dest,kind:'text',value:'Watch '+ch.voice};
  state.busy=true;note.textContent='Sending to '+dest+'…';
  try{
   const response=await bridge('/api/send',command);
   note.textContent=response.commandAccepted?
    'Xfinity accepted the command for '+dest+'. Check the TV for the correct channel or app.':
    'No command acknowledgment received.';
  }catch(err){note.textContent='Unable to tune: '+err.message;}
  finally{state.busy=false;}
 };
}
onAuthStateChanged(auth,user=>{state.user=user;state.paired.clear();state.pairChecked=false;});
window.ManCaveRealGames={state,refresh:()=>refresh(true),ensureLoaded,showStats,openAssign};
setInterval(()=>{if(!document.hidden&&document.querySelector('[data-tab="games"].active')&&Date.now()-state.lastFetch>90000)refresh();},30000);
})();