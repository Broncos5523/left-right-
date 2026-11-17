// V35 Pregame scouting — existing live/final box scores remain unchanged.
(()=>{
'use strict';
const ROOT='https://site.api.espn.com/apis/site/v2/sports/';
const VALID=new Set(['football/nfl','basketball/nba','hockey/nhl','baseball/mlb','basketball/wnba','football/college-football','basketball/mens-college-basketball']);
const CACHE=new Map(),s={game:null,tab:'compare',away:null,home:null,loading:false,serial:0};
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const arr=x=>Array.isArray(x)?x:[];
const plain=x=>typeof x==='string'||typeof x==='number'?String(x).trim():'';
const legal=x=>/^[a-z0-9]{1,18}$/i.test(String(x||''))?String(x):'';
function teamID(g,side){return VALID.has(g?.path)?legal(g[side]?.id)||legal(g[side]?.abbr):'';}
function logo(t){const u=typeof t==='string'?t:t?.href||'';return /^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/(?:i|combiner)\/[^\s<>"']{1,800}$/i.test(u)?u:'';}
function photo(t){const u=logo(t?.logo);return u?'<img src="'+esc(u)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<b>'+esc(t?.abbr||'?')+'</b>';}
function blank(text){return '<div class="pgEmpty">'+esc(text)+'</div>';}
function record(data,g,side){
 const team=data?.team||{},all=arr(team.record?.items);
 return plain((all.find(x=>x.type==='total'||x.name==='overall')||all[0])?.summary||team.record?.summary||g[side]?.record)||'—';
}
function isTeam(x,t){
 const team=x?.team||{};
 if(t.id&&team.id)return String(t.id)===String(team.id);
 if(t.abbr&&team.abbreviation)return String(t.abbr).toUpperCase()===String(team.abbreviation).toUpperCase();
 return !!t.fullName&&plain(team.displayName)===plain(t.fullName);
}
function score(x){const v=x?.value??x?.displayValue??x,n=Number(v);return v===null||v===undefined||v===''||!Number.isFinite(n)?null:n;}
function previous(schedule,team,now=Date.now()){
 const out=[];
 for(const e of arr(schedule?.events)){
  const c=arr(e?.competitions)[0],list=arr(c?.competitors),date=Date.parse(e?.date||c?.date||'');
  const st=e?.status?.type||c?.status?.type||{};
  if(!Number.isFinite(date)||date>=now||(st.state!=='post'&&st.completed!==true))continue;
  const mine=list.find(x=>isTeam(x,team)),other=list.find(x=>x!==mine);if(!mine||!other)continue;
  const x=score(mine.score),y=score(other.score);if(x===null||y===null)continue;
  out.push({date,against:plain(other.team?.shortDisplayName||other.team?.displayName||other.team?.abbreviation||'Opponent'),
   local:mine.homeAway==='home',x,y,result:x>y?'W':x<y?'L':'T'});
 }
 return out.sort((a,b)=>b.date-a.date).slice(0,5);
}
function leaders(data,league){
 const root=data?.leaders||data?.categories||data?.team?.leaders||data?.statistics||[];
 const categories=Array.isArray(root)?root:arr(root?.categories||root?.leaders||root?.items);
 const pref={
 NBA:['points','rebounds','assists'],WNBA:['points','rebounds','assists'],NCAAB:['points','rebounds','assists'],
 NFL:['passingyards','rushingyards','receivingyards'],NCAAF:['passingyards','rushingyards','receivingyards'],
 NHL:['points','goals','assists'],MLB:['battingaverage','homeruns','runsbattedin','era']
 }[league]||[];
 const playerMap=new Map();
 for(const c of categories){
  const metric=plain(c.displayName||c.shortDisplayName||c.name||c.abbreviation||'Stat');
  const norm=metric.toLowerCase().replace(/[^a-z0-9]/g,'');
  const rank=pref.findIndex(x=>norm.includes(x));
  for(const item of arr(c.leaders||c.athletes||c.entries).slice(0,1)){
   const ath=item.athlete||item.player||{},name=plain(ath.displayName||ath.fullName||item.displayName);
   const val=plain(item.displayValue??item.statistics?.[0]?.displayValue??item.value);
   if(!name||!val)continue;
   const id=plain(ath.id||name);
   if(!playerMap.has(id))playerMap.set(id,{name,pic:logo(ath.headshot),stats:[],rank:999});
   const person=playerMap.get(id);
   person.rank=Math.min(person.rank,rank<0?100:rank);
   if(person.stats.length<4)person.stats.push({metric,val});
  }
 }
 return [...playerMap.values()].sort((a,b)=>a.rank-b.rank||b.stats.length-a.stats.length).slice(0,5);
}
function side(which){
 const game=s.game,d=s[which]||{};
 return {team:game[which],record:record(d.detail,game,which),last:previous(d.schedule,game[which]),players:leaders(d.leaders,game.league)};
}
function numberAvg(list,key){return list.length?(list.reduce((acc,r)=>acc+r[key],0)/list.length).toFixed(1):'—';}
function form(list){if(!list.length)return '—';return list.filter(x=>x.result==='W').length+'-'+list.filter(x=>x.result==='L').length;}
function compare(){
 const away=side('away'),home=side('home');
 const metric=s.game.league==='NHL'?'Goals':s.game.league==='MLB'?'Runs':'Points';
 const diff=list=>list.length?(list.reduce((sum,x)=>sum+x.x-x.y,0)/list.length).toFixed(1):'—';
 const line=(label,l,r)=>'<div class="pgComparisonRow"><strong>'+esc(l)+'</strong><span>'+esc(label)+'</span><strong>'+esc(r)+'</strong></div>';
 return '<div class="pgSectionTitle">TEAM STAT COMPARISON</div><div class="pgComparisonHead"><b>'+esc(away.team.abbr)+'</b><span>STAT</span><b>'+esc(home.team.abbr)+'</b></div>'+
 line('Season record',away.record,home.record)+line('Last 5 W–L',form(away.last),form(home.last))+
 line('Last 5 '+metric+' per game',numberAvg(away.last,'x'),numberAvg(home.last,'x'))+
 line('Last 5 '+metric+' allowed',numberAvg(away.last,'y'),numberAvg(home.last,'y'))+
 line('Last 5 '+metric+' difference',diff(away.last),diff(home.last))+
 '<p class="pgFootnote">Recent averages are calculated from up to five completed ESPN games per team, not from season totals.</p>';
}
function people(){
 return '<div class="pgSectionTitle">KEY PLAYER STATS</div>'+['away','home'].map(which=>{
  const team=side(which);
  return '<section class="pgTeamSection"><h4>'+photo(team.team)+esc(team.team.fullName)+'</h4>'+
  (team.players.length?team.players.map(p=>'<div class="pgPlayer">'+
   (p.pic?'<img src="'+esc(p.pic)+'" alt="" loading="lazy" onerror="this.hidden=true">':'<span>★</span>')+
   '<div><strong>'+esc(p.name)+'</strong><small>'+p.stats.map(x=>esc(x.metric)+': <b>'+esc(x.val)+'</b>').join(' · ')+'</small></div></div>').join(''):
   blank('ESPN has not supplied key player statistics for this team.'))+'</section>';
 }).join('')+'<p class="pgFootnote">These are ESPN-reported team leaders, not predicted starters.</p>';
}
function past(){
 return '<div class="pgSectionTitle">PREVIOUS FIVE GAMES</div>'+['away','home'].map(which=>{
  const team=side(which);
  return '<section class="pgTeamSection"><h4>'+photo(team.team)+esc(team.team.fullName)+'</h4>'+
   (team.last.length?team.last.map(x=>'<div class="pgResult"><span class="pgResultTag '+(x.result==='W'?'win':'loss')+'">'+x.result+'</span>'+
    '<div><strong>'+(x.local?'vs ':'@ ')+esc(x.against)+'</strong><small>'+new Date(x.date).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'})+'</small></div>'+
    '<strong>'+x.x+'–'+x.y+'</strong></div>').join(''):
   blank('ESPN has not published previous completed results for this team.'))+'</section>';
 }).join('')+'<p class="pgFootnote">Most recent completed results; scores show the selected team first.</p>';
}
function render(){
 const g=s.game,body=$('modalBody'),heading=$('modalTitle'),shade=$('modalShade');
 if(!g||!body||!heading||!shade)return;
 window.ManCaveStats?.deactivate?.();
 heading.textContent='Upcoming Game Stats · '+g.league;shade.classList.add('open');
 delete body.dataset.statsEvent;body.dataset.pregameEvent=g.id;
 const when=new Date(g.start).toLocaleString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 let h='<div class="pgHero"><small>PREGAME SCOUTING REPORT · '+esc(g.league)+'</small>'+
 '<div class="pgMatch"><div>'+photo(g.away)+'<b>'+esc(g.away.name)+'</b></div>'+
 '<strong>VS<small>'+esc(when)+' ET</small></strong><div>'+photo(g.home)+'<b>'+esc(g.home.name)+'</b></div></div></div>'+
 '<div class="pgTabs" role="tablist">'+[['compare','Team Comparison'],['people','Key Players'],['past','Previous Games']].map(([id,label])=>
 '<button type="button" role="tab" aria-selected="'+(s.tab===id)+'" class="'+(s.tab===id?'active':'')+'" data-pg-tab="'+id+'">'+label+'</button>').join('')+'</div>';
 if(s.loading&&!s.away&&!s.home)h+='<div class="pgLoading" role="status">Loading ESPN pregame statistics…</div>';
 else h+=s.tab==='compare'?compare():s.tab==='people'?people():past();
 h+='<div class="pgFoot"><span>ESPN team reports</span><button type="button" id="pgRefresh"'+(s.loading?' disabled':'')+'>Refresh</button></div>';
 if(/^https:\/\/www\.espn\.com\//.test(g.espnUrl||''))h+='<a class="pgLink" href="'+esc(g.espnUrl)+'" target="_blank" rel="noopener noreferrer">Full matchup on ESPN</a>';
 body.innerHTML=h;
 body.querySelectorAll('[data-pg-tab]').forEach(b=>b.onclick=()=>{s.tab=b.dataset.pgTab;render();});
 $('pgRefresh')?.addEventListener('click',()=>load(true));
}
async function request(url){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});
  if(!r.ok)throw Error('ESPN '+r.status);
  return await r.json();
 }finally{clearTimeout(timeout);}
}
async function lookup(g,which,force=false){
 const id=teamID(g,which);
 if(!id)return {detail:null,leaders:null,schedule:null};
 const key=g.path+'|'+id,now=Date.now(),cached=CACHE.get(key);
 if(!force&&cached&&now-cached.at<15*60000)return cached.data;
 const base=ROOT+g.path+'/teams/'+encodeURIComponent(id);
 const responses=await Promise.allSettled([request(base),request(base+'/leaders'),request(base+'/schedule')]);
 const val={detail:responses[0].status==='fulfilled'?responses[0].value:cached?.data.detail||null,
  leaders:responses[1].status==='fulfilled'?responses[1].value:cached?.data.leaders||null,
  schedule:responses[2].status==='fulfilled'?responses[2].value:cached?.data.schedule||null};
 CACHE.set(key,{at:now,data:val});return val;
}
async function load(force=false){
 if(s.loading||!s.game)return;
 const game=s.game,version=++s.serial;s.loading=true;render();
 const parts=await Promise.allSettled([lookup(game,'away',force),lookup(game,'home',force)]);
 if(s.serial!==version||s.game?.id!==game.id)return;
 s.away=parts[0].status==='fulfilled'?parts[0].value:null;
 s.home=parts[1].status==='fulfilled'?parts[1].value:null;
 s.loading=false;render();
}
function deactivate(){s.serial++;s.game=null;s.loading=false;}
function open(game){
 if(game?.state!=='upcoming'||!VALID.has(game.path)||!game.away||!game.home)return false;
 window.ManCaveStats?.deactivate?.();
 s.game=game;s.tab='compare';s.away=null;s.home=null;s.serial++;s.loading=false;
 render();load();return true;
}
window.ManCavePregame=Object.freeze({open,deactivate,helpers:Object.freeze({teamID,previous,leaders,compare})});
})();