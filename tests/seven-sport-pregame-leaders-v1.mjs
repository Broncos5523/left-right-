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
function harness(league,path,{wrongTeam=false,nflCache=false}={}){
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
     {name:'pointsPerGame',displayName:'Points Per Game',leaders:[
      {displayValue:'22.3',athlete:{displayName:name,headshot:{href:'https://a.espncdn.com/i/headshots/nba/players/full/1.png'}}}]}
    ]});
   return response({header:{competitions:[{competitors:[{team:{id:ids[0]}},{team:{id:ids[1]}}]}]},
    leaders:[g(ids[0],'Real Away Scorer'),g(ids[1],'Real Home Scorer')]});
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
 assert.match(content,/Team leaders unavailable/);
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
