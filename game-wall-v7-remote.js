
import {db,auth,ref,update,onValue,signInWithEmailAndPassword,onAuthStateChanged,signOut} from './firebase.js';
const state={user:null,busy:false,message:'Checking Firebase session...',left:null,right:null,third:null,thirdMode:'keep',
 leftMode:'keep',rightMode:'keep',games:[],gameId:'',swap:false,gamesStatus:'Use Refresh to load actual ESPN games.'};
const el=()=>document.getElementById('liveBridge');
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const descriptions={upcoming:'Upcoming Games',live:'Live Games / Results',team:'Team player board'};
const thirdBoards=[["rotation","ALL 28 SPORTS BOARDS · AUTO ROTATION"],["wrestling","INSIDE THE SQUARED CIRCLE · WRESTLING"],["page1_nfl","Broncos · Page 1"],["page2_nfl","Broncos · Page 2"],["page3_broncos","Broncos · Page 3"],["page4_broncos","Broncos · Page 4"],["page1_nba","Celtics · Page 1"],["page2_nba","Celtics · Page 2"],["page3_celtics","Celtics · Page 3"],["page4_celtics","Celtics · Page 4"],["page1_nhl","Bruins · Page 1"],["page2_nhl","Bruins · Page 2"],["page3_bruins","Bruins · Page 3"],["page4_bruins","Bruins · Page 4"],["page1_mlb","Red Sox · Page 1"],["page2_mlb","Red Sox · Page 2"],["page3_redsox","Red Sox · Page 3"],["page4_redsox","Red Sox · Page 4"],["page1_wnba","Fever · Page 1"],["page2_wnba","Fever · Page 2"],["page3_fever","Fever · Page 3"],["page4_fever","Fever · Page 4"],["page1_cfb","Arizona Football · Page 1"],["page2_cfb","Arizona Football · Page 2"],["page3_arizona_cfb","Arizona Football · Page 3"],["page4_arizona_cfb","Arizona Football · Page 4"],["page1_cbb","Arizona Basketball · Page 1"],["page2_cbb","Arizona Basketball · Page 2"],["page3_arizona_cbb","Arizona Basketball · Page 3"],["page4_arizona_cbb","Arizona Basketball · Page 4"]];
const thirdOptions=(choice)=>[['keep','Keep current display'],...thirdBoards].map(([value,label])=>
 '<option value="'+safe(value)+'"'+(choice===value?' selected':'')+'>'+safe(label)+'</option>').join('');
const thirdLabel=(v)=>{if(!v)return 'No Firebase assignment yet';
 if(v.type==='rotation')return 'All 28 Sports Boards · Auto Rotation';
 if(v.type==='wrestling')return 'Inside the Squared Circle';
 if(v.type==='board')return thirdBoards.find(x=>x[0]===v.board)?.[1]||('Board '+String(v.board||'unknown'));
 return 'Other mode ('+(v.type||'unknown')+')';};
function label(v){if(!v)return 'No Firebase assignment yet';return (v.type==='team'?(v.team||'Team')+' · player board':(descriptions[v.type]||'Unsupported mode'));}
function options(mode){return [['keep','Keep current'],['upcoming','Upcoming Games'],['live','Live Games / Results']].map(x=>
 '<option value="'+x[0]+'"'+(mode===x[0]?' selected':'')+'>'+x[1]+'</option>').join('');}
