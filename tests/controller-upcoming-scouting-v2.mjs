import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../game-wall-v49-visual-analytics.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../game-wall-v49-visual-analytics.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../game-wall-v47-home-screen.html',import.meta.url),'utf8');
const game={
 id:'NCAAF-401856865',eventId:'401856865',league:'NCAAF',
 path:'football/college-football',state:'upcoming',
 away:{id:'12',name:'Arizona',abbr:'ARIZ',fullName:'Arizona Wildcats'},
 home:{id:'2306',name:'Kansas St',abbr:'KSU',fullName:'Kansas State Wildcats'}
};
const stat=(name,value,label)=>({name,displayValue:String(value),label});
const fixture={
 header:{competitions:[{competitors:[{team:{id:'2306'}},{team:{id:'12'}}]}]},
 boxscore:{teams:[
  {team:{id:'2306'},statistics:[stat('totalPointsPerGame',29.2,'Points Per Game'),stat('yardsPerGame',404.2,'Total Yards'),stat('passingYardsPerGame',221.3,'Yards Passing'),stat('rushingYardsPerGame',182.9,'Yards Rushing'),stat('totalPointsPerGameAllowed',26.1,'Points Allowed Per Game')]},
  {team:{id:'12'},statistics:[stat('totalPointsPerGame',34.7,'Points Per Game'),stat('yardsPerGame',450.1,'Total Yards'),stat('passingYardsPerGame',326.2,'Yards Passing'),stat('rushingYardsPerGame',123.9,'Yards Rushing'),stat('totalPointsPerGameAllowed',21.9,'Points Allowed Per Game')]}
 ]},
 leaders:[]
};
function harness(data=fixture){
 const body={dataset:{},innerHTML:'',querySelectorAll:()=>[]};
 const title={textContent:''},shade={classList:{add(){},contains(){return true;}}};
 const refresh={addEventListener(){}};
 const nodes={modalBody:body,modalShade:shade,modalTitle:title,vaRefresh:refresh};
 const context={window:{ManCaveStats:{deactivate(){}}},document:{getElementById:id=>nodes[id]||null,hidden:false},
  Date,console,setTimeout,clearTimeout,setInterval:()=>{},AbortController,
  fetch:async()=>({ok:true,status:200,json:async()=>data})};
 vm.runInNewContext(source,context);
 return{api:context.window.ManCaveVisualAnalytics,body,title};
}
test('pre-game Arizona Kansas State default Scouting shows real multi-row ESPN season bars',async()=>{
 const {api,body}=harness();
 assert.equal(api.open(game),true);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.match(body.innerHTML,/Scouting/);
 assert.match(body.innerHTML,/aria-selected="true" class="active">Scouting/);
 assert.match(body.innerHTML,/PREGAME SCOUTING · SEASON TEAM AVERAGES/);
 assert.match(body.innerHTML,/Points Per Game/);
 assert.match(body.innerHTML,/Total Yards/);
 assert.match(body.innerHTML,/Yards Passing/);
 assert.match(body.innerHTML,/34\.7/);
 assert.match(body.innerHTML,/29\.2/);
 assert.match(body.innerHTML,/450\.1/);
 assert.match(body.innerHTML,/404\.2/);
 assert.equal((body.innerHTML.match(/vaSeasonCard/g)||[]).length,5);
 assert.doesNotMatch(body.innerHTML,/No completed-game path exists yet/);
 assert.doesNotMatch(body.innerHTML,/No fictional shot maps/i);
});
test('upcoming basketball and NHL open real Scouting rather than an empty shot map',async()=>{
 for(const [league,path] of [['NBA','basketball/nba'],['WNBA','basketball/wnba'],
 ['NCAAB','basketball/mens-college-basketball'],['NHL','hockey/nhl']]){
  const {api,body}=harness();
  const g={...game,league,path};
  assert.equal(api.open(g),true);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.match(body.innerHTML,/aria-selected="true" class="active">Scouting/);
  assert.match(body.innerHTML,/vaSeasonCard/,league+' did not render a season comparison');
  assert.doesNotMatch(body.innerHTML,/Pregame shot chart not published|No verified shot locations/,league);
 }
});
test('team ID validation survives ESPN reversing its team list',()=>{
 const {api}=harness();
 const rows=Array.from(api.helpers.pregameRows(fixture,game));
 assert.ok(rows.length>=5);
 const x=rows.find(r=>r.key==='totalpointspergame');
 assert.equal(x.away,34.7);
 assert.equal(x.home,29.2);
 const p=rows.find(r=>r.key==='passingyardspergame');
 assert.equal(p.away,326.2);
 assert.equal(p.home,221.3);
});
test('missing verified two-sided data cannot be turned into invented averages',()=>{
 const {api}=harness();
 const missing={boxscore:{teams:[{team:{id:'12'},statistics:[stat('totalPointsPerGame',34.7,'Points Per Game')]}]}};
 assert.equal(api.helpers.pregameRows(missing,game).length,0);
 const bad={boxscore:{teams:[{team:{id:'12'},statistics:[stat('totalPointsPerGame',34.7,'Points Per Game')]},{team:{id:'999'},statistics:[stat('totalPointsPerGame',25.7,'Points Per Game')]}]}};
 assert.equal(api.helpers.pregameRows(bad,game).length,0);
});
test('new iPhone sheet is cached separately without changing existing Stats or Tune to TV',()=>{
 assert.match(html,/game-wall-v49-visual-analytics\.js\?v=real-pregame-scouting-v3/);
 assert.match(html,/game-wall-v49-visual-analytics\.css\?v=real-pregame-scouting-v3/);
 assert.match(html,/data-stats=/);
 assert.match(html,/data-analytics=/);
 assert.match(html,/data-assign-game=/);
 assert.match(styles,/vaSeasonCard/);
 assert.match(styles,/vaSeasonTrack/);
});
test('actual published Arizona Kansas State summary renders meaningful pregame charts',async()=>{
 const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=401856865',{signal:AbortSignal.timeout(13000)});
 assert.equal(r.status,200);
 const data=await r.json();
 const {api}=harness(data);
 const rows=Array.from(api.helpers.pregameRows(data,game));
 assert.ok(rows.length>=6,'Expected at least six published season averages');
 const points=rows.find(x=>x.key==='totalpointspergame');
 assert.ok(points?.away>0&&points?.home>0);
 console.log('VERIFIED_REAL_PREGAME_CHART',JSON.stringify({game:game.id,statCount:rows.length,points:points&&{Arizona:points.away,KansasState:points.home}}));
});
