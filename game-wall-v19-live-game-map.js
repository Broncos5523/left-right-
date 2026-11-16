// V19 · Stage 1: ESPN live game → reported network → user's Providence Xfinity channel.
import {auth,onAuthStateChanged} from './firebase.js';
(()=>{
'use strict';
const el=()=>document.getElementById('xfinityLiveGameMap');
const HOST='https://man-cave-xfinity-bridge.onrender.com';
const BOXES=['Top Left','Top Right','Center','Side'];
const LEAGUES=[['NFL','football/nfl'],['NBA','basketball/nba'],['NHL','hockey/nhl'],['MLB','baseball/mlb'],['WNBA','basketball/wnba'],['NCAA FB','football/college-football'],['NCAA BB','basketball/mens-college-basketball']];
const ALIASES={'CBS':'CBS · WPRI','FOX':'FOX · WNAC','NBC':'NBC · WJAR','ABC':'ABC · WLNE','ION':'ION · WPXQ','CW':'The CW · WLWC','THE CW':'The CW · WLWC','NBCSB':'NBC Sports Boston','NBC SPORTS BOSTON':'NBC Sports Boston','NBC SPORTS BOSTON PLUS':'NBC Sports Boston Plus','NESN':'NESN','NESN+':'NESN+','BTN':'Big Ten Network','BIG TEN NETWORK':'Big Ten Network','SECN':'SEC Network','ACCN':'ACC Network','CBSSN':'CBS Sports Network','FOX SPORTS 1':'FS1','FOX SPORTS 2':'FS2','USA':'USA Network','TRUTV':'truTV','ESPN NEWS':'ESPNEWS','ESPN U':'ESPNU'};
const STREAM={'ESPN+':'espnplus','PEACOCK':'peacock','PARAMOUNT+':'paramount','PRIME VIDEO':'prime','AMAZON PRIME VIDEO':'prime','APPLE TV+':'appletv'};
const FAVS=['Denver Broncos','Boston Celtics','Boston Bruins','Boston Red Sox','Indiana Fever','Arizona Wildcats'];
const s={user:null,paired:new Set(),tv:'Center',league:'All',mode:'LIVE',games:[],overrides:{},loading:false,sending:false,loaded:false,last:0,message:'Loading games…',receipt:''};
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=x=>String(x||'').trim().toUpperCase().replace(/\s+/g,' ');
const lineup=()=>window.XfinityDirect?.getLineup?.()||[];
function day(date){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
 return p.year+p.month+p.day;
}
function bcasts(e,c){
 const out=[],add=x=>{if(typeof x==='string'&&x.trim())out.push(x.trim());else if(Array.isArray(x))x.forEach(add);};
 [...(c.broadcasts||[]),...(e.broadcasts||[])].forEach(b=>{if(typeof b==='string')add(b);else{add(b.names);add(b.name);add(b.shortName);add(b.media?.shortName);}});
 [...(c.geoBroadcasts||[]),...(e.geoBroadcasts||[])].forEach(b=>{add(b.media?.shortName);add(b.media?.name);});
 add(c.broadcast);add(e.broadcast);
 return [...new Set(out)];
}
function parse(e,league){
 const c=e.competitions?.[0],comp=c?.competitors||[];
 const a=comp.find(x=>x.homeAway==='away'),h=comp.find(x=>x.homeAway==='home');
 if(!a?.team||!h?.team)return null;
 const raw=e.status?.type?.state||c.status?.type?.state||'pre';
 if(raw==='post')return null;
 return {id:league+'-'+e.id,league,status:raw==='in'?'LIVE':'UPCOMING',when:e.date||c.date,
  away:a.team.displayName||a.team.name,home:h.team.displayName||h.team.name,
  awayScore:a.score,homeScore:h.score,
  detail:e.status?.type?.shortDetail||e.status?.type?.detail||'',
  broadcasts:bcasts(e,c),favorite:FAVS.includes(a.team.displayName)||FAVS.includes(h.team.displayName)};
}
function channelCandidates(g){
 const channels=lineup(),out=[],seen=new Set();
 for(const value of g.broadcasts){
  for(const part of value.split(/\s*[,/|]\s*/)){
   const key=norm(part),app=STREAM[key];
   const id=ALIASES[key]||channels.find(n=>norm(n.id)===key||norm(n.voice)===key)?.id;
   const item=app?{key:'app:'+app,name:part,kind:'app',app,reported:true}:
    id?(()=>{const ch=channels.find(n=>n.id===id);return ch?{key:'net:'+id,name:ch.id,kind:'net',ch,reported:true}:null;})():null;
   if(item&&!seen.has(item.key)){seen.add(item.key);out.push(item);}
  }
 }
 const isBoston=/Boston Celtics|Boston Bruins|Boston Red Sox/.test(g.away+' '+g.home);
 if(isBoston)out.sort((a,b)=>Number(/^(NESN|NBC Sports Boston)/.test(b.name))-Number(/^(NESN|NBC Sports Boston)/.test(a.name)));
 return out;
}
function selected(g){
 const reported=channelCandidates(g),saved=s.overrides[g.id],key=saved||reported[0]?.key;
 if(!key)return {reported,item:null};
 let item=reported.find(o=>o.key===key);
 if(!item&&key.startsWith('net:')){
  const ch=lineup().find(n=>n.id===key.slice(4));
  if(ch)item={key,name:ch.id,kind:'net',ch,reported:false};
 }
 if(!item&&key.startsWith('app:')){
  const app=key.slice(4);if(Object.values(STREAM).includes(app))item={key,name:app,kind:'app',app,reported:false};
 }
 return {reported,item:item||null};
}
function tuneData(item){
 if(!item)return null;
 if(item.kind==='app')return {kind:'app',value:item.app,descr:'Open '+item.name+' (select game inside app)'};
 const num=item.ch.hd||item.ch.sd;
 return /^\d{1,5}$/.test(String(num||''))?
  {kind:'channel',value:String(num),descr:item.name+' · #'+num}:
  {kind:'text',value:'Watch '+item.ch.voice,descr:'Watch '+item.name};
}
function tv(){
 const a=document.querySelector('.localDirectBoxes [data-v14-box].active')?.dataset.v14Box;
 return BOXES.includes(a)?a:s.tv;
}
function time(when){try{return new Date(when).toLocaleString('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'2-digit'});}catch{return 'TBD';}}
function shown(){
 const all=s.games.filter(g=>(s.league==='All'||g.league===s.league)&&
  (g.status==='LIVE'||new Date(g.when).getTime()<=Date.now()+36*3600000));
 const live=all.filter(g=>g.status==='LIVE');
 return s.mode==='LIVE'?(live.length?live:all.filter(g=>g.status==='UPCOMING').slice(0,35)):
  s.mode==='UPCOMING'?all.filter(g=>g.status==='UPCOMING'):all;
}
function gameCard(g){
 const obj=selected(g),item=obj.item,target=tuneData(item),tvName=tv(),valid=!!(s.user&&s.paired.has(tvName)&&!s.sending);
 const remaining=lineup().filter(n=>!obj.reported.some(o=>o.key==='net:'+n.id));
 const opts=obj.reported.map(o=>'<option value="'+safe(o.key)+'"'+(item?.key===o.key?' selected':'')+'>'+safe(o.name)+(o.kind==='app'?' · App':' · ESPN-listed')+'</option>').join('');
 const manual=remaining.map(n=>'<option value="net:'+safe(n.id)+'"'+(item?.key==='net:'+n.id?' selected':'')+'>'+safe(n.id)+' · manual</option>').join('');
 const score=g.status==='LIVE'?' · '+safe((g.awayScore??'–')+'–'+(g.homeScore??'–')):'';
 return '<article class="gameMapCard"><div class="gameMapTop"><b>'+safe(g.league)+'</b><span class="'+(g.status==='LIVE'?'gameMapLive':'')+'">'+safe(g.status)+(score||'')+'</span></div>'+
  '<div class="gameMapTeams"><strong>'+safe(g.away)+' @ '+safe(g.home)+'</strong>'+(g.favorite?' <em>★ Favorite</em>':'')+'</div>'+
  '<div class="gameMapWhen">'+safe(g.status==='LIVE'?g.detail||'Live game':'Starts '+time(g.when))+'</div>'+
  '<div class="gameMapSource">ESPN broadcast: '+safe(g.broadcasts.length?g.broadcasts.join(' / '):'Not reported')+'</div>'+
  '<select data-map-choice="'+safe(g.id)+'" aria-label="Network for '+safe(g.away)+' vs '+safe(g.home)+'">'+
   '<option value=""'+(!item?' selected':'')+'>Choose a network</option>'+
   (opts?'<optgroup label="ESPN listed">'+opts+'</optgroup>':'')+
   '<optgroup label="Manual · Providence lineup">'+manual+'</optgroup></select>'+
  '<div class="gameMapAction"><small>'+safe(target?target.descr:'No channel mapped')+(item&&!item.reported?' · manually selected':'')+'</small>'+
  '<button type="button" data-map-tune="'+safe(g.id)+'"'+(!valid||!target?' disabled':'')+'>Tune '+safe(tvName)+'</button></div>'+
  '<div class="gameMapWarn">'+(item?.kind==='app'?'Opens the streaming app, not the game.':item&&!item.reported?'Manual network choice; not verified as this game’s broadcaster.':'Local availability and subscription not confirmed.')+'</div></article>';
}
function render(){
 const node=el();if(!node)return;s.tv=tv();
 const cards=shown(),live=s.games.filter(g=>g.status==='LIVE').length;
 node.innerHTML='<section class="gameMap"><div class="gameMapHead"><div><span>STEP 1 · GAMES TO TV</span><h3>Live Game Map</h3><p>Real ESPN games matched to your saved Providence Xfinity channels. Select a destination, then tune.</p></div><b>'+live+' LIVE</b></div>'+
  '<div class="gameMapTV">'+BOXES.map(b=>'<button type="button" data-map-tv="'+safe(b)+'" class="'+(b===s.tv?'active':'')+'">'+safe(b)+(s.paired.has(b)?' ✓':'')+'</button>').join('')+'</div>'+
  '<div class="gameMapFilters">'+['All',...LEAGUES.map(l=>l[0])].map(l=>'<button data-map-league="'+safe(l)+'" class="'+(l===s.league?'active':'')+'">'+safe(l)+'</button>').join('')+'</div>'+
  '<div class="gameMapFilters">'+['LIVE','UPCOMING','ALL'].map(x=>'<button data-map-mode="'+x+'" class="'+(x===s.mode?'active':'')+'">'+safe(x)+'</button>').join('')+'</div>'+
  '<div class="gameMapInfo">'+safe(s.message)+'</div>'+
  (s.mode==='LIVE'&&!cards.some(x=>x.status==='LIVE')&&s.loaded?'<div class="gameMapInfo">No live games in this filter — upcoming matchups are shown instead.</div>':'')+
  (cards.length?'<div class="gameMapList">'+cards.slice(0,120).map(gameCard).join('')+'</div>':
   '<div class="gameMapInfo">'+(s.loading?'Loading games…':'No matching games. Try another league or Upcoming.')+'</div>')+
  '<div class="gameMapReceipt" role="status">'+safe(s.receipt||'Game broadcasts are not guaranteed on your local package. Nothing tunes until you tap Tune.')+'</div>'+
  '<div class="gameMapButtons"><button data-map-refresh'+(s.loading?' disabled':'')+'>'+(s.loading?'Updating…':'Refresh games')+'</button><button data-map-boxes>Check Xfinity boxes</button></div></section>';
}
async function api(path,body){
 if(!s.user)throw Error('Sign in through Screens → Live TV Link first.');
 const token=await s.user.getIdToken();
 const response=await fetch(HOST+path,{method:body?'POST':'GET',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(json.error||'Xfinity bridge HTTP '+response.status);
 return json;
}
async function boxes(){
 if(!s.user)return;
 try{const result=await api('/api/boxes');s.paired=new Set((result.boxes||[]).filter(b=>b.paired).map(b=>b.name));}
 catch(e){s.paired.clear();s.receipt='Box check failed: '+e.message;}
 render();
}
async function refresh(){
 if(s.loading)return;
 s.loading=true;s.message='Loading seven ESPN leagues…';render();
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date()));
 const offsets=hour<4?[-1,0,1]:[0,1];
 const dates=[...new Set(offsets.map(x=>day(new Date(Date.now()+x*86400000))))];
 const jobs=LEAGUES.flatMap(([league,path])=>dates.map(async date=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   let url='https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?dates='+date+'&limit=150';
   if(league==='NCAA FB')url+='&groups=80';
   if(league==='NCAA BB')url+='&groups=50';
   const r=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(!r.ok)throw Error('ESPN '+r.status);
   const j=await r.json();return (j.events||[]).map(e=>parse(e,league)).filter(Boolean);
  }finally{clearTimeout(timer);}
 }));
 const res=await Promise.allSettled(jobs),records=res.flatMap(x=>x.status==='fulfilled'?x.value:[]);
 const dedup=[...new Map(records.map(g=>[g.id,g])).values()];
 s.games=dedup.sort((a,b)=>Number(b.status==='LIVE')-Number(a.status==='LIVE')||
  Number(b.favorite)-Number(a.favorite)||new Date(a.when)-new Date(b.when));
 const count=res.filter(x=>x.status==='fulfilled').length;
 s.message=count?s.games.filter(x=>x.status==='LIVE').length+' live · '+s.games.length+' scheduled/active · '+count+'/'+res.length+' ESPN feeds':'ESPN feeds unavailable. Your Xfinity controls are unaffected.';
 s.last=Date.now();s.loaded=true;s.loading=false;render();
}
async function tune(id){
 if(s.sending||!s.user)return;
 const game=s.games.find(x=>x.id===id);if(!game)return;
 const route=tuneData(selected(game).item),box=tv();
 if(!route){s.receipt='Choose the game’s broadcast network first.';render();return;}
 if(!s.paired.has(box)){s.receipt='Box '+box+' not confirmed paired.';render();return;}
 s.sending=true;s.receipt='Sending '+route.descr+' to '+box+'…';render();
 try{
  const result=await api('/api/send',{box,kind:route.kind,value:route.value});
  s.receipt=result.commandAccepted?'Xfinity accepted '+route.descr+' on '+box+'. Verify the TV changed.':'No command acknowledgment received.';
 }catch(e){s.receipt='Command failed: '+e.message;}
 finally{s.sending=false;render();}
}
function mount(){if(!el())return;render();if(!s.loaded&&!s.loading)refresh();}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-map-tv],[data-map-league],[data-map-mode],[data-map-tune],[data-map-refresh],[data-map-boxes],[data-v14-box],[data-x18-tv]');
 if(!b)return;
 if(b.dataset.mapTv){
  s.tv=b.dataset.mapTv;
  const other=[...document.querySelectorAll('.localDirectBoxes [data-v14-box]')].find(n=>n.dataset.v14Box===s.tv);
  if(other)other.click();
  render();
 }else if(b.dataset.mapLeague){s.league=b.dataset.mapLeague;render();}
 else if(b.dataset.mapMode){s.mode=b.dataset.mapMode;render();}
 else if(b.hasAttribute('data-map-refresh'))refresh();
 else if(b.hasAttribute('data-map-boxes'))boxes();
 else if(b.dataset.mapTune)tune(b.dataset.mapTune);
 else if(b.dataset.v14Box||b.dataset.x18Tv)queueMicrotask(render);
});
document.addEventListener('change',e=>{
 if(e.target?.hasAttribute('data-map-choice')){
  const k=e.target.dataset.mapChoice;
  if(e.target.value)s.overrides[k]=e.target.value;else delete s.overrides[k];
  render();
 }
});
onAuthStateChanged(auth,u=>{s.user=u;s.paired.clear();if(u)boxes();render();});
window.XfinityGameMap={mount,render,refresh};
setInterval(()=>{if(el()&&!document.hidden&&s.loaded&&!s.loading&&Date.now()-s.last>120000)refresh();},30000);
mount();
})();