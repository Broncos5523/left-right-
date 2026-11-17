'use strict';
// Experimental unofficial Xfinity X1 remote bridge. Source protocol: JeffSteinbok/hass-xfinityremote.
// Do not put Firebase service-account JSON, Xfinity arTokens, or encryption keys in client files.
const express=require('express');
const crypto=require('node:crypto');
const admin=require('firebase-admin');
const cheerio=require('cheerio');
const app=express();
const PORT=Number(process.env.PORT||10000);
const ORIGIN=process.env.CONTROLLER_ORIGIN||'https://broncos5523.github.io';
const DB_URL=process.env.FIREBASE_DATABASE_URL||'https://man-cave-left-right-default-rtdb.firebaseio.com';
const BOXES=Object.freeze({'Top Left':'top_left','Top Right':'top_right','Center':'center','Side':'side'});
const UID_ALLOWLIST=(process.env.ADMIN_UIDS||'').split(',').map(s=>s.trim()).filter(Boolean);
const API='https://remote.xfinity.com';
// Explicitly allowlisted streaming app commands; never accept arbitrary app names from the browser.
// Xfinity voice interpretation can vary by TV box and supported app. Server success != app opened.
const STREAMING_APP_COMMANDS=Object.freeze({
 netflix:'Netflix',
 prime:'Watch Prime Video',
 appletv:'Launch Apple TV app',
 paramount:'Paramount+',
 disney:'Disney plus app',
 espnplus:'ESPN app',
 youtube:'YouTube',
 peacock:'Peacock',
 hulu:'Hulu'
});
const REFRESH_INTERVAL=35*60*1000,PAIR_TIMEOUT=180*1000;
const pairings=new Map(),busy=new Set(),lastCommands=new Map();
let auth=null,db=null,encKey=null,configError=null;

try{
  if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON)throw Error('Missing Firebase service account');
  if(UID_ALLOWLIST.length<1)throw Error('Missing allowed Firebase UIDs');
  const key=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY||'','base64');
  if(key.length!==32)throw Error('Invalid encryption key length');
  encKey=key;
  admin.initializeApp({
    credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    databaseURL:DB_URL
  });
  auth=admin.auth();db=admin.database();
}catch(error){
  configError=error.message;
  console.error('Bridge configuration is incomplete:',configError);
}
function fail(res,status,message){return res.status(status).json({ok:false,error:message});}
function validBox(s){return typeof s==='string'&&Object.hasOwn(BOXES,s);}
function record(box){return db.ref('private_services/xfinity_remote/'+BOXES[box]);}
function encrypt(token){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encKey,iv);
 const output=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return 'v1.'+Buffer.concat([iv,cipher.getAuthTag(),output]).toString('base64url');
}
function decrypt(ciphertext){
 if(typeof ciphertext!=='string'||!ciphertext.startsWith('v1.'))throw Error('Invalid encrypted token');
 const value=Buffer.from(ciphertext.slice(3),'base64url');
 if(value.length<29)throw Error('Invalid encrypted token');
 const cipher=crypto.createDecipheriv('aes-256-gcm',encKey,value.subarray(0,12));
 cipher.setAuthTag(value.subarray(12,28));
 return Buffer.concat([cipher.update(value.subarray(28)),cipher.final()]).toString('utf8');
}
async function xfinity(path,body,token){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(API+path,{
   method:'POST',
   headers:{'Content-Type':'application/json; charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{})},
   body:body===null?undefined:JSON.stringify(body),signal:controller.signal
  });
  const raw=await response.text();
  let data={};try{data=raw?JSON.parse(raw):{};}catch{}
  if(response.status===401||['EXPIRED-XAPI-TOKEN','EXPIRED-EASYPAIR-TOKEN'].includes(data.status)){
   const e=new Error('Xfinity token expired');e.code='EXPIRED';throw e;
  }
  if(!response.ok){const e=new Error('Xfinity rejected request');e.code='REMOTE_ERROR';throw e;}
  return data;
 }finally{clearTimeout(timeout);}
}
async function lock(box,task){
 if(busy.has(box)){const e=new Error('Box is busy');e.code='BUSY';throw e;}
 busy.add(box);try{return await task();}finally{busy.delete(box);}
}
async function tokenFor(box){
 const snap=await record(box).once('value'),saved=snap.val();
 if(!saved?.encryptedToken)return null;
 let token=decrypt(saved.encryptedToken);
 if(!saved.refreshedAt||Date.now()-saved.refreshedAt>REFRESH_INTERVAL){
   const result=await xfinity('/api/v1/auth/token/refresh',null,token);
   if(!result?.arToken)throw Error('No refreshed token returned');
   token=result.arToken;
   await record(box).update({encryptedToken:encrypt(token),refreshedAt:Date.now()});
 }
 return token;
}
function errorResponse(res,error){
 const status=error.code==='EXPIRED'?409:error.code==='BUSY'?429:502;
 console.error('Xfinity request did not finish:',error.code||error.name||'Unknown');
 return fail(res,status,error.code==='EXPIRED'?'Remote pairing expired. Re-pair this box.':
   error.code==='BUSY'?'Box is processing a command.':'Xfinity could not complete the request. Try again or use its official remote.');
}
app.disable('x-powered-by');
app.use((req,res,next)=>{
 res.setHeader('Vary','Origin');
 if(req.get('Origin')===ORIGIN){
  res.setHeader('Access-Control-Allow-Origin',ORIGIN);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Max-Age','600');
 }
 if(req.method==='OPTIONS')return res.sendStatus(204);
 next();
});
app.use(express.json({limit:'12kb'}));

