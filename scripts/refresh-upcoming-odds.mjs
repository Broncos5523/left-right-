// GitHub Actions only — safe pregame odds aggregation; no browser keys or unverified lines.
import fs from 'node:fs';
import {LEAGUES,addMatchedOdds} from './odds-rundown-adapter.mjs';
const key=process.env.THERUNDOWN_API_KEY;
if(!key){
 console.log('THERUNDOWN_NOT_CONFIGURED: Add repository Actions secret THERUNDOWN_API_KEY. ESPN odds stay active.');
 process.exit(0);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const dateET=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'})
 .format(new Date(Date.now()+offset*86400000)).replace(/-/g,'');
const now=Date.now();
const fetchJSON=async(url,headers={})=>{
 const res=await fetch(url,{headers,signal:AbortSignal.timeout(16000)});
 if(!res.ok)throw Error(url.replace(/apiKey=[^&]+/,'apiKey=REDACTED')+' '+res.status);
 return {data:await res.json(),res};
};
async function collectESPN(){
 const work=[];
 for(const [league,def] of Object.entries(LEAGUES)){
  for(let d=0;d<=def.days;d++)work.push({league,def,day:dateET(d)});
 }
 const games=[],failures=[];
 let next=0;
 await Promise.all(Array.from({length:5},async()=>{
  while(next<work.length){
   const q=work[next++],url='https://site.api.espn.com/apis/site/v2/sports/'+q.def.path+
    '/scoreboard?dates='+q.day+'&limit='+(q.league==='NCAAB'?500:250)+
    (q.league==='NCAAB'?'&groups=50':q.league==='NCAAF'?'&groups=80':'');
   try{
    const {data}=await fetchJSON(url);
    for(const e of data.events||[]){
     if((e.status?.type?.state||'pre')!=='pre')continue;
     const start=Date.parse(e.date);if(!Number.isFinite(start)||start<now-60000||start>now+q.def.days*86400000)continue;
     const home=e.competitions?.[0]?.competitors?.find(c=>c.homeAway==='home')?.team?.displayName;
     const away=e.competitions?.[0]?.competitors?.find(c=>c.homeAway==='away')?.team?.displayName;
     if(!home||!away)continue;
     const odds=e.competitions?.[0]?.odds?.[0]||{};
     const fullMarkets=Boolean(odds.moneyline?.home?.close?.odds&&odds.moneyline?.away?.close?.odds
      &&odds.pointSpread?.home?.close?.line&&odds.pointSpread?.away?.close?.line&&odds.overUnder!=null);
     games.push({id:q.league+'-'+e.id,league:q.league,state:'upcoming',start:e.date,
      home:{fullName:home},away:{fullName:away},needsSecondary:!fullMarkets});
    }
   }catch(e){failures.push({league:q.league,day:q.day,error:String(e.message||e)});}
  }
 }));
 const unique=[...new Map(games.map(g=>[g.id,g])).values()];
 if(failures.length>work.length/2)throw Error('Too many ESPN schedule fetch errors; refusing to publish incomplete cache');
 return {games:unique,failures};
}
const {games,failures}=await collectESPN();
const targets=new Map();
for(const g of games.filter(x=>x.needsSecondary)){
 const day=new Date(g.start).toISOString().slice(0,10);
 const key=g.league+':'+day;
 if(!targets.has(key))targets.set(key,{league:g.league,day,sportId:LEAGUES[g.league].id});
}
const entries=Object.create(null);
const stats={espnUpcoming:games.length,needsSecondary:games.filter(x=>x.needsSecondary).length,
 candidates:targets.size,queried:0,matched:0,quoted:0,unmatched:0,errors:failures};
const dateSorted=[...targets.values()].sort((a,b)=>{
 const focus={NCAAB:0,NBA:1,NHL:2,WNBA:3,MLB:4,NCAAF:5,NFL:6};
 return (focus[a.league]-focus[b.league])||a.day.localeCompare(b.day);
});
for(const target of dateSorted){
 const url='https://therundown.io/api/v2/sports/'+target.sportId+'/events/'+target.day+
  '?market_ids=1,2,3&affiliate_ids=19,22,23&main_line=true&hide_closed=true';
 const {data,res}=await fetchJSON(url,{'X-TheRundown-Key':key});
 const all=Array.isArray(data.events)?data.events:[];
 const matched=addMatchedOdds(all,target.league,games,entries);
 stats.queried++;stats.matched+=matched.matched;stats.quoted+=matched.quoted;
 stats.unmatched+=matched.unmatched;
 const remaining=Number(res.headers.get('x-datapoints-remaining'));
 console.log('ODDS_SOURCE',JSON.stringify({sport:target.league,day:target.day,events:all.length,...matched,quotaRemaining:Number.isFinite(remaining)?remaining:null}));
 if(Number.isFinite(remaining)&&remaining<2000){console.log('LOW_QUOTA: Stopping safely with current matched odds.');break;}
 await sleep(1150); // TheRundown Free limits to 1 request/s.
}
const output={generatedAt:new Date().toISOString(),validUntil:new Date(now+30*3600000).toISOString(),
 source:'TheRundown pre-match odds (5-minute-delayed free tier)',games:entries,stats};
fs.mkdirSync('odds-cache',{recursive:true});
fs.writeFileSync('odds-cache/therundown.json',JSON.stringify(output,null,2)+'\n');
console.log('ODDS_CACHE_READY',JSON.stringify({at:output.generatedAt,quotes:Object.keys(entries).length,...stats}));
