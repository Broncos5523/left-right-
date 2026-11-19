import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=read('game-wall-v47-nhl-leaders-cloudflare.js');
const html=read('game-wall-v47-home-screen.html');
const leagues=[
 ['NFL','football/nfl'],['NBA','basketball/nba'],
 ['NHL','hockey/nhl'],['MLB','baseball/mlb'],
 ['WNBA','basketball/wnba'],['NCAAF','football/college-football'],
 ['NCAAB','basketball/mens-college-basketball']
];
function harness(league,path,{wrongTeam=false,nflCache=false,longPassing=false}={}){
 const ids=['7','13'];
 const game={
  id:league+'-401920517',eventId:'401920517',league,path,state:'upcoming',
  start:'2026-11-21T23:30:00Z',
  away:{id:ids[0],abbr:'AAA',name:'Away',fullName:'Away Team',record:'3-2'},
  home:{id:ids[1],abbr:'BBB',name:'Home',fullName:'Home Team',record:'4-1'}
 };
 const requestURLs=[],tabs=[];
 const body={innerHTML:'',dataset:{},querySelectorAll(selector){
  if(selector!=='[data-pg-tab]')return[];
  return ['compare','people','past'].map(pgTab=>{const el={dataset:{pgTab},onclick:null};tabs.push(el);return el;});
 }};
 const fields={
  modalBody:body,modalTitle:{textContent:''},modalShade:{classList:{add(){},contains(){return true;}}},
  pgRefresh:{addEventListener(){}}
 };
 const response=data=>({ok:true,status:200,json:async()=>data});
 const fetch=async url=>{
  requestURLs.push(url);
  if(url.includes('stats-cache/nfl-team-leaders')){
   if(!nflCache)return {ok:false,status:404};
   return response({season:2026,teams:{
    '7':{season:2026,teamId:'7',updatedAt:new Date().toISOString(),
     leaders:[{metric:'Passing Yards',name:'Verified Away Passer',value:'1,234'}]},
    '13':{season:2026,teamId:'13',updatedAt:new Date().toISOString(),
     leaders:[{metric:'Passing Yards',name:'Verified Home Passer',value:'2,345'}]}
   }});
  }
  if(url.includes('/nhl-team-leaders?'))return {ok:false,status:503};
  if(url.includes('/summary?event=')){
   const g=(id,name)=>
    ({team:{id:String(wrongTeam?id==='7'?'999':id:id)},leaders:[
     {name:longPassing?'passingYards':'pointsPerGame',displayName:longPassing?'Passing Yards':'Points Per Game',leaders:[
      {displayValue:longPassing?'251/350, 3,150 YDS, 24 TD, 6 INT':'22.3',athlete:{displayName:name,headshot:{href:'https://a.espncdn.com/i/headshots/nba/players/full/1.png'}}}]}
    ]});
   return response({header:{competitions:[{competitors:[{team:{id:ids[0]}},{team:{id:ids[1]}}]}]},
    leaders:[g(ids[0],longPassing?'Noah Fifita':'Real Away Scorer'),g(ids[1],longPassing?'Avery Johnson':'Real Home Scorer')]});
  }
  if(url.includes('/schedule'))return response({events:[]});
  if(url.includes('/teams/')){const id=url.split('/teams/')[1].split('?')[0].split('/')[0];
   return response({team:{id,displayName:id==='7'?'Away Team':'Home Team',record:{items:[{type:'total',summary:'5-3'}]}}});
  }
  throw Error('Unexpected request '+url);
 };
 const w={ManCaveStats:{deactivate(){} }};
 const context=vm.createContext({window:w,document:{getElementById:x=>fields[x]||null},fetch,
  Date,AbortController,setTimeout,clearTimeout,console});
 vm.runInContext(source,context);
 return {game,ui:w.ManCavePregame,body,tabs,requestURLs};
}
async function renderTeamTab(h){
 assert.equal(h.ui.open(h.game),true);
 await new Promise(resolve=>setTimeout(resolve,22));
 const t=h.tabs.filter(x=>x.dataset.pgTab==='people').at(-1);
 assert.ok(t?.onclick,'Team Leaders tab must have a working click handler');
 t.onclick();return h.body.innerHTML;
}
for(const [league,path] of leagues){
 test(league+' upcoming game has real, ID-validated team leaders rather than the empty old ESPN endpoint',async()=>{
  const h=harness(league,path);
  const content=await renderTeamTab(h);
  assert.match(content,/Real Away Scorer/);
  assert.match(content,/Real Home Scorer/);
  assert.match(content,/22\.3/);
  assert.match(content,/TEAM LEADERS/);
  assert.equal(h.requestURLs.filter(x=>x.includes('/summary?event=')).length,1,'single shared matchup request');
  assert.equal(h.requestURLs.filter(x=>x.endsWith('/leaders')).length,0,'never ask empty legacy team leaders endpoint');
  assert.match(content,/Team Leaders/);
 });
}
test('Never attach a different team summary to the selected team',async()=>{
 const h=harness('NBA','basketball/nba',{wrongTeam:true});
 const content=await renderTeamTab(h);
 assert.doesNotMatch(content,/Real Away Scorer/);
 assert.match(content,/Real Home Scorer/);
 assert.match(content,/No verified season leaders currently published/);
});
test('NFL continues to prefer complete ESPN box-score season leader cache over ESPN preview leaders',async()=>{
 const h=harness('NFL','football/nfl',{nflCache:true});
 const content=await renderTeamTab(h);
 assert.match(content,/Verified Away Passer/);
 assert.match(content,/Verified Home Passer/);
 assert.doesNotMatch(content,/Real Away Scorer/);
 assert.match(content,/1,234/);
});
test('No visual rewrite: approved scouting tabs and TV controller remain in place',()=>{
 assert.match(source,/data-pg-tab/);
 assert.match(source,/Team Comparison/);
 assert.match(source,/Team Leaders/);
 assert.match(source,/Previous Games/);
 assert.match(source,/async function matchupLeaders/);
 assert.match(source,/data\?\.leaders/);
 assert.match(html,/game-wall-v47-nhl-leaders-cloudflare\.js/);
 assert.match(html,/data-assign-game/);
});