// Public facts only: latest Providence-New Bedford CBS/FOX NFL broadcast assignments.
// Refuse to classify a game as local when the publisher has not posted that exact Sunday.
// Does NOT expose any user account, Firebase data, paired Xfinity boxes or credentials.
const PROV_COVERAGE_URL='https://www.thesportsmaps.com/tv-markets/providence-new-bedford.html';
const localNflCache={at:0,data:null};
function cleanCoverageText(html){
 const $=cheerio.load(html);
 $('script,style,noscript,svg').remove();
 return $('body').text().replace(/\s+/g,' ').trim();
}
function parseProvidenceCoverage(raw){
 const text=cleanCoverageText(raw);
 const heading=/On Local TV in Providence-New Bedford:\s*Week\s*(\d+)/i.exec(text);
 if(!heading)throw Error('Local NFL listing heading missing');
 const after=text.slice(heading.index+heading[0].length);
 const date=/Sunday,?\s+([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(20\d\d))?/i.exec(after);
 if(!date)throw Error('Local NFL broadcast date missing');
 const yr=date[3]||String(new Date().getUTCFullYear());
 const mo=Number(new Date(date[1]+' 1, '+yr).getUTCMonth())+1;
 if(!mo||mo>12)throw Error('Invalid listing month');
 const dateIso=yr+'-'+String(mo).padStart(2,'0')+'-'+date[2].padStart(2,'0');
 const end=after.search(/National games(?:\s|\u00b7)|Not on TV in Providence/i);
 if(end<0)throw Error('Local listing section incomplete');
 const section=after.slice(date.index+date[0].length,end);
 const games=[];
 const pattern=/(\d{1,2}:\d\d)\s*(AM|PM)\s*ET\s*(CBS|FOX)\s+(.+?)\s+at\s+(.+?)\s*See the map/gi;
 let match;
 while((match=pattern.exec(section))!==null){
  const away=match[4].trim(),home=match[5].trim();
  if(away.length>50||home.length>50||!away||!home)continue;
  games.push({time:match[1]+' '+match[2].toUpperCase(),network:match[3].toUpperCase(),away,home});
 }
 // No inferred local assignments: if parsing misses a game, the source is not considered complete.
 if(games.length<1||games.length>5)throw Error('Local NFL game rows could not be validated');
 return {date:dateIso,week:Number(heading[1]),market:'Providence–New Bedford',
         source:PROV_COVERAGE_URL,games};
}
async function getProvidenceNflCoverage(){
 if(localNflCache.data&&Date.now()-localNflCache.at<30*60*1000)return localNflCache.data;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch(PROV_COVERAGE_URL,{headers:{'Accept':'text/html','User-Agent':'ManCaveSportsBook/1.0 (local NFL broadcast lookup)'},signal:controller.signal});
  if(!response.ok)throw Error('Listing HTTP '+response.status);
  const html=await response.text();
  if(html.length>1500000)throw Error('Unexpected listing size');
  const data=parseProvidenceCoverage(html);
  localNflCache.at=Date.now();localNflCache.data=data;
  return data;
 }finally{clearTimeout(timeout);}
}
app.get('/nfl-local-coverage',async(req,res)=>{
 const date=String(req.query.date||'');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return fail(res,400,'Provide a Sunday date as YYYY-MM-DD.');
 try{
  const current=await getProvidenceNflCoverage();
  const verified=current.date===date;
  res.set('Cache-Control','public, max-age=300');
  res.json({ok:true,requestedDate:date,date:current.date,week:current.week,
    market:current.market,source:current.source,verifiedForRequestedDate:verified,
    games:verified?current.games:[],status:verified?'published':'not_yet_published'});
 }catch(err){
  console.warn('Providence NFL listing unavailable:',err.message);
  res.status(503).json({ok:false,requestedDate:date,verifiedForRequestedDate:false,
   games:[],status:'unavailable',error:'Providence NFL station assignments not confirmed at this time.'});
 }
});
// V37: Read-only NHL club statistical leaders. Never touches Xfinity/Firebase credentials.
// Only serves public aggregated NHL player stats, restricted to legitimate team codes/seasons.
const NHL_TEAMS=new Set('ANA BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH'.split(' '));
const nhlStatsCache=new Map(),nhlStatsInflight=new Map();
function nhlFullName(row){
 const first=typeof row?.firstName==='string'?row.firstName:row?.firstName?.default||'';
 const last=typeof row?.lastName==='string'?row.lastName:row?.lastName?.default||'';
 return (String(first)+' '+String(last)).trim();
}
function calcNhlLeaders(payload){
 const skaters=Array.isArray(payload?.skaters)?payload.skaters:[];
 const goalies=Array.isArray(payload?.goalies)?payload.goalies:[];
 const items=[];
 const valid=(x,key)=>x&&nhlFullName(x)&&Number.isFinite(Number(x[key]));
 const choose=(group,key,label,format=(v)=>String(v),ascending=false)=>{
  const arr=group.filter(x=>valid(x,key)&&Number(x.gamesPlayed||0)>0)
   .sort((a,b)=>ascending?Number(a[key])-Number(b[key]):Number(b[key])-Number(a[key]));
  if(!arr.length)return;
  const top=arr[0],value=Number(top[key]);
  const headshot=typeof top.headshot==='string'&&/^https:\/\//.test(top.headshot)?top.headshot:'';
  items.push({metric:label,name:nhlFullName(top),value:format(value),headshot,playerId:top.playerId});
 };
 choose(skaters,'points','Points');
 choose(skaters,'goals','Goals');
 choose(skaters,'assists','Assists');
 choose(skaters,'plusMinus','Plus/Minus',v=>(v>0?'+':'')+v);
 choose(skaters,'shots','Shots');
 choose(goalies,'wins','Goalie Wins');
 choose(goalies,'savePercentage','Save %',v=>(v>1?v:v*100).toFixed(1)+'%');
 choose(goalies,'goalsAgainstAverage','Goals Against Avg',v=>v.toFixed(2),true);
 choose(goalies,'saves','Saves');
 return items;
}
app.get('/nhl-team-leaders',async(req,res)=>{
 const team=String(req.query.team||'').toUpperCase();
 const season=String(req.query.season||'');
 const seasonStart=Number(season.slice(0,4)),seasonEnd=Number(season.slice(4));
 if(!NHL_TEAMS.has(team)||!/^20\d{6}$/.test(season)||seasonEnd!==seasonStart+1||
    seasonStart<2020||seasonStart>new Date().getUTCFullYear()+1)
  return fail(res,400,'Invalid NHL team or season.');
 const key=team+':'+season,now=Date.now(),cache=nhlStatsCache.get(key);
 if(cache&&now-cache.at<15*60000){res.set('Cache-Control','public,max-age=300');return res.json(cache.data);}
 try{
  if(!nhlStatsInflight.has(key)){
   const run=(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{
     const response=await fetch('https://api-web.nhle.com/v1/club-stats/'+team+'/'+season+'/2',
      {headers:{Accept:'application/json','User-Agent':'ManCaveSportsBook/1.0 (public hockey stats)'},signal:controller.signal});
     if(!response.ok)throw Error('NHL public statistics HTTP '+response.status);
     const raw=await response.text();
     if(raw.length>1500000)throw Error('Unexpected NHL response size');
     const payload=JSON.parse(raw);
     const result={ok:true,team,season,source:'NHL',leaders:calcNhlLeaders(payload)};
     if(!result.leaders.length)throw Error('NHL has not published season statistics.');
     nhlStatsCache.set(key,{at:Date.now(),data:result});
     return result;
    }finally{clearTimeout(timeout);}
   })().finally(()=>nhlStatsInflight.delete(key));
   nhlStatsInflight.set(key,run);
  }
  const value=await nhlStatsInflight.get(key);
  res.set('Cache-Control','public,max-age=300');res.json(value);
 }catch(error){
  console.warn('NHL leaders unavailable:',team,season,error.message);
  if(cache&&now-cache.at<3600000)return res.json({...cache.data,stale:true});
  res.status(503).json({ok:false,team,season,error:'NHL club statistics are temporarily unavailable.'});
 }
});

