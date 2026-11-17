
import {db,auth,ref,set,update,onValue,signInWithEmailAndPassword,onAuthStateChanged,signOut} from './firebase.js';
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
 +'<p>Cloudflare TV3 receiver: select the 28-board rotation, an individual sports page, or wrestling. Left and Right are unaffected.</p>'
 +'<label class="liveGameSelect">32″ board content<select data-live-select="thirdMode"'+(blocked?' disabled':'')+'>'+thirdOptions(state.thirdMode)+'</select></label>'
 +'<button type="button" class="btn primary liveWide" data-live-action="sendThird"'+(blocked||state.thirdMode==='keep'?' disabled':'')+'>Send to 32″ Onn TV</button>'
 +'<div class="liveSmall">Cloudflare TV receiver: <a href="https://man-cave-28-page.broncos5523.workers.dev/staging/tv3.html?rotate=ccw" target="_blank" rel="noopener noreferrer">32″ Onn · CCW portrait receiver</a>. For connection troubleshooting: <a href="https://man-cave-28-page.broncos5523.workers.dev/staging/tv3.html?rotate=ccw&amp;debug=1" target="_blank" rel="noopener noreferrer">read-only receiver status</a>. Commands use the existing Firebase screens/third assignment.</div>'
 +'<hr><h4>Send a real game to both wings</h4><p>ESPN schedule (not the sample Games tab). Away → Left Wing, Home → Right Wing by default. Finals stay displayed until you send another assignment.</p>'
 +'<button type="button" class="btn subtle" data-live-action="loadGames"'+(state.busy?' disabled':'')+'>Refresh real games</button>'
 +'<div class="liveSmall">'+safe(state.gamesStatus)+'</div>'
 +(state.games.length?'<label class="liveGameSelect">Choose matchup<select data-live-select="gameId">'+opts+'</select></label>'
 +'<label class="liveSwap"><input type="checkbox" data-live-select="swap"'+(state.swap?' checked':'')+'>Swap teams (home left / away right)</label>'
 +'<div class="liveTarget">'+safe(game?((state.swap?game.home:game.away)+' → Left · '+(state.swap?game.away:game.home)+' → Right'):'Choose a game')+'</div>'
 +'<button type="button" class="btn primary liveWide" data-live-action="sendGame"'+(blocked||!game?' disabled':'')+'>Send matchup to both wings</button>':'')
 +'<p class="liveFoot">A successful write confirms Firebase accepted the command, not that any TV is powered on or has displayed it. No commands send without tapping Send. Sample game cards, presets, and cable controls still remain previews.</p></section>';
}
// V40: Direct game assignment from the Game Finder's Send to TVs popup.
 // Same Firebase shape that left.html/right.html already consume; selected wings only.
async function sendWingGame(game,options={}){
 const leagueCodes={NFL:'nfl',NBA:'nba',NHL:'nhl',MLB:'mlb',WNBA:'wnba',NCAAF:'cfb',NCAAB:'cbb'};
 const sport=leagueCodes[String(game?.league||'')],eventId=String(game?.eventId||'');
 const left=options.left===true,right=options.right===true,swap=options.swap===true;
 if(!state.user)throw Error('Wing boards are disconnected. Sign in under Settings → Firebase & Board Connections.');
 if(state.busy)throw Error('Another board command is in progress.');
 if(!left&&!right)throw Error('Select Left Wing or Right Wing first.');
 if(!sport||! /^\d{5,15}$/.test(eventId))throw Error('This game does not have a usable ESPN game ID.');
 const away=String(game.away?.fullName||''),home=String(game.home?.fullName||'');
 if(!away||!home||away.length>140||home.length>140)throw Error('The game is missing valid team names.');
 const key=sport+'-'+eventId,now=Date.now(),patch={};
 if(left)patch.left={type:'team',game:key,eventId,team:swap?home:away,updatedAt:now};
 if(right)patch.right={type:'team',game:key,eventId,team:swap?away:home,updatedAt:now};
 const ok=await send(patch,'Selected wing game boards assigned.');
 if(!ok)throw Error(state.message||'Firebase did not save the wing assignment.');
 return {saved:true,left:left?patch.left.team:null,right:right?patch.right.team:null,
  caveat:'Firebase saved the assignments; the Fire TVs must be running their board receivers.'};
}
window.ManCaveBridge={render,renderBoardExtras,openScreenAssignment,openLibraryBoard,
 sendWingGame,wingStatus:()=>({connected:!!state.user,busy:!!state.busy})};
