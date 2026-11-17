/* Offline browser contract: V45 iPhone controller writes its three approved
 * TV3 modes directly to screens/third. Mock Firebase only; no real accounts
 * or live screen assignments are accessed. */
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{window.__TV3_TEST_WRITES__=[];});
await context.route('**/firebase.js',route=>route.fulfill({
 status:200,
 contentType:'text/javascript; charset=utf-8',
 body:`
export const db={mock:true};
export const auth={currentUser:{uid:'mock-controller-owner',email:'mock@example.invalid'}};
export const ref=(db,path)=>({path});
export async function set(location,value){
  window.__TV3_TEST_WRITES__.push({verb:'set',path:location.path,value});
}
export async function update(location,value){
  window.__TV3_TEST_WRITES__.push({verb:'update',path:location.path,value});
}
export function onValue(location,success){
  queueMicrotask(()=>success({val:()=>location.path==='screens/third'?{type:'rotation'}:null}));
  return ()=>{};
}
export function onAuthStateChanged(auth,success){queueMicrotask(()=>success(auth.currentUser));return ()=>{};}
export async function signInWithEmailAndPassword(auth){return {user:auth.currentUser};}
export async function signOut(auth){auth.currentUser=null;}
export async function signInAnonymously(){return {user:auth.currentUser};}
`
}));
const page=await context.newPage();
const errors=[],results=[];
page.on('pageerror',error=>errors.push(String(error).slice(0,500)));
try{
 const response=await page.goto('http://127.0.0.1:8877/game-wall-v45-home-screen.html',
   {waitUntil:'domcontentloaded',timeout:40000});
 assert.equal(response?.status(),200,'V45 controller not served locally');
 await page.waitForFunction(()=>window.ManCaveBridge?.wingStatus?.()?.connected===true,null,{timeout:25000});
 assert.ok(await page.locator('#liveBridge').count(),'Existing Live TV Link section missing');
 const label=await page.locator('#liveBridge').innerText();
 assert.ok(label.includes('Cloudflare TV3 receiver'),'Old Render receiver text remains');
 assert.ok(label.includes('32″ Onn · CCW portrait receiver'),'Cloudflare receiver link missing');
 for(const [choice,type,board] of [
  ['page1_nfl','board','page1_nfl'],
  ['wrestling','wrestling',null],
  ['rotation','rotation',null]
 ]){
  await page.evaluate(selection=>{
   const input=document.querySelector('[data-live-select="thirdMode"]');
   if(!input)throw Error('TV3 selector absent');
   input.value=selection;input.dispatchEvent(new Event('change',{bubbles:true}));
   const send=document.querySelector('[data-live-action="sendThird"]');
   if(!send||send.disabled)throw Error('TV3 send button disabled after mode selection');
   send.click();
  },choice);
  await page.waitForFunction(n=>window.__TV3_TEST_WRITES__?.length>=n,results.length+1,{timeout:8000});
  const record=await page.evaluate(()=>window.__TV3_TEST_WRITES__.at(-1));
  assert.equal(record.verb,'set');
  assert.equal(record.path,'screens/third');
  assert.equal(record.value.type,type);
  if(board)assert.equal(record.value.board,board);
  assert.ok(record.value.updatedAt>0);
  results.push({choice,protocol:record.value.type,path:record.path,pass:true});
 }
 assert.equal(results.length,3);
 assert.equal(errors.filter(e=>e.includes('game-wall-v41-remote.js')).length,0,
   'V41 controller module raised an exception');
 console.log('PASS_V45_CONTROLLER_TV3_DIRECT_FIREBASE_COMMANDS',JSON.stringify(results));
}finally{
 fs.writeFileSync('controller-tv3-send-result.json',JSON.stringify({passed:results.length===3,
   results,errors:errors.slice(0,20),checkedAt:new Date().toISOString(),firebaseMock:true},null,2));
 await browser.close();
}
