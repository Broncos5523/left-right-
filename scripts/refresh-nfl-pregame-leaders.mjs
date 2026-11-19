// Read-only NFL pregame Team Leaders from individual ESPN 2026 season totals.
// Run in GitHub Actions; never fetch dozens of player profiles on an iPhone.
import fs from 'node:fs';
const year=Number(process.env.SEASON||new Date().getUTCFullYear());
if(year<2026||year>2035)throw Error('Invalid NFL season');
const ids=(process.env.TEAM_IDS||'7,13').split(',').map(x=>x.trim()).filter(x=>/^\d{1,3}$/.test(x));
const cacheFile='stats-cache/nfl-team-leaders-'+year+'.json';
const existing=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile,'utf8')):{};
const all=(existing.season===year&&existing.teams&&typeof existing.teams==='object')?{...existing.teams}:{};
const metrics=[
 {metric:'Passing Yards',category:'passing',key:'passingYards'},
 {metric:'Rushing Yards',category:'rushing',key:'rushingYards'},
 {metric:'Receiving Yards',category:'receiving',key:'receivingYards'},
 {metric:'Passing Touchdowns',category:'passing',key:'passingTouchdowns'},
 {metric:'Total Tackles',category:'defensive',key:'totalTackles'},
 {metric:'Sacks',category:'defensive',key:'sacks'},
 {metric:'Interceptions',category:'defensive',key:'interceptions'}
];
async function get(url){
 const res=await fetch(url,{signal:AbortSignal.timeout(14000)});
 if(res.status===404)return null;
 if(!res.ok)throw Error('ESPN HTTP '+res.status+' '+new URL(url).pathname);
 return res.json();
}
const number=x=>typeof x==='number'?x:Number(String(x??'').replace(/,/g,''));
async function athleteStats(a,teamId){
 const url='https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/'+encodeURIComponent(a.id)+'/stats?season='+year;
 const data=await get(url);
 if(!data)return null;
 const stats={};
 for(const c of data.categories||[]){
  const names=Array.isArray(c.names)?c.names:[];
  const records=(c.statistics||[]).filter(r=>r.season?.year===year&&String(r.teamId)===teamId);
  if(!records.length)continue;
  for(const m of metrics.filter(m=>m.category===c.name)){
   const pos=names.indexOf(m.key);
   if(pos<0)continue;
   // The team and season must match exactly. Zero is valid but not a leader.
   const nums=records.map(r=>number(r.stats?.[pos])).filter(v=>Number.isFinite(v));
   if(nums.length)stats[m.metric]=Math.max(...nums);
  }
 }
 return Object.keys(stats).length?{id:String(a.id),name:a.displayName||a.fullName,headshot:a.headshot||'',stats}:null;
}
async function processTeam(teamId){
 const roster=await get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/'+teamId+'?enable=roster');
 const actual=String(roster?.team?.id||'');
 if(actual!==teamId)throw Error('ESPN wrong team roster '+teamId);
 const athletes=roster.team.athletes||[];
 let cursor=0,failed=0,missing=0;
 const records=[];
 await Promise.all(Array.from({length:9},async()=>{
  while(cursor<athletes.length){
   const i=cursor++,ath=athletes[i];
   try{
    const value=await athleteStats(ath,teamId);
    if(value)records.push(value);
    else missing++;
   }catch(error){
    failed++;console.log('PLAYER_STATS_RETRY',JSON.stringify({teamId,athleteId:ath.id,error:String(error).slice(0,140)}));
   }
  }
 }));
 if(failed>Math.max(3,Math.floor(athletes.length*0.08)))throw Error('Too many failed player statistics for team '+teamId+' ('+failed+')');
 const leaders=metrics.map(m=>{
  const eligible=records.map(p=>({...p,value:p.stats[m.metric]})).filter(x=>Number.isFinite(x.value)&&x.value>0);
  if(!eligible.length)return null;
  eligible.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
  const p=eligible[0];
  return {metric:m.metric,name:p.name,value:p.value.toLocaleString('en-US'),headshot:p.headshot};
 }).filter(Boolean);
 if(leaders.length<3)throw Error('Insufficient verified season metrics for '+teamId+' (only '+leaders.length+')');
 all[teamId]={teamId,team:roster.team.displayName,season:year,updatedAt:new Date().toISOString(),
  verifiedAthletes:records.length,rosterCount:athletes.length,statsMissing:missing,statsFailures:failed,
  leaders};
 console.log('NFL_TEAM_LEADERS_VERIFIED',JSON.stringify({teamId,name:roster.team.displayName,roster:athletes.length,
  verified:records.length,missing,failed,leaders:leaders.map(l=>({metric:l.metric,name:l.name,value:l.value}))}));
}
for(const id of ids)await processTeam(id);
fs.mkdirSync('stats-cache',{recursive:true});
fs.writeFileSync(cacheFile,JSON.stringify({season:year,generatedAt:new Date().toISOString(),
 source:'ESPN NFL 2026 regular-season athlete statistics (verified team IDs)',teams:all},null,2)+'\n');
console.log('NFL_LEADERS_READY',JSON.stringify({season:year,updatedTeams:ids.length,knownTeams:Object.keys(all).length}));
