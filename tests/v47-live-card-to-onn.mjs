import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{window.__LIVE_CARD_WRITES__=[];});
await context.route('**/firebase.js',route=>route.fulfill({
  status:200,contentType:'text/javascript; charset=utf-8',
  body: