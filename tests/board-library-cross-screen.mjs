/* V45 Board Library cross-screen regression, real controller HTML.
   Firebase mocked: no real account access or TV assignments modified. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{window.__BOARD_TEST_WRITES__=[];});
await context.route('**/firebase.js',route=>route.fulfill({
 status:200,contentType:'text/javascript; charset=utf-8',
 body:`
export const db={mock:true};
export const auth={currentUser:{uid:'mock-owner',email:'test@example.invalid'}};
export const ref=(db,path)=>({path});
export async function set(location,value){
 window.__BOARD_TEST_WRITES__.push({verb:'set',path:location.path,value});
}
export async function update(location,value){
 window.__BOARD_TEST_WRITES__.push({verb:'update',path:location.path,value});
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
const issues=[],records=[];
page.on('pageerror',e=>issues.push(String(e).slice(0,300)));
try{
 const response=await page.goto('http://127.0.0.1:8877/game-wall-v45-home-screen.html',
  {waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(response?.status(),200);
 await page.waitForFunction(()=>window.ManCaveBridge?.wingStatus?.()?.connected===true,null,{timeout:20000});
 await page.locator('button.tab[data-nav="boards"]').click();
 await page.waitForSelector('[data-board="deep-dive"]',{timeout:15000});
 const scenarios=[
  ['live-lookin','live'],['upcoming','upcoming'],
  ['wrestling','wrestling'],['deep-dive','rotation']
 ];
 for(const [board,type] of scenarios){
  await page.locator('[data-board="'+board+'"]').click();
  await page.waitForSelector('#modalShade.open #liveModalSend',{timeout:5000});
  const checks=page.locator('#modalBody [data-board-target]');
  assert.deepEqual(await checks.evaluateAll(nodes=>nodes.map(n=>n.dataset.boardTarget)),
   ['left','right','third'],'Each Board Library banner must offer all three physical TVs');
  await page.locator('#modalBody [data-board-target="left"]').check();
  await page.locator('#modalBody [data-board-target="right"]').check();
  await page.locator('#modalBody [data-board-target="third"]').check();
  await page.locator('#liveModalSend').click();
  await page.waitForFunction(n=>window.__BOARD_TEST_WRITES__?.length===n,records.length+1,{timeout:10000});
  const last=await page.evaluate(()=>window.__BOARD_TEST_WRITES__.at(-1));
  assert.equal(last.path,'screens');
  assert.equal(last.verb,'update');
  assert.deepEqual(Object.keys(last.value).sort(),['left','right','third']);
  for(const side of ['left','right','third']){
   assert.equal(last.value[side].type,type,board+' '+side+' type mismatch');
   assert.ok(last.value[side].updatedAt>0);
  }
  records.push({board,type,targets:Object.keys(last.value),result:'PASS'});
 }
 // An individual-screen send must not disturb the other two TVs.
 await page.locator('[data-board="wrestling"]').click();
 await page.locator('#modalBody [data-board-target="right"]').check();
 await page.locator('#liveModalSend').click();
 await page.waitForFunction(()=>window.__BOARD_TEST_WRITES__?.length===5,null,{timeout:10000});
 const one=await page.evaluate(()=>window.__BOARD_TEST_WRITES__.at(-1));
 assert.deepEqual(Object.keys(one.value),['right']);
 assert.equal(one.value.right.type,'wrestling');
 records.push({board:'wrestling',type:'wrestling',targets:['right'],result:'PASS'});
 console.log('PASS_ALL_BOARD_LIBRARY_BANNERS_REAL_THREE_SCREEN_FIREBASE_COMMANDS',JSON.stringify(records));
}finally{
 fs.writeFileSync('board-library-cross-screen-result.json',
  JSON.stringify({checks:records,issues:issues.slice(0,20),firebaseMock:true},null,2));
 await browser.close();
}
