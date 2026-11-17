/* Client-only key creation; no fetch, storage, analytics, logging or network access.
   Uses Web Crypto random 32 bytes, base64 exactly compatible with the
   original Xfinity Worker TOKEN_ENCRYPTION_KEY validation. */
(()=>{
'use strict';
const generate=document.getElementById('generate');
const section=document.getElementById('keySection');
const input=document.getElementById('secret');
const copy=document.getElementById('copy');
const status=document.getElementById('status');
if(!generate||!input||!copy||!section||!status)return;
generate.addEventListener('click',()=>{
 if(!globalThis.crypto||typeof crypto.getRandomValues!=='function'){
  status.textContent='This browser cannot generate a cryptographically secure key.';
  section.hidden=false;return;
 }
 const raw=crypto.getRandomValues(new Uint8Array(32));
 input.value=btoa(String.fromCharCode(...raw));
 raw.fill(0);
 section.hidden=false;
 status.textContent='New key created locally. Copy it directly into Cloudflare and keep a secure backup.';
});
copy.addEventListener('click',async()=>{
 const value=input.value;
 if(!value){status.textContent='Generate a key first.';return;}
 try{
  if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
  await navigator.clipboard.writeText(value);
  status.textContent='Copied. Return to the Cloudflare secret field and paste.';
 }catch{
  input.focus();input.select();
  status.textContent='The key is selected. Use the iPhone Copy menu, then paste in Cloudflare.';
 }
});
})();
