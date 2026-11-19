import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../analytics-32-inch-preview-v1.html',import.meta.url),'utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
test('32-inch concept has no scoreboard, but retains a small matchup identifier',()=>{
 assert.match(html,/width:1920px;height:1080px/);
 assert.match(html,/class="analytics-header"/);
 assert.match(html,/id="awayName"/);
 assert.match(html,/id="homeName"/);
 assert.match(html,/id="status"/);
 assert.doesNotMatch(html,/id="awayScore"|id="homeScore"|class="scoreline"|class="board-header"/);
 assert.doesNotMatch(html,/setText\('awayScore'|setText\('homeScore'/);
 assert.match(html,/height:90px;flex:0 0 90px/);
 assert.match(html,/grid-template-columns:minmax\(0,1378px\)/);
});
test('separate preview retains 7 leagues, upcoming/live/final, and team/player toggles',()=>{
 for(const l of ['NFL','NCAAF','NBA','NCAAB','WNBA','NHL','MLB']) assert.match(html,new RegExp('data-league="'+l+'"'));
 for(const phase of ['UPCOMING','LIVE','FINAL'])assert.match(html,new RegExp('data-phase="'+phase+'"'));
 assert.match(html,/data-focus="TEAM"/);
 assert.match(html,/data-focus="PLAYER"/);
 assert.match(html,/id="chart"/);
 assert.match(html,/id="trendGraph"/);
 assert.match(html,/SAMPLE DATA|sample data|illustrative/i);
});
test('inline javascript remains syntactically valid, with all fixed references present',()=>{
 assert.ok(inline,'inline preview script exists');
 new vm.Script(inline[1],{filename:'analytics-32-inch-preview-v1.html'});
 const ids=[...new Set([...inline[1].matchAll(/setText\('(\w+)'/g)].map(m=>m[1]))];
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'),id+' missing DOM node');
});
