/* MAN CAVE SPORTS BOOK — LEFT RIGHT NHL six-player on-ice development integration.
 * DEVELOPMENT BRANCH ONLY. Uses ESPN onIce roster IDs, never guesses on-ice personnel
 * from box-score sorting or play credits. Layout/CSS are NOT defined here.
 */
(function(){
 'use strict';
 if(sport!=='nhl')return;
 const eventId=p.get('eventId'),base='https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/';
 const rows=Array.from(app.querySelectorAll('.row'));
 const meta=app.querySelector('.meta'),note=app.querySelector('.note'),band=app.querySelector('.band');
 const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const stateKey='lr-nhl-onice-v1:'+eventId+':'+norm(team);
 let previous=null,busy=false,lastViewKey='';
 try{const saved=JSON.parse(localStorage.getItem(stateKey)||'null');
  if(saved&&Array.isArray(saved.players)&&saved.players.length===6&&saved.players.every(x=>x.id))previous=saved;
 }catch(e){}
 const get=async u=>{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('ESPN NHL HTTP '+r.status);return r.json()};
 const key=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const list=v=>Array.isArray(v)?v:[];
 function boxPlayers(data,tid){
   const out=new Map();
   const side=list(data.boxscore?.players).find(x=>String(x.team?.id)===String(tid));
   for(const group of list(side?.statistics)){
     for(const row of list(group.athletes)){
       const a=row.athlete||{},id=String(a.id||'');
       if(!id)continue;
       const stats={};
       list(group.keys).forEach((k,i)=>{stats[key(k)]=row.stats?.[i]??'—'});
       const record={
         id,name:a.displayName||a.fullName||'',
         position:String(a.position?.abbreviation||a.position?.name||'').toUpperCase(),
         headshot:a.headshot?.href||'',
         stats
       };
       // Groups can duplicate a player; keep the record with more game stats.
       const old=out.get(id);
       if(!old||Object.keys(record.stats).length>Object.keys(old.stats).length)out.set(id,record);
     }
   }
   // Structured play participant identities are safe fallback for names/headshots.
   // The play's ytdGoals/ytdAssists are season totals and must NOT be used.
   for(const play of list(data.plays))for(const participant of list(play.participants)){
     const a=participant.athlete||{},id=String(a.id||'');
     if(!id)continue;
     const found=out.get(id);
     if(found){
       if(!found.headshot&&a.headshot?.href)found.headshot=a.headshot.href;
       if(!found.name&&a.displayName)found.name=a.displayName;
     }else{
       out.set(id,{id,name:a.displayName||'',headshot:a.headshot?.href||'',position:String(a.position?.abbreviation||'').toUpperCase(),stats:{}});
     }
   }
   if(previous)for(const x of previous.players){
      if(!out.has(x.id)&&x.name)out.set(x.id,x);
   }
   return out;
 }
 function positionIndex(role){
   return ({C:0,LW:1,RW:2,F:3,D:4,LD:4,RD:4,G:5})[role]??3;
 }
 function scoreAndTeam(data){
   const competition=data.header?.competitions?.[0]||{},all=list(competition.competitors);
   const match=all.find(x=>norm(x.team?.displayName)===norm(team)||
     norm(x.team?.name)===norm(team)||norm(x.team?.abbreviation)===norm(team));
   if(!match)throw Error('Selected NHL event does not match '+team);
   return{competition,match,tid:String(match.team.id)};
 }
 function onIcePlayers(data,tid,known){
   const entry=list(data.onIce).find(x=>String(x.teamId)===String(tid));
   if(!entry||!Array.isArray(entry.entries))throw Error('ESPN onIce group missing');
   const selected=entry.entries.filter(x=>x?.whereabouts?.name==='ROSTER_WHEREABOUTS_IN_PLAY'||
     /in play/i.test(String(x?.whereabouts?.description||'')))
     .map(x=>String(x.athleteid||x.athleteId||'')).filter(Boolean);
   if(selected.length!==6||new Set(selected).size!==6)
     throw Error('ESPN reported '+selected.length+' on-ice IDs; retaining last valid six');
   const athletes=selected.map(id=>known.get(id)||{id,name:'PLAYER ID '+id,position:'',stats:{},headshot:''});
   // Standard on-ice order for readability, but accept all six real skaters
   // during pulled-goalie and special-team situations; never insert a goalie.
   athletes.sort((a,b)=>positionIndex(a.position)-positionIndex(b.position)||
     a.id.localeCompare(b.id));
   return athletes;
 }
 function formatRecord(x){
   return x?.records?.find?.(r=>r.type==='total')?.summary||
     x?.records?.[0]?.summary||x?.record?.[0]?.summary||'';
 }
 function statsFor(a){
   const s=a.stats||{},grab=k=>s[key(k)]??'—';
   if(a.position==='G'){
     return{labels:['SV','SA','SV%'],values:[grab('saves'),grab('shotsAgainst'),grab('savePct')]};
   }
   return{labels:['G','A','+/-'],values:[grab('goals'),grab('assists'),grab('plusMinus')]};
 }
 function showPlayer(row,a,replaceIdentity){
   const name=row.querySelector('.player'),photo=row.querySelector('.portrait');
   if(replaceIdentity){
     name.textContent=a.name||'PLAYER ID '+a.id;
     name.style.fontSize=name.textContent.length>17?'clamp(11px,2.6vw,16px)':'';
     photo.textContent='';
     if(a.headshot){
       const img=document.createElement('img');img.src=a.headshot;img.alt='';
       img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
       img.onerror=()=>{photo.textContent='HEADSHOT UNAVAILABLE'};
       photo.appendChild(img);
     }else photo.textContent='HEADSHOT UNAVAILABLE';
   }
   const stat=statsFor(a);
   row.querySelectorAll('.stats small').forEach((x,i)=>x.textContent=stat.labels[i]);
   row.querySelectorAll('.stats b').forEach((x,i)=>x.textContent=stat.values[i]);
 }
 function draw(players,replaceAll=false){
   const k=players.map(x=>[x.id,x.name,x.position,x.headshot].join(':')).join('|');
   const changed=replaceAll||k!==lastViewKey;
   // Avoid rebuilding headshots every 20 seconds when players have not changed.
   players.forEach((a,i)=>showPlayer(rows[i],a,changed));
   lastViewKey=k;
 }
 if(previous){
   draw(previous.players,true);
   band.textContent='ON ICE · LAST VERIFIED REPORT';
   meta.textContent='LAST ESPN ON-ICE REPORT';
   note.textContent='Restored last ESPN-reported six players while checking for fresh game data.';
 }
 async function update(){
   if(!eventId){meta.textContent='CHOOSE A VERIFIED NHL GAME';return}
   if(busy)return;busy=true;
   try{
     const data=await get(base+'summary?event='+encodeURIComponent(eventId));
     const {competition,match,tid}=scoreAndTeam(data),known=boxPlayers(data,tid);
     const players=onIcePlayers(data,tid,known);
     const abbr=match.team?.abbreviation||match.team?.shortDisplayName||'NHL';
     setHeader(match);setScore(match.score??'—');
     app.querySelector('.team-record').textContent=formatRecord(match);
     const logo=app.querySelector('.logo');
     const src=match.team?.logo||match.team?.logos?.[0]?.href||'';
     if(src){logo.src=src;logo.hidden=false}
     draw(players);
     previous={players,teamId:tid,eventId,updatedAt:new Date().toISOString()};
     try{localStorage.setItem(stateKey,JSON.stringify(previous))}catch(e){}
     const state=competition.status?.type?.state||'unknown';
     const goalie=players.filter(x=>x.position==='G').length;
     band.textContent=state==='post'?'FINAL · ON ICE':'ON ICE · ESPN REPORTED';
     meta.textContent='ESPN · '+String(abbr).toUpperCase()+' · '+(state==='post'?'FINAL SNAPSHOT':'REPORTED LINEUP');
     note.textContent='Six ESPN-reported on-ice players. '+
       (goalie===0?'No goalie reported (possible empty net). ':goalie===1?'One goalie reported. ':goalie+' goalies reported. ')+
       'Position mix follows ESPN; game-specific stats only. '+
       (state==='post'?'Final group held.':'Updates every 20 seconds; source may lag actual line changes.');
   }catch(e){
     meta.textContent=previous?'ESPN ON-ICE RETRYING · LAST REPORT HELD':'ESPN ON-ICE UNAVAILABLE';
     note.textContent=String(e.message||e)+'. '+(previous?
       'The six previously reported players remain displayed; no inferred substitutes.':
       'No trustworthy six-player on-ice group is available. Nothing is invented.');
   }finally{busy=false}
 }
 update();setInterval(update,20000);
})();