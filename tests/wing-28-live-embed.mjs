/* Real Cloudflare 28-board player nested in the existing Fire TV receiver.
 * Use the actual public staged player; mock ONLY Firebase, NEVER sending
 * commands to real TVs. Confirms the live nested player loads and advances.
 */
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const cloud='https://man-cave-28-page.broncos5523.workers.dev';
let published=false;
for(let attempt=0;attempt<24;attempt++){
 try{
  const [page2,bridge]=await Promise.all([
   fetch(cloud+'/staging/boards/page2_nfl',{headers:{'Cache-Control':'no-cache'}}),
   fetch(cloud+'/staging/board-runtime-ancestor.js',{headers:{'Cache-Control':'no-cache'}})
  ]);
  const [html,source]=await Promise.all([page2.text(),bridge.text()]);
  if(page2.ok&&bridge.ok&&html.includes('/staging/board-runtime-ancestor.js')&&
     source.includes('parent.__MC_PRODUCTION')&&source.includes('const host=(()=>{')){
   published=true;console.log('PASS_CLOUDFLARE_WING_SAFE_RUNTIME_DEPLOYED');break;
  }
  console.log('WING_RUNTIME_DEPLOY_PENDING',attempt+1,page2.status,bridge.status);
 }catch(error){console.log('WING_RUNTIME_DEPLOY_RETRY',attempt+1,String(error).slice(0,150));}
 await new Promise(resolve=>setTimeout(resolve,8000));
}
if(!published)throw Error('Cloudflare nested-window safe runtime not yet deployed');
const browser=await chromium.launch({headless:true});
const findings=[],errors=[],responses=[];
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await context.route('**/firebase.js',route=>route.fulfill({
 status:200,contentType:'text/javascript',
 body:`
export const db={mock:true},auth={mock:true};
export const ref=(_db,path)=>({path});
export async function signInAnonymously(){return {user:{uid:'mock'}};}
export function onValue(loc,cb){
 if(loc.path!=='screens/left')throw Error('Unexpected Firebase path: '+loc.path);
 window.__mockWingAssign=(value)=>cb({val:()=>value});
 return ()=>{};
}
`
}));
const page=await context.newPage();
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,500))});
page.on('response',r=>{
 const u=r.url();
 if(/workers\.dev\/staging\/(player|boards\.json|boards\/page)/.test(u))
 responses.push({status:r.status(),url:u.slice(0,200)});
});
try{
 const res=await page.goto('http://127.0.0.1:8877/left.html',{waitUntil:'domcontentloaded',timeout:40000});
 assert.equal(res.status(),200);
 await page.waitForFunction(()=>!!window.__mockWingAssign,null,{timeout:12000});
 await page.evaluate(()=>window.__mockWingAssign({type:'rotation',updatedAt:12345}));
 await page.waitForFunction(()=>document.getElementById('board')?.getAttribute('src')?.includes('/staging/player.html?rotate=off'),
 null,{timeout:9000});
 const staged='https://man-cave-28-page.broncos5523.workers.dev/staging/player';
 let targetFrame=null;
 try{
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe')]
   .some(f=>f.src.includes('man-cave-28-page.broncos5523.workers.dev/staging/player')),null,{timeout:12000});
  await page.waitForTimeout(2500);
  targetFrame=page.frames().find(f=>f.url().startsWith(staged));
  if(!targetFrame)throw Error('Cloudflare rotation iframe never navigated');
  await targetFrame.waitForFunction(()=>!!window.__MC_PRODUCTION?.current,null,{timeout:45000});
  const first=await targetFrame.evaluate(()=>({
   current:window.__MC_PRODUCTION?.current,
   index:window.__MC_PRODUCTION?.index,
   stage:document.getElementById('stage')?.getBoundingClientRect()?.toJSON(),
   visible:document.querySelector('#stage iframe.current')?.dataset.board
  }));
  findings.push({stage:'first',...first});
  if(!first.current||first.visible!==first.current)throw Error('Embedded first 28-board page did not become visible');
  await targetFrame.waitForFunction(id=>window.__MC_PRODUCTION?.current!==id,first.current,{timeout:65000});
  const second=await targetFrame.evaluate(()=>({
   current:window.__MC_PRODUCTION?.current,
   index:window.__MC_PRODUCTION?.index,
   visible:document.querySelector('#stage iframe.current')?.dataset.board
  }));
  findings.push({stage:'second',...second});
  if(!second.current||second.visible!==second.current)throw Error('Embedded rotation did not advance visibly');
  console.log('PASS_CLOUDFLARE_28_BOARD_PLAYER_INSIDE_FIRE_TV',JSON.stringify(findings));
 }catch(e){
  const parentState=targetFrame?await targetFrame.evaluate(()=>({
    current:window.__MC_PRODUCTION?.current,index:window.__MC_PRODUCTION?.index,
    events:window.__MC_PRODUCTION_EVENTS?.slice(-20),
    stageFrames:[...document.querySelectorAll('#stage iframe')].map(f=>({
     id:f.dataset.board,src:f.src.slice(0,220),shown:f.classList.contains('current'),
     ready:f.contentWindow?.MCBoard?.ready,active:f.contentWindow?.MCBoard?.active
    }))
   })).catch(err=>({error:String(err)})):null;
  const children=await Promise.all(page.frames().filter(f=>f.url().includes('/staging/boards/')).map(async f=>({
    url:f.url(),state:await f.evaluate(()=>({
      runtimeReady:window.MCBoard?.ready,
      originalModuleLoaded:!!window.MCBoard,
      documentReady:document.readyState,
      inheritedParent:!!window.parent?.__MC_PRODUCTION,
      events:window.__MC_PRODUCTION_EVENTS?.slice(-3)
    })).catch(err=>({error:String(err)}))
  })));
  const details={message:e.message,frames:page.frames().map(f=>({url:f.url().slice(0,220)})),
   parentState,children,responses:responses.slice(-30),errors:errors.slice(-12)};
  console.error('WING_ROTATION_FAILURE',JSON.stringify(details));
  throw e;
 }
}finally{
 fs.writeFileSync('wing-28-live-embed.json',JSON.stringify({findings,responses:responses.slice(-40),
  errors:errors.slice(-20),testedAt:new Date().toISOString(),realFirebase:false},null,2));
 await browser.close();
}
