/*
 * Public sports-data routes formerly bundled into the Render Xfinity server.
 * Separate from the private Xfinity/Firebase service. No secrets, no user data.
 * Fails closed: no fabricated station assignments, season stats or games.
 */
const COVERAGE='https://www.thesportsmaps.com/tv-markets/providence-new-bedford.html';
const NHL_TEAMS=new Set('ANA BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH'.split(' '));
const nflCache={at:0,data:null};
const hockeyCache=new Map();
const text=(req,data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':status===200?'public,max-age=300':'no-store',
 'Access-Control-Allow-Origin':'https://broncos5523.github.io',
 'Vary':'Origin','X-Content-Type-Options':'nosniff'}});
async function guardedFetch(url,timeout=8500){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{return await fetch(url,{signal:controller.signal,redirect:'error',
  headers:{Accept:'application/json,text/html', 'User-Agent':'ManCaveSportsBook/1.0 (public sports lookup)'}});}
 finally{clearTimeout(timer);}
}
function parseText(raw){
 return String(raw).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
 .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
 .replace(/<[^>]*>/g,' ')
 .replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&')
 .replace(/&quot;/gi,'"').replace(/&#(?:0*39|x0*27);/gi,"'")
 .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
 .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16)))
 .replace(/\s+/g,' ').trim();
}
function parseCoverage(html){
 const body=parseText(html);
 const h=/On Local TV in Providence-New Bedford:\s*Week\s*(\d+)/i.exec(body);
 if(!h)throw Error('Coverage heading missing');
 const after=body.slice(h.index+h[0].length);
 const date=/Sunday,?\s+([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(20\d\d))?/i.exec(after);
 if(!date)throw Error('Exact Sunday unavailable');
 const year=Number(date[3]||new Date().getUTCFullYear());
 const month=new Date(date[1]+' 1, '+year).getUTCMonth()+1;
 if(!month||month>12||Number(date[2])>31)throw Error('Coverage date invalid');
 const iso=year+'-'+String(month).padStart(2,'0')+'-'+date[2].padStart(2,'0');
 const end=after.search(/National games(?:\b|\s|\u00b7)|Not on TV in Providence/i);
 if(end<0)throw Error('Coverage listing incomplete');
 const section=after.slice(date.index+date[0].length,end);
 const games=[];
 const regex=/(\d{1,2}:\d\d)\s*(AM|PM)\s*ET\s*(CBS|FOX)\s+(.+?)\s+at\s+(.+?)\s*See the map/gi;
 let m;while((m=regex.exec(section))!==null){
  const away=m[4].trim(),home=m[5].trim();
  if(!away||!home||away.length>50||home.length>50)continue;
  games.push({time:m[1]+' '+m[2].toUpperCase(),network:m[3].toUpperCase(),away,home});
 }
 if(!games.length||games.length>5)throw Error('Local broadcast rows unverified');
 return {date:iso,week:Number(h[1]),market:'Providence–New Bedford',source:COVERAGE,games};
}
async function nfl(req,url){
 const date=url.searchParams.get('date')||'';
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return text(req,{ok:false,error:'Provide date as YYYY-MM-DD'},400);
 try{
  let published=nflCache.data;
  if(!published||Date.now()-nflCache.at>30*60000){
   const r=await guardedFetch(COVERAGE);
   if(!r.ok)throw Error('No publisher response');
   const html=await r.text();
   if(html.length>1500000)throw Error('Oversized source');
   published=parseCoverage(html);
   nflCache.at=Date.now();nflCache.data=published;
  }
  const yes=published.date===date;
  return text(req,{ok:true,requestedDate:date,date:published.date,week:published.week,
   market:published.market,source:published.source,verifiedForRequestedDate:yes,
   games:yes?published.games:[],status:yes?'published':'not_yet_published'});
 }catch{
  return text(req,{ok:false,requestedDate:date,verifiedForRequestedDate:false,
   games:[],status:'unavailable',error:'Providence NFL station assignments not confirmed at this time.'},503);
 }
}
function fullName(row){
 const first=typeof row?.firstName==='string'?row.firstName:row?.firstName?.default||'';
 const last=typeof row?.lastName==='string'?row.lastName:row?.lastName?.default||'';
 return (String(first)+' '+String(last)).trim();
}
function nhlLeaders(payload){
 const skaters=Array.isArray(payload?.skaters)?payload.skaters:[];
 const goalies=Array.isArray(payload?.goalies)?payload.goalies:[];
 const leaders=[];
 function choose(rows,key,metric,format=v=>String(v),ascending=false){
  const found=rows.filter(r=>fullName(r)&&Number.isFinite(Number(r[key]))&&Number(r.gamesPlayed||0)>0)
    .sort((a,b)=>ascending?Number(a[key])-Number(b[key]):Number(b[key])-Number(a[key]));
  if(!found.length)return;
  const item=found[0],headshot=typeof item.headshot==='string'&&
    item.headshot.startsWith('https://')?item.headshot:'';
  leaders.push({metric,name:fullName(item),value:format(Number(item[key])),
   headshot,playerId:item.playerId});
 }
 choose(skaters,'points','Points');
 choose(skaters,'goals','Goals');
 choose(skaters,'assists','Assists');
 choose(skaters,'plusMinus','Plus/Minus',v=>v>0?'+'+v:String(v));
 choose(skaters,'shots','Shots');
 choose(goalies,'wins','Goalie Wins');
 choose(goalies,'savePercentage','Save %',v=>(v>1?v:v*100).toFixed(1)+'%');
 choose(goalies,'goalsAgainstAverage','Goals Against Avg',v=>v.toFixed(2),true);
 choose(goalies,'saves','Saves');
 return leaders;
}
async function nhl(req,url){
 const team=String(url.searchParams.get('team')||'').toUpperCase();
 const season=String(url.searchParams.get('season')||'');
 const yr=Number(season.slice(0,4)),next=Number(season.slice(4));
 if(!NHL_TEAMS.has(team)||!/^20\d{6}$/.test(season)||next!==yr+1||
  yr<2020||yr>new Date().getUTCFullYear()+1)
  return text(req,{ok:false,error:'Invalid NHL team or season.'},400);
 const key=team+':'+season,cached=hockeyCache.get(key),now=Date.now();
 if(cached&&now-cached.at<15*60000)return text(req,cached.data);
 try{
  const r=await guardedFetch('https://api-web.nhle.com/v1/club-stats/'+team+'/'+season+'/2',10000);
  if(!r.ok)throw Error('No NHL official source');
  const raw=await r.text();
  if(raw.length>1500000)throw Error('Oversized source');
  const leaders=nhlLeaders(JSON.parse(raw));
  if(!leaders.length)throw Error('No verified NHL leaders');
  const data={ok:true,team,season,source:'NHL',leaders};
  hockeyCache.set(key,{at:now,data});return text(req,data);
 }catch{
  if(cached&&now-cached.at<3600000)return text(req,{...cached.data,stale:true});
  return text(req,{ok:false,team,season,
   error:'NHL club statistics are temporarily unavailable.'},503);
 }
}
export async function handlePublic(req,path,url){
 if(req.method!=='GET')return text(req,{ok:false,error:'Method not allowed.'},405);
 if(path==='/nfl-local-coverage')return nfl(req,url);
 if(path==='/nhl-team-leaders')return nhl(req,url);
 return null;
}
export const __test={parseCoverage,nhlLeaders};
