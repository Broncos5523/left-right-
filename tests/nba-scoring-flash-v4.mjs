import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const code=read('nba-scoring-flash-preview-v4.js');

test('exact approved V4 black/red/green shot-chart and frameless headshot kept',()=>{
 assert.match(code,/#nbaFlash\{position:fixed/);
 assert.match(code,/background:#020204/);
 assert.match(code,/'#37ff8e'/);
 assert.match(code,/'#ff405c'/);
 assert.match(code,/border:0;border-radius:0;background:transparent/);
 assert.match(code,/transform:translateY\(-18%\) scale\(1\.55\)/);
 assert.match(code,/timer=setTimeout\(/);
 assert.match(code,/isThree\?8000:6000/);
 assert.match(code,/if\(!p\)return '';/);
 assert.doesNotMatch(code,/firebase\.js|\.set\(ref\(db/);
});

test('preview wing receivers use V4, approved live receivers are preserved',()=>{
 for(const side of ['left','right']){
  const preview=read(side+'-nba-flash-preview.html');
  const live=read(side+'.html');
  assert.match(preview,/team-board-nba-flash-preview-v4\.html/);
  assert.match(preview,/screens\/(left|right)/);
  assert.match(live,/team-board-nba-flash-preview\.html/);
  assert.doesNotMatch(live,/team-board-nba-flash-preview-v4\.html/);
 }
 const board=read('team-board-nba-flash-preview-v4.html');
 assert.match(board,/nba-scoring-flash-preview-v4\.js/);
 const lab=read('nba-scoring-flash-lab-v1.html');
 assert.match(lab,/team-board-nba-flash-preview-v4\.html/);
});

test('historical archive contains real scorer and coordinates without assuming every event has a location',()=>{
 const archive=JSON.parse(read('nba-scoring-archive-401585607.json'));
 const shots=archive.plays.filter(p=>p.shootingPlay===true&&p.participants?.[0]?.athlete?.id);
 const scored=shots.filter(p=>p.scoringPlay===true&&(p.scoreValue===2||p.scoreValue===3));
 assert.ok(scored.length>25);
 assert.ok(shots.some(p=>p.coordinate?.x===25&&p.coordinate?.y===3));
 // ESPN uses large negative sentinels for unavailable coordinates.
 assert.ok(shots.some(p=>Number(p.coordinate?.x)<0));
 assert.match(code,/x>=0&&x<=50&&y>=-3&&y<=34/);
});

test('live scoring engine flashes each new basket in order, not historical or duplicates',()=>{
 const start=code.indexOf('function process(data){');
 const end=code.indexOf('\nasync function poll(){',start);
 assert.ok(start>=0&&end>start);
 const snippet=code.slice(start,end);
 const script=`(()=>{
 let latest=null,last=null,seen=new Set(),maxOrder=-1,loaded=false,phase='';
 const pending=[],displayed=[];
 let active=false;
 const overlay={classList:{contains:()=>active}};
 const document={getElementById:()=>null};
 const build=data=>data;
 const display=(entry)=>{active=true;displayed.push(entry.key);};
 ${snippet}
 return {process,pending,displayed,setActive:(v)=>{active=v}};
 })()`;
 const m=vm.runInNewContext(script);
 const play=(key,order)=>({key,order,p:{scoringPlay:true}});
 const frame=(all,makeList,state='in')=>({
   selectedId:'19',all,shots:makeList,shotMakes:makeList,
   header:{status:{type:{state}}}
 });
 const b1=play('old',10),b2=play('new-2',11),b3=play('new-3',12);
 m.process(frame([b1],[b1]));
 assert.equal(m.displayed.length,0,'must not autoplay past score on initialization');
 m.process(frame([b1,b2,b3],[b1,b2,b3]));
 assert.deepEqual([...m.displayed],['new-2']);
 assert.deepEqual(m.pending.map(p=>p.entry.key),['new-3']);
 m.process(frame([b1,b2,b3],[b1,b2,b3]));
 assert.deepEqual(m.pending.map(p=>p.entry.key),['new-3'],'duplicate polling cannot requeue scores');
});
