// V41 — dynamic Screen Wall preview. Reflects accepted commands / Firebase assignments,
// NEVER claims that physical playback has been verified.
(()=>{
'use strict';
const KEY='mancave-gamewall-last-sent-v41';
const boxes={'Top Left':'.physicalUnit.topLeft','Top Right':'.physicalUnit.topRight',
 'Center':'.physicalUnit.mainUnit','Side':'.physicalUnit.lowerSide'};
const wings={left:'.physicalMiddle .wingUnit:first-child',right:'.physicalMiddle .wingUnit:last-child'};
const local={},remote={};
const esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const str=x=>typeof x==='string'||typeof x==='number'?String(x):'';
function safeLogo(value){
 if(typeof value!=='string'||value.length>1000)return '';
 return /^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/(?:i|combiner)\/[^\s<>"'\x60]{1,980}$/i.test(value.trim())?value.trim():'';
}
function safeColor(value,fallback){
 const x=String(value||'').replace(/^#/,'');
 return /^[0-9a-f]{6}$/i.test(x)?'#'+x:fallback;
}
function teamData(team){
 return {name:str(team?.name||team?.fullName||'Team').slice(0,80),
  fullName:str(team?.fullName||team?.name||'').slice(0,140),
  abbr:str(team?.abbr||'').slice(0,7),
  logo:safeLogo(team?.logo),
  color:safeColor(team?.color,'#2a5279')};
}
function snapshot(game){
 if(!game||!game.away||!game.home)return null;
 const league=str(game.league),eventId=str(game.eventId);
 if(!['NFL','NBA','NHL','MLB','WNBA','NCAAF','NCAAB'].includes(league)||
    !/^\d{5,15}$/.test(eventId))return null;
 return {league,eventId,start:str(game.start),state:str(game.state),
  away:teamData(game.away),home:teamData(game.home)};
}
function storageRead(){
 try{
  const item=JSON.parse(localStorage.getItem(KEY)||'{}');
  for(const name of Object.keys(boxes)){
   const x=item[name];if(!x||!x.game||typeof x.at!=='number')continue;
   // A command from days ago must not masquerade as a current source.
   if(Date.now()-x.at>48*3600000||x.at>Date.now()+60000)continue;
   const game=snapshot(x.game);if(game)local[name]={game,route:routeData(x.route),at:x.at};
  }
 }catch(e){/* Storage may be disabled on the iPhone. */}
}
function storageWrite(){
 try{localStorage.setItem(KEY,JSON.stringify(local));}catch(e){/* In-memory mode is fine. */}
}
function routeData(route){
 if(route?.status!=='ready')return null;
 return {status:'ready',name:str(route.name||route.label).slice(0,90),
  label:str(route.label||route.name).slice(0,90)};
}
function gameFromFeed(value){
 const events=window.ManCaveRealGames?.state?.games||[];
 return events.find(g=>str(g.eventId)===str(value?.eventId)&&
  (!value?.game||str(value.game).endsWith('-'+str(g.eventId))));
}
function teamLogo(team){
 const logo=safeLogo(team?.logo),abbr=esc(str(team?.abbr||team?.name||'?').slice(0,5));
 return '<span class="teamBadge wallAssignedBadge'+(logo?'':' wallLogoFallback')+'">'+
   (logo?'<img class="wallTeamLogo" alt="" src="'+esc(logo)+'" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add(\'wallLogoFallback\')">':'')+
   '<span class="wallLogoInitials">'+abbr+'</span></span>';
}
function portraitLogo(team){
 const logo=safeLogo(team?.logo),abbr=esc(str(team?.abbr||team?.name||'?').slice(0,5));
 return '<span class="portraitShield'+(logo?'':' wallLogoFallback')+'">'+
  (logo?'<img class="wallTeamLogo" alt="" src="'+esc(logo)+'" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add(\'wallLogoFallback\')">':'')+
  '<span class="wallLogoInitials">'+abbr+'</span></span>';
}
function portraitLabel(team,league,role,assignedOnly){
 return '<span class="portraitLeague">'+esc(league||'TEAM')+' PLAYER BOARD</span>'+
  portraitLogo(team)+'<strong>'+esc(team.name||team.fullName||'Selected Team')+'</strong>'+
  '<div class="portraitBars"><i></i><i></i><i></i></div>'+
  '<small>'+esc(assignedOnly?'ASSIGNED':role)+'</small>';
}
function leagueCode(game){
 return ({nfl:'NFL',nba:'NBA',nhl:'NHL',mlb:'MLB',wnba:'WNBA',cfb:'NCAAF',cbb:'NCAAB'})[
  str(game||'').split('-')[0]]||'';
}
function updateHeader(){
 const hasCable=Object.keys(local).length>0;
 const hasRemote=Object.values(remote).some(x=>x&&x.type);
 if(!hasCable&&!hasRemote)return;
 const meta=document.querySelector('.realWallHero .heroMeta');
 if(meta)meta.textContent='Last sent assignments · other tiles are examples';
 const legend=document.querySelector('.realWallHero .legendTail');
 if(legend)legend.textContent='Commands saved ≠ TV playback confirmed';
}
function refreshScreenTab(slot,description){
 const ids={'Top Left':'top-left','Top Right':'top-right','Center':'main','Side':'side',
  left:'left-wing',right:'right-wing',third:'portrait-32'};
 const key=ids[slot];if(!key)return;
 window.dispatchEvent(new CustomEvent('mancave-wall-assignment-updated',{
  detail:{screenId:key,description}
 }));
}
function paintCable(name,item){
 const root=document.querySelector(boxes[name]);if(!root||!item?.game)return;
 const g=item.game,container=root.querySelector('.broadcastContent'),label=root.querySelector('.unitLabel small');
 if(!container)return;
 const away=g.away,home=g.home;
 const member=team=>'<div class="broadcastTeam">'+teamLogo(team)+
  '<b>'+esc(team.name||team.fullName||team.abbr)+'</b></div>';
 container.className='broadcastContent wallAssignedBroadcast';
 container.style.setProperty('--wall-away',safeColor(away.color,'#224f72'));
 container.style.setProperty('--wall-home',safeColor(home.color,'#4b314e'));
 container.innerHTML='<div class="broadTop"><span class="leagueMini">'+esc(g.league)+
  '</span><span class="feedTag">SENT · '+esc(g.state==='live'?'LIVE':g.state==='final'?'FINAL':'GAME')+
  '</span></div><div class="duel">'+member(away)+'<span class="vsMini">VS</span>'+member(home)+
  '</div><div class="broadcastRail"></div>';
 const route=item.route;
 const badge=route?.name&&window.ManCaveNetworkLogos?.badge?.(route)||'';
 if(label)label.innerHTML='<span>'+esc(away.abbr||away.name)+' vs '+esc(home.abbr||home.name)+
  '</span>'+(badge?'<span class="wallBroadcastLogo">'+badge+'</span>':'')+
  '<span class="wallSendState">· Command accepted</span>';
 root.classList.add('wallHasAssignment');
 refreshScreenTab(name,(away.name||away.fullName)+' vs '+(home.name||home.fullName)+' · command sent');
}
function paintWing(side,assignment){
 const root=document.querySelector(wings[side]);if(!root)return;
 const content=root.querySelector('.portraitContent'),label=root.querySelector('.unitLabel small');
 if(!content)return;
 if(!assignment)return; // Preserve the approved example until a real assignment is known.
 if(assignment.type==='team'&&assignment.team){
  const fresh=gameFromFeed(assignment);
  const cached=remote[side]?.fullGame;
  const known=fresh?snapshot(fresh):cached&&str(cached.eventId)===str(assignment.eventId)?cached:null;
  const teamName=str(assignment.team);
  const team=known?[known.away,known.home].find(t=>t.fullName===teamName)||
    {name:teamName,abbr:teamName.slice(0,3),color:'#366082'}:
    {name:teamName,fullName:teamName,abbr:teamName.split(' ').pop()?.slice(0,3)||'TEAM',color:'#366082'};
  const isAway=known?.away?.fullName===teamName;
  const role=known?(isAway?'AWAY':'HOME'):'ASSIGNED';
  const league=known?.league||leagueCode(assignment.game);
  const paintClass=side==='left'?'leftPortrait':'rightPortrait';
  content.className='portraitContent '+paintClass+' wallAssignedPortrait';
  content.style.setProperty('--wall-team',safeColor(team.color,'#305773'));
  content.innerHTML=portraitLabel(team,league,role,!known);
  if(label)label.innerHTML=esc(team.name||teamName)+' <span class="wallSendState">· Firebase saved</span>';
  root.classList.add('wallHasAssignment');
  refreshScreenTab(side,(team.name||teamName)+' · board assigned');
 }else if(assignment.type==='upcoming'||assignment.type==='live'){
  const title=assignment.type==='upcoming'?'Upcoming Games':'Live Games';
  content.className='portraitContent wallAssignedPortrait wallGenericBoard';
  content.innerHTML='<span class="portraitLeague">MAN CAVE SPORTS BOOK</span>'+
    '<strong>'+esc(title)+'</strong><div class="portraitBars"><i></i><i></i><i></i></div><small>FIREBASE ASSIGNED</small>';
  if(label)label.innerHTML=esc(title)+' <span class="wallSendState">· Firebase saved</span>';
  root.classList.add('wallHasAssignment');
  refreshScreenTab(side,title+' · board assigned');
 }
}
function onGameAssigned(data){
 const game=snapshot(data?.game);if(!game)return;
 const route=routeData(data?.route),at=Date.now();
 for(const name of Array.isArray(data?.cable)?data.cable:[]){
  if(!Object.hasOwn(boxes,name))continue;
  local[name]={game,route,at};paintCable(name,local[name]);
 }
 if(data?.wings){
  for(const side of ['left','right']){
   if(!data.wings[side])continue;
   const team=data.wings.swap?(side==='left'?game.home:game.away):
    (side==='left'?game.away:game.home);
   const assignment={type:'team',game:({NFL:'nfl',NBA:'nba',NHL:'nhl',MLB:'mlb',WNBA:'wnba',NCAAF:'cfb',NCAAB:'cbb'})[game.league]+'-'+game.eventId,
    eventId:game.eventId,team:team.fullName,updatedAt:at};
   remote[side]={...assignment,fullGame:game};
   paintWing(side,assignment);
  }
 }
 storageWrite();updateHeader();
}
function onFirebaseUpdate(detail){
 const side=detail?.side;
 if(side!=='left'&&side!=='right')return;
 const a=detail.assignment;
 if(!a||typeof a!=='object')return;
 const prev=remote[side];
 remote[side]={...a,fullGame:
  prev?.fullGame&&str(prev.eventId)===str(a.eventId)?prev.fullGame:null};
 paintWing(side,remote[side]);updateHeader();
}
window.addEventListener('mancave-game-command-accepted',e=>onGameAssigned(e.detail));
window.addEventListener('man-cave-board-update',e=>onFirebaseUpdate(e.detail));
window.addEventListener('mancave-real-games-change',()=>{
 for(const side of ['left','right'])if(remote[side]?.type==='team')paintWing(side,remote[side]);
});
storageRead();
for(const name of Object.keys(local))paintCable(name,local[name]);
updateHeader();
window.ManCaveWallSync=Object.freeze({onGameAssigned,onFirebaseUpdate,read:()=>({cable:{...local},wing:{...remote}})});
})();