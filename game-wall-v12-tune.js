// Game Wall V12. Official Xfinity remote assistance, not a direct tuner.
(()=>{'use strict';
const host=()=>document.getElementById('xfinityTuneGuide');
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const tvs=[['Top Left','40″'],['Top Right','55″'],['Center','65″'],['Side','40″']];
const leagues=[['NFL','football/nfl'],['NBA','basketball/nba'],['NHL','hockey/nhl'],['MLB','baseball/mlb'],['WNBA','basketball/wnba'],['NCAA FB','football/college-football'],['NCAA BB','basketball/mens-college-basketball']];
const favorites=new Set(['Denver Broncos','Boston Celtics','Boston Bruins','Boston Red Sox','Indiana Fever','Arizona Wildcats']);
const s={tv:'Center',league:'All',status:'All',games:[],game:'',channel:'',loaded:false,busy:false,message:'Load real ESPN matchups, or enter a channel manually.'};
function dayET(date){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));return p.year+p.month+p.day;}
function networks(event){
 const c=event.competitions?.[0]||{},result=[];
 const add=x=>{if(typeof x==='string'&&x.trim())result.push(x.trim());else if(Array.isArray(x))x.forEach(add);};
 [...(c.broadcasts||[]),...(event.broadcasts||[])].forEach(b=>{add(b.names);add(b.name);add(b.shortName);add(b.media?.shortName);});
 (c.geoBroadcasts||[]).forEach(b=>{add(b.media?.shortName);add(b.media?.name);});
 add(c.broadcast);add(event.broadcast);
 return [...new Set(result.filter(x=>x.length<70))];
}
function visible(){return s.games.filter(g=>(s.league==='All'||g.league===s.league)&&(s.status==='All'||g.status===s.status));}
function chosen(){return s.games.find(g=>g.key===s.game)||null;}
function command(){
 const manual=s.channel.trim();
 if(manual){if(/^(watch|find|turn on)\b/i.test(manual))return manual;return /^\d+$/.test(manual)?'Watch channel '+manual:'Watch '+manual;}
 const g=chosen();if(!g)return '';
 const station=g.networks.find(n=>!/ESPN\+|STREAM|FUBO|DAZN|PARAMOUNT\+|PEACOCK|MAX|APPLE TV|PRIME VIDEO|PASS/i.test(n));
 return g.status!=='FINAL'&&station?'Watch '+station:'Find '+g.home+' game';
}
function render(){
 const root=host();if(!root)return;
 const games=visible();if(s.loaded&&!games.some(g=>g.key===s.game))s.game=games[0]?.key||'';
 const g=chosen(),cmd=command();
 root.innerHTML='<section class="xTune"><span class="xTuneKicker">GAME-TO-TV · OFFICIAL REMOTE ASSIST</span><h3>Quick Tune</h3><p class="xTuneIntro">Choose a TV and a real game, then take the prepared command to Xfinity Web Remote.</p>'
 +'<h4>1 · Select destination TV</h4><div class="xTuneTvs">'+tvs.map(([id,size])=>'<button type="button" data-xt-tv="'+safe(id)+'" class="'+(s.tv===id?'active':'')+'"><b>'+safe(id)+'</b><small>'+safe(size)+'</small></button>').join('')+'</div>'
 +'<div class="xTuneBoxHint">Box to choose inside Xfinity: <b>'+safe(s.tv)+'</b>. This dashboard does not switch boxes automatically.</div>'
 +'<h4>2 · Select game or enter channel</h4><button type="button" class="btn subtle xTuneRefresh" data-xt-action="load"'+(s.busy?' disabled':'')+'>'+(s.busy?'Loading ESPN…':'Refresh real ESPN games')+'</button>'
 +'<div class="xTuneStatus" role="status">'+safe(s.message)+'</div>'
 +(s.loaded?'<div class="xTuneFilters"><div class="xTuneFilterRow">'+[['All','All leagues'],...leagues.map(x=>[x[0],x[0]])].map(([id,label])=>'<button type="button" data-xt-league="'+safe(id)+'" class="'+(s.league===id?'active':'')+'">'+safe(label)+'</button>').join('')+'</div>'
 +'<div class="xTuneFilterRow">'+['All','LIVE','UPCOMING','FINAL'].map(x=>'<button type="button" data-xt-status="'+x+'" class="'+(s.status===x?'active':'')+'">'+(x==='All'?'All games':x)+'</button>').join('')+'</div></div>'
 +(games.length?'<label class="xTuneLabel">Real game<select data-xt-game>'+games.map(g=>'<option value="'+safe(g.key)+'"'+(g.key===s.game?' selected':'')+'>'+safe(g.status+' · '+g.league+' · '+g.away+' vs '+g.home+(g.networks.length?' · '+g.networks.slice(0,2).join(' / '):''))+'</option>').join('')+'</select></label>':'<div class="xTuneEmpty">No games match those filters. Change the filter or type a channel below.</div>'):'')
 +(g&&games.length?'<div class="xTuneGame"><b>'+safe(g.away+' vs '+g.home)+'</b><span>'+safe(g.status)+' · '+safe(g.league)+' · Broadcast: '+safe(g.networks.length?g.networks.join(' / '):'Not listed')+'</span><small>ESPN broadcast info does not confirm your Xfinity channel availability.</small></div>':'')
 +'<label class="xTuneLabel">Network or channel (optional override)<input type="text" id="xtNetwork" placeholder="ESPN, NESN, 810..." autocomplete="off" value="'+safe(s.channel)+'"></label>'
 +'<div class="xTuneCommand"><small>XFINITY TYPED COMMAND</small><strong id="xtCommand">'+safe(cmd||'Choose a game or enter a network')+'</strong></div>'
 +'<div class="xTuneActions"><button type="button" class="btn primary" data-xt-action="copy"'+(!cmd?' disabled':'')+'>Copy command</button><a href="https://remote.xfinity.com/" target="_blank" rel="noopener noreferrer">Open Xfinity Web Remote ↗</a></div>'
 +'<p class="xTuneFoot">Inside Xfinity: select <b>'+safe(s.tv)+'</b> → tap microphone → paste/type the command → Go. This dashboard cannot automatically tune the box, and some broadcasts require separate streaming apps.</p></section>';
}
async function load(){
 if(s.busy)return;s.busy=true;s.message='Loading real ESPN games across seven leagues…';render();
 try{
  const days=[-1,0,1].map(d=>dayET(new Date(Date.now()+d*86400000)));
  const jobs=leagues.flatMap(([league,path])=>days.map(async day=>{
   const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?dates='+day,{cache:'no-store'});
   if(!r.ok)throw Error('ESPN HTTP '+r.status);
   const j=await r.json();
   return (j.events||[]).map(e=>{
    const teams=e.competitions?.[0]?.competitors||[];
    const a=teams.find(t=>t.homeAway==='away'),h=teams.find(t=>t.homeAway==='home');
    if(!a?.team?.displayName||!h?.team?.displayName)return null;
    const raw=e.status?.type?.state,st=raw==='in'?'LIVE':raw==='post'?'FINAL':'UPCOMING';
    return {key:league+'-'+e.id,league,status:st,date:e.date||'',away:a.team.displayName,home:h.team.displayName,
      favorite:favorites.has(a.team.displayName)||favorites.has(h.team.displayName),networks:networks(e)};
   }).filter(Boolean);
  }));
  const res=await Promise.allSettled(jobs),matches=res.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  const rank={LIVE:0,UPCOMING:1,FINAL:2};
  s.games=[...new Map(matches.map(g=>[g.key,g])).values()].sort((a,b)=>
     rank[a.status]-rank[b.status]||Number(b.favorite)-Number(a.favorite)||new Date(a.date)-new Date(b.date)).slice(0,250);
  s.loaded=true;s.game=visible()[0]?.key||'';s.channel='';
  const ok=res.filter(x=>x.status==='fulfilled').length;
  s.message=s.games.length?s.games.length+' real games · '+ok+'/'+res.length+' ESPN schedule requests succeeded.':
     'No games returned. Manual network/channel entry remains available.';
 }catch(e){s.message='ESPN unavailable: '+(e.message||e)+'. Manual entry still works.';}
 finally{s.busy=false;render();}
}
async function copy(){
 const value=command();if(!value)return;
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
  else {const n=document.createElement('textarea');n.value=value;n.style.position='fixed';n.style.opacity='0';document.body.appendChild(n);n.select();const ok=document.execCommand('copy');n.remove();if(!ok)throw Error('Copy blocked');}
  s.message='Copied: '+value+' · Choose '+s.tv+' in Xfinity, then paste.';
 }catch(e){s.message='Clipboard blocked. Type the command displayed below directly into Xfinity.';}
 render();
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-xt-tv],[data-xt-league],[data-xt-status],[data-xt-action]');if(!b)return;
 if(b.dataset.xtTv){s.tv=b.dataset.xtTv;render();}
 else if(b.dataset.xtLeague){s.league=b.dataset.xtLeague;s.game='';render();}
 else if(b.dataset.xtStatus){s.status=b.dataset.xtStatus;s.game='';render();}
 else if(b.dataset.xtAction==='load')load();
 else if(b.dataset.xtAction==='copy')copy();
});
document.addEventListener('change',e=>{
 if(e.target?.hasAttribute('data-xt-game')){s.game=e.target.value;s.channel='';render();}
 if(e.target?.id==='xtNetwork'){s.channel=e.target.value;render();}
});
document.addEventListener('input',e=>{
 if(e.target?.id!=='xtNetwork')return;
 s.channel=e.target.value;const cmd=command();
 const t=document.getElementById('xtCommand');if(t)t.textContent=cmd||'Choose a game or enter a network';
 const b=document.querySelector('[data-xt-action="copy"]');if(b)b.disabled=!cmd;
});
window.XfinityTune={render};render();
})();