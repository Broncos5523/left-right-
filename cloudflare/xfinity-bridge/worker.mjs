/*
 * MAN CAVE SPORTS BOOK — Cloudflare Xfinity X1 bridge
 * Staging migration of the approved Render bridge. No Node runtime/dependencies.
 * Protected endpoints preserve /api/boxes, /api/pair/{start,status}, /api/send.
 * Secrets and pairing tokens NEVER appear in public responses or source.
 * Firebase RTDB paths and original v1 AES-256-GCM cipher layout are retained.
 * Xfinity's remote API is unofficial and its availability is not guaranteed.
 */
const BOXES=Object.freeze({'Top Left':'top_left','Top Right':'top_right',Center:'center',Side:'side'});
const REMOTE='https://remote.xfinity.com';
const JWKS='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const OAUTH='https://oauth2.googleapis.com/token';
const SCOPES='https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';
const KEY_ACTIONS=Object.freeze({guide:'GUIDE',exit:'EXIT',menu:'MENU',ok:'ENTER',
 channel_up:'CHANNEL_UP',channel_down:'CHANNEL_DOWN',info:'INFO',last:'PREV'});
const APP_ACTIONS=Object.freeze({netflix:'Netflix',prime:'Watch Prime Video',
 appletv:'Launch Apple TV app',paramount:'Paramount+',disney:'Disney plus app',
 espnplus:'ESPN app',youtube:'YouTube',peacock:'Peacock',hulu:'Hulu'});
const PAIR_MS=180000,REFRESH_MS=35*60000;
const enc=new TextEncoder(),dec=new TextDecoder();
let publicKeys=null,keysUntil=0,oauthToken=null,oauthUntil=0;