function render(){
 const node=el();if(!node)return;
 const signed=!!state.user,blocked=state.busy||!signed,game=state.games.find(g=>g.key===state.gameId);
 const opts=state.games.map(g=>'<option value="'+safe(g.key)+'"'+(g.key===state.gameId?' selected':'')+'>'+safe(g.status+' · '+g.sport.toUpperCase()+' · '+g.away+' vs '+g.home)+'</option>').join('');
 node.innerHTML='<section class="liveBridge"><div class="liveHead"><div><span class="liveEyebrow">REAL FIREBASE COMMANDS · 3 TARGETS</span><h3>Live TV Link</h3><p>Left and Right wing player TVs plus the independent 32″ Onn board. Cable TVs remain separate.</p></div><span class="liveTag">'+(signed?'SIGNED IN':'CONNECT')+'</span></div>'
 +'<div class="liveStatus" role="status">'+safe(state.message)+'</div>'
 +(signed?'<div class="liveWho"><span>'+safe(state.user.email||'Firebase controller session')+'</span><button type="button" data-live-action="logout">Sign out</button></div>'
 :'<form id="liveAuthForm"><label>Controller email<input id="liveEmail" type="email" autocomplete="username" required placeholder="Firebase email"></label><label>Password<input id="livePassword" type="password" autocomplete="current-password" required></label><button type="submit" class="btn primary"'+(state.busy?' disabled':'')+'>Connect Firebase</button></form>')
 +'<div class="liveReadback"><div><b>LEFT WING</b><span>'+safe(label(state.left))+'</span></div><div><b>RIGHT WING</b><span>'+safe(label(state.right))+'</span></div><div><b>32″ PORTRAIT · ONN</b><span>'+safe(thirdLabel(state.third))+'</span></div></div>'
 +'<h4>Send boards independently</h4><div class="livePair"><label>Left Wing<select data-live-select="leftMode"'+(blocked?' disabled':'')+'>'+options(state.leftMode)+'</select></label><label>Right Wing<select data-live-select="rightMode"'+(blocked?' disabled':'')+'>'+options(state.rightMode)+'</select></label></div>'
 +'<button type="button" class="btn primary liveWide" data-live-action="sendBoards"'+(blocked||(state.leftMode==='keep'&&state.rightMode==='keep')?' disabled':'')+'>Send board assignments</button>'
 +'<hr><h4>32″ Portrait · Onn board control</h4>'
 +'<p>Reuse your existing 28-page Render player. Select the full rotation, an individual team page, or the wrestling board. Left and Right are unaffected.</p>'
 +'<label class="liveGameSelect">32″ board content<select data-live-select="thirdMode"'+(blocked?' disabled':'')+'>'+thirdOptions(state.thirdMode)+'</select></label>'
 +'<button type="button" class="btn primary liveWide" data-live-action="sendThird"'+(blocked||state.thirdMode==='keep'?' disabled':'')+'>Send to 32″ Onn TV</button>'
 +'<div class="liveSmall">Existing receiver: <a href="https://man-cave-28-board-player.onrender.com/onn/" target="_blank" rel="noopener noreferrer">28-board Onn player</a>. Keep that page open on the TV.</div>'
 +'<hr><h4>Send a real game to both wings</h4><p>ESPN schedule (not the sample Games tab). Away → Left Wing, Home → Right Wing by default. Finals stay displayed until you send another assignment.</p>'
 +'<button type="button" class="btn subtle" data-live-action="loadGames"'+(state.busy?' disabled':'')+'>Refresh real games</button>'
 +'<div class="liveSmall">'+safe(state.gamesStatus)+'</div>'
 +(state.games.length?'<label class="liveGameSelect">Choose matchup<select data-live-select="gameId">'+opts+'</select></label>'
 +'<label class="liveSwap"><input type="checkbox" data-live-select="swap"'+(state.swap?' checked':'')+'>Swap teams (home left / away right)</label>'
 +'<div class="liveTarget">'+safe(game?((state.swap?game.home:game.away)+' → Left · '+(state.swap?game.away:game.home)+' → Right'):'Choose a game')+'</div>'
 +'<button type="button" class="btn primary liveWide" data-live-action="sendGame"'+(blocked||!game?' disabled':'')+'>Send matchup to both wings</button>':'')
 +'<p class="liveFoot">A successful write confirms Firebase accepted the command, not that any TV is powered on or has displayed it. No commands send without tapping Send. Sample game cards, presets, and cable controls still remain previews.</p></section>';
}
window.ManCaveBridge={render};
let unsubs=[];
function listen(){
 unsubs.forEach(fn=>fn());unsubs=[];state.left=null;state.right=null;state.third=null;
 if(!state.user)return;
 [['left','left'],['right','right'],['third','third']].forEach(([side,path])=>{
  unsubs.push(onValue(ref(db,'screens/'+path),snap=>{
    state[side]=snap.val();
    if(!state.busy)state.message='Signed in · Saved Firebase assignments loaded (not TV receipts).';
    render();
  },err=>{state.message='Firebase read error: '+(err.code||err.message);render();}));
 });
}
onAuthStateChanged(auth,user=>{
 const changed=(state.user?.uid||null)!==(user?.uid||null);
 state.user=user;
 state.message=user?'Signed in · Loading assignment data...':'Not signed in · Connect to send actual commands.';
 if(changed)listen();
 render();
},err=>{state.message='Auth error: '+(err.code||err.message);render();});
async function send(patch,msg){
 if(!state.user||state.busy||!Object.keys(patch).length)return;
 state.busy=true;state.message='Saving assignments to Firebase...';render();
 try{await update(ref(db,'screens'),patch);state.message=msg+' Database write succeeded; no TV receipt verified.';
  state.leftMode='keep';state.rightMode='keep';state.thirdMode='keep';
 }catch(err){state.message='Send failed: '+(err.code||err.message);}
 finally{state.busy=false;render();}
}
const leagues=[['nfl','football/nfl'],['nba','basketball/nba'],['nhl','hockey/nhl'],['mlb','baseball/mlb'],
 ['wnba','basketball/wnba'],['cfb','football/college-football'],['cbb','basketball/mens-college-basketball']];
