/* V45 Board Library cross-screen regression, real controller HTML.
   Firebase mocked: no real account access or TV assignments modified. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{window.__LIVE_CARD_WRITES__=[];});
await context.route('**/firebase.js',route=>route.fulfill({
 status:200,contentType:'text/javascript; charset=utf-8',
 body:`
export const db={mock:true};
export const auth={currentUser:{uid:'mock-owner',email:'test@example.invalid'}};
export const ref=(db,path)=>({path});
export async function set(location,value){
 window.__LIVE_CARD_WRITES__.push({verb:'set',path:location.path,value});
}
export async function update(location,value){
 window.__LIVE_CARD_WRITES__.push({verb:'update',path:location.path,value});
}
export function onValue(location,success){
 queueMicrotask(()=>success({val:()=>null}));
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
page.on('pageerror',e=>errors.push(String(e).slice(0,400)));
try {
 const response=await page.goto('http://127.0.0.1:8877/game-wall-v47-home-screen.html',
 {waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200);
 await page.waitForFunction(()=>window.ManCaveBridge?.wingStatus?.()?.connected===true,null,{timeout:20000});
 await page.locator('button.tab[data-nav="boards"]').click();
 for(const [board,type] of [
  ['live-lookin','live'],['upcoming','upcoming'],
  ['wrestling','wrestling'],['deep-dive','rotation']
 ]){
  const before=await page.evaluate(()=>window.__LIVE_CARD_WRITES__.length);
  await page.locator('[data-board="'+board+'"]').click();
  await page.waitForSelector('#modalShade.open #liveModalSend',{timeout:7000});
  assert.equal(await page.locator('#modalBody [data-board-target="third"]').isChecked(),true);
  assert.equal(await page.locator('#modalBody [data-board-target="left"]').isChecked(),false);
  assert.equal(await page.locator('#modalBody [data-board-target="right"]').isChecked(),false);
  assert.equal(await page.evaluate(()=>window.__LIVE_CARD_WRITES__.length),before,
   'Opening a board card should never send an implicit command');
  await page.locator('#liveModalSend').click();
  await page.waitForFunction(x=>window.__LIVE_CARD_WRITES__?.length>x,before,{timeout:8000});
  const actual=await page.evaluate(()=>window.__LIVE_CARD_WRITES__.at(-1));
  assert.equal(actual.verb,'set','Only 32-inch send must use direct Firebase set');
  assert.equal(actual.path,'screens/third');
  assert.equal(actual.value.type,type);
  assert.ok(actual.value.updatedAt>0);
  results.push({board,destination:'32 Onn',type,method:'set',pass:true});
 }
 await page.locator('[data-board="live-lookin"]').click();
 await page.waitForSelector('#modalShade.open #liveModalSend',{timeout:6000});
 await page.locator('#modalBody [data-board-target="third"]').uncheck();
 await page.locator('#modalBody [data-board-target="left"]').check();
 await page.locator('#liveModalSend').click();
 await page.waitForFunction(()=>window.__LIVE_CARD_WRITES__?.length===5,null,{timeout:8000});
 const wing=await page.evaluate(()=>window.__LIVE_CARD_WRITES__.at(-1));
 assert.equal(wing.verb,'update');
 assert.equal(wing.path,'screens');
 assert.deepEqual(Object.keys(wing.value),['left']);
 assert.equal(wing.value.left.type,'live');
 results.push({board:'live-lookin',destination:'Left Wing',type:'live',method:'update',pass:true});
 assert.equal(errors.length,0,'Unexpected JS errors: '+errors.join('; '));
 console.log('PASS_V47_BOARD_TILES_DEFAULT_TO_DIRECT_ONN_SEND',JSON.stringify(results));
} finally {
 fs.writeFileSync('v47-live-card-routing.json',JSON.stringify({results,errors,
   firebaseMock:true,checkedAt:new Date().toISOString()},null,2));
 await browser.close();
}
