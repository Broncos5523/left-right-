// V33 · ESPN daily schedules by league-specific windows, 48h finals, and next available favorites.
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
 'PARAMOUNT+':'paramount','PRIME VIDEO':'prime','AMAZON PRIME VIDEO':'prime',
 'AMAZON PRIME':'prime','AMAZON':'prime','AMZ':'prime','PRIME':'prime',
 'THURSDAY NIGHT FOOTBALL':'prime','TNF':'prime','APPLE TV+':'appletv'};
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
function cleanLogo(value){
 // Allow only HTTPS ESPN CDN image paths, with no redirects to arbitrary hosts.
 if(typeof value!=='string'||value.length>1000)return '';
 const url=value.trim();
 return /^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/(?:i|combiner)\/[^\s<>"'\x60]{1,980}$/i.test(url)?url:'';
}
function teamLogoCandidates(team,league){
 // Prefer the logo(s) ESPN supplied for this exact team.
 const urls=[team.logo,...(Array.isArray(team.logos)?team.logos.map(x=>typeof x==='string'?x:x?.href):[])];
 // Only try an ESPN CDN fallback for this known league and its actual team ID/abbreviation.
 const sport=({NFL:'nfl',NBA:'nba',NHL:'nhl',MLB:'mlb',WNBA:'wnba',
  NCAAF:'ncaa',NCAAB:'ncaa'})[league];
 const symbol=sport==='ncaa'?String(team.id||''):String(team.abbreviation||'').toLowerCase();
 if(sport&&(/^[0-9]{1,8}$/.test(symbol)||sport!=='ncaa'&&/^[a-z0-9]{2,5}$/.test(symbol))){
  urls.push('https://a.espncdn.com/i/teamlogos/'+sport+'/500/'+symbol+'.png');
 }
 return [...new Set(urls.map(cleanLogo).filter(Boolean))].slice(0,4);
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
  const logos=teamLogoCandidates(team,league);
  return {name:team.shortDisplayName||team.name||team.displayName,
   fullName:team.displayName,abbr:team.abbreviation||team.shortDisplayName||'',
   logo:logos[0]||'',logoAlternates:logos.slice(1),
   // Only visual theme data, never used for game or broadcast routing.
   color:/^[0-9a-f]{6}$/i.test(String(team.color||'').replace(/^#/,''))?String(team.color).replace(/^#/,''):'',
   score:raw.score??null,record:(raw.records||[]).find(x=>x.type==='total')?.summary||''};
 }
 return {id:league+'-'+event.id,eventId:String(event.id),league,path,state:status,
  away:t(away),home:t(home),start:when,
  endedAt:event.status?.type?.completedAt||c.endDate||event.endDate||'',
  detail:event.status?.type?.shortDetail||event.status?.type?.detail||'',
  broadcasts:broadcasters(event,c),
  seasonType:Number(event.season?.type||c.season?.type||0),seasonSlug:String(event.season?.slug||''),
  favorite:FAVORITES.has(aName)||FAVORITES.has(hName),
  espnUrl:(event.links||[]).find(x=>/^https:\/\/www\.espn\.com\//.test(x.href||''))?.href||''};
}
const scoreboardCache=new Map(),favoriteScheduleCache=new Map();
async function refresh(force=false){
 if(state.loading)return;
 if(!force&&state.loaded&&Date.now()-state.lastFetch<90000)return;
 state.loading=true;state.message='Loading real ESPN games across seven sports…';notify();
 const now=Date.now(),policy=window.ManCaveGameWindows;
 const work=LEAGUES.flatMap(([league,path])=>
  (policy?.dayOffsets(league)||[-2,-1,0,1,2]).map(offset=>({league,path,date:dayET(offset),offset})))
  .sort((a,b)=>Math.abs(a.offset)-Math.abs(b.offset)||a.offset-b.offset);
 const responses=[];
 for(let i=0;i<work.length;i+=10){
  const batch=await Promise.allSettled(work.slice(i,i+10).map(async q=>{
   const cacheKey=q.league+':'+q.date,cached=scoreboardCache.get(cacheKey);
   const ttl=q.offset===0?85000:q.offset<0?8*60000:q.offset<=2?12*60000:40*60000;
   if(!force&&cached&&now-cached.at<ttl)return cached.games;
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),10000);
   try{
    const params='?dates='+q.date+'&limit='+(q.league==='NCAAB'?'500':'250')+(q.league==='NCAAF'?'&groups=80':q.league==='NCAAB'?'&groups=50':'');
    const res=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+q.path+'/scoreboard'+params,
     {cache:'no-store',signal:controller.signal});
    if(!res.ok)throw Error('ESPN HTTP '+res.status);
    const data=await res.json();
    const games=(data.events||[]).map(e=>parse(e,q.league,q.path)).filter(Boolean);
    scoreboardCache.set(cacheKey,{at:Date.now(),games});return games;
   }catch(error){
    if(cached&&now-cached.at<3*3600000)return cached.games;
    throw error;
   }finally{clearTimeout(timeout);}
  }));
  responses.push(...batch);
 }
 const successes=responses.filter(r=>r.status==='fulfilled');
 state.errors=responses.length-successes.length;
 const games=new Map();
 for(const r of successes)for(const g of r.value)games.set(g.id,g);
 // Only favorite teams can contribute one upcoming game outside the general windows.
 const favoriteResults=await Promise.allSettled((policy?.FAVORITES||[]).map(f=>fetchFavoriteNext(f,now,force)));
 let favoriteErrors=0;
 for(const result of favoriteResults){
  if(result.status==='fulfilled')for(const g of result.value)games.set(g.id,g);
  else favoriteErrors++;
 }
 state.games=policy?policy.select([...games.values()],now):[...games.values()];
 state.loaded=true;state.loading=false;state.lastFetch=Date.now();
 state.message=successes.length?
  state.games.length+' games within your windows · '+(successes.length+favoriteResults.length-favoriteErrors)+'/'+(responses.length+favoriteResults.length)+' ESPN feeds'+
   (state.errors+favoriteErrors?' · '+(state.errors+favoriteErrors)+' unavailable':''):
  'ESPN schedules could not be loaded. Retry — sample games will not be shown.';
 notify();
 loadCurrentNflCoverage().then(notify).catch(()=>{});
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

const NFL_COVERAGE_SOURCE='https://www.thesportsmaps.com/tv-markets/providence-new-bedford.html';
const nflCoverage=new Map(),nflCoverageInflight=new Map();
function eastern(date){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',
  {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',
   weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date)).map(x=>[x.type,x.value]));
 return {date:parts.year+'-'+parts.month+'-'+parts.day,weekday:parts.weekday,
  minutes:Number(parts.hour)*60+Number(parts.minute),month:Number(parts.month)};
}
function lastWord(name){
 return String(name||'').toLowerCase().replace(/[^\da-z]+/g,' ').trim().split(' ').pop();
}
function isSameNflGame(game,local){
 return lastWord(game.away.fullName)===lastWord(local.away)&&
        lastWord(game.home.fullName)===lastWord(local.home);
}
function isSundayAfternoonNFL(game){
 if(game.league!=='NFL')return false;
 const d=eastern(game.start);
 if(d.weekday!=='Sun'||d.minutes<13*60||d.minutes>=19*60)return false;
 const knownRegular=game.seasonType===2||game.seasonSlug==='regular-season'||
   (game.seasonType===0&&!game.seasonSlug&&[9,10,11,12].includes(d.month));
 // No Sunday Ticket assumption for postseason or games with indeterminate season classification.
 return knownRegular;
}
async function loadNflCoverage(date){
 const cached=nflCoverage.get(date);
 if(cached&&Date.now()-(cached.loadedAt||0)<15*60*1000)return cached;
 if(nflCoverageInflight.has(date))return nflCoverageInflight.get(date);
 const task=(async()=>{
  let record={status:'unverified',date,games:[],error:'The exact Providence Sunday CBS/FOX schedule has not been verified.'};
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   let response;
   try{response=await fetch(HOST+'/nfl-local-coverage?date='+encodeURIComponent(date),
       {cache:'no-store',signal:controller.signal});}
   finally{clearTimeout(timer);}
   const payload=await response.json();
   if(response.ok&&payload.verifiedForRequestedDate&&payload.requestedDate===date&&
      payload.date===date&&payload.market==='Providence–New Bedford'&&
      Array.isArray(payload.games)&&payload.games.length>=1){
    const valid=payload.games.every(x=>['CBS','FOX'].includes(x.network)&&x.away&&x.home);
    if(valid)record={status:'verified',date,games:payload.games,source:payload.source};
   }else if(payload.status==='not_yet_published'){
    record={status:'not_published',date,games:[],source:NFL_COVERAGE_SOURCE,
            error:'Providence CBS/FOX assignments have not been published for this Sunday yet.'};
   }
  }catch(_e){
   record={status:'unavailable',date,games:[],error:'Could not verify the Providence CBS/FOX schedule.'};
  }
  record.loadedAt=Date.now();
  nflCoverage.set(date,record);
  nflCoverageInflight.delete(date);
  return record;
 })();
 nflCoverageInflight.set(date,task);
 return task;
}
async function loadCurrentNflCoverage(){
 const dates=[...new Set(state.games.filter(isSundayAfternoonNFL).map(g=>eastern(g.start).date))];
 await Promise.allSettled(dates.slice(0,3).map(loadNflCoverage));
}