const favorites=new Set(['Denver Broncos','Boston Celtics','Boston Bruins','Boston Red Sox','Indiana Fever','Arizona Wildcats']);
function etDate(date){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
 year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
 return p.year+p.month+p.day;}
async function loadGames(){
 if(state.busy)return;state.busy=true;state.gamesStatus='Loading ESPN league schedules...';render();
 try{
  const dates=[-1,0,1].map(d=>etDate(new Date(Date.now()+d*86400000)));
  const requests=leagues.flatMap(([sport,path])=>dates.map(async date=>{
   const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?dates='+date,{cache:'no-store'});
   if(!r.ok)throw new Error('ESPN '+r.status);
   const json=await r.json();
   return (json.events||[]).map(e=>{
    const competitors=e.competitions?.[0]?.competitors||[];
    const away=competitors.find(x=>x.homeAway==='away'),home=competitors.find(x=>x.homeAway==='home');
    if(!away?.team?.displayName||!home?.team?.displayName)return null;
    const st=e.status?.type?.state||'pre';
    if(!['in','pre','post'].includes(st))return null;
    return {key:sport+'-'+e.id,sport,id:String(e.id),status:st==='in'?'LIVE':st==='post'?'FINAL':'UPCOMING',
      away:away.team.displayName,home:home.team.displayName,date:e.date||'',fav:favorites.has(away.team.displayName)||favorites.has(home.team.displayName)};
   }).filter(Boolean);
  }));
  const responses=await Promise.allSettled(requests);
  const matches=responses.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  const unique=[...new Map(matches.map(g=>[g.key,g])).values()].sort((a,b)=>
    ({LIVE:0,UPCOMING:1,FINAL:2}[a.status]-{LIVE:0,UPCOMING:1,FINAL:2}[b.status])||
    Number(b.fav)-Number(a.fav)||new Date(a.date)-new Date(b.date)).slice(0,140);
  state.games=unique;state.gameId=unique.some(x=>x.key===state.gameId)?state.gameId:(unique[0]?.key||'');
  const ok=responses.filter(x=>x.status==='fulfilled').length;
  state.gamesStatus=unique.length?unique.length+' real games · '+ok+'/'+responses.length+' schedule requests succeeded.':
   'No games loaded; check connection and try Refresh. TV assignments remain unchanged.';
 }catch(err){state.gamesStatus='ESPN schedule error: '+(err.message||err);}
 finally{state.busy=false;render();}
}
document.addEventListener('submit',async e=>{
 if(e.target?.id!=='liveAuthForm')return;e.preventDefault();if(state.busy)return;
 const email=document.getElementById('liveEmail')?.value.trim(),password=document.getElementById('livePassword')?.value;
 if(!email||!password)return;state.busy=true;state.message='Signing in...';render();
 try{await signInWithEmailAndPassword(auth,email,password);state.message='Signed in to Firebase.';}
 catch(err){state.message='Sign-in failed: '+(err.code||err.message);}
 finally{state.busy=false;render();}
});
document.addEventListener('change',e=>{
 const key=e.target?.dataset?.liveSelect;
 if(!['leftMode','rightMode','thirdMode','gameId','swap'].includes(key))return;
 state[key]=key==='swap'?e.target.checked:e.target.value;render();
});
document.addEventListener('click',async e=>{
 const button=e.target.closest?.('[data-live-action]');if(!button||state.busy)return;
 const action=button.dataset.liveAction;
 if(action==='logout'){state.busy=true;render();try{await signOut(auth);}catch(err){state.message='Sign-out error: '+(err.code||err.message);}finally{state.busy=false;render();}}
 if(action==='loadGames')await loadGames();
 if(action==='sendBoards'){
  const now=Date.now(),patch={};
  if(state.leftMode!=='keep')patch.left={type:state.leftMode,updatedAt:now};
  if(state.rightMode!=='keep')patch.right={type:state.rightMode,updatedAt:now};
  await send(patch,'Board commands sent.');
 }
 if(action==='sendThird'){
  const choice=state.thirdMode,now=Date.now();
  if(!thirdBoards.some(x=>x[0]===choice))return;
  const value=choice==='rotation'?{type:'rotation',updatedAt:now}:
   choice==='wrestling'?{type:'wrestling',updatedAt:now}:
   {type:'board',board:choice,updatedAt:now};
  await send({third:value},'32″ Onn board command sent.');
 }
 if(action==='sendGame'){
  const g=state.games.find(x=>x.key===state.gameId);if(!g)return;
  const now=Date.now();
  await send({left:{type:'team',game:g.key,eventId:g.id,team:state.swap?g.home:g.away,updatedAt:now},
     right:{type:'team',game:g.key,eventId:g.id,team:state.swap?g.away:g.home,updatedAt:now}},
     'Matchup commands sent to both wings.');
 }
});
render();
