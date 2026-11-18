import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const live=read('team-board.html');
const preview=read('team-board-nba-flash-preview-v4.html');
const overlayCode=read('nba-scoring-flash-preview-v4.js');
const archive=JSON.parse(read('nba-scoring-archive-401585607.json'));
const sharedTag='<script src="./nba-scoring-flash-preview-v4.js?headshot=39pct-full-v4"></script>';

test('production team board differs from Gold Master preview only in title',()=>{
 assert.ok(live.includes(sharedTag),'production board must load exact Gold Master');
 assert.ok(preview.includes(sharedTag),'preview must use the identical script version');
 const normalized=s=>s.replace(/<title>.*?<\/title>/,'<title>same</title>');
 assert.equal(normalized(live),normalized(preview),'approved base design must be byte-identical');
 assert.match(overlayCode, /if\(qs\.get\('sport'\)!=='nba'\)return;/,
  'non-NBA boards must never render NBA scoring flash');
 assert.match(overlayCode,/#nbaFlash \.f-head\{width:39%/);
 assert.match(overlayCode,/border:0;border-radius:0;background:transparent/);
 assert.match(overlayCode,/background:#020204/);
 assert.match(overlayCode,/'#37ff8e'/);
 assert.match(overlayCode,/'#ff405c'/);
 for(const side of ['left','right']){
  const receiver=read(side+'.html');
  assert.match(receiver,/team-board\.html\?sport=/,'both real wing TVs must continue existing assignment flow');
  assert.match(receiver,new RegExp("side="+side),'wing side must remain fixed');
  assert.match(receiver,new RegExp("screens/"+side),'wing must follow independent Firebase assignment');
  assert.doesNotMatch(receiver,/nba-flash-preview/,'live Fire TVs must not use preview receivers');
 }
});

function game(plays,state='in'){
 return {...archive,
  header:{...archive.header,competitions:archive.header.competitions.map(c=>({
   ...c,status:{type:{state,completed:state==='post'}}
  }))},
  plays};
}

function wing(team,side){
 let current=null,nextId=0;
 const timers=new Map();
 const active=new Set();
 const overlay={
  id:null,innerHTML:'',style:{setProperty(){}},
  classList:{
   contains(name){return active.has(name);},
   add(name){active.add(name);},
   remove(name){active.delete(name);}
  }
 };
 const document={
  hidden:false,
  head:{appendChild(){}},
  body:{appendChild(){}},
  createElement(tag){
   if(tag==='style')return {textContent:''};
   if(tag==='div')return overlay;
   throw Error('Unexpected DOM element '+tag);
  },
  getElementById(){return null;}
 };
 const window={};
 const context=vm.createContext({
  document,window,URLSearchParams,
  location:{search:'?sport=nba&team='+encodeURIComponent(team)+'&eventId=401585607&side='+side+'&tv=1'},
  fetch:async uri=>{
   assert.match(String(uri),/site\.api\.espn\.com\/apis\/site\/v2\/sports\/basketball\/nba\/summary\?event=401585607/);
   if(!current)throw Error('No test summary');
   return {ok:true,json:async()=>current};
  },
  getComputedStyle:()=>({getPropertyValue:()=> '#00a65a'}),
  setInterval:()=>null,
  setTimeout(fn,ms){const n=++nextId;timers.set(n,{fn,ms});return n;},
  clearTimeout(id){timers.delete(id);}
 });
 const snippet=overlayCode.replace('poll();setInterval(poll,12000);','window.__nbaStep=poll;');
 assert.notEqual(snippet,overlayCode,'test must exercise real polling logic, not a fake implementation');
 vm.runInContext(snippet,context);
 return {
  overlay,
  active:()=>overlay.classList.contains('active'),
  async tick(summary){current=summary;await window.__nbaStep();},
  advance(){
   const first=timers.entries().next().value;
   assert.ok(first,'a scoring flash must schedule automatic return');
   const [id,{fn,ms}]=first;timers.delete(id);fn();return ms;
  },
  remaining:()=>timers.size
 };
}

test('NBA scorer flashes only on own wing, from real ESPN plays, then returns to player board',async()=>{
 const left=wing('Toronto Raptors','left');
 const right=wing('Orlando Magic','right');
 const plays=archive.plays;
 const initial=game(plays.slice(0,3));
 await Promise.all([left.tick(initial),right.tick(initial)]);
 assert.equal(left.active(),false,'existing baskets must not auto-replay');
 assert.equal(right.active(),false,'existing baskets must not auto-replay');

 const orlandoBasket=game(plays.slice(0,4));
 await Promise.all([left.tick(orlandoBasket),right.tick(orlandoBasket)]);
 assert.equal(left.active(),false,'Toronto cannot flash for Orlando basket');
 assert.equal(right.active(),true,'Orlando must flash for its scorer');
 assert.match(right.overlay.innerHTML,/PAOLO BANCHERO/i);
 assert.match(right.overlay.innerHTML,/PLAYER SHOT CHART/);
 assert.match(right.overlay.innerHTML,/MAKES/);
 assert.match(right.overlay.innerHTML,/MISSES/);
 assert.match(right.overlay.innerHTML,/PTS/);
 const firstMs=right.advance();
 assert.equal(firstMs,6000,'two pointer returns to normal board after 6 seconds');
 assert.equal(right.active(),false);

 const torontoBasket=game(plays.slice(0,8));
 await Promise.all([left.tick(torontoBasket),right.tick(torontoBasket)]);
 assert.equal(left.active(),true,'Toronto must flash for its scorer');
 assert.match(left.overlay.innerHTML,/GRADEY DICK/i);
 assert.equal(right.active(),true,'Orlando must also queue later Orlando basket');
 assert.match(right.overlay.innerHTML,/WENDELL CARTER JR/i);
 assert.equal(right.advance(),8000,'three pointer returns to board after 8 seconds');
 assert.equal(right.active(),false);
 assert.equal(left.advance(),6000);
 assert.equal(left.active(),false);
 await Promise.all([left.tick(torontoBasket),right.tick(torontoBasket)]);
 assert.equal(left.active(),false,'same ESPN basket cannot flash twice');
 assert.equal(right.active(),false,'same ESPN basket cannot flash twice');
});

test('when no NBA game is selected, other sports preserve their existing player boards',()=>{
 assert.match(overlayCode,/if\(qs\.get\('sport'\)!=='nba'\)return;/);
 assert.match(read('left.html'),/\.\/team-board\.html\?sport=/);
 assert.match(read('right.html'),/\.\/team-board\.html\?sport=/);
});
