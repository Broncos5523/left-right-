// Man Cave Sports Book — provider-agnostic fixture matching + TheRundown V2 pregame odds.
// This runs only on GitHub Actions, NEVER in the iPhone controller. No API keys in source.
export const LEAGUES=Object.freeze({
 NFL:{id:2,path:'football/nfl',days:7},
 NBA:{id:4,path:'basketball/nba',days:2},
 NHL:{id:6,path:'hockey/nhl',days:2},
 MLB:{id:3,path:'baseball/mlb',days:2},
 WNBA:{id:8,path:'basketball/wnba',days:2},
 NCAAF:{id:1,path:'football/college-football',days:7},
 NCAAB:{id:5,path:'basketball/mens-college-basketball',days:3}
});
const SOURCE_NAMES=Object.freeze({'19':'DraftKings','23':'FanDuel','22':'BetMGM'});
export const SOURCES=Object.keys(SOURCE_NAMES);
const rename={
 'uconn':'connecticut','st':'saint','st.':'saint','ucf':'central florida',
 'ole miss':'mississippi','umass':'massachusetts','lsu':'louisiana state',
 'smu':'southern methodist','byu':'brigham young','unc':'north carolina',
 'nc state':'north carolina state','pitt':'pittsburgh','usc':'southern california'
};
export function teamKey(value){
 let s=String(value||'').toLowerCase().replace(/&/g,' and ')
  .replace(/\((?:fl|oh|la|ca)\)/g,'').replace(/[^a-z0-9 ]/g,' ')
  .replace(/\b(university of|university|the)\b/g,' ').replace(/\s+/g,' ').trim();
 for(const [short,long] of Object.entries(rename)){
  if(s===short||s.startsWith(short+' '))return long+s.slice(short.length);
 }
 return s;
}
const invalid=['','tbd','to be determined','team'];
export function matchTeam(a,b){
 const x=teamKey(a),y=teamKey(b);
 if(invalid.includes(x)||invalid.includes(y))return false;
 if(x===y)return true;
 // A provider may omit a mascot. Reject ambiguous school-name extensions.
 const short=x.length<y.length?x:y,long=x.length<y.length?y:x;
 if(short.length<8||!long.startsWith(short+' '))return false;
 const extra=long.slice(short.length).trim().split(' ');
 if(extra.length>2)return false;
 if(['state','tech','college','university','a','and','m','western','eastern','northern','southern'].includes(extra[0]))return false;
 return true;
}
const validTime=t=>{const x=Date.parse(t||'');return Number.isFinite(x)?x:null;};
export function matchFixture(league,external,espnGames){
 const home=external?.teams?.find(x=>x.is_home===true||x.isHome===true);
 const away=external?.teams?.find(x=>x.is_home===false||x.isHome===false);
 if(!home?.name||!away?.name)return null;
 const time=validTime(external.event_date||external.date||external.start_time);
 if(time===null)return null;
 const candidates=espnGames.filter(g=>g.league===league&&g.state==='upcoming'
  &&Math.abs((validTime(g.start)??-1e20)-time)<=3*60*60*1000
  &&matchTeam(g.home.fullName,home.name)&&matchTeam(g.away.fullName,away.name));
 return candidates.length===1?candidates[0]:null;
}
function number(value){
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}
function american(value){
 const n=number(value);return n!==null&&Number.isInteger(n)&&n!==0&&Math.abs(n)>=100&&Math.abs(n)<50000
  ?(n>0?'+':'')+n:null;
}
function point(value){
 const n=number(value);
 return n!==null&&Math.abs(n)<=500?(n===0?'PK':(n>0?'+':'')+n):null;
}
function total(value){
 const n=number(value);return n!==null&&n>0&&n<600?String(n):null;
}
function offer(ln,book){
 if(ln?.closed_at||ln?.is_closed===true||ln?.is_available===false)return null;
 const p=ln?.prices?.[book];
 if(!p||p.closed_at||p.is_closed===true||p.is_available===false||p.suspended===true)return null;
 const n=number(p.price);
 // 0.0001 and similar placeholder values aren't American odds.
 if(n===null||!Number.isInteger(n)||n===0||Math.abs(n)<100)return null;
 return american(n);
}
export function parseMarkets(event){
 if(!Array.isArray(event?.markets))return null;
 const home=event.teams?.find(x=>x.is_home===true||x.isHome===true);
 const away=event.teams?.find(x=>x.is_home===false||x.isHome===false);
 if(!home||!away)return null;
 const options=[];
 for(const book of SOURCES){
  const odds={provider:SOURCE_NAMES[book],source:'TheRundown',moneyAway:null,moneyHome:null,
    spreadAway:null,spreadHome:null,spreadPriceAway:null,spreadPriceHome:null,
    overUnder:null,overPrice:null,underPrice:null};
  for(const market of event.markets){
   const marketID=Number(market.market_id);
   if(![1,2,3].includes(marketID)||Number(market.period_id||0)>0)continue;
   for(const participant of market.participants||[]){
    const side=matchTeam(participant.name,away.name)?'Away':
      matchTeam(participant.name,home.name)?'Home':null;
    const outcome=teamKey(participant.name).replace(/\s+/g,'');
    for(const ln of participant.lines||[]){
     const q=offer(ln,book);if(!q)continue;
     const value=ln.value??ln.line??ln.points??ln.handicap;
     if(marketID===1&&side)odds['money'+side]=q;
     if(marketID===2&&side){
      const p=point(value);
      if(p){odds['spread'+side]=p;odds['spreadPrice'+side]=q;}
     }
     if(marketID===3&&(outcome==='over'||outcome==='under')){
      const t=total(value);if(!t)continue;
      if(odds.overUnder&&odds.overUnder!==t)continue; // Never combine differing totals.
      odds.overUnder=t;
      odds[outcome==='over'?'overPrice':'underPrice']=q;
     }
    }
   }
  }
  const completeness=['moneyAway','moneyHome','spreadAway','spreadHome','overUnder'].filter(k=>odds[k]).length;
  if(completeness)options.push({completeness,odds});
 }
 options.sort((a,b)=>b.completeness-a.completeness);
 return options[0]?.odds||null;
}
export function addMatchedOdds(externalEvents,league,espnGames,destination){
 let matched=0,unmatched=0,quoted=0;
 for(const event of externalEvents||[]){
  const g=matchFixture(league,event,espnGames);
  if(!g){unmatched++;continue;}
  matched++;
  const quote=parseMarkets(event);
  if(!quote)continue;
  const previous=destination[g.id];
  const coverage=odds=>['moneyAway','moneyHome','spreadAway','spreadHome','overUnder'].filter(k=>odds?.[k]).length;
  if(!previous||coverage(quote)>coverage(previous)){
   destination[g.id]=quote;quoted++;
  }
 }
 return {matched,unmatched,quoted};
}
