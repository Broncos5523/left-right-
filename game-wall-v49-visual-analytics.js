// MAN CAVE SPORTS BOOK · Controller Visual Analytics v1
// Real ESPN game-summary only. No fabricated tracking coordinates or projections.
// One self-contained read-only modal for Upcoming / Live / Final, seven leagues.
(()=>{
'use strict';
const BASE='https://site.api.espn.com/apis/site/v2/sports/';
const VALID=new Set(['football/nfl','football/college-football','basketball/nba','basketball/wnba','basketball/mens-college-basketball','hockey/nhl','baseball/mlb']);
const CACHE=new Map();
const s={game:null,data:null,tab:'map',team:'all',player:'all',period:'all',error:'',loading:false,token:0,lastFetch:0};
const $=x=>document.getElementById(x);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[x]));
const arr=x=>Array.isArray(x)?x:[];
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const fmt=v=>Number.isFinite(v)?(Number.isInteger(v)?v.toLocaleString('en-US'):v.toFixed(1)):'—';
const matching=(a,b)=>String(a??'')===String(b??'')&&String(a??'')!=='';
const name=g=>String(g?.away?.name||'AWAY')+' vs '+String(g?.home?.name||'HOME');
function getPlayList(data){
 return Array.isArray(data?.plays)?data.plays:arr(data?.plays?.allPlays);
}
function teamId(g,which){return String(g?.[which]?.id||'');}
function safeGame(g){return VALID.has(g?.path)&&/^\d{5,15}$/.test(String(g.eventId||''));}
function shotKind(g){return ['NBA','WNBA','NCAAB'].includes(g.league)?'basket':g.league==='NHL'?'hockey':null;}
function shots(data,g){
 const kind=shotKind(g);
 if(!kind)return [];
 const points=[];
 for(const p of getPlayList(data)){
  const x=num(p.coordinate?.x),y=num(p.coordinate?.y);
  if(x===null||y===null)continue;
  const event=String(p.type?.abbreviation||p.type?.type||p.type?.text||'').toLowerCase();
  let made=false,outcome='';
  if(kind==='basket'){
   if(p.shootingPlay!==true||/free[\s-]?throw/i.test(event)||/free[\s-]?throw/i.test(String(p.text||'')))continue;
   if(x<0||x>50||y<0||y>47)continue;
   made=p.scoringPlay===true;
   outcome=made?'MAKE':'MISS';
  }else{
   // A blocked attempt can be credited to the defending team, so it does
   // not belong in an attacking-team shot-location chart without reconciliation.
   if(!/^(?:shot-on-goal|shot-missed|goal)$/.test(event))continue;
   if(Math.abs(x)>100||Math.abs(y)>44)continue;
   made=event==='goal';
   outcome=made?'GOAL':event==='shot-on-goal'?'SAVE':'MISS';
  }
  const id=String(p.team?.id||'');
  if(!id||![teamId(g,'away'),teamId(g,'home')].includes(id))continue;
  let shooter='';
  if(kind==='basket'){
   const text=String(p.text||'');
   shooter=text.match(/^(.{2,80}?) (?:makes|misses) /i)?.[1]?.trim()||'';
  }else{
   const first=arr(p.participants).find(x=>x.type==='shooter');
   shooter=String(first?.athlete?.displayName||'').trim();
  }
  points.push({id:String(p.id||points.length),x,y,teamId:id,shooter,period:num(p.period?.number)||1,made,outcome,
   text:String(p.text||'').slice(0,180)});
 }
 return points;
}
const svgHead=(w,h,description)=>'<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(description)+'" xmlns="http://www.w3.org/2000/svg">';
function courtSVG(points){
 // ESPN court coordinates: x [0,50], y [0,47]. A single normalized half-court.
 let out=svgHead(600,560,'True ESPN basketball field-goal make and miss locations')+
  '<rect x="28" y="23" width="544" height="512" rx="12" fill="#14364b" stroke="#85a8bf" stroke-width="4"/>'+
  '<path d="M28 47H572 M212 47V213H388V47 M212 213A88 88 0 0 0 388 213 M212 213A88 88 0 0 1 388 213" stroke="#b2d5e4" stroke-width="3" fill="none"/>'+
  '<path d="M90 47V196 Q300 638 510 196V47" fill="none" stroke="#cce8ef" stroke-width="4"/>'+
  '<circle cx="300" cy="78" r="12" fill="none" stroke="#f4b976" stroke-width="4"/>'+
  '<path d="M265 45h70" stroke="#f4b976" stroke-width="5"/>';
 for(const p of points){
  const x=28+p.x*10.88,y=47+p.y*10;
  const color=p.made?'#52efa7':'#fa6c78',stroke=p.made?'#c8ffdf':'#ffd4d9';
  out+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="6.8" fill="'+color+'" stroke="'+stroke+'" stroke-width="1.6" opacity=".91"><title>'+esc(p.shooter||'Shot')+': '+esc(p.outcome)+'</title></circle>';
 }
 return out+'</svg>';
}
function rinkSVG(points){
 let out=svgHead(640,340,'True ESPN hockey shot, save, and goal locations')+
  '<rect x="20" y="19" width="600" height="298" rx="86" fill="#d5eaf2" stroke="#a8c9d9" stroke-width="4"/>'+
  '<path d="M190 22V316M450 22V316" stroke="#3275b3" stroke-width="5"/>'+
  '<path d="M320 22V316" stroke="#bc5161" stroke-width="5"/>'+
  '<circle cx="320" cy="168" r="54" fill="none" stroke="#438bba" stroke-width="4"/>'+
  '<path d="M64 135h12v66H64M564 135h12v66h-12" fill="none" stroke="#bd5766" stroke-width="5"/>'+
  '<circle cx="93" cy="168" r="50" fill="none" stroke="#bd5766" stroke-width="3"/>'+
  '<circle cx="547" cy="168" r="50" fill="none" stroke="#bd5766" stroke-width="3"/>';
 for(const p of points){
  const x=320+p.x*2.9,y=168-p.y*3.25;
  const color=p.outcome==='GOAL'?'#37d992':p.outcome==='SAVE'?'#edb851':'#ee666f';
  const radius=p.outcome==='GOAL'?9:6.5;
  out+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+radius+'" fill="'+color+'" stroke="#1b3045" stroke-width="1.8" opacity=".94"><title>'+esc(p.shooter||'Shot')+': '+esc(p.outcome)+'</title></circle>';
 }
 return out+'</svg>';
}
function theme(g){return g.league==='NHL'?'rink':shotKind(g)==='basket'?'court':'flow';}
function scoreEvents(data){
 const sources=[...getPlayList(data),...arr(data?.scoringPlays)];
 const list=[{a:0,h:0,period:0,label:'Start'}];
 for(const p of sources){
  const a=num(p.awayScore),h=num(p.homeScore);
  if(a===null||h===null||a<0||h<0)continue;
  const prev=list[list.length-1];
  if(a!==prev.a||h!==prev.h)list.push({a,h,period:num(p.period?.number)||0,label:String(p.text||'')});
 }
 if(list.length>1)return list;
 // When individual scoring events aren't provided, rely on recorded period
 // scores. Do not pretend to reconstruct within-period momentum.
 const [away,home]=teamLines(data);
 const n=Math.max(away.length,home.length);
 let a=0,h=0;
 for(let i=0;i<n;i++){
  const aa=num(away[i]),hh=num(home[i]);
  if(aa===null&&hh===null)continue;
  a+=aa||0;h+=hh||0;list.push({a,h,period:i+1,label:'End of period '+(i+1)});
 }
 return list;
}
function teamLines(data){
 const cmp=arr(data?.header?.competitions?.[0]?.competitors);
 const g=s.game;
 return ['away','home'].map(which=>{
  const team=cmp.find(x=>matching(x.team?.id,teamId(g,which))||x.homeAway===which);
  return arr(team?.linescores).map(x=>num(x?.displayValue??x?.value));
 });
}
function graphSVG(events,g){
 if(events.length<2)return '';
 const maxScore=Math.max(1,...events.map(e=>Math.max(e.a,e.h)));
 const ymax=Math.ceil(maxScore/5)*5;
 const chartW=580,chartH=238,x0=42,y0=25,w=515,h=180;
 const px=i=>x0+(i/Math.max(1,events.length-1))*w;
 const py=v=>y0+h-(v/ymax)*h;
 let out=svgHead(chartW,chartH,'Actual cumulative scoring progression by ESPN event order');
 for(let i=0;i<=4;i++){
  const y=py(ymax*i/4);
  out+='<line x1="'+x0+'" x2="'+(x0+w)+'" y1="'+y+'" y2="'+y+'" stroke="#4a667d" opacity=".48"/>'+
   '<text x="7" y="'+(y+5)+'" fill="#a9c3d4" font-size="13">'+fmt(ymax*i/4)+'</text>';
 }
 const path=field=>events.map((e,i)=>(i?'L':'M')+px(i).toFixed(1)+','+py(e[field]).toFixed(1)).join(' ');
 out+='<path d="'+path('a')+'" stroke="#63e3b6" stroke-width="4" fill="none" stroke-linejoin="round"/>'+
 '<path d="'+path('h')+'" stroke="#f4c477" stroke-width="4" fill="none" stroke-linejoin="round"/>';
 const end=events[events.length-1];
 out+='<circle cx="'+px(events.length-1)+'" cy="'+py(end.a)+'" r="5.5" fill="#63e3b6"/>'+
 '<circle cx="'+px(events.length-1)+'" cy="'+py(end.h)+'" r="5.5" fill="#f4c477"/>'+
 '<text x="45" y="231" font-size="13" fill="#a6bdd0">Start</text><text x="555" y="231" font-size="13" fill="#a6bdd0" text-anchor="end">Latest</text></svg>';
 return out;
}
function periodSVG(data,g){
 const [a,h]=teamLines(data);
 if(!Math.max(a.length,h.length))return '';
 const counts=Math.max(a.length,h.length),max=Math.max(1,...[...a,...h].filter(x=>x!==null));
 let out=svgHead(600,250,'Real scoring totals by quarter period or inning');
 for(let i=0;i<counts;i++){
  const dx=48+i*500/counts,xw=Math.min(28,185/counts),baseline=195;
  for(const [j,data,color] of [[0,a,'#63e3b6'],[1,h,'#f4c477']]){
   const val=data[i]??0,bh=(val/max)*137;
   out+='<rect x="'+(dx+(j===0?0:xw+3))+'" y="'+(baseline-bh)+'" width="'+xw+'" height="'+bh+'" rx="3" fill="'+color+'"/>';
  }
  out+='<text x="'+(dx+xw)+'" y="220" text-anchor="middle" fill="#a2bbce" font-size="13">'+(g.league==='MLB'?'I':'P')+(i+1)+'</text>';
 }
 return out+'</svg>';
}
function reportCard(title,detail){return '<div class="vaEmpty"><strong>'+esc(title)+'</strong><p>'+esc(detail)+'</p></div>';}
function evidenceLine(value){return '<div class="vaNote">'+esc(value)+'</div>';}
function nameFor(g,w){return String(g[w]?.abbr||g[w]?.name||w.toUpperCase());}
// Upcoming games: render the actual season-to-date team averages ESPN
// publishes in /summary.boxscore.teams. This is a scouting comparison, NOT a
// fictional shot map, pregame possession path, or model projection.
const PREGAME_ORDER={
 NFL:['totalPointsPerGame','yardsPerGame','passingYardsPerGame','rushingYardsPerGame','totalPointsPerGameAllowed','yardsPerGameAllowed'],
 NCAAF:['totalPointsPerGame','yardsPerGame','passingYardsPerGame','rushingYardsPerGame','totalPointsPerGameAllowed','yardsPerGameAllowed'],
 NBA:['avgPoints','pointsPerGame','fieldGoalPct','threePointFieldGoalPct','totalRebounds','avgRebounds','assists','turnovers'],
 WNBA:['avgPoints','pointsPerGame','fieldGoalPct','threePointFieldGoalPct','totalRebounds','avgRebounds','assists','turnovers'],
 NCAAB:['avgPoints','pointsPerGame','fieldGoalPct','threePointFieldGoalPct','totalRebounds','avgRebounds','assists','turnovers'],
 NHL:['avgGoals','goalsPerGame','avgShots','shotsPerGame','powerPlayPct','penaltyKillPct','savePct'],
 MLB:['avgRuns','runsPerGame','avgHits','battingAverage','onBasePct','earnedRunAverage']
};
function pregameRows(data,g){
 const teams=arr(data?.boxscore?.teams);
 const find=side=>teams.find(x=>matching(x.team?.id,teamId(g,side)));
 const away=find('away'),home=find('home');
 if(!away||!home)return [];
 const toMap=t=>new Map(arr(t.statistics)
  .filter(x=>typeof x.name==='string')
  .map(x=>[x.name.toLowerCase(),x]));
 const a=toMap(away),h=toMap(home),order=arr(PREGAME_ORDER[g.league]);
 const keys=[...new Set([...order.map(k=>k.toLowerCase()),...a.keys()])]
  .filter(k=>a.has(k)&&h.has(k));
 return keys.map(k=>{
  const x=a.get(k),y=h.get(k);
  const awayVal=num(x.displayValue??x.value),homeVal=num(y.displayValue??y.value);
  const label=String(x.label||x.displayName||x.name||'').trim();
  return{key:k,label,away:awayVal,home:homeVal};
 }).filter(x=>x.away!==null&&x.home!==null&&x.away>=0&&x.home>=0&&
    x.label&&x.label.length<=48)
   .slice(0,8);
}
function pregameVisual(){
 const g=s.game,rows=pregameRows(s.data,g);
 if(!rows.length){
  // For competitions without team season averages, compare ESPN's reported
  // category leaders. No invented stats, charts, or assumed player locations.
  return matchup();
 }
 const teamA=nameFor(g,'away'),teamH=nameFor(g,'home');
 let out='<div class="vaSection">PREGAME SCOUTING · SEASON TEAM AVERAGES</div>'+
  '<div class="vaSeasonLegend"><span><i class="away"></i>'+esc(teamA)+'</span>'+
  '<span><i class="home"></i>'+esc(teamH)+'</span></div>';
 out+=rows.map((row,index)=>{
  const scale=Math.max(1,row.away,row.home);
  const left=Math.max(0,Math.min(100,row.away/scale*100));
  const right=Math.max(0,Math.min(100,row.home/scale*100));
  const label=row.label.replace(/([a-z])([A-Z])/g,'$1 $2');
  const lowerBetter=/allowed|against|turnover|penalty|errors|earned run average/i.test(label);
  return '<section class="vaSeasonCard"><div class="vaSeasonTitle"><strong>'+esc(label)+'</strong>'+
   (lowerBetter?'<small>LOWER IS BETTER</small>':'<small>SEASON AVERAGE</small>')+'</div>'+
   '<div class="vaSeasonRow"><span>'+esc(teamA)+'</span><div class="vaSeasonTrack">'+
   '<i class="away" style="width:'+left.toFixed(2)+'%"></i></div><b>'+esc(fmt(row.away))+'</b></div>'+
   '<div class="vaSeasonRow"><span>'+esc(teamH)+'</span><div class="vaSeasonTrack">'+
   '<i class="home" style="width:'+right.toFixed(2)+'%"></i></div><b>'+esc(fmt(row.home))+'</b></div></section>';
 }).join('');
 return out+evidenceLine('Bars compare ESPN-reported season-to-date team averages, not a prediction. Each pair uses its own scale; the label identifies categories where lower is better.');
}
function plot(){
 const g=s.game,d=s.data,kind=shotKind(g);
 if(!d)return reportCard('Waiting for data','ESPN matchup data is loading.');
 // No sport has current-game shot coordinates before the game starts.
 // Upcoming basketball AND hockey show real season scouting bars instead.
 if(g.state==='upcoming')return pregameVisual();
 if(kind){
  const points=shots(d,g),has=points.length>0;
  if(!has)return reportCard(g.state==='upcoming'?'Pregame shot chart not published':'No verified shot locations',
   g.state==='upcoming'?'This game has not started. ESPN does not supply season shot-location maps in this game summary; see Matchup and Leaders for real scouting statistics.':
   'ESPN has not supplied usable shot locations for this game. No estimated markers are shown.');
  const current=points.filter(p=>(s.team==='all'||p.teamId===teamId(g,s.team))&&
   (s.player==='all'||p.shooter===s.player)&&(s.period==='all'||p.period===Number(s.period)));
  const players=[...new Set(points.filter(p=>s.team==='all'||p.teamId===teamId(g,s.team)).map(p=>p.shooter).filter(Boolean))].sort();
  const periods=[...new Set(points.map(p=>p.period))].sort((a,b)=>a-b);
  let html='<div class="vaFocus"><div class="vaChips" role="group" aria-label="Team shot filter">'+
   [['all','Both teams'],['away',nameFor(g,'away')],['home',nameFor(g,'home')]].map(([id,t])=>
    '<button data-va-team="'+id+'" aria-pressed="'+(s.team===id)+'">'+esc(t)+'</button>').join('')+
   '</div><div class="vaSelects"><label>Player<select id="vaPlayer"><option value="all">All players</option>'+
   players.map(p=>'<option value="'+esc(p)+'"'+(s.player===p?' selected':'')+'>'+esc(p)+'</option>').join('')+
   '</select></label><label>Period<select id="vaPeriod"><option value="all">Full game</option>'+
   periods.map(n=>'<option value="'+n+'"'+(s.period===String(n)?' selected':'')+'>P'+n+'</option>').join('')+
   '</select></label></div></div>';
  const made=current.filter(x=>x.made).length,misses=current.filter(x=>!x.made).length;
  html+='<div class="vaKpis">'+
   '<div><small>'+ (kind==='hockey'?'GOALS':'MADE SHOTS')+'</small><strong>'+made+'</strong></div>'+
   '<div><small>'+ (kind==='hockey'?'NON-GOALS':'MISSED SHOTS')+'</small><strong>'+misses+'</strong></div>'+
   '<div><small>LOCATED ATTEMPTS</small><strong>'+current.length+'</strong></div></div>';
  html+='<div class="vaChart">'+(kind==='hockey'?rinkSVG(current):courtSVG(current))+'</div>'+
   '<div class="vaLegend">'+(kind==='hockey'?
    '<span><i style="background:#37d992"></i>Goal</span><span><i style="background:#edb851"></i>Saved</span><span><i style="background:#ee666f"></i>Missed</span>':
    '<span><i style="background:#52efa7"></i>Made</span><span><i style="background:#fa6c78"></i>Missed</span>')+'</div>';
  return html+evidenceLine(kind==='hockey'?
   'ESPN reported rink locations. Blocked shots are excluded because some are credited to the blocking team. Attack direction may vary by period.':
   'Actual ESPN field-goal play coordinates. Free throws and invalid coordinates are excluded. This is not a season tendency estimate.');
 }
 const events=scoreEvents(d);
 return '<div class="vaSection">SCORING PROGRESSION</div>'+(
  events.length>=2?'<div class="vaChart vaGraph">'+graphSVG(events,g)+'</div><div class="vaLegend"><span><i style="background:#63e3b6"></i>'+esc(nameFor(g,'away'))+'</span><span><i style="background:#f4c477"></i>'+esc(nameFor(g,'home'))+'</span></div>':
  reportCard('Not yet available','No completed scoring events or period totals have been reported.'))+
  (g.league==='MLB'?'<div class="vaSection">RUNS BY INNING</div><div class="vaChart vaGraph">'+(periodSVG(d,g)||'')+'</div>':'')+
  evidenceLine(g.league==='MLB'?'ESPN inning totals and game scoring events. No fabricated spray chart or pitch locations.':
   'ESPN scoring events and period totals. These are scoring sequences, not player-tracking paths.');
}
function flow(){
 const g=s.game,d=s.data;
 if(!d)return reportCard('Loading','Waiting for ESPN response.');
 if(g.state==='upcoming')return reportCard('Not started','Actual game-flow graphs appear when the matchup begins. For pregame information, use Matchup and Player Leaders.');
 const list=scoreEvents(d);
 let content='<div class="vaSection">GAME SCORING FLOW</div>';
 if(list.length>=2)content+='<div class="vaChart vaGraph">'+graphSVG(list,g)+'</div>'+
  '<div class="vaLegend"><span><i style="background:#63e3b6"></i>'+esc(nameFor(g,'away'))+'</span><span><i style="background:#f4c477"></i>'+esc(nameFor(g,'home'))+'</span></div>';
 else content+=reportCard('Scoring not recorded','ESPN has not supplied enough events to plot the score.');
 const byPeriod=periodSVG(d,g);
 if(byPeriod)content+='<div class="vaSection">SCORING BY '+(g.league==='MLB'?'INNING':'PERIOD')+'</div><div class="vaChart vaGraph">'+byPeriod+'</div>';
 return content+evidenceLine('Actual ESPN scoreboard totals. Horizontal positions follow reported events; the line is not a win-probability model.');
}
function matchup(){
 const g=s.game,d=s.data;
 if(!d)return reportCard('Loading matchup','Awaiting game report.');
 const entries=arr(d?.boxscore?.teams);
 const lookup=w=>entries.find(t=>matching(t.team?.id,teamId(g,w)));
 const a=lookup('away'),h=lookup('home');
 const toStats=t=>new Map(arr(t?.statistics).map(x=>[String(x.name||'').toLowerCase(),x]));
 const aa=toStats(a),hh=toStats(h);
 const priority={NBA:['fieldgoalpct','threepointfieldgoalpct','totalrebounds','assists','turnovers'],
  WNBA:['fieldgoalpct','threepointfieldgoalpct','totalrebounds','assists','turnovers'],
  NCAAB:['fieldgoalpct','threepointfieldgoalpct','totalrebounds','assists','turnovers'],
  NHL:['shotstotal','hits','blockedshots','faceoffpct','powerplaypct'],
  NFL:['totalyards','firstdowns','thirddowneff','turnovers','netpassingyards'],
  NCAAF:['totalyards','firstdowns','thirddowneff','turnovers','netpassingyards'],
  MLB:['hits','errors','runs']};
 let keys=[...new Set([...aa.keys(),...hh.keys()])];
 const pick=priority[g.league]||[];
 keys.sort((x,y)=>(pick.indexOf(x)<0?99:pick.indexOf(x))-(pick.indexOf(y)<0?99:pick.indexOf(y)));
 keys=keys.filter(key=>{
  const x=aa.get(key),y=hh.get(key);
  const xa=num(x?.displayValue??x?.value),ya=num(y?.displayValue??y?.value);
  return xa!==null&&ya!==null;
 }).slice(0,8);
 if(keys.length){
  return '<div class="vaSection">TEAM PERFORMANCE · ACTUAL GAME STATS</div>'+
   '<div class="vaMatchHead"><b>'+esc(nameFor(g,'away'))+'</b><b>'+esc(nameFor(g,'home'))+'</b></div>'+
   keys.map(key=>{
    const x=aa.get(key),y=hh.get(key),va=num(x.displayValue??x.value),vh=num(y.displayValue??y.value);
    const total=Math.max(1,va+vh),left=Math.max(0,Math.min(100,(va/total)*100));
    return '<div class="vaCompare"><div class="vaCompareValues"><strong>'+esc(x.displayValue??x.value)+'</strong><span>'+esc(x.label||x.displayName||x.name||key)+'</span><strong>'+esc(y.displayValue??y.value)+'</strong></div>'+
     '<div class="vaBars"><span style="width:'+left.toFixed(1)+'%"></span></div></div>';
   }).join('')+evidenceLine('Bars compare each team’s ESPN-reported totals or percentages. More is not necessarily better for turnovers, errors, or penalties.');
 }
 const leaders=arr(d?.leaders);
 const top=leaders.find(x=>matching(x.team?.id,teamId(g,'away')));
 const opp=leaders.find(x=>matching(x.team?.id,teamId(g,'home')));
 const paired=[];
 for(const c of arr(top?.leaders)){
  const other=arr(opp?.leaders).find(x=>x.name===c.name);
  const x=c.leaders?.[0],y=other?.leaders?.[0];
  if(!x||!y)continue;
  const va=num(x.value),vh=num(y.value);
  if(va===null||vh===null)continue;
  paired.push({name:c.displayName||c.name,x,y,va,vh});
 }
 if(!paired.length)return reportCard('Verified comparisons unavailable','ESPN has not published comparable season leaders or team game statistics for both teams.');
 return '<div class="vaSection">PREGAME LEADER MATCHUP · BEST PLAYER IN EACH CATEGORY</div>'+
  '<div class="vaMatchHead"><b>'+esc(nameFor(g,'away'))+'</b><b>'+esc(nameFor(g,'home'))+'</b></div>'+
  paired.slice(0,5).map(p=>{
   const total=Math.max(1,p.va+p.vh),pct=Math.max(0,Math.min(100,p.va/total*100));
   return '<div class="vaCompare"><div class="vaCompareValues"><strong>'+esc(p.x.displayValue||fmt(p.va))+'</strong><span>'+esc(p.name)+'</span><strong>'+esc(p.y.displayValue||fmt(p.vh))+'</strong></div>'+
    '<div class="vaBars"><span style="width:'+pct.toFixed(1)+'%"></span></div><div class="vaCompareNames"><small>'+esc(p.x.athlete?.displayName||'')+'</small><small>'+esc(p.y.athlete?.displayName||'')+'</small></div></div>';
  }).join('')+evidenceLine('These are individual season leaders, not team-wide projections or implied winning probabilities.');
}
function players(){
 const g=s.game,d=s.data;
 if(!d)return reportCard('Loading','Waiting for player leaders.');
 const entries=arr(d?.leaders);
 return '<div class="vaSection">VERIFIED ESPN TEAM LEADERS · '+esc(g.state.toUpperCase())+'</div>'+
  ['away','home'].map(w=>{
   const item=entries.find(x=>matching(x.team?.id,teamId(g,w)));
   const categories=arr(item?.leaders).filter(x=>arr(x.leaders).some(y=>y.athlete?.displayName));
   return '<section class="vaPlayers"><h3>'+esc(g[w].fullName||g[w].name)+'</h3>'+
    (categories.length?categories.slice(0,7).map(c=>{
     const entry=arr(c.leaders).find(x=>x.athlete?.displayName);
     return '<div class="vaLeader"><span>'+esc(c.displayName||c.name)+'</span><strong>'+esc(entry?.athlete?.displayName||'')+'</strong><b>'+esc(entry?.mainStat?.value||entry?.displayValue||fmt(num(entry?.value)))+'</b></div>';
    }).join(''):reportCard('No reported leader','ESPN has not published verified player leaders for this team in this matchup.'))+'</section>';
  }).join('')+evidenceLine('Displayed player identities and values come from the selected ESPN game report.');
}
function render(){
 const g=s.game,body=$('modalBody'),shade=$('modalShade'),title=$('modalTitle');
 if(!g||!body||!shade||!title)return;
 shade.classList.add('open');title.textContent='Game Analytics · '+g.league;
 delete body.dataset.statsEvent;delete body.dataset.pregameEvent;body.dataset.analyticsEvent=g.id;
 const tabs=[['map',g.state==='upcoming'?'Scouting':shotKind(g)?'Shot Map':'Visual'],['flow','Game Flow'],['matchup','Matchup'],['players','Leaders']];
 const desc=g.state==='upcoming'?'PRE-GAME SCOUTING':g.state==='live'?'LIVE GAME ANALYTICS':'FINAL GAME ANALYSIS';
 let out='<div class="vaHero"><small>MAN CAVE SPORTS BOOK · '+esc(desc)+'</small><strong>'+esc(name(g))+'</strong><span>'+esc(g.league)+' · '+esc(g.detail||g.state.toUpperCase())+'</span></div>'+
  '<div class="vaTabs" role="tablist" aria-label="Advanced analytics">'+tabs.map(([id,label])=>
   '<button type="button" role="tab" data-va-tab="'+id+'" aria-selected="'+(s.tab===id)+'" class="'+(s.tab===id?'active':'')+'">'+label+'</button>').join('')+'</div>';
 if(s.loading&&!s.data)out+=reportCard('Loading real analytics','Retrieving ESPN play coordinates and statistics for this matchup.');
 else if(s.error&&!s.data)out+=reportCard('Unable to load game analytics',s.error);
 else if(s.data)out+='<div class="vaBody">'+({map:plot,flow,matchup,players}[s.tab]||plot)()+'</div>';
 out+='<div class="vaFooter"><small>ESPN game summary · '+(s.lastFetch?new Date(s.lastFetch).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'Awaiting data')+
  (g.state==='live'?' · Live refresh ~30 seconds':'')+'</small><button type="button" id="vaRefresh"'+(s.loading?' disabled':'')+'>Refresh Analytics</button></div>';
 body.innerHTML=out;
 body.querySelectorAll('[data-va-tab]').forEach(b=>b.onclick=()=>{s.tab=b.dataset.vaTab;render();});
 body.querySelectorAll('[data-va-team]').forEach(b=>b.onclick=()=>{s.team=b.dataset.vaTeam;s.player='all';render();});
 const p=$('vaPlayer');if(p)p.onchange=()=>{s.player=p.value;render();};
 const t=$('vaPeriod');if(t)t.onchange=()=>{s.period=t.value;render();};
 $('vaRefresh')?.addEventListener('click',()=>load(true));
}
async function load(force=false){
 const g=s.game;if(!g)return;
 const key=g.path+'|'+g.eventId,cache=CACHE.get(key),now=Date.now();
 const ttl=g.state==='live'?23000:g.state==='final'?600000:180000;
 if(!force&&cache&&now-cache.at<ttl){s.data=cache.data;s.error='';s.loading=false;s.lastFetch=cache.at;render();return;}
 const serial=++s.token; s.loading=true;s.error='';render();
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),13000);
 try{
  const res=await fetch(BASE+g.path+'/summary?event='+encodeURIComponent(g.eventId),{cache:'no-store',signal:ctrl.signal});
  if(!res.ok)throw Error('ESPN HTTP '+res.status);
  const data=await res.json();
  if(serial!==s.token||s.game?.id!==g.id)return;
  // Verify team participants before ever using this summary for charts.
  const ids=arr(data?.header?.competitions?.[0]?.competitors).map(x=>String(x.team?.id||''));
  if(!ids.includes(teamId(g,'away'))||!ids.includes(teamId(g,'home')))throw Error('Matchup team identifiers did not match ESPN');
  CACHE.set(key,{at:Date.now(),data});s.data=data;s.lastFetch=Date.now();s.error='';
 }catch(err){
  if(serial!==s.token||s.game?.id!==g.id)return;
  s.error=err.name==='AbortError'?'ESPN timed out. Tap Refresh Analytics.':String(err.message||err);
  if(cache){s.data=cache.data;s.lastFetch=cache.at;}
 }finally{clearTimeout(timer);if(serial===s.token&&s.game?.id===g.id){s.loading=false;render();}}
}
function open(g){
 if(!safeGame(g))return false;
 window.ManCaveStats?.deactivate?.();
 s.token++;s.game=g;s.data=null;s.error='';s.loading=false;s.lastFetch=0;
 s.team='all';s.player='all';s.period='all';s.tab='map';
 render();load();return true;
}
function openById(id){
 const g=window.ManCaveRealGames?.state?.games?.find(x=>x.id===id);
 return g?open(g):false;
}
setInterval(()=>{
 const g=s.game;
 if(!g||g.state!=='live'||document.hidden||s.loading)return;
 if($('modalBody')?.dataset.analyticsEvent!==g.id)return;
 if(!$('modalShade')?.classList.contains('open'))return;
 if(Date.now()-s.lastFetch>28000)load();
},30000);
window.ManCaveVisualAnalytics=Object.freeze({open,openById,
 helpers:Object.freeze({shots,scoreEvents,teamLines,shotKind,graphSVG,courtSVG,rinkSVG,periodSVG,safeGame,pregameRows})});
})();