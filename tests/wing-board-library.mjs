/* Real left/right Fire TV player regression with mocked Firebase and mocked
   external iframe responses. No Firebase writes, no changes to approved art. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const reports=[],errors=[];
for(const side of ['left','right']){
 const context=await browser.newContext({viewport:{width:1920,height:1080}});
 await context.addInitScript(()=>{window.__TEST_ASSIGN_WING__=null});
 await context.route('**/firebase.js',route=>route.fulfill({
  status:200,contentType:'text/javascript',
  body:`
export const db={mock:true};
export const auth={mock:true};
export const ref=(db,path)=>({path});
export async function signInAnonymously(){return {user:{uid:'mock'}};}
export function onValue(location,success){
  if(location.path!=='screens/${side}')throw Error('Unexpected Fire TV Firebase path '+location.path);
  window.__TEST_ASSIGN_WING__=(value)=>success({val:()=>value});
  return ()=>{};
}
`
 }));
 await context.route('https://**/*',route=>{
  if(route.request().resourceType()==='document')
   return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body>Mock external board</body></html>'});
  return route.abort();
 });
 const page=await context.newPage();
 page.on('pageerror',err=>errors.push(side+': '+String(err).slice(0,500)));
 try{
  const res=await page.goto('http://127.0.0.1:8877/'+side+'.html',
   {waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(res?.status(),200);
  await page.waitForFunction(()=>typeof window.__TEST_ASSIGN_WING__==='function',null,{timeout:12000});
  const trials=[
   ['upcoming','https://caveup.pages.dev/','other'],
   ['live','https://testcave.pages.dev/','other'],
   ['wrestling','https://broncos5523.github.io/Inside-the-squared-circle/staging/?view=tv&mode=active&rotate=none','team'],
   ['rotation','https://man-cave-28-page.broncos5523.workers.dev/staging/player.html?rotate=off','team']
  ];
  for(const [type,src,mode] of trials){
   await page.evaluate(type=>window.__TEST_ASSIGN_WING__({type,updatedAt:123456}),type);
   await page.waitForFunction(src=>document.getElementById('board')?.getAttribute('src')===src,
    src,{timeout:8000});
   const a=await page.evaluate(()=>({
    src:document.getElementById('board').getAttribute('src'),
    mode:document.documentElement.dataset.boardMode,
    rotation:document.documentElement.dataset.rotation,
    hidden:document.getElementById('board').classList.contains('hidden'),
    transform:getComputedStyle(document.getElementById('board')).transform,
    bounds:document.getElementById('board').getBoundingClientRect().toJSON()
   }));
   assert.equal(a.src,src);
   assert.equal(a.mode,mode);
   assert.equal(a.rotation,side==='left'?'cw':'ccw');
   assert.equal(a.hidden,false);
   if(mode==='team'){
    assert.notEqual(a.transform,'none',type+' must rotate in portrait Silk mode');
    assert.ok(Math.abs(a.bounds.width-1920)<=3&&Math.abs(a.bounds.height-1080)<=3,
     type+' rotated viewport clipped unexpectedly');
   }else assert.equal(a.transform,'none','Original '+type+' external rotation behavior must remain');
   reports.push({side,type,mode,rotation:a.rotation,pass:true});
  }
  // Existing game assignment path remains intact.
  const team={type:'team',game:'nfl-401770100',team:'Denver Broncos',eventId:'401770100',updatedAt:1234567};
  await page.evaluate(value=>window.__TEST_ASSIGN_WING__(value),team);
  await page.waitForFunction(()=>document.getElementById('board').getAttribute('src')?.includes('/team-board.html'),
   null,{timeout:8000});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.boardMode),'team');
  reports.push({side,type:'team',mode:'team',pass:true});
 }finally{await context.close();}
}
await browser.close();
if(errors.length)console.log('BROWSER_WARNINGS',JSON.stringify(errors.slice(0,10)));
fs.writeFileSync('wing-board-library-result.json',JSON.stringify({reports,errors,realFirebase:false},null,2));
console.log('PASS_FIRE_TV_WINGS_FOUR_BOARD_LIBRARY_MODES_AND_TEAM_COMPATIBILITY',JSON.stringify(reports));
