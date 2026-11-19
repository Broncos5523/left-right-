// ESPN NFL Team Leaders, season to date — aggregate EVERY completed regular
// season box score. Avoid current-roster-only blind spots (trades/injuries).
// Runs in GitHub Actions, never on phones or TVs.
import fs from 'node:fs';
const year=Number(process.env.SEASON||new Date().getUTCFullYear());
if(year<2026||year>2035)throw Error('Invalid NFL season');
const ids=(process.env.TEAM_IDS||'7,13').split(',').map(x=>x.trim()).filter(x=>/^\d{1,3}$/.test(x));
const cacheFile='stats-cache/nfl-team-leaders-'+year+'.json';
const existing=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile,'utf8')):{};
const all=existing.season===year&&existing.teams?{...existing.teams}:{};
const base='https://site.api.espn.com/apis/site/v2/sports/football/nfl/';
const metrics=[
 {metric:'Passing Yards',category:'passing',key:'passingYards'},
 {metric:'Rushing Yards',category:'rushing',key:'rushingYards'},
 {metric:'Receiving Yards',category:'receiving',key:'receivingYards'},
 {metric:'Passing Touchdowns',category:'passing',key:'passingTouchdowns'},
 {metric:'Total Tackles',category:'defensive',key:'totalTackles'},
 {metric:'Sacks',category:'defensive',key:'sacks'},
 {metric:'Interceptions',category:'interceptions',key:'interceptions'}
];
async function get(url){
 const res=await fetch(url,{signal:AbortSignal.timeout(14000)});
 if(!res.ok)throw Error('ESPN HTTP '+res.status+' '+new URL(url).pathname);
 return res.json();
}
const number=x=>typeof x==='number'?x:Number(String(x??'').trim().replace(/,/g,''));
async function processTeam(teamId){
 const [detail,schedule]=await Promise.all([
  get(base+'teams/'+teamId),get(base+'teams/'+teamId+'/schedule?season='+year)
 ]);
 const team=detail?.team;
 if(String(team?.id)!==teamId)throw Error('Wrong ESPN team ID for '+teamId);
 const events=[...new Map((schedule.events||[])
  .filter(e=>String(e?.season?.year||year)===String(year))
  .filter(e=>e.competitions?.[0]?.status?.type?.state==='post'||
   e.competitions?.[0]?.status?.type?.completed===true)
  .filter(e=>Date.parse(e.date)<Date.now())
  .map(e=>[String(e.id),e])).values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 if(!events.length)throw Error('No confirmed 2026 completed games for '+teamId);
 const records=new Map(),failures=[];
 let next=0;
 await Promise.all(Array.from({length:5},async()=>{
  while(next<events.length){
   const e=events[next++];
   try{
    const data=await get(base+'summary?event='+encodeURIComponent(e.id));
    const completed=data.header?.competitions?.[0]?.status?.type?.state==='post';
    const side=(data.boxscore?.players||[]).find(s=>String(s.team?.id)===teamId);
    if(!completed||!side)throw Error('No completed team box score');
    for(const group of side.statistics||[]){
     const names=group.keys||[];
     const required=metrics.filter(m=>m.category===group.name);
     if(!required.length)continue;
     for(const row of group.athletes||[]){
      const athlete=row.athlete||{},id=String(athlete.id||'');
      if(!/^\d{1,12}$/.test(id)||!athlete.displayName)continue;
      let entry=records.get(id);
      if(!entry){entry={id,name:athlete.displayName,
       headshot:athlete.headshot?.href||'',stats:{}};records.set(id,entry);}
      for(const m of required){
       const index=names.indexOf(m.key);
       if(index<0)continue;
       const n=number(row.stats?.[index]);
       if(!Number.isFinite(n))continue;
       entry.stats[m.metric]=(entry.stats[m.metric]||0)+n;
      }
     }
    }
   }catch(error){failures.push({event:e.id,error:String(error).slice(0,125)});}
  }
 }));
 if(failures.length)throw Error('Incomplete ESPN season totals for '+teamId+': '+JSON.stringify(failures));
 const athletes=[...records.values()];
 const leaders=metrics.map(m=>{
  const list=athletes.map(p=>({...p,value:p.stats[m.metric]})).filter(p=>Number.isFinite(p.value)&&p.value>0);
  if(!list.length)return null;
  list.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
  const p=list[0];
  return {metric:m.metric,name:p.name,value:p.value.toLocaleString('en-US'),headshot:p.headshot};
 }).filter(Boolean);
 if(leaders.length<5)throw Error('Too few verified team categories '+teamId);
 all[teamId]={teamId,team:team.displayName,season:year,updatedAt:new Date().toISOString(),
  verifiedAthletes:athletes.length,gamesExpected:events.length,gamesVerified:events.length,
  coverage:'all ESPN-completed regular-season games through '+events[events.length-1].date,
  leaders};
 console.log('NFL_TEAM_LEADERS_VERIFIED',JSON.stringify({teamId,name:team.displayName,
  games:events.length,athletes:athletes.length,leaders:leaders.map(l=>({metric:l.metric,name:l.name,value:l.value}))}));
}
for(const id of ids)await processTeam(id);
fs.mkdirSync('stats-cache',{recursive:true});
fs.writeFileSync(cacheFile,JSON.stringify({season:year,generatedAt:new Date().toISOString(),
 source:'ESPN completed-game NFL player box scores, 2026 regular season (all verified games)',teams:all},null,2)+'\n');
console.log('NFL_LEADERS_READY',JSON.stringify({season:year,teams:ids.length,knownTeams:Object.keys(all).length}));