test('completed-game matchup results parse ESPN score objects for Previous Games and comparison',()=>{
 const ctx=vm.createContext({window:{},document:{getElementById(){return null;}},Date,console,setTimeout,clearTimeout,AbortController});
 vm.runInContext(source,ctx);
 const team={id:'7',abbr:'DEN',fullName:'Denver Broncos'};
 const schedule={events:[{id:'401873041',date:'2026-11-15T18:00:00Z',
  competitions:[{status:{type:{state:'post',completed:true}},competitors:[
   {team:{id:'7',displayName:'Denver Broncos'},homeAway:'away',score:{value:26,displayValue:'26'}},
   {team:{id:'29',displayName:'Carolina Panthers'},homeAway:'home',score:{value:21,displayValue:'21'}}
  ]}]}]};
 const games=ctx.window.ManCavePregame.helpers.previous(schedule,team,Date.parse('2026-11-19T05:00:00Z'));
 assert.equal(games.length,1);
 assert.equal(games[0].x,26);
 assert.equal(games[0].y,21);
 assert.equal(games[0].result,'W');
 assert.equal(games[0].against,'Carolina Panthers');
});
test('future MLB or WNBA scouting sheets never display an ESPN placeholder 12AM time',async()=>{
 const h=harness('MLB','baseball/mlb');
 h.game.timeConfirmed=false;
 h.game.start='2027-03-25T04:00:00Z';
 const display=await renderTeamTab(h);
 assert.match(display,/TIME TBD/);
 assert.doesNotMatch(display,/12:00 AM/);
});

test('TBD tournament opponents show an honest missing-data message rather than another team leader',async()=>{
 const h=harness('NCAAB','basketball/mens-college-basketball');
 h.game.away.fullName='TBD';
 h.game.away.id='-1';
 const view=await renderTeamTab(h);
 assert.match(view,/Opponent not yet determined/);
 assert.doesNotMatch(view,/Real Away Scorer/);
 assert.match(view,/Real Home Scorer/);
});

test('college football passing card protects QB full names from wide ESPN stat breakdown',async()=>{
 const h=harness('NCAAF','football/college-football',{longPassing:true});
 const content=await renderTeamTab(h);
 assert.match(content,/Noah Fifita/);
 assert.match(content,/Avery Johnson/);
 assert.match(content,/251\/350, 3,150 YDS, 24 TD, 6 INT/);
 assert.match(content,/pgLeaderCategory--passing/);
 assert.match(source,/\^passing\\s\*yards\$/i);
 const stylesheet=read('game-wall-v36-team-leaders.css');
 assert.match(stylesheet,/\.pgLeaderCategory--passing \.pgLeaderPerson/);
 assert.match(stylesheet,/grid-template-areas:"portrait passer" "numbers numbers"/);
 assert.match(stylesheet,/\.pgLeaderCategory--passing \.pgLeaderValue/);
 assert.match(stylesheet,/white-space:normal/);
 assert.match(html,/game-wall-v36-team-leaders\.css\?v=qb-name-layout-20261119/);
 assert.match(html,/game-wall-v47-nhl-leaders-cloudflare\.js\?v=qb-name-layout-20261119/);
});
test('all non-passing sports retain the approved leader card layout',async()=>{
 for(const [league,path] of [['NBA','basketball/nba'],['NHL','hockey/nhl'],['NCAAB','basketball/mens-college-basketball']]){
  const h=harness(league,path);
  const content=await renderTeamTab(h);
  assert.doesNotMatch(content,/pgLeaderCategory--passing/);
  assert.match(content,/class="pgLeaderCategory"/);
 }
});