// Verified availability exceptions: never infer a blackout merely because a national
// broadcaster is also listed. Confirmed sources or the user's direct TV verification are
// required. This is extendable as additional exclusive broadcasts are verified.
const VERIFIED_NATIONAL_EXCLUSIVES=[
 {
  league:'NBA',date:'2026-11-16',
  away:'Orlando Magic',home:'Boston Celtics',
  localUnavailable:'NBC Sports Boston',
  primary:{kind:'voice',name:'NBC Sports Network',phrase:'Watch NBC Sports Network'},
  alternative:{kind:'app',app:'peacock',name:'Peacock'},
  detail:'The NBA and NBC Sports list NBCSN/Peacock, and you confirmed NBC Sports Boston is not carrying this game.'
 }
];
function verifiedNationalExclusive(game){
 const when=eastern(game.start).date;
 return VERIFIED_NATIONAL_EXCLUSIVES.find(x=>x.league===game.league&&x.date===when&&
  x.away===game.away.fullName&&x.home===game.home.fullName)||null;
}
function nationalRoute(route,reason,confidence='national-confirmed'){
 return {status:'ready',kind:route.kind,name:route.name,app:route.app,
  phrase:route.phrase,confidence,label:route.name,detail:reason};
}
function confirmedNationalFallback(game,reportedNames){
 const verified=verifiedNationalExclusive(game);
 if(verified)return nationalRoute(verified.primary,verified.detail,'verified-regional-unavailable');
 // Generic rule for future officially branded national-exclusive NBA Monday games:
 // NBA/NBC specify the weekly NBCSN/Peacock Monday window; when ESPN itself names
 // the NBCSN/Peacock service and does not list the regional broadcaster, use national.
 // A generic ESPN/ABC/FOX national listing is NOT sufficient for an override.
 if(game.league==='NBA'&&eastern(game.start).weekday==='Mon'&&
    reportedNames.every(n=>!/^NBC SPORTS BOSTON(?: PLUS)?$|^NBCSB\+?$/.test(n))){
   if(reportedNames.some(n=>['NBCSN','NBC SPORTS NETWORK'].includes(n)))
    return nationalRoute({kind:'voice',name:'NBC Sports Network',phrase:'Watch NBC Sports Network'},
      'NBCSN/Peacock NBA Monday national presentation; no regional feed reported by ESPN.','nba-monday-national');
   if(reportedNames.includes('PEACOCK'))
    return nationalRoute({kind:'app',app:'peacock',name:'Peacock'},
      'Peacock NBA Monday national presentation; no regional feed reported by ESPN. Opens the app.','nba-monday-national');
 }
 // Apple confirms Friday Night Baseball broadcasts are nationally exclusive with no
 // local broadcasting restrictions. Apply only when ESPN explicitly reports Apple TV.
 if(game.league==='MLB'&&reportedNames.every(n=>n!=='NESN'&&n!=='NESN+')&&
  reportedNames.some(n=>['APPLE TV+','APPLE TV','FRIDAY NIGHT BASEBALL'].includes(n)))
  return nationalRoute({kind:'app',app:'appletv',name:'Apple TV'},
   'Apple Friday Night Baseball is an exclusive national presentation; opens the Apple TV app.','mlb-apple-exclusive');
 return null;
}
function routeFor(game){
 if(!game)return {status:'unknown',label:'No game selected',detail:''};
 if(game.state==='final')return {status:'unknown',label:'Game has ended',detail:'No live channel is assigned to a final game.'};
 const listed=routeOptions(game);
 const names=game.broadcasts.map(norm),raw=names.join(' / ');
 const fromChannel=(id,why,confidence)=>{
  const ch=lineup().find(item=>item.id===id);
  return ch?{status:'ready',kind:'channel',ch,name:id,confidence,
   label:'Watch '+(ch.voice||id),
   detail:why+(ch.hd||ch.sd?' · Channel backup: '+(ch.hd||ch.sd):'')}:null;
 };
 const fromListing=(choice,why)=>{
  if(!choice)return null;
  return {status:'ready',kind:choice.kind,app:choice.app,ch:choice.ch,
   name:choice.name,confidence:'reported',label:choice.name,
   detail:why||'ESPN reports this broadcaster; local carriage and subscription are not guaranteed.'};
 };
 if(isSundayAfternoonNFL(game)){
  const date=eastern(game.start).date,coverage=nflCoverage.get(date);
  if(!coverage||coverage.status!=='verified')
   return {status:'unknown',label:'Providence CBS/FOX listing pending',
    detail:coverage?.error||'Checking this Sunday’s Providence local CBS/FOX TV assignments. Sunday Ticket will not be assumed until verified.'};
  const local=coverage.games.find(x=>isSameNflGame(game,x));
  if(local){
   const id=local.network==='CBS'?'CBS · WPRI':'FOX · WNAC';
   return fromChannel(id,'Confirmed on Providence local '+local.network+' for '+date+' by Sports Maps.','local-verified')||
    {status:'unknown',label:'Local channel unavailable',detail:id+' was not found in your Xfinity lineup.'};
  }
  return {status:'ready',kind:'app',app:'youtube',name:'NFL Sunday Ticket',confidence:'out-of-market-verified',
   label:'NFL Sunday Ticket · YouTube',
   detail:'Not listed on Providence local CBS/FOX for '+date+'. Opens YouTube; select this matchup inside Sunday Ticket. An active subscription is required.'};
 }
 // NFL official Week 11 schedule (revised Nov 9, 2026) confirms Indianapolis at
 // Houston on Nov 19 (8:15 p.m. ET) airs on Prime Video nationally.
 // This specific published assignment fills ESPN's occasional missing/abbreviated field.
 // Do not guess future Thursday games: their broadcasters may vary (e.g. Thanksgiving).
 if(game.league==='NFL'&&eastern(game.start).date==='2026-11-19'&&
    game.away.fullName==='Indianapolis Colts'&&game.home.fullName==='Houston Texans'){
   return {status:'ready',kind:'app',app:'prime',name:'Prime Video',
    confidence:'official-nfl-schedule',label:'Prime Video',
    detail:'NFL Week 11 officially lists this matchup on Prime Video. Opens the app on selected TVs; choose the game inside.'};
 }
 if(game.league==='NFL'&&eastern(game.start).weekday==='Sun'){
  // Sunday night, international morning games, preseason, and playoffs are not presumed Sunday Ticket games.
  return fromListing(listed[0],'NFL Sunday game outside the Sunday Ticket afternoon regular-season window. Using ESPN-reported broadcaster.')||
   {status:'unknown',label:'Network not verified',detail:'This NFL game is outside the verified Sunday-afternoon CBS/FOX route.'};
 }
 const teams=game.away.fullName+' '+game.home.fullName;
 if(game.league==='NBA'&&teams.includes('Boston Celtics')){
  const exclusive=confirmedNationalFallback(game,names);
  if(exclusive)return exclusive;
  // Prefer NBC Sports Boston except when a national-exclusive feed has been verified.
  // If ESPN explicitly names the local Plus feed, select that Boston regional alternative.
  const localPlus=names.some(n=>/NBC SPORTS BOSTON(?:\s|\+|-)PLUS|NBCSB\+/.test(n));
  const localName=localPlus?'NBC Sports Boston Plus':'NBC Sports Boston';
  const local=fromChannel(localName,
   localPlus?'ESPN reports the local NBC Sports Boston Plus feed; using its Providence channel.':
    'Your preferred Celtics channel is NBC Sports Boston. A separate national listing does not override the regional preference.',
   'regional-preferred');
  if(local)return local;
  const primary=fromChannel('NBC Sports Boston',
   'NBC Sports Boston Plus is not in the saved Xfinity lineup; trying your preferred main regional channel.','regional-fallback');
  if(primary)return primary;
  return fromListing(listed[0],
   'NBC Sports Boston is unavailable in the saved Xfinity lineup; using the reported broadcaster instead.')||
   {status:'unknown',label:'Celtics broadcast unavailable',
    detail:'Neither the preferred regional channel nor a verified alternative is in the saved lineup.'};
 }
 if(game.league==='MLB'&&teams.includes('Boston Red Sox')){
  const exclusive=confirmedNationalFallback(game,names);
  if(exclusive)return exclusive;
  // Prefer NESN except when an exclusive national/streaming feed has been verified.
  const localPlus=names.some(n=>n==='NESN+'||n==='NESN PLUS');
  const localName=localPlus?'NESN+':'NESN';
  const local=fromChannel(localName,
   localPlus?'ESPN reports NESN+ for this game; using the local alternate NESN feed.':
    'Your preferred Red Sox channel is NESN. A separate national listing does not override the regional preference.',
   'regional-preferred');
  if(local)return local;
  const primary=fromChannel('NESN',
   'NESN+ is missing from your Xfinity lineup; trying your preferred main NESN channel.','regional-fallback');
  if(primary)return primary;
  return fromListing(listed[0],
   'NESN is unavailable in your saved Xfinity lineup; using the reported broadcaster instead.')||
   {status:'unknown',label:'Red Sox broadcast unavailable',
    detail:'Neither the preferred NESN channel nor a verified alternate is in the saved lineup.'};
 }
 const first=listed[0];
 return fromListing(first)||{status:'unknown',label:'Broadcast not reported',detail:'ESPN did not provide a recognized Xfinity network for this game. No channel will be guessed.'};
}
function routeToCommand(route,box){
 if(route.status!=='ready')throw Error('No verified/default network could be determined.');
 if(route.kind==='app')return {box,kind:'app',value:route.app};
 if(route.kind==='voice'){
  if(!/^Watch [\w\s.+&,'?!:-]{2,80}$/.test(String(route.phrase||'')))throw Error('Invalid national voice command.');
  return {box,kind:'text',value:route.phrase};
 }
 const ch=route.ch||lineup().find(item=>item.id===route.name);
 if(!ch)throw Error('Channel is missing from the local lineup.');
 // Voice first; use digits only when no server-compatible voice name exists.
 const phrase='Watch '+String(ch.voice||'').trim();
 if(/^[\w\s.+&,'?!:-]{1,90}$/.test(phrase)&&phrase.length>6)
  return {box,kind:'text',value:phrase};
 const number=ch.hd||ch.sd;
 if(/^\d{1,5}$/.test(String(number||'')))return {box,kind:'channel',value:String(number)};
 throw Error('Neither a valid voice phrase nor a fallback channel exists for '+ch.id);
}
async function openAssign(id){
 const game=state.games.find(g=>g.id===id);if(!game)return;
 // First choose destinations. The app resolves the channel automatically and never asks users to choose a channel.
 await Promise.all([checkPairing(),game.league==='NFL'&&isSundayAfternoonNFL(game)?
  loadNflCoverage(eastern(game.start).date):Promise.resolve()]);
 const route=routeFor(game);
 const selectedTVs=new Set();
 const tvButtons=TEAMS.map(name=>'<button type="button" class="realTvChoice" data-real-tv="'+esc(name)+
  '" aria-pressed="false"'+(!state.paired.has(name)?' disabled':'')+'><strong>'+esc(name)+'</strong>'+
  '<small>'+esc(state.paired.has(name)?'● Paired':'○ Not paired')+'</small></button>').join('');
 const broadcasterBadge=route.status==='ready'?
  (window.ManCaveNetworkLogos?.badge?.(route)||''):'';
 const networkVisual=broadcasterBadge?
  '<div class="realAutoNetwork"><small>AUTO-SELECTED BROADCAST</small><div class="realAutoNetworkBadge">'+broadcasterBadge+'</div></div>':'';
 const networkNote=broadcasterBadge&&route.detail?
  '<div class="realGameFine">'+esc(route.detail)+'</div>':'';
 const details='<div class="realGameShort"><strong>'+esc(game.away.fullName)+' at '+esc(game.home.fullName)+'</strong>'+
  '<span>'+esc(game.league)+' · '+esc(game.state.toUpperCase())+' · '+esc(game.detail||'')+'</span></div>';
 if(!popup('Send Game to TVs',details+
  '<div class="realTvHeading">Choose one or more TVs</div>'+
  '<div class="realTvGrid" role="group" aria-label="Choose Xfinity televisions">'+tvButtons+'</div>'+
  networkVisual+networkNote+
  '<div class="realGameReceipt" role="status" id="realGameReceipt">'+
  (state.pairError?'Box check: '+esc(state.pairError):
    route.status==='ready'?'Select your TVs, then tap Send.':'This game cannot be sent without a verified broadcast assignment.')+'</div>'+
  '<div class="modalActions"><button type="button" class="btn subtle" id="realGameCancel">Cancel</button>'+
  '<button type="button" class="btn primary" id="realGameTune" disabled>Send to selected TVs</button></div>'))return;
 const modal=document.getElementById('modalBody');
 const button=document.getElementById('realGameTune');
 const note=document.getElementById('realGameReceipt');
 const repaint=()=>{
  modal.querySelectorAll('[data-real-tv]').forEach(el=>{
   const chosen=selectedTVs.has(el.dataset.realTv);
   el.classList.toggle('selected',chosen);el.setAttribute('aria-pressed',String(chosen));
  });
  button.disabled=state.busy||selectedTVs.size===0||route.status!=='ready';
  button.textContent=selectedTVs.size===0?'Select a TV':
   'Send to '+selectedTVs.size+' TV'+(selectedTVs.size===1?'':'s');
 };
 modal.querySelectorAll('[data-real-tv]').forEach(el=>el.addEventListener('click',()=>{
  const name=el.dataset.realTv;if(!state.paired.has(name)||state.busy)return;
  if(selectedTVs.has(name))selectedTVs.delete(name);else selectedTVs.add(name);
  state.selectedTV=name;repaint();
 }));
 document.getElementById('realGameCancel').onclick=()=>document.getElementById('modalShade').classList.remove('open');
 button.onclick=async()=>{
  if(state.busy||selectedTVs.size===0||route.status!=='ready')return;
  const targets=[...selectedTVs];state.busy=true;repaint();
  note.textContent='Sending '+route.label+' to '+targets.join(', ')+'…';
  const responses=await Promise.allSettled(targets.map(async name=>{
   const command=routeToCommand(route,name);
   const reply=await bridge('/api/send',command);
   if(!reply.commandAccepted)throw Error('Xfinity did not acknowledge the command');
   return name;
  }));
  const lines=responses.map((r,i)=>r.status==='fulfilled'?
   '✓ '+targets[i]+' — command accepted':
   '✕ '+targets[i]+' — '+(r.reason?.message||'Request failed'));
  note.textContent=lines.join(' · ')+(route.app==='youtube'?' · Select the game inside YouTube Sunday Ticket.':' · Check each TV to confirm playback.');
  state.busy=false;repaint();
 };
}
onAuthStateChanged(auth,user=>{state.user=user;state.paired.clear();state.pairChecked=false;});
window.ManCaveRealGames={state,refresh:()=>refresh(true),ensureLoaded,showStats,openAssign,routeFor};
if(document.querySelector('[data-nav="games"].active'))ensureLoaded();
setInterval(()=>{if(!document.hidden&&document.querySelector('[data-nav="games"].active')&&Date.now()-state.lastFetch>90000)refresh();},30000);
})();