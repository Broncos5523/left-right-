import test from 'node:test';
import assert from 'node:assert/strict';
import {LEAGUES,matchTeam,providerTeamName,matchFixture,parseMarkets,addMatchedOdds} from '../scripts/odds-rundown-adapter.mjs';
const mk=(name,price,value=null)=>({name,lines:[{value,prices:{'19':{price}}}]});
const events=[{
 sport_id:5,event_id:'test-external-id',event_date:'2026-11-19T23:00:00Z',
 teams:[{name:'Connecticut Huskies',is_home:true},{name:'Arizona Wildcats',is_home:false}],
 markets:[
  {market_id:1,participants:[mk('Arizona Wildcats',+150),mk('Connecticut Huskies',-180)]},
  {market_id:2,participants:[mk('Arizona Wildcats',-110,'+4.5'),mk('Connecticut Huskies',-110,'-4.5')]},
  {market_id:3,participants:[mk('Over',-105,'153.5'),mk('Under',-115,'153.5')]}
 ]}];
const espn=[{
 id:'NCAAB-401909742',league:'NCAAB',state:'upcoming',start:'2026-11-19T23:00:00Z',
 away:{fullName:'Arizona Wildcats'},home:{fullName:'UConn Huskies'}
}];
test('same league fixture matches high-confidence Arizona vs UConn aliases and UTC time',()=>{
 assert.equal(matchTeam('UConn Huskies','Connecticut Huskies'),true);
 assert.equal(matchFixture('NCAAB',events[0],espn)?.id,'NCAAB-401909742');
 assert.equal(matchFixture('NBA',events[0],espn),null);
 assert.equal(matchTeam('North Carolina Tar Heels','North Carolina State Wolfpack'),false);
 const collision=[...espn,{...espn[0],id:'NCAAB-other'}];
 assert.equal(matchFixture('NCAAB',events[0],collision),null,'do not auto-assign ambiguous odds');
});
test('fixture reconciliation rebuilds separated city and mascot without guessing teams',()=>{
 const nba=[{id:'NBA-1',league:'NBA',state:'upcoming',start:'2026-11-19T23:00:00Z',
  away:{fullName:'Toronto Raptors'},home:{fullName:'New York Knicks'}}];
 const event={event_date:'2026-11-19T23:00:00Z',teams:[
  {name:'Toronto',mascot:'Raptors',is_away:true,is_home:false},
  {name:'New York',mascot:'Knicks',is_home:true,is_away:false}
 ]};
 assert.equal(providerTeamName(event.teams[0]),'Toronto Raptors');
 assert.equal(providerTeamName({name:'New York Knicks',mascot:'Knicks'}),'New York Knicks');
 assert.equal(matchFixture('NBA',event,nba)?.id,'NBA-1');
 assert.equal(matchFixture('NBA',{...event,teams:[
  {...event.teams[0],mascot:'Maple Leafs'},event.teams[1]]},nba),null,
  'Never attach another sport/team by city name alone');
});
test('markets correctly attribute both sides when provider lists only a short city name',()=>{
 const event={teams:[
  {name:'Utah',mascot:'Utes',is_away:true},
  {name:'Miami',mascot:'Hurricanes',is_home:true}
 ],markets:[{market_id:1,participants:[
  mk('Utah Utes',+220),mk('Miami Hurricanes',-260)
 ]},{market_id:2,participants:[
  mk('Utah Utes',-110,'+6.5'),mk('Miami Hurricanes',-110,'-6.5')
 ]}]};
 const quote=parseMarkets(event);
 assert.equal(quote.moneyAway,'+220');
 assert.equal(quote.moneyHome,'-260');
 assert.equal(quote.spreadAway,'+6.5');
 assert.equal(quote.spreadHome,'-6.5');
});
test('normalize three markets from ONE actual named bookmaker',()=>{
 const got=parseMarkets(events[0]);
 assert.equal(got.provider,'DraftKings');
 assert.equal(got.moneyAway,'+150');assert.equal(got.moneyHome,'-180');
 assert.equal(got.spreadAway,'+4.5');assert.equal(got.spreadHome,'-4.5');
 assert.equal(got.spreadPriceAway,'-110');assert.equal(got.spreadPriceHome,'-110');
 assert.equal(got.overUnder,'153.5');
 assert.equal(got.overPrice,'-105');assert.equal(got.underPrice,'-115');
 const result={};
 const summary=addMatchedOdds(events,'NCAAB',espn,result);
 assert.equal(summary.quoted,1);
 assert.equal(result['NCAAB-401909742'].provider,'DraftKings');
});
test('no-book/closed/pulled lines never invent market odds',()=>{
 const closed=structuredClone(events[0]);
 for(const market of closed.markets)for(const p of market.participants)for(const line of p.lines)
  line.prices={'19':{price:-110,closed_at:'2026-11-19T22:00:00Z'}};
 assert.equal(parseMarkets(closed),null);
 const empty={...events[0],markets:[]};
 assert.equal(parseMarkets(empty),null);
 const flip={...events[0],event_date:'2026-11-20T18:00:00Z'};
 assert.equal(matchFixture('NCAAB',flip,espn),null);
});
test('all seven leagues have provider IDs without pretending off-season odds',()=>{
 assert.deepEqual(Object.keys(LEAGUES).sort(),['MLB','NBA','NCAAB','NCAAF','NFL','NHL','WNBA'].sort());
});
