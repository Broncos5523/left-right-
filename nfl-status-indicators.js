/* LEFT RIGHT · NFL-only broadcast dots · independent of player renderer.
   Yellow: unused timeout; gray: used; green: available challenge; red: expended.
   No labels on screen. Never count automatic/official reviews as coach challenges.
   Missing or ambiguous live data is hidden, never synthesized.
*/
(function(){
'use strict';
if(typeof sport==='undefined'||sport!=='nfl')return;
const game=String(p.get('eventId')||'');
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const row=document.createElement('div');
row.className='nfl-indicators';row.hidden=true;row.setAttribute('role','img');
const t=document.createElement('span'),c=document.createElement('span'),sep=document.createElement('span');
t.className=c.className='nfl-dots';sep.className='nfl-separator';sep.textContent='/';
for(let i=0;i<3;i++){let d=document.createElement('i');d.className='nfl-dot';t.appendChild(d);}
for(let i=0;i<2;i++){let d=document.createElement('i');d.className='nfl-dot';c.appendChild(d);}
row.append(t,sep,c);
const style=document.createElement('style');
style.textContent='.nfl-indicators{display:flex;width:100%;align-items:center;justify-content:center;gap:clamp(3px,.8vw,5px);min-height:15px;margin-top:2px;white-space:nowrap}.nfl-indicators[hidden],.nfl-dots[hidden],.nfl-separator[hidden]{display:none!important}.nfl-dots{display:inline-flex;align-items:center;gap:clamp(3px,.8vw,5px)}.nfl-dot{display:block;flex:none;width:clamp(7px,1.8vw,10px);height:clamp(7px,1.8vw,10px);border-radius:50%}.nfl-separator{font:700 clamp(13px,3vw,18px)/13px Arial,sans-serif;color:#E6E9EF;margin:0 1px}';
document.head.appendChild(style);
app.querySelector('.logo-group')?.appendChild(row);
const store={timeouts:null,results:null,source:'',updatedAt:0,phase:'unknown',error:''};
const yellow='#FFD52A',gray='#9CA3AF',green='#22C55E',red='#DC3945';
function colors(res){
 if(!Array.isArray(res)||res.length>3)return null;
 if(res.length===0)return [green,green];
 if(res.length===1)return res[0]?[green,green]:[red,green];
 if(res.length===2)return res[0]?[green,red]:res[1]?[red,green]:[red,red];
 return [red,red];
}
function draw(){
 if(store.phase==='post'){row.hidden=true;return}
 const hasT=Number.isInteger(store.timeouts),pair=colors(store.results),hasC=!!pair;
 row.hidden=!hasT&&!hasC;t.hidden=!hasT;c.hidden=!hasC;sep.hidden=!hasT||!hasC;
 if(hasT)[...t.children].forEach((e,i)=>e.style.backgroundColor=i<store.timeouts?yellow:gray);
 if(hasC)[...c.children].forEach((e,i)=>e.style.backgroundColor=pair[i]);
 row.setAttribute('aria-label',(hasT?store.timeouts+' timeouts remaining':'Timeouts unavailable')+'; '+(hasC?'two coach-challenge availability indicators':'challenge availability unavailable'));
}
const number=x=>{
 if(x===null||x===undefined||x==='')return null;
 const n=Number(x);return Number.isInteger(n)&&n>=0&&n<=3?n:null;
};
function timeoutValue(comp,side){
 const s=comp?.situation||{},key=side+'Timeouts',value=s[key];
 const team=comp?.competitors?.find(x=>x.homeAway===side);
 for(const candidate of [value,value?.timeoutsRemainingCurrent,value?.timeoutsRemaining,comp?.[key],
  comp?.[key]?.timeoutsRemaining,team?.timeoutsRemaining,team?.timeouts]){
  const n=number(candidate);if(n!==null)return n;
 }
 return null;
}
function compOf(d){return d?.header?.competitions?.[0]||d?.competitions?.[0]||{}}
function phase(d){
 const comp=compOf(d),st=comp.status||d?.header?.status||d?.status||{};
 const state=String(st.type?.state||st.state||'').toLowerCase();
 return st.type?.completed===true||st.completed===true||state==='post'?'post':state==='pre'?'pre':state==='in'?'in':'unknown';
}
function sideOf(d){
 const x=(compOf(d).competitors||[]).find(y=>norm(y.team?.displayName)===norm(team)||norm(y.team?.name)===norm(team));
 return x?.homeAway||null;
}
function result(text){
 if(/\b(unsuccessful|challenge failed|challenge fails|ruling stands|call stands|ruling upheld|not overturned|confirmed)\b/i.test(text))return false;
 if(/\b(successful|overturned|reversed|ruling changed)\b/i.test(text))return true;
 return null;
}
function collect(d){
 const groups=[],drives=d?.drives||{};
 if(Array.isArray(d?.plays))groups.push(d.plays);
 (drives.previous||[]).forEach(x=>{if(Array.isArray(x.plays))groups.push(x.plays)});
 if(Array.isArray(drives.current?.plays))groups.push(drives.current.plays);
 const map=new Map();
 groups.flat().forEach((x,i)=>{if(x&&typeof x==='object')map.set(String(x.id||x.sequenceNumber||i),x)});
 const plays=[...map.values()];
 if(plays.length&&plays.every(x=>Number.isFinite(Number(x.sequenceNumber||x.id))))plays.sort((a,b)=>Number(a.sequenceNumber||a.id)-Number(b.sequenceNumber||b.id));
 return plays;
}
function challengeHistory(d,side){
 const plays=collect(d),teams=compOf(d).competitors||[];
 if(!plays.length)return null;
 let ambiguous=false;const found=[];
 for(let i=0;i<plays.length;i++){
  const x=plays[i],text=String(x.text||x.description||''),label=String(x.type?.text||'');
  const combined=label+' '+text;
  if(!/\bchalleng(?:e|es|ed|ing)\b/i.test(combined))continue;
  if(/\b(?:booth|official|automatic)\s+review\b/i.test(combined)&&!/\bcoach\b/i.test(combined))continue;
  const claimed=teams.find(y=>{
   const n=y.team||{};
   return [n.displayName,n.shortDisplayName,n.name,n.abbreviation].filter(Boolean).some(k=>{
    const val=String(k).toLowerCase(),body=text.toLowerCase();
    return body.includes(val+' challenges')||body.includes(val+' challenged')||body.includes('challenge by '+val)||body.includes('challenged by '+val)||body.includes('challenge from '+val);
   });
  });
  if(!claimed){ambiguous=true;continue;}
  let outcome=result(combined);
  if(outcome===null&&i+1<plays.length){
   const next=String(plays[i+1].text||'');
   if(/\b(review|ruling|challenge)\b/i.test(next))outcome=result(next);
  }
  if(outcome===null){ambiguous=true;continue;}
  found.push({side:claimed.homeAway,success:outcome});
 }
 if(ambiguous)return null;
 const own=found.filter(x=>x.side===side).map(x=>x.success);
 return own.length>3||(own.length===3&&!own.slice(0,2).includes(true))?null:own;
}
async function load(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('ESPN HTTP '+r.status);return r.json()}
function dateKey(iso){
 const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
 return parts.year+parts.month+parts.day;
}
let busy=false,timer;
async function update(){
 if(!game||busy)return;busy=true;
 try{
  const summary=await load('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event='+encodeURIComponent(game));
  const side=sideOf(summary);if(!side)throw Error('Selected team not found');
  const pstate=phase(summary);store.phase=pstate;
  if(pstate==='post'){store.timeouts=null;store.results=null;draw();clearInterval(timer);return;}
  if(pstate==='pre'){store.timeouts=3;store.results=[];store.source='pregame-rule';store.updatedAt=Date.now();draw();return;}
  let count=timeoutValue(compOf(summary),side),source=count!==null?'summary':'';
  if(count===null){
   const date=dateKey(compOf(summary).date||summary.header?.date);
   if(date)try{
    const scores=await load('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates='+date);
    const event=(scores.events||[]).find(x=>String(x.id)===game);
    if(event){count=timeoutValue(compOf(event),side);if(count!==null)source='scoreboard';}
   }catch(_){}
  }
  if(count===null&&/^\d+$/.test(game))try{
   const cid=String(compOf(summary).id||game);
   const sit=await load('https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/'+encodeURIComponent(game)+'/competitions/'+encodeURIComponent(cid)+'/situation');
   count=number(sit[side+'Timeouts']);if(count!==null)source='core';
  }catch(_){}
  store.timeouts=count;store.results=challengeHistory(summary,side);store.source=source||'unavailable';
  store.updatedAt=Date.now();draw();
 }catch(err){
  store.error=String(err.message||err);
  if(Date.now()-store.updatedAt>120000){store.timeouts=null;store.results=null;draw();}
 }finally{busy=false}
}
window.__LR_NFL_INDICATORS__={colors,timeoutValue,challengeHistory,store,refresh:update};
draw();update();timer=setInterval(update,20000);
})();