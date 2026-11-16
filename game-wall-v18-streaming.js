// Game Wall V18: Xfinity voice-style streaming app shortcuts + dedicated NFL RedZone.
import {auth,onAuthStateChanged} from './firebase.js';
(()=>{
 'use strict';
 const ROOT_ID='xfinityStreamingPanel';
 const HOST='https://man-cave-xfinity-bridge.onrender.com'; // Verified Render service
 const TVS=['Top Left','Top Right','Center','Side'];
 // App IDs are an explicit allowlist on the private server; never trust arbitrary commands.
 const APPS=[
  {id:'netflix',name:'Netflix',glyph:'N',type:'Streaming',cmd:'Netflix'},
  {id:'prime',name:'Prime Video',glyph:'prime',type:'Streaming',cmd:'Watch Prime Video'},
  {id:'appletv',name:'Apple TV',glyph:'tv+',type:'Streaming',cmd:'Launch Apple TV app'},
  {id:'paramount',name:'Paramount+',glyph:'P+',type:'Streaming · sports',cmd:'Paramount+'},
  {id:'disney',name:'Disney+',glyph:'D+',type:'Streaming',cmd:'Disney plus app'},
  {id:'espnplus',name:'ESPN+ / ESPN app',glyph:'E+',type:'Sports streaming',cmd:'ESPN app'},
  {id:'youtube',name:'YouTube',glyph:'YT',type:'Streaming video',cmd:'YouTube'},
  {id:'peacock',name:'Peacock',glyph:'Pc',type:'Sports streaming',cmd:'Peacock'},
  {id:'hulu',name:'Hulu',glyph:'H',type:'Streaming',cmd:'Hulu'}
 ];
 const root=()=>document.getElementById(ROOT_ID);
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const state={box:'Center',user:null,paired:new Set(),checking:false,sending:false,notice:'Checking your existing Xfinity pairing…',lastCommand:'',ready:false};
 function currentBox(){
  const selected=document.querySelector('.localDirectBoxes [data-v14-box].active')?.dataset.v14Box;
  return TVS.includes(selected)?selected:state.box;
 }
 async function api(path,body){
  if(!state.user)throw Error('Sign in to your Firebase controller first.');
  const bearer=await state.user.getIdToken();
  const response=await fetch(HOST+path,{
   method:body?'POST':'GET',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Xfinity bridge returned HTTP '+response.status);
  return data;
 }
 function render(){
  const host=root();if(!host)return;
  state.box=currentBox();
  const eligible=!!state.user&&!state.sending&&state.paired.has(state.box);
  host.innerHTML='<section class="streamLaunchPanel">'
   +'<div class="streamLaunchHeader"><div><span class="streamEyebrow">MAN CAVE · DIRECT XFINITY APP LAUNCHER</span><h3>Streaming Apps <span>+ NFL RedZone</span></h3><p>Tap a network or streaming service to send its voice-style command straight to the selected Xfinity box. No jumping to Xfinity Web Remote.</p></div><span class="streamCount">9 APPS<br>+ REDZONE</span></div>'
   +'<div class="streamLine"><strong>DESTINATION TV</strong><span>'+safe(state.box)+'</span></div>'
   +'<div class="streamTvGrid">'+TVS.map(box=>'<button type="button" data-x18-tv="'+safe(box)+'" class="'+(state.box===box?'active':'')+'"><b>'+safe(box)+'</b><small>'+safe(state.paired.has(box)?'● Paired':'○ Not paired')+'</small></button>').join('')+'</div>'
   +'<div class="streamStatus" role="status">'+safe(state.notice)+'</div>'
   +'<div class="streamSectionLabel">STREAMING APP QUICK LAUNCH</div>'
   +'<div class="streamGrid">'+APPS.map(a=>'<button type="button" class="streamAppCard" data-x18-app="'+safe(a.id)+'"'+(!eligible?' disabled':'')+'><span class="streamLogo" data-app="'+safe(a.id)+'">'+safe(a.glyph)+'</span><span class="streamAppTexts"><b>'+safe(a.name)+'</b><small>'+safe(a.type)+'</small><em>“'+safe(a.cmd)+'”</em></span><span class="streamAction">Launch</span></button>').join('')+'</div>'
   +'<div class="streamSectionLabel">NFL LIVE · REDZONE</div>'
   +'<div class="streamRedzone"><div class="streamRedTitle"><span class="streamRedIcon">RZ</span><div><strong>NFL RedZone</strong><small>Providence Xfinity · HD 1216 · SD 287 · alternate 899</small></div></div>'
   +'<p>RedZone is an Xfinity live channel, not a streaming app. Requires access through your TV package.</p>'
   +'<div class="streamRedActions"><button type="button" data-x18-red="voice"'+(!eligible?' disabled':'')+'>Watch RedZone on '+safe(state.box)+'</button><button type="button" data-x18-red="channel"'+(!eligible?' disabled':'')+'>Tune #1216</button></div></div>'
   +'<div class="streamReceipt" role="status">'+safe(state.lastCommand||'Choose a streaming app or RedZone button above. A successful response confirms Xfinity received the command, not that the app opened or a program is playing.')+'</div>'
   +'<div class="streamFooter"><button type="button" data-x18-refresh'+(state.checking?' disabled':'')+'>'+(state.checking?'Checking…':'Refresh box connections')+'</button><a href="./xfinity-pairing-v13.html">Pair / repair a TV</a></div>'
   +'<p class="streamFine">Voice phrase availability can vary by box, Xfinity software, and app. Netflix, Disney+ and Apple TV phrases follow published Xfinity guidance; other launch phrases may require testing. ESPN+ content opens within the ESPN app; YouTube is YouTube, not YouTube TV. Apps may require separate logins or subscriptions.</p>'
   +'</section>';
 }
 async function refresh(){
  if(state.checking)return;
  if(!state.user){state.notice='Sign in under Screens → Live TV Link to use direct app launching.';state.paired.clear();render();return;}
  state.checking=true;state.notice='Checking the four paired Xfinity boxes…';render();
  try{
   const data=await api('/api/boxes');
   state.paired=new Set((data.boxes||[]).filter(b=>b.paired&&TVS.includes(b.name)).map(b=>b.name));
   state.notice=state.paired.size+' of 4 Xfinity boxes paired'+(state.paired.size===4?' · launch controls ready':' · check pairing');
  }catch(e){state.paired.clear();state.notice='Could not verify boxes: '+e.message;}
  finally{state.checking=false;render();}
 }
 async function send(input){
  if(!state.user||state.sending)return;
  const box=currentBox();state.box=box;
  if(!state.paired.has(box)){state.lastCommand=box+' is not paired. Use the pairing setup link.';render();return;}
  state.sending=true;
  state.lastCommand='Sending '+input.preview+' to '+box+'…';render();
  try{
   const result=await api('/api/send',{box,kind:input.kind,value:input.value});
   state.lastCommand=result.commandAccepted?
    'Xfinity accepted '+input.preview+' for '+box+'. Check that TV to confirm the app or channel actually opened.':
    'Xfinity did not confirm the command.';
  }catch(e){
   state.lastCommand='Unable to control '+box+': '+e.message;
   if(/pair|expired/i.test(e.message))refresh();
  }finally{state.sending=false;render();}
 }
 function selectBox(box){
  if(!TVS.includes(box)||state.sending)return;
  state.box=box;
  // Keep the established regional/cable controller's selected TV in sync.
  const old=[...document.querySelectorAll('.localDirectBoxes [data-v14-box]')].find(el=>el.dataset.v14Box===box);
  if(old)old.click();
  render();
 }
 document.addEventListener('click',event=>{
  const el=event.target.closest?.('[data-x18-tv],[data-x18-app],[data-x18-red],[data-x18-refresh],[data-v14-box]');
  if(!el)return;
  if(el.dataset.v14Box){
   if(TVS.includes(el.dataset.v14Box)){state.box=el.dataset.v14Box;render();}
  }else if(el.dataset.x18Tv)selectBox(el.dataset.x18Tv);
  else if(el.hasAttribute('data-x18-refresh'))refresh();
  else if(el.dataset.x18App){
   const app=APPS.find(a=>a.id===el.dataset.x18App);
   if(app)send({kind:'app',value:app.id,preview:app.name+' (“'+app.cmd+'”)'});
  }else if(el.dataset.x18Red==='voice')send({kind:'text',value:'Watch NFL RedZone',preview:'Watch NFL RedZone'});
  else if(el.dataset.x18Red==='channel')send({kind:'channel',value:'1216',preview:'channel 1216 (NFL RedZone)'});
 });
 onAuthStateChanged(auth,user=>{
  state.user=user;state.paired.clear();
  state.notice=user?'Firebase session connected · checking pairing…':'Sign in under Screens → Live TV Link to enable direct streaming commands.';
  render();
  if(user)refresh();
 });
 window.XfinityStreaming={render,refresh};
 render();
})();