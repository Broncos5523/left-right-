/* MAN CAVE SPORTS BOOK — football personnel helper v1.
 * ESPN does not publish a reliable six-player on-field status for college football.
 * This helper uses ESPN's current possession, box-score contributors and official
 * team roster. Roster-only selections are explicitly unverified for this game.
 * No invented stats. No changes to approved scoreboard dimensions or labels.
 */
(function(root){
'use strict';
const n=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const id=v=>String(v??'').trim();
const valid=x=>x!==null&&x!==undefined&&x!==''&&x!=='—'&&x!=='--';
function teamIds(summary){
  return (summary?.header?.competitions?.[0]?.competitors||[]).map(x=>id(x.team?.id)).filter(Boolean);
}
function possession(summary,scoreboard,eventId,previous){
  const ids=teamIds(summary);
  const game=(scoreboard?.events||[]).find(x=>id(x.id)===id(eventId));
  const situ=game?.competitions?.[0]?.situation||{};
  const poss=situ.possession;
  const current=id((typeof poss==='object'?poss?.id:poss));
  const drive=id(summary?.drives?.current?.team?.id);
  if(ids.includes(current))return {teamId:current,source:'scoreboard-situation'};
  if(ids.includes(drive))return {teamId:drive,source:'current-drive'};
  if(ids.includes(previous))return {teamId:id(previous),source:'last-confirmed'};
  return {teamId:null,source:'not-reported'};
}
function rosterItems(data,side){
  if(!Array.isArray(data?.athletes))return [];
  const group=(data.athletes||[]).find(x=>n(x.position)===n(side));
  return (group?.items||[]).filter(x=>x?.id&&x?.displayName).map(x=>({
    id:id(x.id),name:x.displayName,position:String(x.position?.abbreviation||x.position?.name||'').toUpperCase(),
    headshot:x.headshot?.href||'',raw:x
  }));
}
function rosterMap(data){
  return new Map(['offense','defense'].flatMap(g=>rosterItems(data,g)).map(x=>[x.id,x]));
}
function group(side,key){
  return (side?.statistics||[]).find(x=>n(x.name||x.title||x.type||x.displayName)===n(key));
}
function defensiveGroups(side){
  // Match the published game box score, including ESPN category/label variants.
  return (side?.statistics||[]).filter(g=>{
    const name=n(g.name||g.title||g.type||g.displayName);
    if(['defensive','defense','defensivestats','tackles'].includes(name))return true;
    const keys=(g.keys||[]).map(n),labels=(g.labels||[]).map(n);
    return keys.some(k=>['totaltackles','solotackles','tacklesforloss','passesdefended'].includes(k))||
      labels.some(k=>['tot','tkl','tack','tfl','tackles'].includes(k));
  });
}
function statFor(g,a,keys,labels=[]){
  if(!g||!a)return '—';
  const k=(g.keys||[]).map(n),l=(g.labels||[]).map(n);
  const wantedKeys=keys.map(n),wantedLabels=labels.map(n);
  const values=Array.isArray(a.stats)?a.stats:[];
  if(values.length&&typeof values[0]==='object'){
    const named=values.find(x=>wantedKeys.includes(n(x?.name))||
      wantedLabels.includes(n(x?.abbreviation||x?.shortDisplayName||x?.displayName)));
    const v=named?.displayValue??named?.value;
    if(valid(v))return String(v);
  }
  let i=k.findIndex(x=>wantedKeys.includes(x));
  if(i<0)i=l.findIndex(x=>wantedLabels.includes(x));
  const raw=i>=0?values[i]:null;
  const value=raw&&typeof raw==='object'?(raw.displayValue??raw.value):raw;
  return valid(value)?String(value):'—';
}
function contrib(side,roster){
  const known=rosterMap(roster);
  const map=new Map();
  for(const type of ['passing','rushing','receiving','defensive','interceptions']){
    const sources=type==='defensive'?defensiveGroups(side):[group(side,type)].filter(Boolean);
    for(const g of sources)for(const a of g?.athletes||[]){
      const athlete=a.athlete||{},pid=id(athlete.id);
      if(!pid||a.didNotPlay||athlete.didNotPlay)continue;
      let row=map.get(pid);
      if(!row){
        const rosterInfo=known.get(pid);
        row={id:pid,name:athlete.displayName||rosterInfo?.name||'',
          position:rosterInfo?.position||String(athlete.position?.abbreviation||'').toUpperCase(),
          headshot:athlete.headshot?.href||rosterInfo?.headshot||'',groups:{},verified:true};
        map.set(pid,row);
      }
      if(type==='defensive'){
        if(!row.groups.defensive)row.groups.defensive={g,a};
        (row.defensiveGroups||(row.defensiveGroups=[])).push({g,a});
      }else row.groups[type]={g,a};
    }
  }
  return map;
}
function has(row,type){
  const groups=type==='defensive'?(row?.defensiveGroups||[]):[row?.groups?.[type]].filter(Boolean);
  return groups.some(x=>Array.isArray(x.a?.stats)&&x.a.stats.some(v=>
    valid(v&&typeof v==='object'?(v.displayValue??v.value):v)));
}
function stat(row,type,keys,labels=[]){
  const groups=type==='defensive'?(row?.defensiveGroups||[]):[row?.groups?.[type]].filter(Boolean);
  for(const entry of groups){
    const value=statFor(entry.g,entry.a,keys,labels);
    if(value!=='—')return value;
  }
  return '—';
}
function fromRoster(x){
  return {id:x.id,name:x.name,position:x.position,headshot:x.headshot,
    groups:{},verified:false};
}
function selectOffense(side,roster){
 const contributions=contrib(side,roster),known=rosterItems(roster,'offense');
 const players=[...contributions.values()],chosen=[],taken=new Set();
 function pick(role,eligible,sorter){
   const live=players.filter(x=>!taken.has(x.id)&&eligible(x)&&
     (has(x,'passing')||has(x,'rushing')||has(x,'receiving')));
   if(sorter)live.sort(sorter);
   let chosenOne=live[0];
   if(!chosenOne){
     const base=known.find(x=>!taken.has(x.id)&&eligible(x));
     if(base)chosenOne=fromRoster(base);
   }
   if(!chosenOne)return;
   chosen.push({...chosenOne,role,side:'offense'});
   taken.add(chosenOne.id);
 }
 const positions=(x,...positions)=>positions.includes(x.position);
 // 6 skill slots: QB, RB, WR1, WR2, TE, FLEX. Game contributions first;
 // roster fallback fills unused slots but is not an on-field claim.
 pick('QB',x=>positions(x,'QB')||has(x,'passing'));
 pick('RB',x=>positions(x,'RB','FB','HB')||has(x,'rushing')&&!has(x,'passing'));
 pick('WR',x=>positions(x,'WR')||has(x,'receiving')&&!positions(x,'TE','RB','FB','HB'));
 pick('WR',x=>positions(x,'WR')||has(x,'receiving')&&!positions(x,'TE','RB','FB','HB'));
 pick('TE',x=>positions(x,'TE'));
 pick('FLEX',x=>positions(x,'WR','TE','RB','FB','HB')||has(x,'receiving')||has(x,'rushing')&&!has(x,'passing'));
 // If ESPN reports only a few contributors, preserve all 6 via roster.
 while(chosen.length<6){
   const rest=players.find(x=>!taken.has(x.id)&&(has(x,'passing')||has(x,'receiving')||has(x,'rushing')));
   const full=rest||known.find(x=>!taken.has(x.id)&&['QB','RB','WR','TE','FB','HB'].includes(x.position));
   if(!full)break;
   const entry=rest||fromRoster(full);
   chosen.push({...entry,role:entry.position||'FLEX',side:'offense'});
   taken.add(entry.id);
 }
 return chosen.slice(0,6);
}
function selectDefense(side,roster){
 const contributions=contrib(side,roster),known=rosterItems(roster,'defense');
 const players=[...contributions.values()],taken=new Set(),chosen=[];
 const roles=['EDGE','EDGE','LB','CB','CB','S'];
 function matches(role,pos){
   if(role==='EDGE')return ['EDGE','DE','LE','RE','OLB','DL','DT','NT'].includes(pos);
   if(role==='LB')return ['LB','MLB','ILB','OLB'].includes(pos);
   if(role==='CB')return ['CB','DB'].includes(pos);
   if(role==='S')return ['S','FS','SS','DB'].includes(pos);
   return false;
 }
 function defensiveRank(x){
   const val=Number(stat(x,'defensive',['totaltackles','tackles'],['tot','tkl','tack','tackles'])||0);
   return Number.isFinite(val)?val:0;
 }
 for(const role of roles){
   const eligible=players.filter(x=>!taken.has(x.id)&&matches(role,x.position));
   eligible.sort((a,b)=>defensiveRank(b)-defensiveRank(a));
   let player=eligible[0];
   if(!player){
     const fallback=known.find(x=>!taken.has(x.id)&&matches(role,x.position));
     if(fallback)player=fromRoster(fallback);
   }
   // If a position group has no roster member, take a verified defensive
   // participant rather than presenting a blank row.
   if(!player){
     const candidates=players.filter(x=>!taken.has(x.id)&&has(x,'defensive'));
     candidates.sort((a,b)=>defensiveRank(b)-defensiveRank(a));
     player=candidates[0];
   }
   if(!player){
     const fallback=known.find(x=>!taken.has(x.id));
     if(fallback)player=fromRoster(fallback);
   }
   if(!player)continue;
   chosen.push({...player,role,side:'defense'});
   taken.add(player.id);
 }
 return chosen.slice(0,6);
}
function displayStats(item){
 if(!item)return {labels:['—','—','—'],values:['—','—','—']};
 if(item.side==='defense'){
   const tackle=stat(item,'defensive',['totaltackles','tackles'],['tot','tkl','tack','tackles']);
   const sack=stat(item,'defensive',['sacks','sack'],['sack','sacks','sk']);
   const tfl=stat(item,'defensive',['tacklesforloss','tfl'],['tfl','tfls']);
   const pd=stat(item,'defensive',['passesdefended'],['pd']);
   const interception=stat(item,'interceptions',['interceptions'],['int']);
   if(item.role==='CB'||item.role==='S')return {labels:['TKL','PD','INT'],values:[tackle,pd,interception]};
   return {labels:['TKL','SACK','TFL'],values:[tackle,sack,tfl]};
 }
 if(item.role==='QB'||has(item,'passing')&&!has(item,'receiving')&&!has(item,'rushing'))
   return {labels:['YDS','C/ATT','TD'],values:[
     stat(item,'passing',['passingyards'],['yds']),
     stat(item,'passing',['completionspassingattempts','completionsattempts'],['catt','compatt']),
     stat(item,'passing',['passingtouchdowns'],['td'])]};
 const rush=has(item,'rushing'),rec=has(item,'receiving');
 if((item.role==='RB'||['RB','FB','HB'].includes(item.position))&&rush||rush&&!rec)
   return {labels:['ATT','YDS','TD'],values:[
     stat(item,'rushing',['rushingattempts'],['car','att']),
     stat(item,'rushing',['rushingyards'],['yds']),
     stat(item,'rushing',['rushingtouchdowns'],['td'])]};
 if(rec||item.role==='WR'||item.role==='TE'||item.position==='WR'||item.position==='TE')
   return {labels:['REC','YDS','TD'],values:[
     stat(item,'receiving',['receptions'],['rec']),
     stat(item,'receiving',['receivingyards'],['yds']),
     stat(item,'receiving',['receivingtouchdowns'],['td'])]};
 return {labels:['ATT','YDS','TD'],values:[
   stat(item,'rushing',['rushingattempts'],['car','att']),
   stat(item,'rushing',['rushingyards'],['yds']),
   stat(item,'rushing',['rushingtouchdowns'],['td'])]};
}
root.ManCaveFootballPersonnel={possession,rosterItems,selectOffense,selectDefense,displayStats};
})(window);
