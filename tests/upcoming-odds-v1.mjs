import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const src=read('game-wall-v48-upcoming-odds.js');
const html=read('game-wall-v47-home-screen.html');
const games=read('game-wall-v47-games-cloudflare.js');
const css=read('game-wall-v48-upcoming-odds.css');
const sandbox={window:{},Date,console};
vm.runInNewContext(src,sandbox);
const api=sandbox.window.ManCaveUpcomingOdds;
const names={away:{abbr:'IND'},home:{abbr:'HOU'}};
const sample={
 provider:{name:'DraftKings'},overUnder:43.5,
 moneyline:{away:{close:{odds:'+500'}},home:{close:{odds:'-700'}}},
 pointSpread:{away:{close:{line:'+12.5',odds:'-112'}},home:{close:{line:'-12.5',odds:'-108'}}},
 total:{over:{close:{line:'o43.5',odds:'-118'}},under:{close:{line:'u43.5',odds:'-102'}}}
};
test('normalize sportsbook, side-specific spreads, American moneylines and total',()=>{
 const o=api.normalize([sample]);
 assert.equal(o.provider,'DraftKings');
 assert.equal(o.spreadAway,'+12.5');
 assert.equal(o.spreadHome,'-12.5');
 assert.equal(o.moneyAway,'+500');
 assert.equal(o.moneyHome,'-700');
 assert.equal(o.overUnder,'43.5');
 assert.equal(o.overPrice,'-118');
 assert.equal(o.underPrice,'-102');
 const markup=api.markup({id:'NFL-401873066',state:'upcoming',...names,oddsRaw:[sample]});
 assert.match(markup,/PRE-GAME ODDS/);
 assert.match(markup,/IND \+12\.5/);
 assert.match(markup,/HOU -12\.5/);
 assert.match(markup,/IND \+500/);
 assert.match(markup,/HOU -700/);
 assert.match(markup,/43\.5/);
 assert.match(markup,/DraftKings · via ESPN/);
});
test('ESPN core v2 current moneyline/point spread format is supported',()=>{
 const core={
  provider:{name:'DraftKings'},overUnder:6.5,
  homeTeamOdds:{moneyLine:-110,spreadOdds:+225,current:{pointSpread:{american:'-1.5'}}},
  awayTeamOdds:{moneyLine:-110,spreadOdds:-278,current:{pointSpread:{american:'+1.5'}}},
  overOdds:102,underOdds:-122
 };
 const o=api.normalize([core]);
 assert.equal(o.spreadAway,'+1.5');
 assert.equal(o.spreadHome,'-1.5');
 assert.equal(o.moneyAway,'-110');
 assert.equal(o.moneyHome,'-110');
 assert.equal(o.overUnder,'6.5');
 assert.equal(o.overPrice,'+102');
 assert.equal(o.underPrice,'-122');
});
test('unavailable odds remain clearly unavailable, not guessed',()=>{
 assert.equal(api.normalize([]),null);
 const m=api.markup({id:'NCAAB-1234567',state:'upcoming',...names,oddsRaw:[]});
 assert.match(m,/Checking available odds/);
 assert.equal(api.markup({id:'NBA-1234567',state:'live',...names,oddsRaw:[sample]}),'');
});
test('only the Upcoming cards receive an odds rail while visuals and controls remain',()=>{
 assert.match(games,/oddsRaw:Array\.isArray\(c\?\.odds\)/);
 assert.match(html,/game-wall-v48-upcoming-odds\.js/);
 assert.match(html,/game-wall-v48-upcoming-odds\.css/);
 assert.match(html,/ManCaveUpcomingOdds\?\.markup/);
 assert.match(html,/ManCaveUpcomingOdds\?\.hydrate/);
 assert.match(html,/data-assign-game/);
 assert.match(html,/data-stats/);
 assert.match(css,/\.games \.gameCard\.upcoming \.mcOdds/);
 assert.match(src,/IntersectionObserver/);
 assert.match(src,/const concurrency=3/);
 assert.doesNotMatch(src,/sportsbook\.draftkings\.com|\/api\/send|firebase|signInWithEmailAndPassword/);
});