function bytesToB64(bytes){
 let str='';for(let i=0;i<bytes.length;i+=8192)
   str+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(str);
}
function b64ToBytes(raw){
 const value=String(raw||'').replace(/-/g,'+').replace(/_/g,'/');
 const s=atob(value+'='.repeat((4-value.length%4)%4));
 return Uint8Array.from(s,c=>c.charCodeAt(0));
}
const b64url=b=>bytesToB64(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const concat=(...items)=>{
 const result=new Uint8Array(items.reduce((n,b)=>n+b.length,0));let i=0;
 for(const b of items){result.set(b,i);i+=b.length;}return result;
};
const bytes=s=>enc.encode(s);
function json(req,body,status=200,extra={}){
 const allowed=req.headers.get('Origin');
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Vary':'Origin',...extra};
 if(allowed&&allowed==='https://broncos5523.github.io'){
  headers['Access-Control-Allow-Origin']=allowed;
  headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';
  headers['Access-Control-Allow-Headers']='Authorization,Content-Type';
  headers['Access-Control-Max-Age']='600';
 }
 return new Response(JSON.stringify(body),{status,headers});
}
function fail(req,status,message){return json(req,{ok:false,error:message},status);}
class BridgeError extends Error{
 constructor(code,status=502){super(code);this.name='BridgeError';this.code=code;this.status=status;}
}
function config(env){
 const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');
 const uids=String(env.ADMIN_UIDS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const url=String(env.FIREBASE_DATABASE_URL||'https://man-cave-left-right-default-rtdb.firebaseio.com');
 const origin=String(env.CONTROLLER_ORIGIN||'https://broncos5523.github.io');
 const key=b64ToBytes(env.TOKEN_ENCRYPTION_KEY||'');
 if(!account?.private_key?.includes('BEGIN PRIVATE KEY')||!account.client_email||
    !/^[a-z0-9][a-z0-9-]{3,100}$/i.test(account.project_id||'')||
    !uids.length||key.length!==32||origin!=='https://broncos5523.github.io'||
    !/^https:\/\/[a-z0-9.-]+\.(?:firebaseio\.com|firebasedatabase\.app)\/?$/.test(url))
   throw new BridgeError('UNCONFIGURED',503);
 return {account,uids,url:url.replace(/\/$/,''),origin,key};
}
async function safeFetch(url,init,timeout=10000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{return await fetch(url,{...init,signal:controller.signal,redirect:'error'});}
 finally{clearTimeout(timer);}
}
async function aesKey(cfg){
 return crypto.subtle.importKey('raw',cfg.key,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
// Node's legacy v1 format: iv[12] || tag[16] || ciphertext; WebCrypto
// returns ciphertext || tag, so reorder without changing the old records.
async function encrypt(value,cfg){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const blob=new Uint8Array(await crypto.subtle.encrypt(
  {name:'AES-GCM',iv,tagLength:128},await aesKey(cfg),bytes(value)));
 return 'v1.'+b64url(concat(iv,blob.slice(-16),blob.slice(0,-16)));
}
async function decrypt(ciphertext,cfg){
 if(typeof ciphertext!=='string'||!ciphertext.startsWith('v1.'))
   throw new BridgeError('INVALID_SAVED_PAIRING',409);
 const blob=b64ToBytes(ciphertext.slice(3));
 if(blob.length<29)throw new BridgeError('INVALID_SAVED_PAIRING',409);
 try{
  const source=concat(blob.slice(28),blob.slice(12,28));
  return dec.decode(await crypto.subtle.decrypt(
   {name:'AES-GCM',iv:blob.slice(0,12),tagLength:128},await aesKey(cfg),source));
 }catch{throw new BridgeError('PAIRING_KEY_MISMATCH',409);}
}
async function importRsa(privateKey){
 const raw=privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 return crypto.subtle.importKey('pkcs8',b64ToBytes(raw),
  {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
}
async function googleAccess(cfg){
 if(oauthToken&&Date.now()<oauthUntil)return oauthToken;
 const now=Math.floor(Date.now()/1000);
 const header=b64url(bytes(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const claims=b64url(bytes(JSON.stringify({iss:cfg.account.client_email,
  aud:OAUTH,scope:SCOPES,iat:now,exp:now+3300})));
 const input=header+'.'+claims;
 const signature=b64url(new Uint8Array(await crypto.subtle.sign(
  'RSASSA-PKCS1-v1_5',await importRsa(cfg.account.private_key),bytes(input))));
 const response=await safeFetch(OAUTH,{method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion:input+'.'+signature}).toString()},12500);
 if(!response.ok)throw new BridgeError('FIREBASE_AUTH_UNAVAILABLE');
 const body=await response.json();
 if(!body.access_token)throw new BridgeError('FIREBASE_AUTH_UNAVAILABLE');
 oauthToken=body.access_token;
 oauthUntil=Date.now()+Math.min(Math.max(60,Number(body.expires_in||3600)-120),3300)*1000;
 return oauthToken;
}
function recordPath(box){return 'private_services/xfinity_remote/'+BOXES[box];}
function pairingPath(box){return 'private_services/xfinity_pairings/'+BOXES[box];}
function lockPath(box){return 'private_services/xfinity_locks/'+BOXES[box];}
async function db(cfg,path,method='GET',value,opts={}){
 if(!/^[A-Za-z0-9_/-]+$/.test(path)||path.startsWith('/')||path.includes('..'))
  throw new BridgeError('BAD_DATABASE_PATH',500);
 const token=await googleAccess(cfg);
 const headers={Authorization:'Bearer '+token,'Cache-Control':'no-store'};
 if(method==='GET'&&opts.etag)headers['X-Firebase-ETag']='true';
 if(method!=='GET')headers['Content-Type']='application/json';
 if(opts.ifMatch)headers['if-match']=opts.ifMatch;
 const response=await safeFetch(cfg.url+'/'+path+'.json',{method,headers,
  ...(method==='GET'?{}:{body:JSON.stringify(value===undefined?null:value)})},12000);
 if(opts.ifMatch&&response.status===412)return {conflict:true};
 if(!response.ok)throw new BridgeError('FIREBASE_DATABASE_UNAVAILABLE');
 if(method==='DELETE')return {data:null};
 return {data:await response.json(),etag:response.headers.get('ETag')};
}
async function getKeys(){
 if(publicKeys&&Date.now()<keysUntil)return publicKeys;
 const response=await safeFetch(JWKS,{},12000);
 if(!response.ok)throw new BridgeError('FIREBASE_SIGNING_KEYS_UNAVAILABLE',503);
 const data=await response.json();
 if(!Array.isArray(data.keys)||!data.keys.length)
  throw new BridgeError('FIREBASE_SIGNING_KEYS_UNAVAILABLE',503);
 const match=/max-age=(\d+)/i.exec(response.headers.get('Cache-Control')||'');
 keysUntil=Date.now()+Math.max(60,Math.min(18000,Number(match?.[1]||300)))*1000;
 publicKeys=data.keys;
 return publicKeys;
}
async function verifyFirebaseIdToken(token,cfg){
 const parts=token.split('.');
 if(parts.length!==3||parts.some(p=>!p||p.length>11000))
  throw new BridgeError('INVALID_ID_TOKEN',401);
 let h,payload;
 try{
  h=JSON.parse(dec.decode(b64ToBytes(parts[0])));
  payload=JSON.parse(dec.decode(b64ToBytes(parts[1])));
 }catch{throw new BridgeError('INVALID_ID_TOKEN',401);}
 const now=Math.floor(Date.now()/1000);
 if(h.alg!=='RS256'||h.typ&&h.typ!=='JWT'||!h.kid||
    payload.aud!==cfg.account.project_id||
    payload.iss!=='https://securetoken.google.com/'+cfg.account.project_id||
    !payload.sub||typeof payload.sub!=='string'||payload.sub.length>128||
    !Number.isInteger(payload.exp)||payload.exp<=now||
    !Number.isInteger(payload.iat)||payload.iat>now||
    !Number.isInteger(payload.auth_time)||payload.auth_time>now||
    !cfg.uids.includes(payload.sub)||
    payload.firebase?.sign_in_provider==='anonymous')
   throw new BridgeError('NOT_AUTHORIZED',403);
 const keys=await getKeys();
 const jwk=keys.find(k=>k.kid===h.kid&&k.kty==='RSA'&&k.n&&k.e);
 if(!jwk)throw new BridgeError('INVALID_ID_TOKEN',401);
 const key=await crypto.subtle.importKey('jwk',jwk,
  {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 let ok=false;
 try{
  ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,
   b64ToBytes(parts[2]),bytes(parts[0]+'.'+parts[1]));
 }catch{throw new BridgeError('INVALID_ID_TOKEN',401);}
 if(!ok)throw new BridgeError('INVALID_ID_TOKEN',401);
 return payload;
}
async function xfinity(path,body,token){
 const response=await safeFetch(REMOTE+path,{method:'POST',headers:{
  'Content-Type':'application/json; charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{})},
  ...(body===null?{}:{body:JSON.stringify(body)})},12500);
 let data={};try{data=await response.json();}catch{}
 if(response.status===401||['EXPIRED-XAPI-TOKEN','EXPIRED-EASYPAIR-TOKEN'].includes(data?.status))
  throw new BridgeError('EXPIRED',409);
 if(!response.ok)throw new BridgeError('XFINITY_UNAVAILABLE');
 return data;
}
// Firebase conditional ETags prevent concurrent box commands on distinct
// Cloudflare isolates. A time-bound lease survives restarts and cleans itself.
async function withBoxLock(cfg,box,task,{cooldown=false}={}){
 const path=lockPath(box);
 const current=await db(cfg,path,'GET',undefined,{etag:true});
 // Concurrency safety is mandatory. If Firebase does not supply an ETag,
 // fail closed rather than silently making the compare-and-set unconditional.
 if(!current.etag)throw new BridgeError('FIREBASE_DATABASE_UNAVAILABLE');
 const now=Date.now(),v=current.data||{};
 if(Number(v.leaseUntil||0)>now)throw new BridgeError('BUSY',429);
 if(cooldown&&now-Number(v.lastCommandAt||0)<2500)
  throw new BridgeError('COOLDOWN',429);
 const deadline=now+45000,leaseId=crypto.randomUUID();
 const obtained=await db(cfg,path,'PUT',{
  leaseUntil:deadline,leaseId,lastCommandAt:Number(v.lastCommandAt||0)
 },{ifMatch:current.etag});
 if(obtained.conflict)throw new BridgeError('BUSY',429);
 let sent=false;
 try{
  const result=await task(()=>{sent=true});
  return result;
 }finally{
  // Release conservatively, retaining command throttle across requests.
  try{
   const fresh=await db(cfg,path,'GET',undefined,{etag:true});
   if(fresh.data?.leaseId===leaseId)
    await db(cfg,path,'PUT',{leaseUntil:0,lastCommandAt:sent?Date.now():
      Number(v.lastCommandAt||0)},{ifMatch:fresh.etag});
  }catch{/* Lease expires automatically if Firebase temporarily fails. */}
 }
}
async function tokenFor(cfg,box){
 const old=(await db(cfg,recordPath(box))).data;
 if(!old?.encryptedToken)throw new BridgeError('UNPAIRED',409);
 let token=await decrypt(old.encryptedToken,cfg);
 if(!old.refreshedAt||Date.now()-Number(old.refreshedAt)>REFRESH_MS){
  const next=await xfinity('/api/v1/auth/token/refresh',null,token);
  if(!next?.arToken)throw new BridgeError('EXPIRED',409);
  token=next.arToken;
  await db(cfg,recordPath(box),'PATCH',{encryptedToken:await encrypt(token,cfg),
   refreshedAt:Date.now()});
 }
 return token;
}
async function requestJson(req){
 const contentType=req.headers.get('Content-Type')||'';
 if(!contentType.startsWith('application/json'))throw new BridgeError('JSON_REQUIRED',400);
 const text=await req.text();
 if(text.length>12000)throw new BridgeError('PAYLOAD_TOO_LARGE',413);
 try{return JSON.parse(text||'{}');}
 catch{throw new BridgeError('INVALID_JSON',400);}
}
async function dispatch(req,cfg,path){
 const method=req.method;
 if(path==='/api/boxes'&&method==='GET'){
  const rows=await Promise.all(Object.keys(BOXES).map(async box=>{
   const [record,pairing]=await Promise.all([
    db(cfg,recordPath(box)),db(cfg,pairingPath(box))]);
   return {name:box,paired:!!record.data?.encryptedToken,
    pairing:Number(pairing.data?.expiresAt||0)>Date.now()};
  }));
  return json(req,{ok:true,boxes:rows});
 }
 if(method!=='POST')return fail(req,405,'Method not allowed.');
 const input=await requestJson(req);
 const box=input?.box;
 if(!Object.hasOwn(BOXES,box))return fail(req,400,'Choose a valid box.');
 if(path==='/api/pair/start'){
  const payload=await withBoxLock(cfg,box,async()=>{
   const clientDeviceId=crypto.randomUUID();
   const data=await xfinity('/api/v1/pairing/start',{partner:'comcast',clientDeviceId},null);
   const code=String(data?.pairingCode||'');
   if(!/^\d{7}$/.test(code)||typeof data.token!=='string')
    throw new BridgeError('PAIRING_UNAVAILABLE');
   await db(cfg,pairingPath(box),'PUT',{
    clientDeviceId,encryptedToken:await encrypt(data.token,cfg),
    expiresAt:Date.now()+PAIR_MS
   });
   return {ok:true,box,code,expiresInSeconds:180};
  });
  return json(req,payload);
 }
 if(path==='/api/pair/status'){
  return json(req,await withBoxLock(cfg,box,async()=>{
   const pairing=(await db(cfg,pairingPath(box))).data;
   if(!pairing)return {ok:true,status:'not_started'};
   if(Date.now()>Number(pairing.expiresAt||0)){
    await db(cfg,pairingPath(box),'DELETE');
    return {ok:true,status:'expired'};
   }
   let data;
   try{
    data=await xfinity('/api/v1/pairing/confirm',
     {partner:'comcast',clientDeviceId:pairing.clientDeviceId},
     await decrypt(pairing.encryptedToken,cfg));
   }catch(e){
    if(e.code==='EXPIRED'){
     await db(cfg,pairingPath(box),'DELETE');
     return {ok:true,status:'expired'};
    }
    throw e;
   }
   if(data?.status==='CONFIRMED'&&typeof data.arToken==='string'){
    // Replaces only this paired box; never deletes other boxes or screens.
    await db(cfg,recordPath(box),'PUT',{encryptedToken:await encrypt(data.arToken,cfg),
     refreshedAt:Date.now(),pairedAt:Date.now()});
    await db(cfg,pairingPath(box),'DELETE');
    return {ok:true,status:'paired',box};
   }
   return {ok:true,status:'pending',
    expiresInSeconds:Math.max(0,Math.ceil((Number(pairing.expiresAt)-Date.now())/1000))};
  }));
 }
 if(path!=='/api/send')return fail(req,404,'Unknown Xfinity endpoint.');
 const kind=input.kind,value=String(input.value||'').trim();
 if(!['text','channel','key','app'].includes(kind))
  return fail(req,400,'Invalid command kind.');
 if(kind==='app'&&!Object.hasOwn(APP_ACTIONS,value))
  return fail(req,400,'Unsupported streaming app.');
 if(kind==='channel'&&!/^\d{1,5}$/.test(value))
  return fail(req,400,'Enter 1–5 channel digits.');
 if(kind==='text'&&(!/^[\w\s.+&,'?!:-]{1,90}$/.test(value)||
   !/^(watch|tune to|find|go to|show)\b/i.test(value)))
  return fail(req,400,'Use a command such as Watch ESPN.');
 if(kind==='key'&&!Object.hasOwn(KEY_ACTIONS,value))
  return fail(req,400,'Unsupported button.');
 const result=await withBoxLock(cfg,box,async markSent=>{
  const token=await tokenFor(cfg,box);
  if(kind==='text')await xfinity('/api/v1/text',{cmd:value,arToken:token},null);
  else if(kind==='app')await xfinity('/api/v1/text',{cmd:APP_ACTIONS[value],arToken:token},null);
  else if(kind==='key')await xfinity('/api/v1/processKey',{vcode:KEY_ACTIONS[value]},token);
  else for(let i=0;i<value.length;i++){
   if(i)await new Promise(r=>setTimeout(r,400));
   await xfinity('/api/v1/processKey',{vcode:'NUMBER_'+value[i]},token);
  }
  markSent();
  return {ok:true,box,commandAccepted:true,playbackVerified:false};
 },{cooldown:true});
 return json(req,result);
}
export default{
 async fetch(req,env){
  const url=new URL(req.url),path=url.pathname;
  if(!['GET','POST','OPTIONS'].includes(req.method))
   return fail(req,405,'Method not allowed.');
  // Disallow unknown origins, including credential-bearing cross-site calls.
  const origin=req.headers.get('Origin');
  if(origin&&origin!=='https://broncos5523.github.io')
   return fail(req,403,'Unrecognized controller origin.');
  if(req.method==='OPTIONS'){
   if(!origin)return fail(req,400,'Origin required.');
   return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Authorization,Content-Type',
    'Access-Control-Max-Age':'600','Vary':'Origin'}});
  }
  if(path==='/health'&&req.method==='GET'){
   let configured=false;try{config(env);configured=true;}catch{}
   return json(req,{ok:true,service:'man-cave-xfinity-bridge',
    runtime:'cloudflare-workers',configured});
  }
  if(!path.startsWith('/api/'))return fail(req,404,'Not found.');
  if(!['/api/boxes','/api/pair/start','/api/pair/status','/api/send'].includes(path))
   return fail(req,404,'Not found.');
  try{
   const cfg=config(env);
   const match=/^Bearer ([^\s]{20,12000})$/.exec(req.headers.get('Authorization')||'');
   if(!match)return fail(req,401,'Firebase sign-in required.');
   await verifyFirebaseIdToken(match[1],cfg);
   return await dispatch(req,cfg,path);
  }catch(error){
   const e=error instanceof BridgeError?error:new BridgeError('BRIDGE_UNAVAILABLE',503);
   // Never log bearer tokens, pairing tokens, database payloads or private keys.
   const messages={
    UNCONFIGURED:'Cloudflare bridge secrets have not been configured.',
    INVALID_ID_TOKEN:'Firebase session expired. Sign in again.',
    NOT_AUTHORIZED:'This Firebase user cannot control Xfinity devices.',
    FIREBASE_SIGNING_KEYS_UNAVAILABLE:'Firebase identity verification is unavailable.',
    FIREBASE_DATABASE_UNAVAILABLE:'Firebase pairing records are temporarily unavailable.',
    FIREBASE_AUTH_UNAVAILABLE:'Firebase service authentication is unavailable.',
    INVALID_SAVED_PAIRING:'Saved Xfinity pairing record is unreadable.',
    PAIRING_KEY_MISMATCH:'Original Xfinity encryption key does not match. Preserve or restore the original key.',
    BUSY:'Box is processing a command.',
    COOLDOWN:'Wait a moment between commands.',
    UNPAIRED:'Pair this box first.',
    EXPIRED:'Remote pairing expired. Re-pair this box.',
    JSON_REQUIRED:'JSON request required.',
    INVALID_JSON:'Invalid JSON request.',
    PAYLOAD_TOO_LARGE:'Request too large.',
    PAIRING_UNAVAILABLE:'Xfinity pairing did not complete.',
    XFINITY_UNAVAILABLE:'Xfinity remote service is unavailable.',
    BRIDGE_UNAVAILABLE:'Cloudflare bridge could not complete the request.'
   };
   return fail(req,e.status,messages[e.code]||'Cloudflare bridge could not complete the request.');
  }
 }
};
// Pure internals exported for read-only contract/unit testing.
export const __test={config,encrypt,decrypt,verifyFirebaseIdToken,
 bytes,b64url,b64ToBytes,recordPath,pairingPath,lockPath};
