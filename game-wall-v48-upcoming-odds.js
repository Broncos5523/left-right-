/* MAN CAVE SPORTS BOOK · Game Finder upcoming odds. No betting links or writes.
   ESPN scoreboard market data first; lazy, read-only ESPN Core odds fallback. */
(()=>{
'use strict';
const cache=new Map(),pending=new Set(),queue=[];
let active=0,observer=null;
const concurrency=3,cacheMs=12*60*1000;
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=x=>x===null||x===undefined||String(x).trim()===''?null:Number.isFinite(Number(x))?Number(x):null;
const price=x=>{
 const raw=x&&typeof x==='object'?(x.american??x.alternateDisplayValue??x.odds):x;
 const n=num(raw);
 return n!==null&&Number.isInteger(n)&&n!==0&&Math.abs(n)<=50000?(n>0?'+':'')+n:null;
};
const line=x=>{
 const raw=x&&typeof x==='object'?(x.american??x.alternateDisplayValue??x.line):x;
 const n=num(raw);if(n===null||Math.abs(n)>200)return null;
 return n===0?'PK':(n>0?'+':'')+n;
};
const total=x=>{const n=num(x);return n===null||n<0||n>600?null:String(n);};
const latest=obj=>obj?.close??obj?.current??obj?.open??null;
function extract(raw){
 if(!raw||typeof raw!=='object')return null;
 const name=String(raw.provider?.displayName||raw.provider?.name||'ESPN').replace(/\s*-\s*Live Odds$/i,'').slice(0,40);
 const am=raw.moneyline?.away,hm=raw.moneyline?.home;
 const ap=raw.pointSpread?.away,hp=raw.pointSpread?.home;
 const at=raw.awayTeamOdds||{},ht=raw.homeTeamOdds||{};
 const moneyAway=price(latest(am)?.odds??at.moneyLine??at.current?.moneyLine);
 const moneyHome=price(latest(hm)?.odds??ht.moneyLine??ht.current?.moneyLine);
 const spreadAway=line(latest(ap)?.line??at.current?.pointSpread);
 const spreadHome=line(latest(hp)?.line??ht.current?.pointSpread);
 const spreadPriceAway=price(latest(ap)?.odds??at.spreadOdds??at.current?.spread);
 const spreadPriceHome=price(latest(hp)?.odds??ht.spreadOdds??ht.current?.spread);
 const overUnder=total(raw.overUnder??String(latest(raw.total?.over)?.line||'').replace(/^[oO]/,'')??null);
 const overPrice=price(latest(raw.total?.over)?.odds??raw.overOdds??raw.total?.current?.over);
 const underPrice=price(latest(raw.total?.under)?.odds??raw.underOdds??raw.total?.current?.under);
 if(![moneyAway,moneyHome,spreadAway,spreadHome,overUnder].some(Boolean))return null;
 return {provider:name,moneyAway,moneyHome,spreadAway,spreadHome,spreadPriceAway,spreadPriceHome,overUnder,overPrice,underPrice};
}
function pick(input){
 const arr=Array.isArray(input)?input:[input];
 const options=arr.map(extract).filter(Boolean);
 // Prefer complete markets and a regular pregame feed over in-play lines.
 options.sort((a,b)=>{
  const weight=x=>[x.moneyAway,x.moneyHome,x.spreadAway,x.spreadHome,x.overUnder].filter(Boolean).length;
  return weight(b)-weight(a);
 });
 return options[0]||null;
}
function abbrev(t){
 const s=String(t?.abbr||t?.name||'TEAM').trim();
 return s.length<=7?s:s.split(' ').map(x=>x[0]).join('').slice(0,5).toUpperCase();
}
function col(label,body,sub=''){
 return '<div class="mcOddsCell"><small>'+esc(label)+'</small><strong>'+esc(body)+'</strong><span>'+esc(sub)+'</span></div>';
}
function markup(g){
 if(!g||g.state!=='upcoming')return '';
 const cached=cache.get(g.id);
 const odds=(cached&&cached.expires>Date.now()?cached.odds:null)||pick(g.oddsRaw);
 const source=odds?'<span>'+esc(odds.provider)+' · via ESPN</span>':'<span>ESPN pregame lines</span>';
 let body='';
 if(odds){
  const away=abbrev(g.away),home=abbrev(g.home);
  const spread=[odds.spreadAway?away+' '+odds.spreadAway+(odds.spreadPriceAway?' ('+odds.spreadPriceAway+')':''):null,
   odds.spreadHome?home+' '+odds.spreadHome+(odds.spreadPriceHome?' ('+odds.spreadPriceHome+')':''):null].filter(Boolean);
  const ml=[odds.moneyAway?away+' '+odds.moneyAway:null,odds.moneyHome?home+' '+odds.moneyHome:null].filter(Boolean);
  const totals=[odds.overPrice?'O '+odds.overPrice:null,odds.underPrice?'U '+odds.underPrice:null].filter(Boolean);
  body='<div class="mcOddsGrid">'+
   col('SPREAD',spread[0]||'—',spread[1]||'')+
   col('MONEYLINE',ml[0]||'—',ml[1]||'')+
   col('OVER / UNDER',odds.overUnder||'—',totals.join(' · '))+
   '</div>';
 }else{
  const looking=!cached||cached.expires<=Date.now();
  body='<div class="mcOddsEmpty">'+(looking?'Checking available odds…':'Odds not posted')+'</div>';
 }
 return '<section class="mcOdds" data-odds-for="'+esc(g.id)+'" aria-label="Upcoming betting odds">'+
  '<div class="mcOddsHead"><b>PRE-GAME ODDS</b>'+source+'</div>'+body+'</section>';
}
function paint(id){
 const game=window.ManCaveRealGames?.state?.games?.find(x=>x.id===id);
 if(!game)return;
 document.querySelectorAll('[data-odds-for]').forEach(el=>{
  if(el.dataset.oddsFor!==id)return;
  const fragment=document.createElement('div');
  fragment.innerHTML=markup(game);
  const replacement=fragment.firstElementChild;
  if(replacement)el.replaceWith(replacement);
 });
}
function enqueue(id){
 const game=window.ManCaveRealGames?.state?.games?.find(g=>g.id===id&&g.state==='upcoming');
 if(!game)return;
 const hit=cache.get(id);
 if(hit&&hit.expires>Date.now()){paint(id);return;}
 const inline=pick(game.oddsRaw);
 if(inline){
  cache.set(id,{odds:inline,expires:Date.now()+cacheMs});paint(id);return;
 }
 if(pending.has(id))return;
 pending.add(id);queue.push(id);drain();
}
function drain(){
 while(active<concurrency&&queue.length){
  const id=queue.shift(),game=window.ManCaveRealGames?.state?.games?.find(x=>x.id===id);
  if(!game||game.state!=='upcoming'){pending.delete(id);continue;}
  active++;
  (async()=>{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),8000);
   let found=null;
   try{
    const pieces=String(game.path||'').split('/');
    if(pieces.length===2&&/^\d{5,15}$/.test(String(game.eventId||''))){
     const url='https://sports.core.api.espn.com/v2/sports/'+encodeURIComponent(pieces[0])+
      '/leagues/'+encodeURIComponent(pieces[1])+'/events/'+encodeURIComponent(game.eventId)+
      '/competitions/'+encodeURIComponent(game.eventId)+'/odds?limit=10';
     const r=await fetch(url,{signal:controller.signal,cache:'no-store'});
     if(r.ok){const data=await r.json();found=pick(data.items);}
    }
   }catch(e){/* Source unavailable: never invent a market. */}
   finally{
    clearTimeout(timeout);
    cache.set(id,{odds:found,expires:Date.now()+(found?cacheMs:6*60*1000)});
    pending.delete(id);active--;paint(id);drain();
   }
  })();
 }
}
function hydrate(){
 observer?.disconnect();observer=null;
 const nodes=[...document.querySelectorAll('.games .mcOdds[data-odds-for]')];
 if(!nodes.length)return;
 if(typeof IntersectionObserver==='function'){
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){
    observer?.unobserve(entry.target);
    enqueue(entry.target.dataset.oddsFor);
   }
  },{rootMargin:'280px 0px'});
  nodes.forEach(el=>observer.observe(el));
 }else nodes.slice(0,12).forEach(el=>enqueue(el.dataset.oddsFor));
}
window.ManCaveUpcomingOdds=Object.freeze({markup,hydrate,normalize:pick});
})();