app.get('/health',(_,res)=>res.json({ok:true,service:'man-cave-xfinity-bridge',configured:!configError}));
app.get('/',(_,res)=>res.type('text/plain').send('Man Cave Xfinity Remote Bridge. Open the private controller pairing page.'));
app.use('/api',async(req,res,next)=>{
 if(configError)return fail(res,503,'Secure bridge setup is incomplete.');
 if(req.get('Origin')&&req.get('Origin')!==ORIGIN)return fail(res,403,'Unrecognized controller origin.');
 const match=/^Bearer (.+)$/.exec(req.get('Authorization')||'');
 if(!match)return fail(res,401,'Firebase sign-in required.');
 try{
  const claims=await auth.verifyIdToken(match[1]);
  if(!UID_ALLOWLIST.includes(claims.uid)||claims.firebase?.sign_in_provider==='anonymous')
   return fail(res,403,'This Firebase user cannot control Xfinity devices.');
  next();
 }catch(error){fail(res,401,'Firebase session expired. Sign in again.');}
});
app.get('/api/boxes',async(req,res)=>{
 try{
  const boxes=await Promise.all(Object.keys(BOXES).map(async name=>{
   const snap=await record(name).child('encryptedToken').once('value');
   return {name,paired:snap.exists(),pairing:pairings.has(name)};
  }));
  res.json({ok:true,boxes});
 }catch(error){errorResponse(res,error);}
});
app.post('/api/pair/start',async(req,res)=>{
 const box=req.body?.box;
 if(!validBox(box))return fail(res,400,'Choose a valid box.');
 try{
  const payload=await lock(box,async()=>{
   const clientDeviceId=crypto.randomUUID();
   const data=await xfinity('/api/v1/pairing/start',{partner:'comcast',clientDeviceId},null);
   const pairingCode=String(data.pairingCode||'');
   if(!/^\d{7}$/.test(pairingCode)||!data.token)throw Error('Unexpected pairing response');
   pairings.set(box,{clientDeviceId,token:data.token,expiresAt:Date.now()+PAIR_TIMEOUT});
   return {ok:true,box,code:pairingCode,expiresInSeconds:180};
  });
  res.json(payload);
 }catch(error){errorResponse(res,error);}
});
app.post('/api/pair/status',async(req,res)=>{
 const box=req.body?.box;
 if(!validBox(box))return fail(res,400,'Choose a valid box.');
 const pairing=pairings.get(box);
 if(!pairing)return res.json({ok:true,status:'not_started'});
 if(Date.now()>pairing.expiresAt){pairings.delete(box);return res.json({ok:true,status:'expired'});}
 try{
  const data=await lock(box,()=>xfinity('/api/v1/pairing/confirm',
   {partner:'comcast',clientDeviceId:pairing.clientDeviceId},pairing.token));
  if(data?.status==='CONFIRMED'&&typeof data.arToken==='string'){
   await record(box).set({encryptedToken:encrypt(data.arToken),refreshedAt:Date.now(),pairedAt:Date.now()});
   pairings.delete(box);
   return res.json({ok:true,status:'paired',box});
  }
  res.json({ok:true,status:'pending',expiresInSeconds:Math.max(0,Math.ceil((pairing.expiresAt-Date.now())/1000))});
 }catch(error){
  if(error.code==='EXPIRED'){pairings.delete(box);return res.json({ok:true,status:'expired'});}
  errorResponse(res,error);
 }
});
app.post('/api/send',async(req,res)=>{
 const {box,kind}=req.body||{};
 const value=String(req.body?.value||'').trim();
 if(!validBox(box))return fail(res,400,'Choose a valid box.');
 if(!['text','channel','key','app'].includes(kind))return fail(res,400,'Invalid command kind.');
 if(kind==='app'&&!Object.hasOwn(STREAMING_APP_COMMANDS,value))return fail(res,400,'Unsupported streaming app.');
 if(kind==='channel'&&!/^\d{1,5}$/.test(value))return fail(res,400,'Enter 1–5 channel digits.');
 if(kind==='text'&&(!/^[\w\s.+&,'?!:-]{1,90}$/.test(value)||!/^(watch|tune to|find|go to|show)\b/i.test(value)))
   return fail(res,400,'Use a command such as Watch ESPN.');
 const keys={guide:'GUIDE',exit:'EXIT',menu:'MENU',ok:'ENTER',channel_up:'CHANNEL_UP',channel_down:'CHANNEL_DOWN',info:'INFO',last:'PREV'};
 if(kind==='key'&&!Object.hasOwn(keys,value))return fail(res,400,'Unsupported button.');
 if(Date.now()-(lastCommands.get(box)||0)<2500)return fail(res,429,'Wait a moment between commands.');
 try{
  await lock(box,async()=>{
   const token=await tokenFor(box);
   if(!token){const e=new Error('Not paired');e.code='UNPAIRED';throw e;}
   if(kind==='text')await xfinity('/api/v1/text',{cmd:value,arToken:token},null);
   if(kind==='app')await xfinity('/api/v1/text',{cmd:STREAMING_APP_COMMANDS[value],arToken:token},null);
   if(kind==='key')await xfinity('/api/v1/processKey',{vcode:keys[value]},token);
   if(kind==='channel')for(let i=0;i<value.length;i++){
    if(i)await new Promise(resolve=>setTimeout(resolve,400));
    await xfinity('/api/v1/processKey',{vcode:'NUMBER_'+value[i]},token);
   }
   lastCommands.set(box,Date.now());
  });
  res.json({ok:true,box,commandAccepted:true,playbackVerified:false});
 }catch(error){
  if(error.code==='UNPAIRED')return fail(res,409,'Pair this box first.');
  errorResponse(res,error);
 }
});
app.use((error,req,res,next)=>{
 console.error('Bad bridge request:',error?.name||'Error');
 if(!res.headersSent)fail(res,400,'Request could not be processed.');
});
app.listen(PORT,'0.0.0.0',()=>console.log('Xfinity bridge listening on port',PORT));
