/* MLB team board: preserves the globally approved scoreboard layout. */
(function(){
if(sport!=='mlb')return;
const eventId=p.get('eventId');
const band=app.querySelector('.band'),note=app.querySelector('.note');
const rows=[...app.querySelectorAll('.row')];
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const content=document.createElement('div');
content.className='mlb-game-state';
content.setAttribute('aria-live','off');
content.innerHTML='<div class="mlb-game-line"><strong class="mlb-inning">GAME STATE PENDING</strong><span class="mlb-count" hidden></span><span class="mlb-bases" hidden><i class="mlb-base" data-base="2"></i><i class="mlb-base" data-base="3"></i><i class="mlb-base" data-base="1"></i></span></div><div class="mlb-last" hidden></div>';
const extraStyle=document.createElement('style');
extraStyle.textContent='.mlb-game-state{margin:7px 0 6px;padding:5px 8px;border-top:1px solid #555;border-bottom:1px solid #555;color:#ddd;font-family:"Roboto Condensed",Arial,sans-serif}.mlb-game-line{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:clamp(13px,3.2vw,18px)}.mlb-inning{letter-spacing:.035em}.mlb-count{white-space:nowrap;font-weight:800}.mlb-bases{display:grid;grid-template-columns:repeat(2,10px);grid-template-rows:repeat(2,10px);gap:2px;transform:rotate(45deg);margin:4px 10px}.mlb-base{display:block;width:10px;height:10px;border:1px solid #ddd;background:#333}.mlb-base.on{background:#ffc544;border-color:#ffc544}.mlb-base[data-base="2"]{grid-column:1;grid-row:1}.mlb-base[data-base="1"]{grid-column:2;grid-row:1}.mlb-base[data-base="3"]{grid-column:1;grid-row:2}.mlb-last{font-family:Arial,sans-serif;font-size:clamp(10px,2.6vw,13px);color:#bdbdbd;padding-top:5px;line-height:1.25}.mlb-role{display:block;font-family:"Roboto Condensed",Arial,sans-serif;font-weight:700;font-size:clamp(9px,2vw,12px);letter-spacing:.08em;color:#f9cd66;margin-bottom:3px}';
document.head.appendChild(extraStyle);
app.querySelector('.header').insertAdjacentElement('afterend',content);
const inning=content.querySelector('.mlb-inning'),count=content.querySelector('.mlb-count'),bases=content.querySelector('.mlb-bases'),last=content.querySelector('.mlb-last');

function stat(item,keys,labels=[]){
 if(!item)return '—';
 const ki=item.keys.findIndex(x=>keys.includes(x));
 const i=ki>=0?ki:item.labels.findIndex(x=>labels.includes(x));
 return i<0?'—':item.a.stats?.[i]??'—';
}
function selectGroups(side){
 const data={batting:[],pitching:[]};
 for(const group of side?.statistics||[]){
  const groupName=norm(group.name||group.displayName||group.title||group.type);
  const labels=(group.labels||[]).map(norm),keys=(group.keys||[]).map(norm);
  let category=groupName.includes('pitch')?'pitching':groupName.includes('bat')?'batting':null;
  if(!category){if(labels.includes('ip')||labels.includes('era'))category='pitching';else if(labels.includes('ab')||labels.includes('rbi'))category='batting'}
  if(!category)continue;
  for(const a of group.athletes||[]){
   if(a.didNotPlay||a.athlete?.didNotPlay)continue;
   const athlete=a.athlete||{};
   if(!athlete.id&&!athlete.displayName)continue;
   data[category].push({a,athlete,keys,labels,category});
  }
 }
 return data;
}
function hitterStats(item){
 const h=stat(item,['hits'],['h']);
 const pa=stat(item,['plateappearances'],['pa']);
 const ab=stat(item,['atbats'],['ab']);
 const hr=stat(item,['homeruns','homeRuns'.toLowerCase()],['hr']);
 const rbi=stat(item,['runsbattedin','rbis'],['rbi']);
 return {labels:[pa!=='—'?'H/PA':'H/AB','HR','RBI'],values:[String(h)+'/'+String(pa!=='—'?pa:ab),hr,rbi]};
}
function pitcherStats(item){
 return {labels:['IP','K','ERA'],values:[
  stat(item,['inningspitched'],['ip']),
  stat(item,['strikeouts','pitchingstrikeouts'],['k','so']),
  stat(item,['earnedrunaverage'],['era'])
 ]};
}
function drawPlayer(row,item,role){
 const portrait=row.querySelector('.portrait'),name=row.querySelector('.player');
 const labels=[...row.querySelectorAll('.stats small')],vals=[...row.querySelectorAll('.stats b')];
 name.textContent='';portrait.textContent='';
 if(!item){name.textContent='NO VERIFIED PLAYER';labels.forEach(x=>x.textContent='—');vals.forEach(x=>x.textContent='—');portrait.textContent='—';return}
 const person=item.athlete||{};
 const label=document.createElement('span');label.className='mlb-role';label.textContent=role;
 name.appendChild(label);
 const title=document.createElement('span');title.textContent=person.displayName||person.fullName||'PLAYER';name.appendChild(title);
 name.style.fontSize=title.textContent.length>19?'clamp(11px,2.6vw,16px)':'';
 const headshot=person.headshot?.href||(typeof person.headshot==='string'?person.headshot:'')||(person.id?'https://a.espncdn.com/i/headshots/mlb/players/full/'+encodeURIComponent(person.id)+'.png':'');
 if(headshot){
  const img=document.createElement('img');img.src=headshot;img.alt='';img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
  img.onerror=()=>{portrait.textContent='HEADSHOT UNAVAILABLE'};portrait.appendChild(img);
 }else portrait.textContent='HEADSHOT UNAVAILABLE';
 const data=item.category==='pitching'?pitcherStats(item):hitterStats(item);
 labels.forEach((x,i)=>x.textContent=data.labels[i]||'—');
 vals.forEach((x,i)=>x.textContent=data.values[i]??'—');
}
function getSituPerson(situation,key,players,category){
 const source=situation?.[key]?.athlete||situation?.[key];
 if(!source)return null;
 const found=players.find(x=>source.id!=null&&String(x.athlete.id)===String(source.id));
 if(found)return found;
 if(!source.displayName&&!source.fullName)return null;
 return {athlete:source,category,keys:[],labels:[],a:{stats:[]}};
}
function dateInEastern(value){
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return null;
 const pieces=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 return pieces.year+pieces.month+pieces.day;
}
async function scoreSituation(data){
 const comp=data.header?.competitions?.[0];
 if(comp?.situation)return comp.situation;
 const date=dateInEastern(comp?.date||data.header?.date||data.gameInfo?.date);
 if(!date)return null;
 try{
  const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates='+date,{cache:'no-store'});
  if(!r.ok)return null;
  const events=(await r.json()).events||[];
  const e=events.find(x=>String(x.id)===String(eventId));
  return e?.competitions?.[0]?.situation||null;
 }catch(e){return null}
}
function showSituation(situation,status,comp){
 const state=status?.type?.state||comp?.status?.type?.state||'';
 const completed=Boolean(status?.type?.completed||comp?.status?.type?.completed||state==='post');
 const live=state==='in'||(Boolean(situation)&&!completed&&state!=='pre');
 const half=(status?.period||comp?.status?.period||'');
 if(completed){
  inning.textContent='FINAL'+(half?(' · '+half+' INN'):'');
  count.hidden=true;bases.hidden=true;last.hidden=true;
  return false;
 }
 if(!live){inning.textContent='PRE-GAME / NOT LIVE';count.hidden=true;bases.hidden=true;last.hidden=true;return false}
 const d=status?.type?.shortDetail||status?.type?.detail||status?.type?.description||'LIVE';
 inning.textContent=String(d).toUpperCase();
 if(situation && Number.isFinite(Number(situation.balls))&&Number.isFinite(Number(situation.strikes))&&Number.isFinite(Number(situation.outs))){
  count.textContent='B '+situation.balls+'  S '+situation.strikes+'  O '+situation.outs;
  count.hidden=false;
 }else count.hidden=true;
 if(situation && ['onFirst','onSecond','onThird'].some(k=>typeof situation[k]==='boolean')){
  bases.hidden=false;
  for(const [name,key] of [['1','onFirst'],['2','onSecond'],['3','onThird']]){
   bases.querySelector('[data-base="'+name+'"]').classList.toggle('on',situation[key]===true);
  }
 }else bases.hidden=true;
 const lastText=situation?.lastPlay?.text||'';
 last.hidden=!lastText;
 if(lastText)last.textContent='LAST PLAY · '+lastText;
 return true;
}
async function update(){
 if(!eventId){band.textContent='SELECT A GAME';note.textContent='Choose an actual MLB matchup in the controller to load game statistics.';return}
 try{
  const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event='+encodeURIComponent(eventId),{cache:'no-store'});
  if(!r.ok)throw Error('ESPN '+r.status);
  const data=await r.json();
  const comp=data.header?.competitions?.[0]||{};
  const match=(comp.competitors||[]).find(x=>norm(x.team?.displayName)===norm(team)||norm(x.team?.name)===norm(team));
  if(!match)throw Error('Team is not in the selected MLB event');
  setHeader(match);setScore(match.score??'—');
  const logo=app.querySelector('.logo'),t=match.team||{};
  const src=t.logo||t.logos?.[0]?.href||(t.id?'https://a.espncdn.com/i/teamlogos/mlb/500/'+encodeURIComponent(t.id)+'.png':'');
  if(src){logo.src=src;logo.hidden=false}
  const records=match.record||match.records||[];
  app.querySelector('.team-record').textContent=Array.isArray(records)?((records.find(x=>x.type==='total')||records[0])?.summary||''):(records.summary||'');
  const allBox=data.boxscore?.players||[];
  const selectedSide=allBox.find(x=>(t.id!=null&&x.team?.id!=null&&String(x.team.id)===String(t.id))||norm(x.team?.displayName)===norm(team));
  const own=selectGroups(selectedSide);
  const other=allBox.flatMap(s=>{const group=selectGroups(s);return [...group.batting,...group.pitching]});
  const situation=await scoreSituation(data);
  const live=showSituation(situation,data.header?.competitions?.[0]?.status||data.header?.status,comp);
  const selected=[],used=new Set();
  const add=(item,role)=>{
   if(!item||selected.length>=4)return;
   const id=String(item.athlete?.id||item.athlete?.displayName||'');
   if(!id||used.has(id))return;
   used.add(id);selected.push({item,role});
  };
  if(live&&situation){
   add(getSituPerson(situation,'batter',other.filter(x=>x.category==='batting'),'batting'),'AT BAT');
   add(getSituPerson(situation,'pitcher',other.filter(x=>x.category==='pitching'),'pitching'),'ON MOUND');
  }
  const scoredHits=item=>{const v=Number(stat(item,['hits'],['h']));return Number.isFinite(v)?v:0};
  const scoredHR=item=>{const v=Number(stat(item,['homeruns'],['hr']));return Number.isFinite(v)?v:0};
  const batters=[...own.batting].sort((a,b)=>(scoredHits(b)-scoredHits(a))||(scoredHR(b)-scoredHR(a)));
  batters.forEach(x=>add(x,'TEAM BATTER'));
  own.pitching.forEach(x=>add(x,'TEAM PITCHER'));
  rows.forEach((row,i)=>drawPlayer(row,selected[i]?.item,selected[i]?.role||''));
  band.textContent=live?'LIVE GAME':'GAME CONTRIBUTORS';
  note.textContent=live
   ?'B/S/O, occupied bases, batter, pitcher, and last play appear only when the live feed supplies them. Batting numbers are current-game stats; pitchers show game IP/K and ERA when published. H/AB is used when plate appearances are unavailable.'
   :'Selected team box-score contributors. Final scores and game statistics remain displayed until you select another board. No live count, baserunners, or current batter/pitcher are claimed after the game ends.';
 }catch(e){band.textContent='GAME DATA UNAVAILABLE';note.textContent='MLB update unavailable: '+e.message+'. Retrying automatically.'}
}
update();setInterval(update,45000);
})();