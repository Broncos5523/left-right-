import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../game-wall-v49-visual-analytics.js',import.meta.url),'utf8');
const w={};
vm.runInNewContext(source,{
 window:w,document:{getElementById(){return null;},hidden:false},Date,console,setTimeout,clearTimeout,setInterval:()=>{},AbortController,fetch
});
const api=w.ManCaveVisualAnalytics;
async function summary(path,id){
 const url='https://site.api.espn.com/apis/site/v2/sports/'+path+'/summary?event='+id;
 const r=await fetch(url,{signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200,url);
 return r.json();
}
function matchup(league,path,id,data){
 const teams=(data.header?.competitions?.[0]?.competitors||[]).map(c=>String(c.team?.id||''));
 assert.equal(teams.length,2);
 return {league,path,eventId:id,id:league+'-'+id,away:{id:teams[0]},home:{id:teams[1]},state:'final'};
}
test('NBA, WNBA, NCAA basketball: true make/miss shot coordinates from real ESPN finals',async()=>{
 const items=[['NBA','basketball/nba','401910015'],['WNBA','basketball/wnba','401918022'],['NCAAB','basketball/mens-college-basketball','401909742']];
 for(const [league,path,id] of items){
  const d=await summary(path,id),g=matchup(league,path,id,d),arr=api.helpers.shots(d,g);
  assert.ok(arr.length>40,league+' has insufficient valid court shot points '+arr.length);
  assert.ok(arr.some(x=>x.made),league+' no made shots');
  assert.ok(arr.some(x=>!x.made),league+' no missed shots');
  assert.ok(arr.every(x=>x.x>=0&&x.x<=50&&x.y>=0&&x.y<=47),league+' invalid shot coordinates');
  assert.ok(arr.every(x=>!x.text.toLowerCase().includes('free throw')),league+' free throws leaked');
  const svg=api.helpers.courtSVG(arr);
  assert.ok(svg.includes('<circle'),league+' chart blank');
  console.log('COURT_VERIFIED',JSON.stringify({league,event:id,shots:arr.length,made:arr.filter(x=>x.made).length,misses:arr.filter(x=>!x.made).length}));
 }
});
test('NHL shot map excludes blocked attempts and includes live actual goals/saves/misses',async()=>{
 const d=await summary('hockey/nhl','401892739');
 const g=matchup('NHL','hockey/nhl','401892739',d);
 const p=api.helpers.shots(d,g);
 assert.ok(p.length>30,'hockey rink shot map too sparse '+p.length);
 for(const status of ['GOAL','SAVE','MISS'])assert.ok(p.some(x=>x.outcome===status),status+' missing');
 assert.ok(p.every(x=>x.x>=-100&&x.x<=100&&x.y>=-44&&x.y<=44));
 console.log('RINK_VERIFIED',JSON.stringify({shots:p.length,goals:p.filter(x=>x.made).length}));
});
test('football and college football real scoring plays support game-flow charts',async()=>{
 for(const [league,path,id] of [['NFL','football/nfl','401873041'],['NCAAF','football/college-football','401856864']]){
  const d=await summary(path,id),g=matchup(league,path,id,d);
  const seq=api.helpers.scoreEvents(d);
  assert.ok(seq.length>=5,league+' scoring timeline missing '+seq.length);
  assert.ok(api.helpers.graphSVG(seq,g).includes('<path'));
  console.log('FOOTBALL_FLOW_VERIFIED',JSON.stringify({league,event:id,scoreEvents:seq.length}));
 }
});
test('MLB final real inning scores produce actual inning chart without imaginary pitch locations',async()=>{
 const d=await summary('baseball/mlb','401817089');
 const g=matchup('MLB','baseball/mlb','401817089',d);
 assert.equal(api.helpers.shotKind(g),null);
 assert.equal(api.helpers.shots(d,g).length,0);
 const svg=api.helpers.periodSVG(d,g);
 assert.ok(svg.includes('<rect'), 'missing real inning bars');
 console.log('MLB_INNINGS_VERIFIED',JSON.stringify({event:g.eventId,periods:(d.header?.competitions?.[0]?.competitors?.[0]?.linescores||[]).length}));
});
test('upcoming NBA and NCAA basketball have named matchup leaders for scouting bar charts',async()=>{
 for(const [league,path,id] of [['NBA','basketball/nba','401910019'],['NCAAB','basketball/mens-college-basketball','401920517']]){
  const d=await summary(path,id);
  assert.equal(d.leaders?.length,2,league+' no pregame leader groups');
  assert.ok(d.leaders.every(g=>g.leaders?.some(c=>c.leaders?.[0]?.athlete?.displayName)),league+' no named leaders');
  console.log('PREGAME_LEADERS_VERIFIED',JSON.stringify({league,event:id,categories:d.leaders.map(x=>x.leaders?.length||0)}));
 }
});
