/* MAN CAVE SPORTS BOOK · NHL live on-ice selector.
 * Only uses ESPN's summary.onIce[*].entries athleteid + whereabouts "In Play"
 * for a verified on-ice lineup. Never equates boxscore membership with current ice.
 * Preserves the approved 6 portrait rows, header, fonts, and stat columns.
 */
(()=>{
'use strict';
if(sport!=='nhl')return;
const meta=app.querySelector('.meta'),band=app.querySelector('.band'),note=app.querySelector('.note');
const nodes=Array.from(app.querySelectorAll('.row'));
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const list=x=>Array.isArray(x)?x:[];
const requested=String(p.get('eventId')||'');
const url='https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event='+encodeURIComponent(requested);
let busy=false,hasRendered=false,lastVerifiedIds=[],lastVerification=0,lastError='',lastMode='pending';
band.textContent='ON ICE';meta.textContent='LOOKING UP NHL LIVE LINEUP…';
const rosterFor=(summary,match)=>{
 const byId=new Map();
 const side=list(summary.boxscore?.players).find(x=>String(x.team?.id||'')===String(match.team?.id||'')||norm(x.team?.abbreviation)===norm(match.team?.abbreviation));
 for(const group of list(side?.statistics)){
  for(const a of list(group.athletes)){
   const id=String(a.athlete?.id||'');
   if(id&&!byId.has(id))byId.set(id,{a,keys:list(group.keys).map(norm),labels:list(group.labels).map(norm),id});
  }
 }
 return byId;
};
const onIceIds=(summary,match,roster)=>{
 const group=list(summary.onIce).find(x=>String(x.teamId||'')===String(match.team?.id||''));
 if(!group)return null;
 const ids=[...new Set(list(group.entries)
  .filter(entry=>String(entry?.whereabouts?.id||'')==='1'||entry?.whereabouts?.name==='ROSTER_WHEREABOUTS_IN_PLAY')
  .map(entry=>String(entry?.athleteid||'')).filter(Boolean))];
 // Includes goalie when one is on ice; power plays and overtime may have < 6.
 // Refuse partial/unmapped data rather than invent missing active players.
 return ids.length>=4&&ids.length<=6&&ids.every(id=>roster.has(id))?ids:null;
};
const position=data=>{
 const a=data?.a?.athlete||{};
 const code=String(a.position?.abbreviation||a.position?.displayName||a.position?.name||'').toUpperCase();
 return /^G$|GOAL/.test(code)?'G':/^C$|CENTER/.test(code)?'C':/^D$|DEFEN/.test(code)?'D':'F';
};
const rank=data=>({C:0,F:1,D:2,G:3})[position(data)]??2;
const byPosition=(a,b)=>rank(a)-rank(b);
const fallbackIds=roster=>{
 const athletes=[...roster.values()];
 const centers=athletes.filter(a=>position(a)==='C');
 const forwards=athletes.filter(a=>position(a)==='F');
 const defenders=athletes.filter(a=>position(a)==='D');
 const goalies=athletes.filter(a=>position(a)==='G');
 const ordered=[...centers.slice(0,1),...forwards.slice(0,2),...defenders.slice(0,2),...goalies.slice(0,1),...athletes];
 return [...new Set(ordered.map(x=>x.id))].slice(0,6);
};
const stat=(data,keys,labels)=>{
 let i=data.keys.findIndex(x=>keys.includes(x));
 if(i<0)i=data.labels.findIndex(x=>labels.includes(x));
 return i<0?'—':data.a.stats?.[i]??'—';
};
function updateRow(node,data){
 const photo=node.querySelector('.portrait'),name=node.querySelector('.player'),
  labels=Array.from(node.querySelectorAll('.stats small')),vals=Array.from(node.querySelectorAll('.stats b'));
 if(!data){
  if(node.dataset.nhlPlayerId!==''){
   node.dataset.nhlPlayerId='';
   name.textContent='NO PLAYER ON ICE';name.style.fontSize='';
   photo.textContent='—';
  }
  vals.forEach(v=>v.textContent='—');
  return;
 }
 const athlete=data.a.athlete||{};
 // Do not rebuild the headshot every 12 seconds if the player has not changed.
 if(node.dataset.nhlPlayerId!==data.id){
  node.dataset.nhlPlayerId=data.id;
  name.textContent=athlete.displayName||athlete.fullName||'PLAYER';
  name.style.fontSize=name.textContent.length>17?'clamp(11px,2.6vw,16px)':'';
  const src=athlete.headshot?.href||'https://a.espncdn.com/i/headshots/nhl/players/full/'+encodeURIComponent(data.id)+'.png';
  photo.textContent='';
  const img=document.createElement('img');
  img.src=src;img.alt='';img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
  img.onerror=()=>{if(node.dataset.nhlPlayerId===data.id)photo.textContent='HEADSHOT UNAVAILABLE';};
  photo.appendChild(img);
 }
 const goalie=position(data)==='G';
 const wanted=goalie?[
  ['SV',['saves'],['sv']],['SA',['shotsagainst'],['sa']],['SV%',['savepct','savepercentage'],['sv']]
 ]:[
  ['G',['goals'],['g']],['A',['assists'],['a']],['+/-',['plusminus'],['']]
 ];
 for(let i=0;i<Math.min(3,labels.length,vals.length);i++){
  labels[i].textContent=wanted[i][0];
  vals[i].textContent=stat(data,wanted[i][1],wanted[i][2]);
 }
}
function render(summary,match){
 setHeader(match);setScore(match.score??'—');
 const record=match.records?.find?.(r=>r.type==='total')?.summary||match.records?.[0]?.summary||match.record?.[0]?.summary||'';
 app.querySelector('.team-record').textContent=record;
 const logo=app.querySelector('.logo');
 const logoSrc=match.team?.logo||match.team?.logos?.[0]?.href||(match.team?.abbreviation?'https://a.espncdn.com/i/teamlogos/nhl/500/'+match.team.abbreviation.toLowerCase()+'.png':'');
 if(logoSrc&&logo.getAttribute('src')!==logoSrc){logo.src=logoSrc;logo.hidden=false;}
 const roster=rosterFor(summary,match);
 const status=summary.header?.competitions?.[0]?.status||summary.header?.status||{};
 const state=String(status.type?.state||status.state||'').toLowerCase();
 const ids=state==='in'?onIceIds(summary,match,roster):null;
 if(ids){lastVerifiedIds=ids;lastVerification=Date.now();}
 const held=lastVerifiedIds.length&&lastVerifiedIds.every(id=>roster.has(id));
 const selected=ids||(held?lastVerifiedIds:fallbackIds(roster));
 const chosen=selected.map(id=>roster.get(id)).filter(Boolean).sort(byPosition).slice(0,6);
 nodes.forEach((node,i)=>updateRow(node,chosen[i]||null));
 hasRendered=true;
 if(state==='post'){
  band.textContent='KEY PLAYERS';lastMode='final';
  meta.textContent='ESPN · FINAL GAME STATS';
  note.textContent='Final score and game stats. Last verified on-ice players may be retained; no claim of current ice time.';
 }else if(ids){
  band.textContent='ON ICE';lastMode='verified';
  meta.textContent='ESPN · LIVE ON-ICE PLAYERS';
  note.textContent='Players are selected from ESPN onIce athlete IDs for this team; current-game stats refresh independently. Provider updates may be delayed.';
 }else if(held){
  band.textContent='LAST ON ICE';lastMode='held';
  meta.textContent='ESPN · WAITING FOR NEXT LINEUP UPDATE';
  note.textContent='Holding the last verified six from '+new Date(lastVerification).toLocaleTimeString()+'. Current on-ice lineup is not available from the latest ESPN response.';
 }else{
  band.textContent='GAME PLAYERS';lastMode='unverified';
  meta.textContent='ESPN · LIVE LINEUP NOT VERIFIED';
  note.textContent='Using game participants temporarily. ESPN has not supplied a complete verified on-ice lineup for this team.';
 }
}
async function refresh(){
 if(!/^\d{5,15}$/.test(requested)){
  band.textContent='GAME PLAYERS';meta.textContent='SELECT AN NHL GAME';
  note.textContent='A valid ESPN NHL event ID is needed to identify the players on ice.';return;
 }
 if(busy||document.hidden)return;
 busy=true;
 try{
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error('ESPN HTTP '+response.status);
  const summary=await response.json();
  const match=list(summary.header?.competitions?.[0]?.competitors).find(x=>norm(x.team?.displayName)===norm(team)||norm(x.team?.name)===norm(team)||norm(x.team?.abbreviation)===norm(team));
  if(!match)throw Error('Selected NHL team missing from ESPN event');
  render(summary,match);
  lastError='';
 }catch(e){
  lastError=String(e?.message||e);
  meta.textContent=hasRendered?'ESPN · HOLDING LAST LINEUP':'NHL LINEUP FEED UNAVAILABLE';
  note.textContent='NHL feed error: '+lastError+'. Retrying; previous valid lineup remains on screen.';
 }
 finally{busy=false;}
}
window.ManCaveNhlOnIce=Object.freeze({
 status:()=>({team,eventId:requested,mode:lastMode,verifiedCount:lastVerifiedIds.length,
  lastVerifiedAt:lastVerification,error:lastError}),
 refresh
});
refresh();
setInterval(refresh,12000);
})();