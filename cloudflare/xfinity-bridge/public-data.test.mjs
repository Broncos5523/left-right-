import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {__test} from './public-data.mjs';
const origin='https://broncos5523.github.io';
const url='https://man-cave-xfinity-bridge.example.test';
const fixture='<body><h3>On Local TV in Providence-New Bedford: Week 11</h3>'+
'<p>Sunday, November 15, 2026</p><p>1:00 PM ET CBS Denver Broncos at Kansas City Chiefs See the map</p>'+
'<p>4:25 PM ET FOX Miami Dolphins at New York Jets See the map</p>'+
'<div>National games</div></body>';
test('Providence listing accepts only published exact Sunday and explicit CBS/FOX games',async()=>{
 const parsed=__test.parseCoverage(fixture);
 assert.equal(parsed.date,'2026-11-15');
 assert.deepEqual(parsed.games.map(x=>x.network),['CBS','FOX']);
 assert.throws(()=>__test.parseCoverage('<script>alert(1)</script>Fake listing'),/heading missing/);
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async target=>{calls++;return new Response(fixture,{status:200})};
 try{
  const res=await worker.fetch(new Request(url+'/nfl-local-coverage?date=2026-11-15',{headers:{Origin:origin}}),{});
  assert.equal(res.status,200);
  assert.equal((await res.json()).verifiedForRequestedDate,true);
  const no=await worker.fetch(new Request(url+'/nfl-local-coverage?date=2026-11-22',{headers:{Origin:origin}}),{});
  assert.equal((await no.json()).verifiedForRequestedDate,false);
  assert.equal((await no.clone().json()).games.length,0);
  const bad=await worker.fetch(new Request(url+'/nfl-local-coverage?date=bad',{headers:{Origin:origin}}),{});
  assert.equal(bad.status,400);
  assert.equal(calls,1,'Local broadcast caching should not need a second publisher fetch');
 }finally{globalThis.fetch=previous;}
});
test('NHL leader endpoint maintains original season and team validation',async()=>{
 const sample={skaters:[{firstName:{default:'Test'},lastName:{default:'Player'},
  gamesPlayed:5,points:11,goals:4,assists:7,shots:18,plusMinus:2}],
  goalies:[{firstName:{default:'Example'},lastName:{default:'Goalie'},
   gamesPlayed:5,wins:4,savePercentage:.941,goalsAgainstAverage:1.9,saves:111}]};
 const previous=globalThis.fetch;const calls=[];
 globalThis.fetch=async target=>{calls.push(String(target));return new Response(JSON.stringify(sample),{status:200})};
 try{
  const first=await worker.fetch(new Request(url+'/nhl-team-leaders?team=BOS&season=20262027',{headers:{Origin:origin}}),{});
  assert.equal(first.status,200);
  const payload=await first.json();
  assert.equal(payload.source,'NHL');
  assert.equal(payload.leaders.length,9);
  assert.deepEqual(payload.leaders.map(x=>x.metric),[
   'Points','Goals','Assists','Plus/Minus','Shots','Goalie Wins','Save %','Goals Against Avg','Saves']);
  assert.equal(calls.length,1);
  const wrong=await worker.fetch(new Request(url+'/nhl-team-leaders?team=XXX&season=20262027',{headers:{Origin:origin}}),{});
  assert.equal(wrong.status,400);
 }finally{globalThis.fetch=previous;}
});
