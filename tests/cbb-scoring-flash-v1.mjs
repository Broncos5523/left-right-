import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const collegeCode=read('cbb-scoring-flash-preview-v1.js');
const nbaCode=read('nba-scoring-flash-preview-v4.js');
const live=read('team-board.html');
const nbaPreview=read('team-board-nba-flash-preview-v4.html');
const cbbPreview=read('team-board-cbb-flash-preview-v1.html');
const normalized=s=>s.replace(/<title>.*?<\/title>/,'<title>same</title>');

// Public ESPN field samples verified in the actual 61-game 2026-11-17 audit.
// Compact, constructed test summaries, not a claim to replay an entire game.
const teamNames=['Alabama Crimson Tide','Kennesaw State Owls'];
const players=[
 {athlete:{id:'5082704',displayName:'Drew Fielder',headshot:{href:'https://example.org/field.png'}},stats:['3']},
 {athlete:{id:'4711306',displayName:'Brandon Garrison'},stats:['0']},
];
const shot=(key,seq,teamId,athlete,text,scoreValue,coordinate)=>{
 const p={id:key,sequenceNumber:seq,text,shootingPlay:true,scoringPlay:scoreValue>0,scoreValue,
  pointsAttempted:/three point/i.test(text)?3:2,team:{id:teamId},
  participants:athlete?[{athlete:{id:athlete}}]:[],
  period:{number:1,displayValue:'1st Half'},clock:{displayValue:'12:34'}};
 if(coordinate)p.coordinate=coordinate;
 return p;
};
const baseline=[
 shot('a1',1,'338','5312348','Amir Taylor makes 8-foot turnaround jump shot',2,{x:20,y:6}),
 shot('a2',2,'333','4711306','Brandon Garrison misses 23-foot three point jumper',0,{x:2,y:2}),
];
const alabamaThree=shot('a3',3,'333','5082704','Drew Fielder makes 25-foot three point jumper',3,{x:36,y:23});
const kennesawTwo=shot('a4',4,'338','5312348','Amir Taylor makes 8-foot turnaround jump shot',2,{x:20,y:6});
const unassignedShot=shot('a5',5,'333',null,'Unattributed jumper',2,{x:25,y:9});

function game(plays,state='in',alabamaScore=17,kennesawScore=16){
 return {
  header:{competitions:[{
   status:{type:{state,completed:state==='post'}},
   competitors:[
    {team:{id:'333',displayName:teamNames[0],name:'Crimson Tide',logo:'https://example.org/alabama-logo.png'},score:String(alabamaScore)},
    {team:{id:'338',displayName:teamNames[1],name:'Owls',logo:'https://example.org/kennesaw-logo.png'},score:String(kennesawScore)}
   ]
  }]},
  boxscore:{players:[
   {team:{id:'333',displayName:teamNames[0]},statistics:[{keys:['points'],athletes:players}]},
   {team:{id:'338',displayName:teamNames[1]},statistics:[{keys:['points'],athletes:[
    {athlete:{id:'5312348',displayName:'Amir Taylor',headshot:{href:'https://example.org/taylor.png'}},stats:['4']}
   ]}]}
  ]},
  plays
 };
}

function wing(team,delaySeconds=0){
 let current=null,nextId=0;
 const scores=[],timers=new Map(),classes=new Set(),events=[];
 const overlay={innerHTML:'',style:{setProperty(){}},
  classList:{contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key)}};
 const document={hidden:false,head:{appendChild(){}},body:{appendChild(){}},
  createElement:tag=>tag==='style'?{textContent:''}:overlay,getElementById:()=>null};
 const window={};
 const env=vm.createContext({
  document,window,URLSearchParams,
  location:{search:'?sport=cbb&team='+encodeURIComponent(team)+'&eventId=401906761&tv=1&broadcastDelay='+delaySeconds},
  setScore(value){scores.push(String(value));events.push('score:'+value);},
  getComputedStyle:()=>({getPropertyValue:()=>'#00a65a'}),
  fetch:async url=>{
   assert.match(String(url),/basketball\/mens-college-basketball\/summary\?event=401906761/);
   if(!current)throw Error('No snapshot provided');
   return {ok:true,json:async()=>current};
  },
  setInterval:(_fn,ms)=>{events.push('interval:'+ms);return 1;},
  setTimeout(fn,ms){const id=++nextId;timers.set(id,{fn,ms});return id;},
  clearTimeout:id=>timers.delete(id)
 });
 const altered=collegeCode.replace('poll();setInterval(poll,10000);','window.__collegeTick=poll;');
 assert.notEqual(altered,collegeCode,'tests must replace the real polling loop');
 vm.runInContext(altered,env);
 return {
  overlay,scores,events,
  active:()=>classes.has('active'),
  async tick(snapshot){current=snapshot;await window.__collegeTick();},
  advance(){const item=timers.entries().next().value;assert.ok(item,'pending timer');const [key,t]=item;timers.delete(key);t.fn();return t.ms;},
  remaining:()=>timers.size,
  api:window.ManCaveCbbFlash
 };
}

