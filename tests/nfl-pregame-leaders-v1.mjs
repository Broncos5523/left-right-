import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=read('game-wall-v47-nhl-leaders-cloudflare.js');
const controller=read('game-wall-v47-home-screen.html');
const cache=JSON.parse(read('stats-cache/nfl-team-leaders-2026.json'));
const context=vm.createContext({window:{},document:{},Date,console,setTimeout,clearTimeout});
vm.runInContext(source,context);
const parse=data=>context.window.ManCavePregame.helpers.leaders({leaders:data.leaders},'NFL');
test('ESPN team leaders cache includes every completed regular-season game for screenshot matchup',()=>{
 assert.equal(cache.season,2026);
 assert.equal(Object.keys(cache.teams).length,32,'all NFL teams must have verified season player leaders');
 for(const x of Object.values(cache.teams)){
  assert.equal(x.gamesVerified,x.gamesExpected,'no incomplete season records');
  assert.ok(x.gamesVerified>=6,'season game counts must be credible');
  assert.ok(x.leaders.length>=5,'all NFL teams need real category leaders');
  assert.ok(Number.isFinite(Date.parse(x.updatedAt)));
 }
 const raiders=cache.teams['13'],broncos=cache.teams['7'];
 assert.equal(raiders.team,'Las Vegas Raiders');
 assert.equal(broncos.team,'Denver Broncos');
 assert.equal(raiders.gamesVerified,raiders.gamesExpected);
 assert.equal(broncos.gamesVerified,broncos.gamesExpected);
 assert.ok(raiders.gamesVerified>=8);
 assert.ok(broncos.gamesVerified>=8);
 assert.ok(raiders.verifiedAthletes>=30);
 assert.ok(broncos.verifiedAthletes>=30);
});
test('both team leaders resolve to actual attributed ESPN players, not team rankings or an empty response',()=>{
 const raiders=parse(cache.teams['13']),broncos=parse(cache.teams['7']);
 for(const group of [raiders,broncos]){
  assert.ok(group.length>=6);
  for(const x of group){assert.ok(x.metric&&x.name&&x.value,'each statistic needs a player and value');}
 }
 assert.equal(raiders.find(p=>p.metric==='Passing Yards')?.name,'Kirk Cousins');
 assert.equal(broncos.find(p=>p.metric==='Passing Yards')?.name,'Bo Nix');
 assert.equal(raiders.find(p=>p.metric==='Receiving Yards')?.name,'Brock Bowers');
 assert.equal(broncos.find(p=>p.metric==='Total Tackles')?.name,'Alex Singleton');
});
test('iPhone controller uses small cached ESPN season results, preserving NHL and existing pregame UI',()=>{
 assert.match(source,/async function officialNfl\(/);
 assert.match(source,/stats-cache\/nfl-team-leaders-/);
 assert.match(source,/\['NHL','NFL'\]\.includes\(g\.league\)/);
 assert.match(source,/officialNhl\(g,which\)/);
 assert.match(source,/data-pg-tab/);
 assert.match(source,/Team Comparison/);
 assert.match(source,/Team Leaders/);
 assert.match(source,/Previous Games/);
 assert.match(controller,/game-wall-v47-nhl-leaders-cloudflare\.js\?v=espn-2026-nfl-season-leaders-20261119/);
 assert.doesNotMatch(source,/\.\.\/scripts\/refresh-nfl-pregame-leaders/);
});
