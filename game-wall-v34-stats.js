// V34 · Real ESPN game-summary stats in the existing iPhone modal. No TV controls changed.
(()=>{
'use strict';
const HOST='https://site.api.espn.com/apis/site/v2/sports/';
const PATHS=new Set(['football/nfl','basketball/nba','hockey/nhl','baseball/mlb',
 'basketball/wnba','football/college-football','basketball/mens-college-basketball']);
const CACHE=new Map();
const session={game:null,tab:'players',data:null,error:'',loading:false,token:0,lastFetch:0};
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const plain=x=>typeof x==='number'||typeof x==='string'?String(x):'';
const num=x=>Number.isFinite(Number(x))?Number(x):null;
function validLogo(x){
 if(typeof x!=='string')return '';
 const v=x.trim();
 return /^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/(?:i|combiner)\/[^\s<>"']{1,700}$/.test(v)?v:'';
}
function gameKey(game){
 const p=String(game?.path||''),id=String(game?.eventId||'');
 return PATHS.has(p)&&/^\d{5,15}$/.test(id)?p+'|'+id:'';
}
function teamPicture(team){
 const src=validLogo(team?.logo);
 return src?'<img src="'+esc(src)+'" alt="" loading="lazy" onerror="this.hidden=true">':
  '<span class="statsTeamFallback">'+esc(team?.abbr||'')+'</span>';
}
function headerCompetitors(data){
 const list=data?.header?.competitions?.[0]?.competitors;
 return Array.isArray(list)?list:[];
}
function matches(entry,team,side){
 const e=entry?.team||entry||{};
 return entry?.homeAway===side||entry?.team?.homeAway===side||
  (!!e.id&&!!team?.id&&String(e.id)===String(team.id))||
  (!!e.abbreviation&&!!team?.abbr&&String(e.abbreviation).toUpperCase()===String(team.abbr).toUpperCase())||
  (!!e.displayName&&!!team?.fullName&&e.displayName===team.fullName);
}
function pairOrder(list,game){
 const pending=Array.isArray(list)?[...list]:[];
 const awayIdx=pending.findIndex(x=>matches(x,game.away,'away'));
 const away=awayIdx>=0?pending.splice(awayIdx,1)[0]:pending.shift();
 const homeIdx=pending.findIndex(x=>matches(x,game.home,'home'));
 const home=homeIdx>=0?pending.splice(homeIdx,1)[0]:pending.shift();
 return [away,home];
}
function scorePair(data,game){
 const [a,h]=pairOrder(headerCompetitors(data),game);
 const score=x=>plain(x?.score??'')||'';
 return [score(a)||plain(game.away.score)||'–',score(h)||plain(game.home.score)||'–'];
}
function renderHeader(){
 const game=session.game;
 const [a,h]=scorePair(session.data,game);
 const start=Date.parse(game.start);
 const when=Number.isFinite(start)?new Date(start).toLocaleString('en-US',{
  timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
 }):'Time unavailable';
 const status=esc(game.detail||game.state.toUpperCase());
 return '<div class="statsHeaderCard">'+
  '<div class="statsTopline"><span>'+esc(game.league)+' · '+esc(game.state.toUpperCase())+
  '</span><span>'+esc(when)+' ET</span></div>'+
  '<div class="statsMatch">'+
   '<div class="statsMatchTeam">'+teamPicture(game.away)+'<strong>'+esc(game.away.name)+'</strong></div>'+
   '<div class="statsMatchScore"><strong>'+esc(a)+' – '+esc(h)+'</strong><small>'+status+'</small></div>'+
   '<div class="statsMatchTeam">'+teamPicture(game.home)+'<strong>'+esc(game.home.name)+'</strong></div>'+
  '</div></div>';
}
function unavail(heading,detail){
 return '<div class="statsEmpty"><strong>'+esc(heading)+'</strong><p>'+esc(detail)+'</p></div>';
}
function teamStats(data,game){
 const entries=data?.boxscore?.teams;
 const [away,home]=pairOrder(entries,game);
 const toMap=item=>{
  const m=new Map();
  for(const stat of Array.isArray(item?.statistics)?item.statistics:[]){
   const label=plain(stat?.label||stat?.displayName||stat?.name||'').trim();
   const key=plain(stat?.name||label).trim().toLowerCase().replace(/[^a-z0-9]/g,'');
   const value=plain(stat?.displayValue??stat?.value).trim();
   if(key&&label&&value&&!m.has(key))m.set(key,{key,label,value});
  }return m;
 };
 const a=toMap(away),h=toMap(home);
 const keys=[...new Set([...a.keys(),...h.keys()])];
 if(!keys.length)return unavail('Team stats not published','ESPN has not supplied team box-score statistics for this game.');
 const favored={
  NBA:['fieldgoalpct','threepointfieldgoalpct','freethrowpct','totalrebounds','rebounds','assists','steals','blocks','turnovers'],
  WNBA:['fieldgoalpct','threepointfieldgoalpct','freethrowpct','totalrebounds','rebounds','assists','turnovers'],
  NCAAB:['fieldgoalpct','threepointfieldgoalpct','freethrowpct','totalrebounds','rebounds','assists','turnovers'],
  NHL:['shots','hits','blockedshots','faceoffpct','powerplaygoals','penaltyminutes'],
  NFL:['totalyards','passingyards','rushingyards','firstdowns','thirddownefficiency','turnovers','timeofpossession'],
  NCAAF:['totalyards','passingyards','rushingyards','firstdowns','thirddownefficiency','turnovers'],
  MLB:['hits','runs','errors','leftonbase','walks','strikeouts']
 }[game.league]||[];
 keys.sort((x,y)=>{
  const ix=favored.findIndex(k=>x.includes(k)),iy=favored.findIndex(k=>y.includes(k));
  return (ix<0?100:ix)-(iy<0?100:iy);
 });
 const label=item=>esc(item?.label||'');
 return '<div class="statsSectionTitle">TEAM COMPARISON <small>ESPN box score</small></div>'+
  '<div class="statsCompareHead"><strong>'+esc(game.away.abbr||game.away.name)+'</strong><span>STAT</span><strong>'+esc(game.home.abbr||game.home.name)+'</strong></div>'+
  '<div class="statsCompareRows">'+keys.slice(0,45).map(key=>
   '<div class="statsCompareRow"><strong>'+esc(a.get(key)?.value??'—')+'</strong>'+
   '<span>'+label(a.get(key)||h.get(key))+'</span>'+
   '<strong>'+esc(h.get(key)?.value??'—')+'</strong></div>').join('')+'</div>';
}
function statsColumns(group){
 const labels=Array.isArray(group?.labels)&&group.labels.length?group.labels:
  Array.isArray(group?.names)?group.names:[];
 return labels.map(x=>plain(x).slice(0,28));
}
function playerGroups(data,game){
 const groups=Array.isArray(data?.boxscore?.players)?data.boxscore.players:[];
 const [away,home]=pairOrder(groups,game);
 function renderTeam(entry,team){
  const blocks=Array.isArray(entry?.statistics)?entry.statistics:[];
  const sections=blocks.map(block=>{
   const rawAthletes=Array.isArray(block.athletes)?block.athletes:[];
   const athletes=rawAthletes.filter(item=>item?.athlete?.displayName||item?.athlete?.fullName||item?.name);
   if(!athletes.length)return '';
   const columns=statsColumns(block),validColumns=columns.length;
   const rows=athletes.slice(0,65).map(item=>{
    const name=plain(item.athlete?.displayName||item.athlete?.fullName||item.name);
    let stats=Array.isArray(item.stats)?item.stats:[];
    if(!stats.length&&Array.isArray(item.statistics)){
     stats=item.statistics.map(x=>plain(x?.displayValue??x?.value??x));
    }
    const note=!stats.length?plain(item.reason||item.didNotPlay?'DNP':''):'';
    return '<tr><th scope="row">'+esc(name)+(note?'<small>'+esc(note)+'</small>':'')+'</th>'+
      stats.slice(0,validColumns||20).map(x=>'<td>'+esc(plain(x)||'—')+'</td>').join('')+
      (validColumns>stats.length?Array.from({length:validColumns-stats.length},()=>'<td>—</td>').join(''):'')+
      '</tr>';
   }).join('');
   const tableHead=validColumns?
    '<tr><th scope="col">PLAYER</th>'+columns.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr>':
    '<tr><th scope="col">PLAYER</th><th scope="col">GAME STATS</th></tr>';
   return '<section class="statsPlayerGroup"><h4>'+esc(block.name||block.displayName||'Players')+'</h4>'+
    '<div class="statsTableScroll"><table><thead>'+tableHead+'</thead><tbody>'+rows+'</tbody></table></div></section>';
  }).filter(Boolean);
  return sections.length?
   '<div class="statsTeamHeading">'+teamPicture(team)+'<strong>'+esc(team.fullName||team.name)+'</strong></div>'+sections.join(''):'';
 }
 const awayHTML=renderTeam(away,game.away),homeHTML=renderTeam(home,game.home);
 return awayHTML||homeHTML?awayHTML+homeHTML:unavail('Player stats not published',
  'Player box scores appear when ESPN provides game statistics. For an upcoming game, check back after play begins.');
}
function scoringPlays(data,game){
 const scoring=Array.isArray(data?.scoringPlays)?data.scoringPlays:[];
 const plays=Array.isArray(data?.plays)?data.plays:
  Array.isArray(data?.plays?.allPlays)?data.plays.allPlays:[];
 const chosen=scoring.length?scoring:plays;
 const [a,h]=pairOrder(headerCompetitors(data),game);
 const lineScores=(entry)=>Array.isArray(entry?.linescores)?entry.linescores.map(x=>plain(x?.displayValue??x?.value??'')):[];
 const away=lineScores(a),home=lineScores(h);
 const periodLen=Math.max(away.length,home.length);
 let out='';
 if(periodLen){
  const periodName=i=>(game.league==='MLB'?'INN '+(i+1):
   game.league==='NHL'?'P'+(i+1):'Q'+(i+1));
  out+='<div class="statsSectionTitle">SCORING BY PERIOD</div><div class="statsTableScroll">'+
   '<table class="statsPeriodTable"><thead><tr><th>TEAM</th>'+
   Array.from({length:periodLen},(_,i)=>'<th>'+periodName(i)+'</th>').join('')+
   '</tr></thead><tbody>'+
   [[game.away,away],[game.home,home]].map(([team,values])=>
    '<tr><th>'+esc(team.abbr||team.name)+'</th>'+
    Array.from({length:periodLen},(_,i)=>'<td>'+esc(values[i]??'—')+'</td>').join('')+'</tr>').join('')+
   '</tbody></table></div>';
 }
 if(chosen.length){
  out+='<div class="statsSectionTitle">'+(scoring.length?'SCORING PLAYS':'RECENT PLAYS')+'</div>'+
   '<div class="statsPlayList">'+chosen.slice(-28).reverse().map(play=>{
    const body=plain(play.text||play.shortText||play.type?.text||'');
    const clock=plain(play.clock?.displayValue||'');
    const period=plain(play.period?.number||'');
    if(!body)return '';
    return '<div class="statsPlay"><span>'+esc(period?'P'+period:'')+(clock?' · '+esc(clock):'')+'</span>'+
     '<p>'+esc(body)+'</p></div>';
   }).join('')+'</div>';
 }
 return out||unavail('Scoring details not available','ESPN has not published period scoring or play descriptions for this game.');
}
function render(){
 const game=session.game;if(!game)return;
 const body=$('modalBody'),heading=$('modalTitle'),shade=$('modalShade');
 if(!body||!heading||!shade)return;
 heading.textContent='Game Stats · '+game.league;
 shade.classList.add('open');
 body.dataset.statsEvent=game.id;
 let content=renderHeader();
 content+='<div class="statsTabBar" role="tablist" aria-label="Game statistics">'+
  [['players','Players'],['teams','Team Stats'],['scoring','Scoring']].map(([id,title])=>
   '<button type="button" role="tab" data-stats-tab="'+id+'" aria-selected="'+(session.tab===id)+'" class="'+(session.tab===id?'active':'')+'">'+title+'</button>').join('')+'</div>';
 if(session.loading&&!session.data)content+=
  '<div class="statsLoading" role="status"><span class="statsLoader" aria-hidden="true"></span>Loading ESPN box scores…</div>';
 else if(session.error&&!session.data)content+=unavail('Stats could not load',session.error);
 else if(session.data)content+='<div class="statsTabContent">'+
  (session.tab==='teams'?teamStats(session.data,game):
   session.tab==='scoring'?scoringPlays(session.data,game):
   playerGroups(session.data,game))+'</div>';
 content+='<div class="statsFooter"><small>ESPN game summary · '+
  (session.lastFetch?new Date(session.lastFetch).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'Awaiting data')+
  (game.state==='live'?' · Refreshes while open':'')+
  '</small><button type="button" id="refreshGameStats"'+(session.loading?' disabled':'')+
  '>'+ (session.loading?'Loading…':'Refresh Stats')+'</button></div>';
 if(game.espnUrl&&/^https:\/\/www\.espn\.com\//.test(game.espnUrl)){
  content+='<a class="statsEspnLink" target="_blank" rel="noopener noreferrer" href="'+esc(game.espnUrl)+'">Full game details on ESPN</a>';
 }
 body.innerHTML=content;
 body.querySelectorAll('[data-stats-tab]').forEach(el=>el.onclick=()=>{session.tab=el.dataset.statsTab;render();});
 $('refreshGameStats')?.addEventListener('click',()=>load(true));
}
async function load(force=false){
 const game=session.game,key=gameKey(game);
 if(!key)return;
 const cache=CACHE.get(key),now=Date.now();
 const ttl=game.state==='live'?18000:game.state==='final'?10*60000:3*60000;
 if(!force&&cache&&now-cache.at<ttl){
  session.data=cache.data;session.lastFetch=cache.at;session.loading=false;session.error='';
  render();return;
 }
 const token=++session.token;
 session.loading=true;session.error='';render();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const path=HOST+game.path+'/summary?event='+encodeURIComponent(game.eventId);
  const response=await fetch(path,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('ESPN returned HTTP '+response.status);
  const data=await response.json();
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('ESPN returned an invalid game summary');
  if(token!==session.token||session.game?.id!==game.id)return;
  CACHE.set(key,{at:Date.now(),data});
  session.data=data;session.lastFetch=Date.now();session.error='';
  // Select an available tab if the player box score is not present.
  if(session.tab==='players'&&!Array.isArray(data.boxscore?.players)&&Array.isArray(data.boxscore?.teams))session.tab='teams';
 }catch(e){
  if(token!==session.token||session.game?.id!==game.id)return;
  session.error=e.name==='AbortError'?'ESPN did not respond in time. Tap Refresh Stats.':
   'ESPN game-summary request failed: '+(e.message||'Unknown error');
  if(cache){session.data=cache.data;session.lastFetch=cache.at;}
 }finally{
  clearTimeout(timeout);
  if(token===session.token&&session.game?.id===game.id){session.loading=false;render();}
 }
}
function open(game){
 const key=gameKey(game);
 if(!key)return false;
 session.token++;
 session.game=game;session.tab='players';session.data=null;session.error='';
 session.lastFetch=0;session.loading=false;
 render();load(false);return true;
}
// Refresh live stats only while this game's stats sheet is visibly open.
setInterval(()=>{
 if(!session.game||session.game.state!=='live'||document.hidden)return;
 if(!$('modalShade')?.classList.contains('open'))return;
 if($('modalBody')?.dataset.statsEvent!==session.game.id)return;
 if(!session.loading&&Date.now()-session.lastFetch>28000)load(false);
},30000);
window.ManCaveStats=Object.freeze({open,render,
 helpers:Object.freeze({teamStats,playerGroups,scoringPlays,gameKey})});
})();