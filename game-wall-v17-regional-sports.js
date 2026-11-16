// V17 · prominently feature Boston regional NESN/NBC Sports Boston alongside complete Providence sports guide.
// Dial positions transcribed from provided screen recording; account subscriptions may differ.
// Private address and the screen recording are not stored in the public repository.
import {auth,onAuthStateChanged} from './firebase.js';
(()=>{
'use strict';
const root=()=>document.getElementById('xfinityDirectPanel');
const HOST='https://man-cave-xfinity-bridge.onrender.com'; // Verified Render deployment only.
const ZIP='02767',STORE='man-cave-v16-providence-recorded-lineup';
const BOXES=[['Top Left','Top Left 40″'],['Top Right','Top Right 55″'],['Center','Center 65″'],['Side','Side 40″']];
const NETWORKS=[
 ["CBS · WPRI","CBS","12","812"],
 ["FOX · WNAC","FOX","11","811"],
 ["NBC · WJAR","NBC","10","810"],
 ["ABC · WLNE","ABC","6","806"],
 ["ION · WPXQ","ION","15","803"],
 ["The CW · WLWC","The CW","13","808"],
 ["CBS · WBZ (Boston)","WBZ","4","804"],
 ["ABC · WCVB (Boston)","WCVB","5","805"],
 ["FOX · WFXT (Boston)","WFXT","22",""],
 ["The CW · WLVI (Boston)","WLVI","18","1056"],
 ["ESPN","ESPN","49","1205"],
 ["ESPN2","ESPN2","50","1206"],
 ["ESPNEWS","ESPNEWS","248","1210"],
 ["ESPNU","ESPNU","286","1301"],
 ["NESN","NESN","51","1250"],
 ["NESN+","NESN+","84","1255"],
 ["NBC Sports Boston","NBC Sports Boston","52","1251"],
 ["NBC Sports Boston Plus","NBC Sports Boston Plus","85","1256"],
 ["FS1","FS1","250","1208"],
 ["FS2","FS2","254","1209"],
 ["NFL Network","NFL Network","265","1215"],
 ["NFL RedZone","NFL RedZone","287","1216"],
 ["NBA TV","NBA TV","257","1218"],
 ["NHL Network","NHL Network","259","1217"],
 ["MLB Network","MLB Network","269","1219"],
 ["CBS Sports Network","CBS Sports Network","261","1303"],
 ["ACC Network","ACC Network","139","1325"],
 ["Big Ten Network","Big Ten Network","285","1313"],
 ["SEC Network","SEC Network","137","1321"],
 ["TBS","TBS","31","1434"],
 ["TNT","TNT","33","1404"],
 ["USA Network","USA","35","1403"],
 ["truTV","truTV","69","1430"],
 ["NBC Sports Network","NBC Sports Network","","1211"],
 ["Golf Channel","Golf Channel","66","1223"],
 ["Tennis Channel","Tennis Channel","266","1224"],
 ["Sportsman Channel","Sportsman Channel","136","1237"],
 ["TUDN","TUDN","","3359"],
 ["ESPN Deportes","ESPN Deportes","","3351"],
 ["FOX Deportes","FOX Deportes","","3353"],
 ["Latin American Sports HD","Latin American Sports","","3355"],
 ["NBC Sports 4K","NBC Sports 4K","","1368"],
 ["FOX Sports 4K Events 1","FOX Sports 4K Events 1","","1354"],
 ["FOX Sports 4K Events 2","FOX Sports 4K Events 2","","1390"],
 ["NBC 4K Events","NBC 4K Events","","1356"],
 ["Golf Channel 4K","Golf Channel 4K","","1364"],
 ["USA 4K","USA 4K","","1362"],
 ["Telemundo 4K","Telemundo 4K","","1366"],
].map(([id,voice,sd,hd])=>({id,voice,sd,hd}));
const ALTERNATE_DIAL_POSITIONS={"ESPN":["849"],"ESPN2":["850"],"ESPNEWS":["796"],"ESPNU":["900"],"NESN":["851"],"NESN+":["894"],"NBC Sports Boston":["852"],"FS1":["925"],"FS2":["923"],"NFL Network":["853"],"NFL RedZone":["899"],"NBA TV":["913"],"NHL Network":["822"],"MLB Network":["914"],"CBS Sports Network":["856"],"Big Ten Network":["882"],"TBS":["831"],"TNT":["833"],"USA Network":["835"],"truTV":["902"],"Golf Channel":["848"],"Tennis Channel":["838"]};
const BOSTON_REGIONAL=['NESN','NESN+','NBC Sports Boston','NBC Sports Boston Plus'];
const known=new Map(NETWORKS.map(n=>[n.id,n]));
const s={box:'Center',network:'ESPN',quality:'HD',overrides:{},user:null,paired:new Set(),note:'Checking the four paired boxes…',sendNote:'',
 checking:false,sending:false,filter:''};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function normalize(x){return String(x||'').toLowerCase().replace(/[^a-z0-9+]/g,'');}
const alias={'cbs':'CBS · WPRI','fox':'FOX · WNAC','nbc':'NBC · WJAR','abc':'ABC · WLNE',
 'ion':'ION · WPXQ','wpxq':'ION · WPXQ','cw':'The CW · WLWC','thecw':'The CW · WLWC','wlwc':'The CW · WLWC','nbcsn':'NBC Sports Network',
 'nbcsportsboston':'NBC Sports Boston','nbcsboston':'NBC Sports Boston',
 'nbcsportsbostonplus':'NBC Sports Boston Plus',
 'newenglandsportsnetwork':'NESN','newenglandsportsnetworkplus':'NESN+',
 'foxsports1':'FS1','foxsports2':'FS2','cbs sports network':'CBS Sports Network',
 'cbssportsnetwork':'CBS Sports Network','btn':'Big Ten Network','secn':'SEC Network',
 'acchnetwork':'ACC Network','nbatv':'NBA TV','mlbnetwork':'MLB Network',
 'nhlnetwork':'NHL Network','usanetwork':'USA Network','espnnews':'ESPNEWS'};
function networkForVoice(v){
 const key=normalize(v);let name=alias[key]||v;
 return NETWORKS.find(n=>normalize(n.id)===normalize(name)||normalize(n.voice)===normalize(name))||null;
}
function readOverrides(){try{
 const parsed=JSON.parse(localStorage.getItem(STORE)||'{}');
 if(parsed&&typeof parsed==='object')s.overrides=parsed;
}catch{}}
function writeOverrides(){try{localStorage.setItem(STORE,JSON.stringify(s.overrides));return true;}catch{return false;}}
readOverrides();
function selectedNetwork(){return known.get(s.network)||NETWORKS[0];}
function numberFor(n=selectedNetwork()){const item=typeof n==='object'?n:selectedNetwork();const saved=s.overrides[item.id]||{};return s.quality==='HD'?(saved.hd??item.hd):(saved.sd??item.sd);}
function verified(n=selectedNetwork()){const record=s.overrides[n.id]||{};return record['confirmed'+s.quality]===true;}
async function api(path,body){
 if(!s.user)throw Error('Sign in through Screens → Live TV Link first.');
 const token=await s.user.getIdToken();
 const response=await fetch(HOST+path,{
  method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(json.error||'Remote bridge HTTP '+response.status);
 return json;
}
async function refresh(){
 if(s.checking)return;if(!s.user){s.note='Sign in through Screens → Live TV Link first.';render();return;}
 s.checking=true;s.note='Checking remote box pairing…';render();
 try{const result=await api('/api/boxes');s.paired=new Set((result.boxes||[]).filter(b=>b.paired).map(b=>b.name));
 s.note=s.paired.size+' of 4 Xfinity boxes paired'+(s.paired.size===4?' · ready':' · some need pairing');}
 catch(e){s.paired.clear();s.note='Connection problem: '+e.message;}
 finally{s.checking=false;render();}
}
function gameNetwork(){
 const guide=document.getElementById('xfinityTuneGuide');
 if(!guide)return null;
 const cmd=guide.querySelector('#xtCommand')?.textContent?.trim()||'';
 const m=/^Watch\s+(.+)$/i.exec(cmd);
 if(!m)return null;
 const chosen=networkForVoice(m[1]);if(!chosen)return null;
 const option=guide.querySelector('select[data-xt-game] option:checked');
 return {network:chosen,details:option?.textContent||'Selected ESPN matchup'};
}
let watchedGuide=null,guideObserver=null;
function followEspnSelection(){
 const guide=document.getElementById('xfinityTuneGuide');
 if(guide===watchedGuide)return;
 if(guideObserver)guideObserver.disconnect();
 watchedGuide=guide;
 if(guide){
  guideObserver=new MutationObserver(()=>{
   // ESPN's existing Quick Tune re-renders its own subtree after game/filter changes.
   // Our panel is a sibling, so rendering here cannot cause an observer loop.
   if(root())render();
  });
  guideObserver.observe(guide,{childList:true,subtree:true,characterData:true});
 }
}
function render(){
 const node=root();if(!node)return;
 followEspnSelection();
 const n=selectedNetwork(),num=numberFor(n),pair=s.paired.has(s.box);
 const games=gameNetwork();
 node.innerHTML='<section class="localDirect"><div class="localDirectHead"><div><span class="localDirectEyebrow">DIRECT XFINITY CONTROL · RECORDED LINEUP</span><h3>Providence Sports TV Guide</h3><p>Sports networks and channels that carry games, from your Xfinity recording. Includes ION, The CW, TBS, TNT, USA and truTV.</p></div><div class="localDirectZip">02767</div></div>'
  +'<div class="localDirectStatus" role="status">'+esc(s.note)+'</div>'
  +'<div class="localDirectLabel">1 · CHOOSE YOUR TV</div><div class="localDirectBoxes">'+BOXES.map(([id,label])=>
   '<button type="button" data-v14-box="'+esc(id)+'" class="'+(s.box===id?'active':'')+'"><b>'+esc(id)+'</b><small>'+esc(s.paired.has(id)?'● Paired':'○ Not paired')+'</small></button>').join('')+'</div>'
  +'<div class="regionalSports"><div class="regionalSportsHead"><strong>BOSTON REGIONAL SPORTS</strong><span>NESN · NBC SPORTS BOSTON</span></div><p>Quick-tune a regional network on <b>'+esc(s.box)+'</b> using the paired Xfinity remote. SD/HD numbers were visible in your Xfinity lineup recording.</p><div class="regionalSportsGrid">'+BOSTON_REGIONAL.map(id=>{const item=known.get(id),saved=s.overrides[id]||{},hd=saved.hd??item.hd,sd=saved.sd??item.sd;return '<div class="regionalSportsCard"><div><strong>'+esc(id)+'</strong><small>HD '+esc(hd||'—')+' · SD '+esc(sd||'—')+'</small></div><div class="regionalSportsCardActions"><button type="button" data-v14-net="'+esc(id)+'" class="regionalChoose"'+(s.sending?' disabled':'')+'>Select</button><button type="button" data-v17-watch="'+esc(id)+'" class="regionalWatch"'+(!s.user||!pair||s.sending?' disabled':'')+'>Watch on '+esc(s.box)+'</button></div></div>';}).join('')+'</div><small class="regionalSportsNote">Watch sends the Xfinity voice-style command. For a specific channel number or alternate position, use Select then Tune # below. Confirm the actual TV changes.</small></div>'
  +'<div class="localDirectLabel">2 · SPORTS & GENERAL NETWORKS</div>'
  +'<div class="localDirectFavorites">'+["ESPN","NESN","ION · WPXQ","USA Network","TBS","TNT","truTV","The CW · WLWC","CBS · WPRI","FOX · WNAC","NBC · WJAR","ABC · WLNE"].map(id=>'<button type="button" data-v14-net="'+esc(id)+'" class="'+(s.network===id?'active':'')+'">'+esc(id.replace(/ · .*/,''))+'</button>').join('')+'</div>'
  +'<label class="localDirectSearch">Find a channel<input type="search" id="v14Filter" placeholder="ESPN, NESN, TNT…" value="'+esc(s.filter)+'" autocomplete="off"></label>'
  +'<div class="localDirectChannels">'+NETWORKS.filter(x=>normalize(x.id).includes(normalize(s.filter))).map(x=>{
   const saved=s.overrides[x.id]||{};const hd=saved.hd??x.hd,sd=saved.sd??x.sd,alts=ALTERNATE_DIAL_POSITIONS[x.id]||[];
   return '<button type="button" data-v14-net="'+esc(x.id)+'" class="localDirectCh'+(x.id===s.network?' active':'')+'"><strong>'+esc(x.id)+'</strong><span>'+(hd||sd?esc(hd||'—')+' <small>HD</small> · '+esc(sd||'—')+' <small>SD</small>':'Voice only · number not visible')+(alts.length?' · alt '+esc(alts.join('/')):'')+'</span></button>';
  }).join('')+'</div>'
  +(games?'<button type="button" class="localDirectGame" data-v14-game><strong>Use game from ESPN Quick Tune</strong><span>'+esc(games.details)+' → '+esc(games.network.id)+'</span></button>':
   '<div class="localDirectGameDisabled">For game-specific tuning, load/select a matchup in the ESPN Quick Tune panel below. If ESPN provides a known network, a Use game button will appear here.</div>')
  +'<div class="localDirectSelected"><div><small>SELECTED NETWORK</small><b>'+esc(n.id)+'</b></div><div><small>LISTED '+esc(s.quality)+' CHANNEL</small><b>'+esc(num||'—')+'</b></div></div>'
  +'<div class="localDirectQuality"><button type="button" data-v14-quality="HD" class="'+(s.quality==='HD'?'active':'')+'">HD</button><button type="button" data-v14-quality="SD" class="'+(s.quality==='SD'?'active':'')+'">SD</button></div>'
  +'<div class="localDirectAlternates">'+((ALTERNATE_DIAL_POSITIONS[n.id]||[]).length?'Also listed on: '+esc(ALTERNATE_DIAL_POSITIONS[n.id].join(', '))+' · enter an alternate below if preferred.':'No additional dial positions visible in the recording.')+'</div>'
  +'<label class="localDirectEdit">Edit recorded channel number for '+esc(n.id)+' ('+esc(s.quality)+')<input id="v14Edit" inputmode="numeric" pattern="[0-9]*" maxlength="5" value="'+esc(num)+'" placeholder="Enter channel number"></label>'
  +'<button type="button" class="localDirectConfirm" data-v14-action="confirm">'+(verified(n)?'✓ Channel verified on my Xfinity box':'Save after verifying this number on the TV')+'</button>'
  +'<div class="localDirectLabel">3 · TUNE THE SELECTED TV</div>'
  +'<div class="localDirectTune"><button type="button" class="localDirectMain" data-v14-action="tune"'+(!s.user||!pair||s.sending?' disabled':'')+'>'+(s.sending?'Sending…':'Watch '+esc(n.id)+' on '+esc(s.box))+'</button>'
  +'<button type="button" class="localDirectDigits" data-v14-action="digits"'+(!s.user||!pair||s.sending||!num?' disabled':'')+'>Tune #'+esc(num||'—')+'</button></div>'
  +'<div class="localDirectNotice" role="status">'+esc(s.sendNote||'Watch sends the tested voice-style command. Tune # uses a dial position from your Xfinity recording (or your own saved correction). Actual access depends on your package.')+'</div>'
  +'<div class="localDirectBottom"><button type="button" data-v14-action="refresh">'+(s.checking?'Checking…':'Refresh paired boxes')+'</button><a href="./xfinity-pairing-v13.html">Pair or test a box</a></div>'
  +'<p class="localDirectFoot">Source: your November 16 Xfinity recording of the address-selected Providence-region lineup. Alternate dial positions are shown where observed. Some networks require subscription. Edits stay in this iPhone browser. No private Xfinity credentials or address are published. API acceptance does not verify TV playback.</p></section>';
}
async function send(kind){
 if(!s.user||s.sending||!s.paired.has(s.box))return;
 const n=selectedNetwork(),channel=numberFor(n);
 if(kind==='channel'&&!/^\d{1,5}$/.test(String(channel||''))){s.sendNote='Enter a valid channel number first.';render();return;}
 s.sending=true;s.sendNote='Sending '+(kind==='channel'?'#'+channel:n.id)+' to '+s.box+'…';render();
 try{
  const payload=await api('/api/send',{box:s.box,kind,value:kind==='channel'?String(channel):'Watch '+n.voice});
  s.sendNote=payload.commandAccepted?'Xfinity accepted '+(kind==='channel'?'#'+channel:n.id)+' for '+s.box+'. Verify playback on that TV.':'No acceptance received from Xfinity.';
 }catch(e){s.sendNote='Could not change '+s.box+': '+e.message;if(/pair|expired/i.test(e.message))refresh();}
 finally{s.sending=false;render();}
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-v14-box],[data-v14-net],[data-v14-quality],[data-v14-action],[data-v14-game],[data-v17-watch]');
 if(!b)return;
 if(b.dataset.v17Watch){
  if(!BOSTON_REGIONAL.includes(b.dataset.v17Watch))return;
  s.network=b.dataset.v17Watch;
  send('text');
 }
 else if(b.dataset.v14Box){s.box=b.dataset.v14Box;s.sendNote='';render();}
 else if(b.dataset.v14Net){s.network=b.dataset.v14Net;s.sendNote='';render();}
 else if(b.dataset.v14Quality){s.quality=b.dataset.v14Quality;render();}
 else if(b.hasAttribute('data-v14-game')){
  const g=gameNetwork();if(g){s.network=g.network.id;s.sendNote='Using '+g.network.id+' from the ESPN matchup. Check that the local channel matches the broadcast.';render();}
 }
 else if(b.dataset.v14Action==='refresh')refresh();
 else if(b.dataset.v14Action==='tune')send('text');
 else if(b.dataset.v14Action==='digits')send('channel');
 else if(b.dataset.v14Action==='confirm'){
  const n=selectedNetwork(),num=numberFor(n);
  if(!/^\d{1,5}$/.test(String(num||''))){s.sendNote='Enter a valid channel number first.';render();return;}
  const entry=s.overrides[n.id]||{};entry['confirmed'+s.quality]=true;s.overrides[n.id]=entry;
  const saved=writeOverrides();
  s.sendNote=saved?'Saved as verified on this iPhone.':'Verified in this session; browser storage was unavailable.';
  render();
 }
});
document.addEventListener('input',e=>{
 if(e.target?.id==='v14Filter'){
  s.filter=e.target.value;
  // Avoid stealing the search input focus while updating the list.
  const box=root()?.querySelector('.localDirectChannels');if(!box)return;
  box.querySelectorAll('[data-v14-net]').forEach(button=>{button.hidden=!normalize(button.dataset.v14Net).includes(normalize(s.filter));});
 }
});
document.addEventListener('change',e=>{
 if(e.target?.id!=='v14Edit')return;
 const n=selectedNetwork(),number=e.target.value.trim();
 if(number&&!/^\d{1,5}$/.test(number)){s.sendNote='Please enter 1–5 digits.';render();return;}
 const entry=s.overrides[n.id]||{};entry[s.quality.toLowerCase()]=number;entry['confirmed'+s.quality]=false;s.overrides[n.id]=entry;
 s.sendNote=writeOverrides()?'Channel number saved on this iPhone. Confirm it matches your Xfinity service.':'Number updated for this session.';
 render();
});
onAuthStateChanged(auth,user=>{
 s.user=user;s.paired.clear();
 s.note=user?'Signed in · checking pairing status…':'Sign in on Screens → Live TV Link to enable direct Xfinity tuning.';
 render();
 if(user)refresh();
});
window.XfinityDirect={render,refresh};
render();
})();
