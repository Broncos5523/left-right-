// V14 · 02767 local sports channel guide with direct, per-box Xfinity tuning.
// Lineup reference: https://thechannellist.com/comcast-xfinity-channel-lineup/massachusetts/raynham/
// Numbers are ZIP-level candidates (Nov 2026), not a verified subscriber-specific lineup.
import {auth,onAuthStateChanged} from './firebase.js';
(()=>{
'use strict';
const root=()=>document.getElementById('xfinityDirectPanel');
const HOST='https://man-cave-xfinity-bridge.onrender.com'; // Verified Render deployment only.
const ZIP='02767',STORE='man-cave-v14-02767-channel-overrides';
const BOXES=[['Top Left','Top Left 40″'],['Top Right','Top Right 55″'],['Center','Center 65″'],['Side','Side 40″']];
const NETWORKS=[
 ['ESPN','ESPN','44','217'],['ESPN2','ESPN2','45','218'],
 ['ESPNEWS','ESPNEWS','118','172'],['ESPNU','ESPNU','148','235'],
 ['NESN','NESN','46','219'],['NESN+','NESN+','63','234'],
 ['NBC Sports Boston','NBC Sports Boston','47','220'],
 ['NBC Sports Boston Plus','NBC Sports Boston Plus','64',''],
 ['FS1','FS1','120','256'],['FS2','FS2','123','254'],
 ['NFL Network','NFL Network','129','221'],
 ['NBA TV','NBA TV','126','247'],['NHL Network','NHL Network','127','194'],
 ['MLB Network','MLB Network','133','248'],
 ['TNT','TNT','28','205'],['TBS','TBS','26','203'],
 ['USA Network','USA','30','207'],
 ['CBS Sports Network','CBS Sports Network','128','224'],
 ['ACC Network','ACC Network','75','283'],
 ['Big Ten Network','Big Ten Network','147','233'],
 ['SEC Network','SEC Network','74','257'],
 ['Golf Channel','Golf Channel','59','216'],
 ['Tennis Channel','Tennis Channel','130','210'],
 ['truTV','truTV','61','237']
].map(([id,voice,sd,hd])=>({id,voice,sd,hd}));
const known=new Map(NETWORKS.map(n=>[n.id,n]));
const s={box:'Center',network:'ESPN',quality:'HD',overrides:{},user:null,paired:new Set(),note:'Checking the four paired boxes…',sendNote:'',
 checking:false,sending:false,filter:''};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function normalize(x){return String(x||'').toLowerCase().replace(/[^a-z0-9+]/g,'');}
const alias={'nbcsportsboston':'NBC Sports Boston','nbcsboston':'NBC Sports Boston',
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
function render(){
 const node=root();if(!node)return;
 const n=selectedNetwork(),num=numberFor(n),pair=s.paired.has(s.box);
 const games=gameNetwork();
 node.innerHTML='<section class="localDirect"><div class="localDirectHead"><div><span class="localDirectEyebrow">DIRECT XFINITY CONTROL · 02767</span><h3>Local Sports Channels</h3><p>Raynham, MA · ZIP-based channel suggestions. Tune your paired boxes directly and save the numbers confirmed on your own Xfinity service.</p></div><div class="localDirectZip">02767</div></div>'
  +'<div class="localDirectStatus" role="status">'+esc(s.note)+'</div>'
  +'<div class="localDirectLabel">1 · CHOOSE YOUR TV</div><div class="localDirectBoxes">'+BOXES.map(([id,label])=>
   '<button type="button" data-v14-box="'+esc(id)+'" class="'+(s.box===id?'active':'')+'"><b>'+esc(id)+'</b><small>'+esc(s.paired.has(id)?'● Paired':'○ Not paired')+'</small></button>').join('')+'</div>'
  +'<div class="localDirectLabel">2 · PICK A LOCAL SPORTS NETWORK</div>'
  +'<label class="localDirectSearch">Find a channel<input type="search" id="v14Filter" placeholder="ESPN, NESN, TNT…" value="'+esc(s.filter)+'" autocomplete="off"></label>'
  +'<div class="localDirectChannels">'+NETWORKS.filter(x=>normalize(x.id).includes(normalize(s.filter))).map(x=>{
   const saved=s.overrides[x.id]||{};const hd=saved.hd??x.hd,sd=saved.sd??x.sd;
   return '<button type="button" data-v14-net="'+esc(x.id)+'" class="localDirectCh'+(x.id===s.network?' active':'')+'"><strong>'+esc(x.id)+'</strong><span>'+esc(hd||'—')+' <small>HD</small> · '+esc(sd||'—')+' <small>SD</small></span></button>';
  }).join('')+'</div>'
  +(games?'<button type="button" class="localDirectGame" data-v14-game><strong>Use game from ESPN Quick Tune</strong><span>'+esc(games.details)+' → '+esc(games.network.id)+'</span></button>':
   '<div class="localDirectGameDisabled">For game-specific tuning, load/select a matchup in the ESPN Quick Tune panel below. If ESPN provides a known network, a Use game button will appear here.</div>')
  +'<div class="localDirectSelected"><div><small>SELECTED NETWORK</small><b>'+esc(n.id)+'</b></div><div><small>CANDIDATE '+esc(s.quality)+' CHANNEL</small><b>'+esc(num||'—')+'</b></div></div>'
  +'<div class="localDirectQuality"><button type="button" data-v14-quality="HD" class="'+(s.quality==='HD'?'active':'')+'">HD</button><button type="button" data-v14-quality="SD" class="'+(s.quality==='SD'?'active':'')+'">SD</button></div>'
  +'<label class="localDirectEdit">Channel number for '+esc(n.id)+' ('+esc(s.quality)+')<input id="v14Edit" inputmode="numeric" pattern="[0-9]*" maxlength="5" value="'+esc(num)+'" placeholder="Enter channel number"></label>'
  +'<button type="button" class="localDirectConfirm" data-v14-action="confirm">'+(verified(n)?'✓ Channel verified on my Xfinity box':'Mark this channel number as verified')+'</button>'
  +'<div class="localDirectLabel">3 · TUNE THE SELECTED TV</div>'
  +'<div class="localDirectTune"><button type="button" class="localDirectMain" data-v14-action="tune"'+(!s.user||!pair||s.sending?' disabled':'')+'>'+(s.sending?'Sending…':'Watch '+esc(n.id)+' on '+esc(s.box))+'</button>'
  +'<button type="button" class="localDirectDigits" data-v14-action="digits"'+(!s.user||!pair||s.sending||!num?' disabled':'')+'>Tune #'+esc(num||'—')+'</button></div>'
  +'<div class="localDirectNotice" role="status">'+esc(s.sendNote||'Watch uses the tested Xfinity voice-style command. Tune # sends digits for the listed channel; confirm the number on your TV first.')+'</div>'
  +'<div class="localDirectBottom"><button type="button" data-v14-action="refresh">'+(s.checking?'Checking…':'Refresh paired boxes')+'</button><a href="./xfinity-pairing-v13.html">Pair or test a box</a></div>'
  +'<p class="localDirectFoot">Source: <a href="https://thechannellist.com/comcast-xfinity-channel-lineup/massachusetts/raynham/" target="_blank" rel="noopener noreferrer">Raynham 02767 lineup (Nov 2026)</a>. ZIP-based numbers do not prove your package includes a network. Your corrections are stored only in this iPhone browser. <a href="https://www.xfinity.com/support/local-channel-lineup" target="_blank" rel="noopener noreferrer">Check exact channels with Xfinity.</a> An API acknowledgment does not verify TV playback.</p></section>';
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
 const b=e.target.closest?.('[data-v14-box],[data-v14-net],[data-v14-quality],[data-v14-action],[data-v14-game]');
 if(!b)return;
 if(b.dataset.v14Box){s.box=b.dataset.v14Box;s.sendNote='';render();}
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
 s.sendNote=writeOverrides()?'Local channel number updated on this iPhone. Verify it on the actual TV.':'Number updated for this session.';
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
