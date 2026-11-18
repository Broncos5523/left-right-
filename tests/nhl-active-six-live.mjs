import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const code=read('nhl-on-ice-engine.js');
const chosenTag='<script src="./nhl-on-ice-engine.js?v=20261117-active-six-v2"></script>';

test('production and approved preview use identical six-row NHL engine without touching layout',()=>{
 const prod=read('team-board.html'),preview=read('team-board-nba-flash-preview-v4.html');
 assert.ok(prod.includes(chosenTag));assert.ok(preview.includes(chosenTag));
 const norm=s=>s.replace(/<title>.*?<\/title>/,'<title>same</title>');
 assert.equal(norm(prod),norm(preview),'approved board base and NBA flash should remain identical');
 assert.match(prod,/nba-scoring-flash-preview-v4.js\?headshot=39pct-full-v4/);
 assert.match(code,/if\(sport!=='nhl'\)return;/);
 assert.match(code,/summary\.onIce/);
 assert.match(code,/athleteid/);
 assert.match(code,/whereabouts/);
 assert.match(code,/setInterval\(refresh,12000\)/);
 assert.doesNotMatch(code,/\.slice\(0,6\).*side\?\.statistics/,'must not treat first six boxscore rows as on ice');
});

function rosterPlayer(id,name,position,stats){
 return {athlete:{id:String(id),displayName:name,position:{abbreviation:position},headshot:{href:'https://example.com/'+id+'.png'}},stats};
}
const bteam={id:'1',displayName:'Boston Bruins',abbreviation:'BOS',logo:'https://example.com/bos.png'};
const ateam={id:'8',displayName:'Los Angeles Kings',abbreviation:'LAK'};
const bplayers=[
 rosterPlayer('11','BRUINS CENTER','C',['1','2','0']),
 rosterPlayer('12','BRUINS WING A','LW',['1','0','1']),
 rosterPlayer('13','BRUINS WING B','RW',['0','1','0']),
 rosterPlayer('14','BRUINS DEFENSE A','D',['0','1','1']),
 rosterPlayer('15','BRUINS DEFENSE B','D',['0','0','1']),
 rosterPlayer('16','BRUINS GOALIE','G',['26','29','.897']),
 rosterPlayer('17','BRUINS SUBSTITUTE','RW',['0','1','0']),
 rosterPlayer('18','BRUINS RESERVE','C',['0','0','0'])
];
function summary(ids,withOnIce=true,state='in'){
 return {
  header:{competitions:[{competitors:[{team:bteam,score:'2',records:[{type:'total',summary:'12-5-2'}]},
    {team:ateam,score:'1'}],status:{type:{state}}}]},
  boxscore:{players:[{team:bteam,statistics:[
   {name:'forwards',keys:['goals','assists','plusMinus'],athletes:bplayers.filter(x=>!['D','G'].includes(x.athlete.position.abbreviation))},
   {name:'defenses',keys:['goals','assists','plusMinus'],athletes:bplayers.filter(x=>x.athlete.position.abbreviation==='D')},
   {name:'goalies',keys:['saves','shotsAgainst','savePct'],athletes:bplayers.filter(x=>x.athlete.position.abbreviation==='G')}
  ]}]},
  onIce:withOnIce?[{teamId:'1',entries:ids.map(id=>({athleteid:id,whereabouts:{id:'1',description:'In Play'}}))}]:[]
 };
}
function harness(){
 let current=null;
 const txt=()=>({textContent:'',style:{},hidden:false,getAttribute(){return this.src||''}});
 const rows=Array.from({length:6},()=>({
  dataset:{},portrait:{textContent:'',image:null,appendChild(img){this.image=img;}},
  name:txt(),labels:Array.from({length:3},txt),values:Array.from({length:3},txt),
  querySelector(key){return key==='.portrait'?this.portrait:key==='.player'?this.name:null;},
  querySelectorAll(key){return key==='.stats small'?this.labels:key==='.stats b'?this.values:[];}
 }));
 const single={'.meta':txt(),'.band':txt(),'.note':txt(),'.team-record':txt(),'.logo':txt()};
 const app={querySelector:key=>single[key],querySelectorAll:key=>key==='.row'?rows:[]};
 const document={hidden:true,createElement:()=>({src:'',alt:'',style:{}})};
 const window={};
 const clock=[];
 const ctx=vm.createContext({
  sport:'nhl',team:'Boston Bruins',p:{get:()=> '401892728'},
  app,window,document,Date,setHeader:()=>{},setScore:()=>{},
  setInterval:(fn,delay)=>{clock.push(delay);return 1;},
  fetch:async()=>({ok:true,json:async()=>current}),
  console
 });
 vm.runInContext(code,ctx);
 document.hidden=false;
 return {rows,single,clock,async update(value){current=value;await window.ManCaveNhlOnIce.refresh();},
   status:()=>window.ManCaveNhlOnIce.status()};
}
test('six real IDs sort C/F/D/G and update when the live NHL lineup changes',async()=>{
 const h=harness();
 await h.update(summary(['16','15','14','13','12','11']));
 assert.equal(h.clock[0],12000);
 assert.deepEqual(h.rows.map(r=>r.name.textContent),[
  'BRUINS CENTER','BRUINS WING A','BRUINS WING B','BRUINS DEFENSE A','BRUINS DEFENSE B','BRUINS GOALIE'
 ]);
 assert.equal(h.single['.band'].textContent,'ON ICE');
 assert.equal(h.status().mode,'verified');
 assert.equal(h.rows[5].labels[0].textContent,'SV');
 assert.equal(h.rows[5].values[0].textContent,'26');
 const priorImg=h.rows[0].portrait.image;
 await h.update(summary(['16','15','14','13','12','17']));
 assert.equal(h.rows[0].name.textContent,'BRUINS SUBSTITUTE');
 assert.ok(h.rows.some(r=>r.name.textContent==='BRUINS SUBSTITUTE'));
 assert.ok(!h.rows.some(r=>r.name.textContent==='BRUINS CENTER'));
 assert.equal(h.status().verifiedCount,6);
 await h.update(summary(['16','15','14','13','12','17']));
 assert.equal(h.rows[5].name.textContent,'BRUINS GOALIE');
 assert.equal(h.single['.meta'].textContent,'ESPN · LIVE ON-ICE PLAYERS');
});
test('holding prior NHL verified players is clearly labelled when onIce temporarily disappears',async()=>{
 const h=harness();
 await h.update(summary(['11','12','13','14','15','16']));
 const prior=h.rows.map(r=>r.name.textContent);
 await h.update(summary(['11','12','13','14','15','16'],false));
 assert.equal(h.single['.band'].textContent,'LAST ON ICE');
 assert.equal(h.status().mode,'held');
 assert.deepEqual(h.rows.map(r=>r.name.textContent),prior);
});
test('missing onIce never falsely labels arbitrary box score roster as current on ice',async()=>{
 const h=harness();
 await h.update(summary([],false));
 assert.equal(h.single['.band'].textContent,'GAME PLAYERS');
 assert.equal(h.status().mode,'unverified');
 assert.match(h.single['.note'].textContent,/not supplied a complete verified on-ice lineup/);
});
test('end-of-period reporting keeps lineup visible without claiming players are currently skating',async()=>{
 const h=harness();
 const intermission=summary(['11','12','13','14','15','16']);
 intermission.header.competitions[0].status.type.name='STATUS_END_PERIOD';
 await h.update(intermission);
 assert.equal(h.single['.band'].textContent,'LAST ON ICE');
 assert.match(h.single['.meta'].textContent,/INTERMISSION/);
 assert.equal(h.status().mode,'held');
 assert.equal(h.rows.filter(r=>r.name.textContent.includes('BRUINS')).length,6);
});
test('power plays and overtime can show fewer players without inventing active players',async()=>{
 const h=harness();
 await h.update(summary(['11','12','14','16']));
 assert.equal(h.status().verifiedCount,4);
 assert.equal(h.rows[4].name.textContent,'NO PLAYER ON ICE');
 assert.equal(h.rows[5].name.textContent,'NO PLAYER ON ICE');
 assert.equal(h.single['.band'].textContent,'ON ICE');
});
