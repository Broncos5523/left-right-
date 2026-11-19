// V45 — Reconnect existing Firebase/Xfinity session directly from the Game Finder modal.
// This script adds a small connection section only when a destination is unavailable.
// V44 artwork, TV assignment logic, and send authorization remain unchanged.
import {auth,signInWithEmailAndPassword} from './firebase.js';
(()=>{
'use strict';
function esc(value){
 return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
const games=window.ManCaveRealGames;
if(!games||typeof games.openAssign!=='function')return;
const originalOpen=games.openAssign.bind(games);
async function openWithReconnect(id){
 await originalOpen(id);
 const body=document.getElementById('modalBody');
 if(!body?.querySelector('#realGameTune')||body.querySelector('#realReconnectPanel'))return;
 const user=auth.currentUser||games.state?.user;
 const cableButtons=[...body.querySelectorAll('[data-real-tv]')];
 const unavailable=cableButtons.filter(button=>button.disabled).length;
 const wingsConnected=window.ManCaveBridge?.wingStatus?.()?.connected===true;
 if(!unavailable&&wingsConnected)return; // All existing destinations are connected: do not add clutter.
 const panel=document.createElement('section');
 panel.id='realReconnectPanel';
 panel.className='realReconnectPanel';
 panel.setAttribute('aria-label','Reconnect TV controls');
 const status=user
  ?(games.state?.pairError
     ?'Xfinity pairing check failed: '+games.state.pairError
     :unavailable+' of 4 cable TVs are unavailable. Recheck the existing connections.')
  :'This Home Screen app needs its own Firebase sign-in. Your TV pairing has not been erased.';
 panel.innerHTML='<div class="realReconnectHeading"><strong>TV CONNECTION</strong><span>'+esc(user?'Firebase connected':'Sign-in required')+'</span></div>'+
  '<p>'+esc(status)+'</p>'+
  (user?'<button type="button" class="realReconnectButton" id="realReconnectRetry">Recheck Xfinity TVs</button>':
   '<form id="realReconnectForm" autocomplete="on">'+
    '<label>Controller email<input type="email" id="realReconnectEmail" autocomplete="username" required placeholder="Firebase email"></label>'+
    '<label>Password<input type="password" id="realReconnectPassword" autocomplete="current-password" required></label>'+
    '<button type="submit" class="realReconnectButton">Connect and check TVs</button></form>')+
  '<div class="realReconnectStatus" id="realReconnectStatus" role="status"></div>'+
  '<button type="button" class="realReconnectSettings" id="realReconnectSettings">Connection settings</button>';
 const insertionPoint=body.querySelector('.realTvHeading');
 if(insertionPoint)body.insertBefore(panel,insertionPoint);
 else body.prepend(panel);
 const text=panel.querySelector('#realReconnectStatus');
 const message=value=>{if(text)text.textContent=value};
 const setting=panel.querySelector('#realReconnectSettings');
 setting?.addEventListener('click',()=>{
  document.getElementById('closeModal')?.click();
  document.querySelector('[data-nav="settings"]')?.click();
 });
 const retry=panel.querySelector('#realReconnectRetry');
 retry?.addEventListener('click',async()=>{
  retry.disabled=true;message('Checking paired Xfinity boxes…');
  try{await openWithReconnect(id);}
  catch(error){message('Recheck failed: '+(error.message||error));retry.disabled=false;}
 });
 panel.querySelector('#realReconnectForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button');
  const email=form.querySelector('#realReconnectEmail')?.value.trim();
  const password=form.querySelector('#realReconnectPassword')?.value;
  if(!email||!password)return;
  button.disabled=true;message('Signing in to the existing Firebase controller…');
  try{
   const credential=await Promise.race([
    signInWithEmailAndPassword(auth,email,password),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Firebase sign-in timed out. Check your connection and retry.')),18000))
   ]);
   if(games.state)games.state.user=credential.user;
   const field=form.querySelector('#realReconnectPassword');if(field)field.value='';
   // The previous automatic reopen awaited a new Xfinity pairing check,
   // leaving the sign-in popup apparently frozen on slow networks.
   // Let Firebase's shared auth observer update the connection instead.
   message('Firebase connected. Close this popup and choose Tune to TV again to refresh destinations.');
   button.textContent='Connected';
  }catch(error){
   message('Connection failed: '+(error.code||error.message||'Unknown error'));
   button.disabled=false;
  }
 });
}
games.openAssign=openWithReconnect;
})();
