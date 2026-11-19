import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../game-wall-v49-visual-analytics.js',import.meta.url),'utf8');
const style=fs.readFileSync(new URL('../game-wall-v49-visual-analytics.css',import.meta.url),'utf8');
const ctl=fs.readFileSync(new URL('../game-wall-v47-home-screen.html',import.meta.url),'utf8');
function bootstrap(){
 const body={dataset:{},innerHTML:'',querySelectorAll:()=>[]};
 const shade={classList:{add() {},contains(){return true;}}};
 const title={textContent:''};
 const refresh={addEventListener(){}};
 const elements={modalBody:body,modalShade:shade,modalTitle:title,vaRefresh:refresh};
 const ctx={window:{},document:{getElementById:id=>elements[id]||null,hidden:false},
   setTimeout,clearTimeout,setInterval:()=>{},Date,console,AbortController,
   fetch:async()=>({ok:true,json:async()=>({})})};
 vm.runInNewContext(src,ctx);
 return{api:ctx.window.ManCaveVisualAnalytics,ctx,body,elements};
}
const game=league=>({
 id:league+'-401910015',eventId:'401910015',league,
 path:{NBA:'basketball/nba',WNBA:'basketball/wnba',NCAAB:'basketball/mens-college-basketball',
 NHL:'hockey/nhl',NFL:'football/nfl',NCAAF:'football/college-football',MLB:'baseball/mlb'}[league],
 state:'final',away:{id:'2',abbr:'BOS',name:'Boston',fullName:'Boston'},
 home:{id:'7',abbr:'DEN',name:'Denver',fullName:'Denver'},
 start:'2026-11-18T21:00:00Z'
});
test('seven leagues have a supported, non-destructive Analytics button',()=>{
 for(const l of ['NBA','WNBA','NCAAB','NHL','NFL','NCAAF','MLB']){
  const {api}=bootstrap(); assert.equal(api.helpers.safeGame(game(l)),true,l);
 }
 assert.match(ctl,/data-stats=/);
 assert.match(ctl,/data-analytics=/);
 assert.match(ctl,/data-assign-game=/);
 assert.match(ctl,/ManCaveVisualAnalytics\?\.openById/);
 assert.match(ctl,/game-wall-v49-visual-analytics\.js\?v=/);
 assert.match(ctl,/game-wall-v49-visual-analytics\.css\?v=/);
 assert.match(style,/\.vaChart/);
 assert.match(style,/\.vaChips/);
 assert.match(style,/\.vaTabs/);
});
test('basketball: real court shots, not free throws, invalid coordinates or false misses',()=>{
 const {api}=bootstrap(),g=game('NCAAB');
 const plays=[
  {id:'1',shootingPlay:true,scoringPlay:true,type:{text:'JumpShot'},coordinate:{x:25,y:19},team:{id:'2'},text:'Noah Fifita makes jumper',period:{number:1}},
  {id:'2',shootingPlay:true,scoringPlay:false,scoreValue:2,type:{text:'LayUpShot'},coordinate:{x:24,y:2},team:{id:'7'},text:'Avery Johnson misses layup',period:{number:1}},
  {id:'3',shootingPlay:true,scoringPlay:true,type:{text:'MadeFreeThrow'},coordinate:{x:25,y:0},team:{id:'2'},text:'Player makes free throw',period:{number:1}},
  {id:'4',shootingPlay:true,scoringPlay:true,type:{text:'JumpShot'},coordinate:{x:-214748340,y:-214748365},team:{id:'2'},text:'Bad data makes three point jumper'},
  {id:'5',shootingPlay:false,scoringPlay:false,type:{text:'Defensive Rebound'},coordinate:{x:24,y:2},team:{id:'2'},text:'Rebound'}
 ];
 const shots=api.helpers.shots({plays},g);
 assert.equal(shots.length,2);
 assert.equal(shots[0].made,true);
 assert.equal(shots[1].made,false,'college missed attempt has scoreValue but no points');
 assert.equal(shots[0].shooter,'Noah Fifita');
 assert.equal(shots[1].shooter,'Avery Johnson');
 assert.match(api.helpers.courtSVG(shots),/Noah Fifita/);
});
test('NHL: goal, saved and missed shots included, blocked shots with bad team attribution excluded',()=>{
 const{api}=bootstrap(),g=game('NHL');
 const mk=(kind,team,x,name)=>({id:kind,type:{abbreviation:kind},coordinate:{x,y:-12},team:{id:team},
  participants:[{type:'shooter',athlete:{displayName:name}}],period:{number:2}});
 const d={plays:[
  mk('goal','2',74,'David Pastrnak'),
  mk('shot-on-goal','7',-75,'Auston Matthews'),
  mk('shot-missed','7',-54,'Player Three'),
  mk('shot-blocked','2',65,'Incorrect Shooter'),
  mk('hit','2',52,'Wrong Event')
 ]};
 const shots=api.helpers.shots(d,g);
 assert.deepEqual(Array.from(shots,x=>x.outcome),['GOAL','SAVE','MISS']);
 assert.match(api.helpers.rinkSVG(shots),/David Pastrnak/);
});
test('football: live/final charts use actual ESPN scoring changes not invented receiver routes',()=>{
 const{api}=bootstrap(),g=game('NFL');
 const d={scoringPlays:[
  {awayScore:3,homeScore:0,period:{number:1},text:'Field Goal'},
  {awayScore:3,homeScore:7,period:{number:2},text:'Touchdown'},
  {awayScore:10,homeScore:7,period:{number:3},text:'Touchdown'}
 ]};
 const out=api.helpers.scoreEvents(d);
 assert.equal(out.length,4);
 assert.equal(out.at(-1).a,10);
 assert.equal(out.at(-1).h,7);
 assert.match(api.helpers.graphSVG(out,g),/cumulative scoring progression/);
 assert.equal(api.helpers.shotKind(g),null);
});
test('MLB: real inning scores are represented as per-period bars',()=>{
 const{api,ctx}=bootstrap(),g=game('MLB');ctx.window.ManCaveRealGames={state:{games:[g]}};
 api.openById(g.id);
 const d={header:{competitions:[{competitors:[
  {team:{id:'2'},linescores:[{displayValue:'1'},{displayValue:'0'},{displayValue:'3'}]},
  {team:{id:'7'},linescores:[{displayValue:'0'},{displayValue:'2'},{displayValue:'0'}]}
 ]}]}};
 assert.match(api.helpers.periodSVG(d,g),/scoring totals by quarter/);
 assert.equal(api.helpers.shots(d,g).length,0);
});
test('external or unknown identifiers never open a valid analytics record',()=>{
 const{api}=bootstrap();
 assert.equal(api.helpers.safeGame({...game('NBA'),path:'other/unsafe'}),false);
 assert.equal(api.helpers.safeGame({...game('NBA'),eventId:'evil'}),false);
 assert.equal(api.openById('not-known'),false);
});