let unsubs=[];
function listen(){
 unsubs.forEach(fn=>fn());unsubs=[];state.left=null;state.right=null;state.third=null;
 if(!state.user)return;
 [['left','left'],['right','right'],['third','third']].forEach(([side,path])=>{
  unsubs.push(onValue(ref(db,'screens/'+path),snap=>{
    state[side]=snap.val();
    window.dispatchEvent(new CustomEvent('man-cave-board-update',{
      detail:{side,label:side==='third'?thirdLabel(state[side]):label(state[side]),
     assignment:state[side]}
    }));
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
 try{
  // Target TV3 directly when sending a single 32-inch board assignment.
  // This is the same authorized screens/third path/protocol as the original
  // working Game Wall TV3 controller. Never touch wing assignments here.
  if(Object.keys(patch).length===1&&Object.prototype.hasOwnProperty.call(patch,'third'))
   await set(ref(db,'screens/third'),patch.third);
  else await update(ref(db,'screens'),patch);
  state.message=msg+' Database write succeeded; no TV receipt verified.';
  state.leftMode='keep';state.rightMode='keep';state.thirdMode='keep';return true;
 }catch(err){state.message='Send failed: '+(err.code||err.message);return false;}
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

// V8: Connect the approved Screen and Board Library tabs to already-tested Firebase destinations.
// No automatic sends and no cable-TV commands.
const favoritePageLeagues=[
 {id:'nfl',label:'NFL · Broncos',pages:['page1_nfl','page2_nfl','page3_broncos','page4_broncos']},
 {id:'nba',label:'NBA · Celtics',pages:['page1_nba','page2_nba','page3_celtics','page4_celtics']},
 {id:'nhl',label:'NHL · Bruins',pages:['page1_nhl','page2_nhl','page3_bruins','page4_bruins']},
 {id:'mlb',label:'MLB · Red Sox',pages:['page1_mlb','page2_mlb','page3_redsox','page4_redsox']},
 {id:'wnba',label:'WNBA · Fever',pages:['page1_wnba','page2_wnba','page3_fever','page4_fever']},
 {id:'cfb',label:'NCAA FB · Arizona',pages:['page1_cfb','page2_cfb','page3_arizona_cfb','page4_arizona_cfb']},
 {id:'cbb',label:'NCAA BB · Arizona',pages:['page1_cbb','page2_cbb','page3_arizona_cbb','page4_arizona_cbb']}
];
let pageLeague='nfl';
function renderBoardExtras(){
 const holder=document.getElementById('boardExtras');if(!holder)return;
 const group=favoritePageLeagues.find(g=>g.id===pageLeague)||favoritePageLeagues[0];
 holder.innerHTML='<div class="liveLibrary">'
  +'<div class="liveLibraryTop"><div><span class="liveEyebrow">32″ ONN · LIVE BOARD CONTROL</span><h3>28 Sports Team Pages</h3><p>Choose a league, then send any of its four approved pages to the 32″ screen.</p></div></div>'
  +'<div class="liveLibraryFilters">'+favoritePageLeagues.map(g=>'<button type="button" data-board-league="'+safe(g.id)+'" class="'+(g.id===group.id?'active':'')+'">'+safe(g.label)+'</button>').join('')+'</div>'
  +'<div class="liveLibraryPages">'+group.pages.map((id,i)=>'<button type="button" data-board-page="'+safe(id)+'"><small>'+safe(group.label)+'</small><b>Page '+(i+1)+'</b><span>Send to Onn ›</span></button>').join('')+'</div>'
  +'<p class="liveLibraryHint">Commands need your Firebase sign-in and the existing Onn receiver running. The approved board artwork is unchanged.</p>'
  +'</div>';
 holder.querySelectorAll('[data-board-league]').forEach(btn=>btn.addEventListener('click',()=>{
   pageLeague=btn.dataset.boardLeague;renderBoardExtras();
 }));
 holder.querySelectorAll('[data-board-page]').forEach(btn=>btn.addEventListener('click',()=>{
   openLibraryBoard('team-page',btn.dataset.boardPage);
 }));
}
function liveModalBase(title,desc,inner,buttonText){
 const shade=document.getElementById('modalShade'),body=document.getElementById('modalBody');
 if(!shade||!body)return false;
 document.getElementById('modalTitle').textContent=title;
 body.innerHTML='<p class="modalDesc">'+safe(desc)+'</p>'+inner
  +(!state.user?'<p class="liveModalWarning">Sign in under Screens → Live TV Link before sending any commands.</p>':'')
  +'<p class="liveModalStatus" id="liveModalStatus" role="status">No command sent yet.</p>'
  +'<div class="modalActions"><button type="button" class="btn subtle" id="liveModalCancel">Cancel</button>'
  +(state.user?'<button type="button" class="btn primary" id="liveModalSend">'+safe(buttonText)+'</button>':
   '<button type="button" class="btn primary" id="liveModalLogin">Go to sign-in</button>')+'</div>';
 shade.classList.add('open');
 document.getElementById('liveModalCancel').onclick=()=>document.getElementById('closeModal').click();
 const goLogin=document.getElementById('liveModalLogin');
 if(goLogin)goLogin.onclick=()=>{
   document.getElementById('closeModal').click();
   document.querySelector('[data-nav="screens"]')?.click();
   document.getElementById('liveBridge')?.scrollIntoView({behavior:'smooth',block:'start'});
 };
 return true;
}
function buildThirdCommand(choice,now){
 if(choice==='rotation')return {type:'rotation',updatedAt:now};
 if(choice==='wrestling')return {type:'wrestling',updatedAt:now};
 if(thirdBoards.some(([id])=>id===choice))return {type:'board',board:choice,updatedAt:now};
 return null;
}
function choiceFor(side,choice,now){
 if(side==='third')return buildThirdCommand(choice,now);
 if((side==='left'||side==='right')&&(choice==='live'||choice==='upcoming'))
   return {type:choice,updatedAt:now};
 return null;
}
async function submitBridgeModal(patch){
 const status=document.getElementById('liveModalStatus'),button=document.getElementById('liveModalSend');
 if(!status)return;
 if(!state.user){status.textContent='Sign in first. No command sent.';return;}
 if(!Object.keys(patch).length){status.textContent='Choose a board first. No command sent.';return;}
 if(button)button.disabled=true;
 status.textContent='Sending to Firebase…';
 const success=await send(patch,'Screen/Board Library assignment sent.');
 status.textContent=success?'Saved to Firebase. TV playback has not been independently verified.':'Send failed. Check the Live TV Link status.';
 if(button)button.disabled=false;
 if(success){
  document.getElementById('closeModal').click();
  if(typeof window.ManCaveClearSelection==='function')window.ManCaveClearSelection();
 }
}
function openScreenAssignment(screenIds){
 const targetMap={'left-wing':'left','right-wing':'right','portrait-32':'third'};
 const allowed=(screenIds||[]).filter(id=>targetMap[id]);
 if(!allowed.length)return false;
 const html='<div class="liveModalRows">'+allowed.map(id=>{
   const side=targetMap[id],title=id==='portrait-32'?'32″ Portrait · Onn':id==='left-wing'?'Left Wing':'Right Wing';
   const choices=side==='third'?[['keep','Keep current'],...thirdBoards]:[['keep','Keep current'],['upcoming','Upcoming Games'],['live','Live Games / Results']];
   return '<label>'+safe(title)+'<select class="liveModalSelect" data-bridge-target="'+safe(side)+'">'
     +choices.map(([value,name])=>'<option value="'+safe(value)+'">'+safe(name)+'</option>').join('')+'</select></label>';
 }).join('')+'</div>';
 if(!liveModalBase('Send content to selected screens','Only connected board displays can be changed here. Choose a new board for each destination; Keep current leaves it untouched.',html,'Send to selected TVs'))return false;
 document.getElementById('liveModalSend')?.addEventListener('click',()=>{
   const patch={},now=Date.now();
   document.querySelectorAll('#modalBody [data-bridge-target]').forEach(sel=>{
     if(sel.value==='keep')return;
     const command=choiceFor(sel.dataset.bridgeTarget,sel.value,now);
     if(command)patch[sel.dataset.bridgeTarget]=command;
   });
   submitBridgeModal(patch);
 });
 return true;
}
function openLibraryBoard(boardId,pageId){
 let title,desc,targets;
 if(boardId==='live-lookin'){
  title='Man Cave Sports Book Live Lookin';desc='Send the existing Live Games / Results feed to either or both portrait wing TVs.';
  targets=[['left','Left Wing'],['right','Right Wing']];
 }else if(boardId==='upcoming'){
  title='Upcoming Games';desc='Send Upcoming Games to either or both portrait wing TVs.';
  targets=[['left','Left Wing'],['right','Right Wing']];
 }else if(boardId==='wrestling'){
  title='Inside the Squared Circle';desc='Send the existing wrestling board to the 32″ Onn display.';
  targets=[['third','32″ Portrait · Onn']];
 }else if(boardId==='team-page'&&thirdBoards.some(([id])=>id===pageId)){
  title=thirdBoards.find(([id])=>id===pageId)[1];desc='Send this existing approved sports page to the 32″ Onn display.';
  targets=[['third','32″ Portrait · Onn']];
 }else return false;
 const html='<div class="liveModalChecks">'+targets.map(([side,name])=>'<label><input type="checkbox" data-board-target="'+safe(side)+'"> '+safe(name)+'</label>').join('')+'</div>';
 if(!liveModalBase(title,desc,html,'Send board to TV'))return false;
 document.getElementById('liveModalSend')?.addEventListener('click',()=>{
   const selected=[...document.querySelectorAll('#modalBody [data-board-target]:checked')].map(el=>el.dataset.boardTarget);
   if(!selected.length){document.getElementById('liveModalStatus').textContent='Select a destination first.';return;}
   const patch={},now=Date.now();
   selected.forEach(side=>{
     const choice=boardId==='live-lookin'?'live':boardId==='upcoming'?'upcoming':boardId==='wrestling'?'wrestling':pageId;
     const command=choiceFor(side,choice,now);
     if(command)patch[side]=command;
   });
   submitBridgeModal(patch);
 });
 return true;
}