test('CBB production, NBA review, and CBB review share the same locked scoreboard layout',()=>{
 assert.equal(normalized(live),normalized(nbaPreview));
 assert.equal(normalized(live),normalized(cbbPreview));
 assert.match(live,/cbb-scoring-flash-preview-v1\.js/);
 assert.match(live,/nba-scoring-flash-preview-v4\.js/);
 assert.match(collegeCode,/if\(qs\.get\('sport'\)!=='cbb'\)return/);
 assert.match(nbaCode,/if\(qs\.get\('sport'\)!=='nba'\)return/);
 assert.doesNotMatch(nbaCode,/mens-college-basketball\/summary/);
 assert.match(collegeCode,/mens-college-basketball\/summary/);
 assert.match(live,/\['nba','cbb'\]\.includes\(sport\)/);
 assert.doesNotMatch(live,/<script>\s*if\(sport==='cbb'\)/,'old immediate, undelayed CBB header must be removed');
 for(const side of ['left','right'])assert.match(read(side+'.html'),/team-board\.html\?sport=/);
});

test('CBB flash preserves the exact approved NBA V4 SVG, sizes, court and 6/8 second durations',()=>{
 const css=s=>s.slice(s.indexOf('const css=['),s.indexOf("].join('');",s.indexOf('const css=['))+11);
 assert.equal(css(collegeCode),css(nbaCode),'CBB must not redesign the gold-master graphic');
 assert.match(collegeCode,/#nbaFlash \.f-head\{width:39%/);
 assert.match(collegeCode,/isThree\?8000:6000/);
 assert.match(collegeCode,/'#37ff8e'/);
 assert.match(collegeCode,/'#ff405c'/);
 assert.match(collegeCode,/x>=0&&x<=50&&y>=-3&&y<=34/);
 assert.doesNotMatch(collegeCode,/@sportsdataverse\/|sdvplot|sporty/);
});

test('new Alabama three plays only on Alabama wing and returns in 8 sec',async()=>{
 const left=wing(teamNames[0]),right=wing(teamNames[1]);
 await Promise.all([left.tick(game(baseline)),right.tick(game(baseline))]);
 assert.equal(left.active(),false,'historical attempts must not auto-play');
 assert.equal(right.active(),false);
 await Promise.all([left.tick(game([...baseline,alabamaThree], 'in',20,16)),right.tick(game([...baseline,alabamaThree],'in',20,16))]);
 assert.equal(left.active(),true);
 assert.equal(right.active(),false,'opponent wing must not flash');
 assert.match(left.overlay.innerHTML,/DREW FIELDER/i);
 assert.match(left.overlay.innerHTML,/THREE-POINTER/);
 assert.match(left.overlay.innerHTML,/PLAYER SHOT CHART/);
 assert.match(left.overlay.innerHTML,/\+3 POINTS/);
 assert.match(left.overlay.innerHTML,/>3<small>PTS/);
 assert.equal(left.advance(),8000);
 assert.equal(left.active(),false);
 await left.tick(game([...baseline,alabamaThree],'in',20,16));
 assert.equal(left.active(),false,'repeat ESPN snapshot must not replay basket');
});

test('new Kennesaw two flashes on its own side for six seconds',async()=>{
 const h=wing(teamNames[1]);
 await h.tick(game(baseline));
 await h.tick(game([...baseline,alabamaThree,kennesawTwo],'in',20,18));
 assert.equal(h.active(),true);
 assert.match(h.overlay.innerHTML,/AMIR TAYLOR/i);
 assert.match(h.overlay.innerHTML,/MADE BASKET/);
 assert.match(h.overlay.innerHTML,/\+2 POINTS/);
 assert.equal(h.advance(),6000);
 assert.equal(h.active(),false);
});


test('two quick college scoring events queue in game order without duplicate playback',async()=>{
 const h=wing(teamNames[0]);
 const next=shot('a7',7,'333','5082704','Drew Fielder makes 25-foot three point jumper',3,{x:36,y:23});
 await h.tick(game(baseline));
 await h.tick(game([...baseline,alabamaThree,next],'in',23,16));
 assert.equal(h.active(),true);
 assert.match(h.overlay.innerHTML,/>3<small>PTS/);
 assert.equal(h.advance(),8000);
 assert.equal(h.active(),true,'second made shot should follow the first');
 assert.match(h.overlay.innerHTML,/>6<small>PTS/);
 assert.equal(h.advance(),8000);
 assert.equal(h.active(),false);
 await h.tick(game([...baseline,alabamaThree,next],'in',23,16));
 assert.equal(h.active(),false,'repeat poll must not replay either made basket');
});

test('late ESPN backfill still flashes a new basket even when a later timeout already arrived',async()=>{
 const h=wing(teamNames[0]);
 const timeout={id:'late-timeout',sequenceNumber:121604446,text:'UConn Timeout',shootingPlay:false,scoringPlay:false,scoreValue:0,team:{id:'338'}};
 await h.tick(game([...baseline,timeout]));
 assert.equal(h.active(),false);
 const backfilled=shot('backfilled-3pt',121604293,'333','5082704','Drew Fielder makes 25-foot three point jumper',3,{x:36,y:23});
 await h.tick(game([...baseline,backfilled,timeout], 'in',20,16));
 assert.equal(h.active(),true,'a unique made shot must not be dropped because a later play appeared first');
 assert.match(h.overlay.innerHTML,/DREW FIELDER/i);
 assert.match(h.overlay.innerHTML,/THREE-POINTER/);
 assert.equal(h.advance(),8000);
 await h.tick(game([...baseline,backfilled,timeout], 'in',20,16));
 assert.equal(h.active(),false,'backfilled play ID must not flash twice');
});

test('30-second TV delay holds score and shot graphic in order without slowing 10-second feed',async()=>{
 const h=wing(teamNames[0],30);
 await h.tick(game(baseline));
 assert.equal(h.active(),false);
 assert.deepEqual(h.scores,[]);
 assert.equal(h.advance(),30000);
 assert.deepEqual(h.scores,['17']);
 await h.tick(game([...baseline,alabamaThree],'in',20,16));
 assert.equal(h.active(),false);
 assert.deepEqual(h.scores,['17']);
 assert.equal(h.advance(),30000);
 assert.deepEqual(h.scores,['17','20']);
 assert.equal(h.active(),true);
 assert.equal(h.api.status().broadcastDelaySeconds,30);
 assert.equal(h.advance(),8000);
 assert.equal(h.active(),false);
});

test('a shot with no athlete ID does not trigger an invented player spotlight',async()=>{
 const h=wing(teamNames[0]);
 await h.tick(game(baseline));
 await h.tick(game([...baseline,unassignedShot],'in',19,16));
 assert.equal(h.active(),false);
 assert.equal(h.api.status().knownEvents,0,'unattributed attempts must not be identified as a player');
});

test('missing coordinates remain unplotted, and missing headshots use genuine college team logo',async()=>{
 const h=wing(teamNames[0]);
 const unlocated=shot('a6',6,'333','4711306','Brandon Garrison makes layup',2,null);
 await h.tick(game(baseline.slice(0,1)));
 await h.tick(game([...baseline.slice(0,1),unlocated],'in',19,16));
 assert.equal(h.active(),true);
 assert.match(h.overlay.innerHTML,/BRANDON GARRISON/i);
 assert.match(h.overlay.innerHTML,/SHOT LOCATIONS UNAVAILABLE/);
 assert.match(h.overlay.innerHTML,/alabama-logo\.png/);
 assert.doesNotMatch(h.overlay.innerHTML,/headshots\/nba\//);
});

test('first load of already-completed college game never auto-replays final baskets',async()=>{
 const h=wing(teamNames[0]);
 await h.tick(game([...baseline,alabamaThree],'post',20,16));
 assert.equal(h.active(),false);
 assert.equal(h.api.status().phase,'post');
});
