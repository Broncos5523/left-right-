import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createCipheriv,createDecipheriv,randomBytes,sign} from 'node:crypto';
import worker,{__test as helpers} from './worker.mjs';

const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=pair.privateKey.export({type:'pkcs8',format:'pem'});
const jwk=pair.publicKey.export({format:'jwk'});
const serverKey=randomBytes(32);
const config={
 FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({
  client_email:'example-service@man-cave-test.iam.gserviceaccount.com',
  project_id:'man-cave-test',private_key:pem
 }),
 FIREBASE_DATABASE_URL:'https://man-cave-left-right-default-rtdb.firebaseio.com',
 ADMIN_UIDS:'admin-123',
 TOKEN_ENCRYPTION_KEY:serverKey.toString('base64'),
 CONTROLLER_ORIGIN:'https://broncos5523.github.io'
};
function signedFirebase({uid='admin-123',provider='password',project='man-cave-test',expDelta=3600}={}){
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'test-key'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({sub:uid,user_id:uid,
  aud:project,iss:'https://securetoken.google.com/'+project,
  iat:now,exp:now+expDelta,auth_time:now-100,
  firebase:{sign_in_provider:provider}})).toString('base64url');
 const input=header+'.'+body;
 const sig=sign('RSA-SHA256',Buffer.from(input),pair.privateKey).toString('base64url');
 return input+'.'+sig;
}
function api(path,options={}){
 return new Request('https://man-cave-xfinity-bridge.example.test'+path,{
  method:options.method||'GET',
  headers:{Origin:'https://broncos5523.github.io',
   Authorization:'Bearer '+(options.token||signedFirebase()),
   ...(options.body?{'Content-Type':'application/json'}:{}),
   ...options.headers},
  ...(options.body?{body:JSON.stringify(options.body)}:{})
 });
}
function mockEndpoints(){
 const former=globalThis.fetch,records=new Map(),calls=[];
 let revision=0;
 const result=(value,status=200,headers={})=>new Response(JSON.stringify(value),{
  status,headers:{'Content-Type':'application/json',...headers}});
 globalThis.fetch=async(url,opts={})=>{
  const target=new URL(String(url)),headers=new Headers(opts.headers||{});
  if(target.hostname==='www.googleapis.com'){
   return result({keys:[{...jwk,alg:'RS256',use:'sig',kid:'test-key'}]},200,
    {'Cache-Control':'public,max-age=300'});
  }
  if(target.hostname==='oauth2.googleapis.com')
   return result({access_token:'mock-oauth-access-token',expires_in:3600});
  if(target.hostname==='remote.xfinity.com'){
   calls.push({api:target.pathname,body:opts.body?JSON.parse(opts.body):null,
    authorized:headers.has('Authorization')});
   if(target.pathname.endsWith('/pairing/start'))
    return result({pairingCode:'1234567',token:'temporary-xfinity-secret'});
   if(target.pathname.endsWith('/pairing/confirm'))
    return result({status:'CONFIRMED',arToken:'xfinity-secret-key'});
   if(target.pathname.endsWith('/auth/token/refresh'))
    return result({arToken:'xfinity-secret-key-refreshed'});
   return result({ok:true});
  }
  if(target.hostname==='man-cave-left-right-default-rtdb.firebaseio.com'){
   if(headers.get('Authorization')!=='Bearer mock-oauth-access-token')
    throw Error('Database called without short-lived service access token');
   const key=target.pathname.replace(/^\//,'').replace(/\.json$/,'');
   const v=records.get(key),method=opts.method||'GET';
   if(method==='GET')return result(v?.data??null,200,
    headers.get('X-Firebase-ETag')==='true'?{'ETag':'"'+(v?.rev||0)+'"'}:{});
   if(headers.get('if-match')&&headers.get('if-match')!=='"'+(v?.rev||0)+'"')
    return result({error:'etag'},412);
   const data=opts.body?JSON.parse(opts.body):null;
   if(method==='PUT')records.set(key,{data,rev:++revision});
   else if(method==='PATCH')records.set(key,{data:{...(v?.data||{}),...data},rev:++revision});
   else if(method==='DELETE')records.delete(key);
   else throw Error('Unexpected Firebase method '+method);
   return result(data);
  }
  throw Error('Unexpected outgoing host '+target.host);
 };
 return {calls,records,restore(){globalThis.fetch=former}};
}

test('Node legacy AES-GCM v1 encrypted pairing records decrypt in Worker and reverse',async()=>{
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',serverKey,iv);
 const ciphertext=Buffer.concat([c.update('legacy-remote-token','utf8'),c.final()]);
 const old='v1.'+Buffer.concat([iv,c.getAuthTag(),ciphertext]).toString('base64url');
 const cfg=helpers.config(config);
 assert.equal(await helpers.decrypt(old,cfg),'legacy-remote-token');
 const cloud=await helpers.encrypt('worker-remote-token',cfg);
 const blob=Buffer.from(cloud.slice(3),'base64url');
 const d=createDecipheriv('aes-256-gcm',serverKey,blob.subarray(0,12));
 d.setAuthTag(blob.subarray(12,28));
 assert.equal(Buffer.concat([d.update(blob.subarray(28)),d.final()]).toString(),'worker-remote-token');
 assert.ok(cloud.startsWith('v1.'));
});
test('health is public but incomplete secrets fail closed, origin constrained',async()=>{
 const health=await worker.fetch(api('/health'),config);
 assert.equal(health.status,200);
 assert.equal((await health.json()).configured,true);
 const bad=await worker.fetch(api('/health'),{});
 assert.equal((await bad.json()).configured,false);
 const blocked=await worker.fetch(api('/api/boxes'),{});
 assert.equal(blocked.status,503);
 const origin=await worker.fetch(api('/api/boxes',{headers:{Origin:'https://untrusted.test'}}),config);
 assert.equal(origin.status,403);
 const missing=await worker.fetch(api('/api/boxes',{headers:{Authorization:''}}),config);
 assert.equal(missing.status,401);
 const allowed=await worker.fetch(api('/api/boxes',{method:'OPTIONS'}),config);
 assert.equal(allowed.status,204);
 assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),'https://broncos5523.github.io');
});
test('Cloudflare Xfinity bridge verifies signed Firebase user and rejects forgery, wrong UID, anonymous',async()=>{
 const mock=mockEndpoints();
 try{
  for(const token of [
   signedFirebase({uid:'intruder'}),
   signedFirebase({provider:'anonymous'}),
   signedFirebase({project:'another-project'}),
   signedFirebase({expDelta:-2}),
   signedFirebase().slice(0,-14)+'invalid-signature',
  ]){
   const response=await worker.fetch(api('/api/boxes',{token}),config);
   assert.ok([401,403].includes(response.status),'Must reject untrusted token: '+response.status);
  }
  const okay=await worker.fetch(api('/api/boxes'),config);
  assert.equal(okay.status,200);
  assert.deepEqual((await okay.json()).boxes.map(row=>[row.name,row.paired]),[
   ['Top Left',false],['Top Right',false],['Center',false],['Side',false]]);
 }finally{mock.restore();}
});
test('four Xfinity boxes pair independently and preserve encrypted Firebase records',async()=>{
 const mock=mockEndpoints();
 try{
  for(const box of ['Top Left','Top Right','Center','Side']){
   const start=await worker.fetch(api('/api/pair/start',{method:'POST',body:{box}}),config);
   assert.equal(start.status,200,(await start.clone().text()).slice(0,500));
   const started=await start.json();
   assert.equal(started.code,'1234567');
   const key=helpers.pairingPath(box);
   assert.ok(mock.records.get(key).data.encryptedToken.startsWith('v1.'));
   assert.ok(!JSON.stringify(mock.records.get(key).data).includes('temporary-xfinity-secret'));
   const confirm=await worker.fetch(api('/api/pair/status',{method:'POST',body:{box}}),config);
   assert.equal(confirm.status,200,(await confirm.clone().text()).slice(0,500));
   assert.equal((await confirm.json()).status,'paired');
   assert.ok(mock.records.get(helpers.recordPath(box)).data.encryptedToken.startsWith('v1.'));
   assert.ok(!mock.records.has(key),'Temporary pairing must be removed after pairing');
  }
  const rows=await worker.fetch(api('/api/boxes'),config);
  assert.deepEqual((await rows.json()).boxes.map(box=>box.paired),[true,true,true,true]);
  assert.equal((await worker.fetch(api('/api/send',{method:'POST',
    body:{box:'Center',kind:'text',value:'Watch ESPN'}}),config)).status,200);
  assert.ok(mock.calls.some(row=>row.api==='/api/v1/text'&&row.body.cmd==='Watch ESPN'));
  const status=await worker.fetch(api('/api/send',{method:'POST',
    body:{box:'Side',kind:'app',value:'peacock'}}),config);
  assert.equal(status.status,200);
  assert.ok(mock.calls.some(row=>row.api==='/api/v1/text'&&row.body.cmd==='Peacock'));
  assert.ok(!mock.calls.some(row=>JSON.stringify(row).includes('mock-oauth-access-token')));
  const invalid=await worker.fetch(api('/api/send',{method:'POST',
    body:{box:'Center',kind:'text',value:'delete all users'}}),config);
  assert.equal(invalid.status,400);
  const after=await worker.fetch(api('/api/boxes'),config);
  assert.equal((await after.json()).boxes.length,4);
 }finally{mock.restore();}
});
test('original encryption key mismatch fails closed without overwriting saved pairing',async()=>{
 const mock=mockEndpoints();
 try{
  const cfg=helpers.config(config);
  const old=await helpers.encrypt('old-secret',cfg);
  mock.records.set(helpers.recordPath('Center'),{data:{encryptedToken:old,refreshedAt:Date.now()},rev:1});
  const wrong={...config,TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
  const response=await worker.fetch(api('/api/send',{method:'POST',
   body:{box:'Center',kind:'key',value:'guide'}}),wrong);
  assert.equal(response.status,409);
  const error=await response.json();
  assert.match(error.error,/Original Xfinity encryption key/);
  assert.equal(mock.records.get(helpers.recordPath('Center')).data.encryptedToken,old);
 }finally{mock.restore();}
});
