// V33 schedule policy: rolling windows, approved favorites, next scheduled favorite only.
(()=>{
'use strict';
const HOURS=Object.freeze({NBA:48,NCAAB:72,WNBA:48,NCAAF:168,NFL:168,MLB:48,NHL:48});
const FAVORITES=Object.freeze([
 {league:'NFL',name:'Denver Broncos',team:'den'},
 {league:'NBA',name:'Boston Celtics',team:'bos'},
 {league:'NHL',name:'Boston Bruins',team:'bos'},
 {league:'MLB',name:'Boston Red Sox',team:'bos'},
 {league:'WNBA',name:'Indiana Fever',team:'ind'},
 {league:'NCAAF',name:'Arizona Wildcats',team:'12'},
 {league:'NCAAB',name:'Arizona Wildcats',team:'12'}
]);
const HOURS_MS=3600000;
function timestamp(value){const n=Date.parse(value||'');return Number.isFinite(n)?n:NaN;}
function isFavoriteNext(game,favorite,now){
 return game?.state==='upcoming'&&game.league===favorite.league&&
  (game.away?.fullName===favorite.name||game.home?.fullName===favorite.name)&&
  timestamp(game.start)>now;
}
function visibleByWindow(game,now=Date.now()){
 const start=timestamp(game?.start);
 if(!Number.isFinite(start))return false;
 if(game.state==='live')return true;
 if(game.state==='final'){
  const finished=timestamp(game.endedAt);
  const reference=Number.isFinite(finished)?finished:start;
  return reference<=now&&reference>=now-48*HOURS_MS;
 }
 // ESPN can report 'pre' briefly after scheduled tip-off. Preserve the
 // match under Upcoming without mislabeling it as live.
 return game.state==='upcoming'&&
  Number.isFinite(HOURS[game.league])&&start>=now-60*60000&&start<=now+HOURS[game.league]*HOURS_MS;
}
function select(games,now=Date.now()){
 const all=[...new Map((games||[]).filter(g=>g?.id).map(g=>[g.id,g])).values()];
 const chosen=new Map(all.filter(g=>visibleByWindow(g,now)).map(g=>[g.id,g]));
 for(const favorite of FAVORITES){
  const next=all.filter(g=>isFavoriteNext(g,favorite,now))
   .sort((a,b)=>timestamp(a.start)-timestamp(b.start))[0];
  if(next)chosen.set(next.id,next);
 }
 const rank={live:0,upcoming:1,final:2};
 return [...chosen.values()].sort((a,b)=>
  (rank[a.state]??9)-(rank[b.state]??9)||
  Number(b.favorite)-Number(a.favorite)||
  (a.state==='final'?timestamp(b.start)-timestamp(a.start):timestamp(a.start)-timestamp(b.start)));
}
function dayOffsets(league){
 const days=Math.ceil((HOURS[league]??48)/24);
 return Array.from({length:days+3},(_,i)=>i-2);
}
window.ManCaveGameWindows=Object.freeze({HOURS,FAVORITES,visibleByWindow,select,dayOffsets});
})();