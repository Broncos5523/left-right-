import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const policySrc=read('game-wall-v33-schedule-policy.js');
const controller=read('game-wall-v47-games-cloudflare.js');
const html=read('game-wall-v47-home-screen.html');
const css=read('game-wall-v32-games-style.css');
const ctx=vm.createContext({window:{},Date});
vm.runInContext(policySrc,ctx);
const policy=ctx.window.ManCaveGameWindows;
const now=Date.parse('2026-11-19T04:39:14Z');
function game(league,date,team='Boston Red Sox'){
 return {id:league+'-123456',league,state:'upcoming',start:date,favorite:true,
  away:{fullName:team},home:{fullName:'Seattle Mariners'},timeConfirmed:false};
}
test('Red Sox 2027 opener is still the next favorite but never appears in immediate 48-hour MLB slate',()=>{
 const opener=game('MLB','2027-03-25T04:00:00Z');
 assert.equal(policy.visibleByWindow(opener,now),false);
 assert.equal(policy.isDistantFavorite(opener,now),true);
 const tonight=game('NHL','2026-11-19T19:00:00Z','Boston Bruins');
 assert.equal(policy.visibleByWindow(tonight,now),true);
 assert.equal(policy.isDistantFavorite(tonight,now),false);
 const date=new Date(opener.start).toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',year:'numeric'});
 assert.match(date,/Mar 25, 2027/);
});
test('ESPN unconfirmed times stay unconfirmed instead of appearing as midnight',()=>{
 assert.match(controller,/timeConfirmed:event\.timeValid!==false&&c\?\.timeValid!==false/);
 assert.match(html,/g\.timeConfirmed===false\?\(longDate\+' · TIME TBD'\)/);
 assert.match(html,/year:'numeric'/);
 assert.match(html,/NEXT FAVORITE · FUTURE SCHEDULE/);
 assert.match(html,/NEXT FAVORITE GAMES/);
 assert.match(css,/\.games \.gameFutureHeading/);
});
test('near-term upcoming keeps original odds layout and out-of-window next favorites do not show misleading odds',()=>{
 assert.match(html,/g\.state==='upcoming'&&!futureFavorite\?\(window\.ManCaveUpcomingOdds\?\.markup/);
 assert.match(html,/const smart=futureFavorite\?null:/);
 assert.match(html,/data-stats/);
 assert.match(html,/data-assign-game/);
 assert.match(html,/gameTeamAccent/);
});
