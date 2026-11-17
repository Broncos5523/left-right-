// V31 — Approved sports network selector. Keeps all credentials and commands in the existing private bridge.
import {auth,onAuthStateChanged} from './firebase.js';
(()=>{
'use strict';
const BRIDGE='https://man-cave-xfinity-bridge.onrender.com';
const BOXES=['Top Left','Top Right','Center','Side'];
const STREAM=[
  {id:'Peacock',name:'Peacock',app:'peacock'},
  {id:'Prime Video',name:'Prime Video',app:'prime'},
  {id:'ESPN+',name:'ESPN+',app:'espnplus'},
  {id:'Paramount+',name:'Paramount+',app:'paramount'},
  {id:'Apple TV',name:'Apple TV',app:'appletv'},
  {id:'NFL Sunday Ticket',name:'NFL Sunday Ticket',app:'youtube',note:'Opens YouTube. Select the Sunday Ticket game inside the app.'}
];
const LOCAL=/^(ABC|CBS|FOX|NBC|ION|The CW) · /;
const REGIONAL=/^(NBC Sports Boston|NESN)/;
const FOURK=/\b4K\b/;
const NATIONAL=/^(ESPN|FS[12]|FOX Sports|NBC Sports Network|NFL|NBA TV|NHL Network|MLB Network|CBS Sports|ACC |Big Ten|SEC |TBS|TNT|truTV|USA Network|Golf |Tennis |Sportsman |TUDN|Telemundo)/;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={user:null,checked:false,paired:new Set(),selected:new Set(['Center']),current:null,loading:false,filter:'',message:'Connect to the Xfinity bridge to use network tuning.',receipt:''};
function catalog(){
 const observed=window.XfinityDirect?.getLineup?.()||[];
 const physical=observed.filter(n=>n&&n.id&&n.voice).map(n=>({...n,name:n.id,app:null}));
 return [...physical,...STREAM];
}
function groupFor(n){
 if(n.app)return 'Streaming Sports';
 if(REGIONAL.test(n.name))return 'Regional Sports';
 if(LOCAL.test(n.name))return 'Local Broadcast';
 if(FOURK.test(n.name))return '4K & Specialty';
 if(NATIONAL.test(n.name))return 'National Sports';
 return 'Other Recorded Networks';
}
const GROUPS=['Regional Sports','Local Broadcast','National Sports','Other Recorded Networks','4K & Specialty','Streaming Sports'];
function badge(name){
 return window.ManCaveNetworkLogos?.badge?.({name,status:'ready'})||'<span class="networkNameFallback">'+esc(name)+'</span>';
}
function root(){return document.getElementById('networkPicker');}
function render(){
 const node=root();if(!node)return;
 const items=catalog();
 const filtered=items.filter(n=>n.name.toLowerCase().includes(state.filter.trim().toLowerCase()));
 const count=items.length;
 node.innerHTML='<section class="networkSelect" aria-label="Choose an approved sports network">'+
  '<div class="networkSelectTop"><div><span class="networkSelectKicker">APPROVED NETWORKS · PROVIDENCE</span><h3>Choose a broadcast</h3><p>Tap a network, select your cable TVs, then send the Xfinity voice command. Streaming services launch their apps.</p></div><span class="networkSelectCount">'+count+' SOURCES</span></div>'+
  '<div class="networkSelectStatus" role="status">'+esc(state.message)+'</div>'+
  '<div class="networkSelectActions"><input id="networkSearch" type="search" placeholder="Find ESPN, NESN, NBC, Peacock…" aria-label="Search approved sports networks" value="'+esc(state.filter)+'"><button type="button" data-network-action="refresh"'+(state.loading?' disabled':'')+'>Check TVs</button></div>'+
  (items.length?GROUPS.map(group=>{
    const members=filtered.filter(n=>groupFor(n)===group);
    if(!members.length)return '';
    return '<div class="networkSelectGroup"><h4>'+esc(group)+'</h4><div class="networkSelectGrid">'+
      members.map(n=>'<button type="button" class="networkSelectCard" data-network-id="'+esc(n.id)+'"><span class="networkSelectArt">'+badge(n.name)+'</span><span class="networkSelectName">'+esc(n.name)+'</span></button>').join('')+
      '</div></div>';
   }).join(''):'<div class="networkSelectEmpty">Loading your saved Providence channels…</div>')+
  '<p class="networkSelectFine">The channel list comes from your approved Xfinity recording and saved corrections. Send confirms Xfinity received a command, not that a channel or game is playing.</p></section>';
 node.querySelectorAll('[data-network-id]').forEach(b=>b.onclick=()=>openNetwork(b.dataset.networkId));
 node.querySelector('[data-network-action="refresh"]')?.addEventListener('click',checkBoxes);
 node.querySelector('#networkSearch')?.addEventListener('input',e=>{
   const sel=e.target,position=sel.selectionStart??sel.value.length;
   state.filter=sel.value;
   // Rebuild only the group grid; preserve keyboard focus during live searches.
   const box=node.querySelectorAll('.networkSelectGroup');
   const all=filteredSections();
   box.forEach(el=>el.remove());
   const fine=node.querySelector('.networkSelectFine');
   if(fine)fine.insertAdjacentHTML('beforebegin',all);
   node.querySelectorAll('[data-network-id]').forEach(b=>b.onclick=()=>openNetwork(b.dataset.networkId));
   if(sel.setSelectionRange&&position<=sel.value.length)sel.setSelectionRange(position,position);
 });
}
function filteredSections(){
 const matches=catalog().filter(n=>n.name.toLowerCase().includes(state.filter.trim().toLowerCase()));
 return GROUPS.map(group=>{
  const members=matches.filter(n=>groupFor(n)===group);if(!members.length)return '';
  return '<div class="networkSelectGroup"><h4>'+esc(group)+'</h4><div class="networkSelectGrid">'+
   members.map(n=>'<button type="button" class="networkSelectCard" data-network-id="'+esc(n.id)+'"><span class="networkSelectArt">'+badge(n.name)+'</span><span class="networkSelectName">'+esc(n.name)+'</span></button>').join('')+'</div></div>';
 }).join('');
}
async function bridge(path,payload){
 if(!state.user)throw Error('Sign in under Settings → Firebase connection first.');
 const token=await state.user.getIdToken();
 const response=await fetch(BRIDGE+path,{
  method:payload?'POST':'GET',
  headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
  ...(payload?{body:JSON.stringify(payload)}:{})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Xfinity HTTP '+response.status);
 return data;
}
async function checkBoxes(){
 if(state.loading)return;
 if(!state.user){state.message='Not signed in. Open Settings → Firebase connection.';render();return;}
 state.loading=true;state.message='Checking paired Xfinity TVs…';render();
 try{
  const response=await bridge('/api/boxes');
  state.paired=new Set((response.boxes||[]).filter(box=>box.paired&&BOXES.includes(box.name)).map(box=>box.name));
  state.checked=true;
  state.selected=new Set([...state.selected].filter(box=>state.paired.has(box)));
  if(!state.selected.size&&state.paired.size)state.selected.add(state.paired.has('Center')?'Center':[...state.paired][0]);
  state.message=state.paired.size+' of 4 Xfinity boxes paired.';
 }catch(e){state.checked=false;state.paired.clear();state.message='Box check failed: '+e.message;}
 finally{
  state.loading=false;render();
  if(state.current&&document.getElementById('modalShade')?.classList.contains('open'))showPicker();
 }
}
function openNetwork(id){
 const item=catalog().find(n=>n.id===id);if(!item)return;
 state.current=item;state.receipt='';
 if(state.user&&!state.checked&&!state.loading)checkBoxes();
 showPicker();
}
function showPicker(){
 const item=state.current;if(!item)return;
 const title=document.getElementById('modalTitle'),body=document.getElementById('modalBody'),shade=document.getElementById('modalShade');
 if(!title||!body||!shade)return;
 title.textContent='Send Network to TVs';
 const command=item.app?'Launch '+item.name:'Watch '+item.voice;
 body.innerHTML='<div class="networkPickerHeading">'+badge(item.name)+'<strong>'+esc(item.name)+'</strong></div>'+
  '<div class="networkPickerCommand"><small>XFINITY COMMAND</small><strong>'+esc(command)+'</strong>'+
  (item.app?'<p>'+esc(item.note||'Launches the streaming app; select the event inside the app.')+'</p>':'<p>Voice-first channel tuning. The recorded channel number remains available in Settings as a backup.</p>')+'</div>'+
  '<div class="networkPickerLabel">Choose one or more TVs</div>'+
  '<div class="networkPickerTVs">'+BOXES.map(box=>
   '<button type="button" data-network-tv="'+esc(box)+'" aria-pressed="'+state.selected.has(box)+'" class="'+(state.selected.has(box)?'selected':'')+'"'+(!state.paired.has(box)?' disabled':'')+'><b>'+esc(box)+'</b><small>'+esc(state.paired.has(box)?'● Paired':'○ Not paired')+'</small></button>'
  ).join('')+'</div>'+
  '<div id="networkPickerReceipt" class="networkPickerReceipt" role="status">'+esc(state.receipt||(state.user?state.message:'Sign in through Settings to connect.'))+'</div>'+
  '<div class="modalActions"><button type="button" class="btn subtle" id="networkCancel">Cancel</button>'+
  (!state.user?'<button type="button" class="btn primary" id="networkSettings">Open Settings</button>':
   '<button type="button" class="btn primary" id="networkSend"'+(!state.selected.size||state.loading?' disabled':'')+'>Send to '+state.selected.size+' TV'+(state.selected.size===1?'':'s')+'</button>')+'</div>';
 shade.classList.add('open');
 body.querySelectorAll('[data-network-tv]').forEach(button=>button.onclick=()=>{
  const tv=button.dataset.networkTv;
  if(state.selected.has(tv))state.selected.delete(tv);else state.selected.add(tv);
  showPicker();
 });
 document.getElementById('networkCancel')?.addEventListener('click',()=>document.getElementById('closeModal')?.click());
 document.getElementById('networkSettings')?.addEventListener('click',()=>{
  document.getElementById('closeModal')?.click();document.querySelector('[data-nav="settings"]')?.click();
 });
 document.getElementById('networkSend')?.addEventListener('click',send);
}
async function send(){
 if(state.loading||!state.current||!state.user)return;
 const item=state.current;
 const tvs=[...state.selected].filter(tv=>state.paired.has(tv));
 if(!tvs.length){state.receipt='Choose at least one paired TV.';showPicker();return;}
 state.loading=true;state.receipt='Sending to '+tvs.join(', ')+'…';showPicker();
 const command=item.app?{kind:'app',value:item.app}:{kind:'text',value:'Watch '+String(item.voice).trim()};
 const results=[];
 for(const box of tvs){
  try{
   const response=await bridge('/api/send',{box,...command});
   if(response.commandAccepted!==true)throw Error('Bridge did not acknowledge command.');
   results.push(box+' ✓ accepted');
  }
  catch(e){results.push(box+' — '+e.message);}
 }
 state.receipt=results.join(' · ')+' · Command sent, playback not verified.';
 state.loading=false;showPicker();render();
}
window.ManCaveNetworks={render,checkBoxes,openNetwork,catalog};
onAuthStateChanged(auth,user=>{
 const changed=(state.user?.uid||null)!==(user?.uid||null);
 state.user=user;
 if(changed){state.checked=false;state.paired.clear();}
 state.message=user?'Signed in · Choose a network.':'Not signed in · Connect under Settings.';
 render();
 if(changed&&user)checkBoxes();
},error=>{state.message='Firebase authentication error: '+error.message;render();});
render();
})();
