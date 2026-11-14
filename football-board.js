/* LEFT RIGHT — NFL/CFB GAME IMPACT player tracker, development only.
 * Six players per selected team based on CURRENT GAME ESPN statistics and
 * individually credited plays. No claim of live on-field participation.
 * All approved HTML/CSS and Firebase screen assignments are unchanged.
 */
(function(){
  if(sport!=='nfl'&&sport!=='cfb')return;
  const path=sport==='nfl'?'football/nfl':'football/college-football';
  const eventId=p.get('eventId'), norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const rows=[...app.querySelectorAll('.row')],band=app.querySelector('.band'),note=app.querySelector('.note');
  const roles=['QB','RB','WR','TE','CB','S','EDGE','LB'];
  const teamCache={id:null,stamp:0,depth:null,roster:null,injuries:null};
  let impactIds=[];const impactKey='lr-football-impact-v1:'+sport+':'+eventId+':'+norm(team);
  let lastPlayId='',rbStatMode={},busy=false,receivingPbp=new Map(),usedPbpFallback=false;let observedPlayKeys=new Set();
  const creditedReceptions=new Map(); // event-scoped receipts, keyed by ESPN play ID
  const base='https://site.api.espn.com/apis/site/v2/sports/'+path+'/';
  const arr=x=>Array.isArray(x)?x:[];
  const statusText=x=>String(typeof x==='string'?x:x?.displayName||x?.name||x?.type||x?.description||x?.abbreviation||'');
  const idOf=x=>String(x?.id||x?.athlete?.id||x?.player?.id||x?.playerId||x?.athleteId||'');
  const photo=x=>{const h=x?.headshot?.href||x?.headshot;return typeof h==='string'&&/^https:\/\//.test(h)?h:''};
  const unavailable=s=>/^(out|inactive|injuredreserve|ir|suspended|pup|nonfootballinjury|nfi)$/.test(norm(s));
  const roleOf=s=>{
    const x=String(s||'').toUpperCase().replace(/[^A-Z]/g,'');
    if(x==='QB')return 'QB';if(['HB','FB','RB','TB'].includes(x))return 'RB';
    if(['WR','SE','FL','SLOT'].includes(x))return 'WR';if(['TE','H','Y'].includes(x))return 'TE';
    if(['CB','DB','NB'].includes(x))return 'CB';
    if(['FS','SS','S','SAF'].includes(x))return 'S';
    if(['DE','EDGE','ED','LE','RE'].includes(x))return 'EDGE';
    if(['LB','OLB','ILB','MLB','WLB','SLB','ROLB','LOLB'].includes(x))return 'LB';
    return '';
  };
  const positionOf=x=>x?.position?.abbreviation||x?.position?.name||x?.position?.displayName||x?.position||'';
  try{const saved=JSON.parse(localStorage.getItem(impactKey)||'[]');if(Array.isArray(saved))impactIds=saved.map(String).slice(0,6)}catch(e){}
  function rememberImpact(players){impactIds=players.map(x=>x.id);try{localStorage.setItem(impactKey,JSON.stringify(impactIds))}catch(e){}}
  async function get(url){
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok)throw Error('ESPN '+res.status);return res.json();
  }
  async function getTeamContext(teamId){
    if(teamCache.id===String(teamId)&&Date.now()-teamCache.stamp<600000)return teamCache;
    const root=base+'teams/'+encodeURIComponent(teamId);
    const responses=await Promise.allSettled([get(root+'/depthcharts'),get(root+'/roster'),get(root+'/injuries')]);
    let [depth,roster,injuries]=responses.map(x=>x.status==='fulfilled'?x.value:null);
    if(!Array.isArray(injuries?.injuries)||injuries.injuries.length===0){
      try{injuries=await get(base+'injuries')}catch(e){injuries=null}
    }
    // A missing injury report is UNKNOWN availability, not proof of good health.
    const differentTeam=teamCache.id!==String(teamId);
    if(differentTeam){teamCache.depth=null;teamCache.roster=null;teamCache.injuries=null}
    teamCache.id=String(teamId);teamCache.stamp=Date.now();
    if(depth)teamCache.depth=depth;if(roster)teamCache.roster=roster;
    if(injuries)teamCache.injuries=injuries;
    return teamCache;
  }
  function candidatePool(depth,roster,injuries,side,teamId,activeGame,eventDate){
    const map=new Map(),injuryMap=new Map(),groups=new Map();
    function upsert(a,role,rank,source){
      const athlete=a?.athlete||a?.player||a;
      if(!athlete||(!athlete.id&&!athlete.displayName))return;
      const id=String(athlete.id||norm(athlete.displayName));
      const realRole=roleOf(positionOf(athlete))||roleOf(role);
      if(!realRole)return;
      const prev=map.get(id);
      const updated={...(prev||{}),id,role:realRole,
        athlete:{...(prev?.athlete||{}),...athlete,
          headshot:photo(athlete)?athlete.headshot:(prev?.athlete?.headshot||athlete.headshot)},
        rank:Math.min(prev?.rank??99,rank??99),source:prev?.source==='depth'?'depth':source};
      map.set(id,updated);
    }
    for(const dc of arr(depth?.depthCharts||depth?.depthcharts)){
      const positions=dc?.positions||{};
      for(const [key,val] of Object.entries(positions)){
        for(const [idx,entry] of arr(val?.athletes||val?.players).entries()){
          upsert(entry,val?.position?.abbreviation||key,Number(entry.rank??entry.depth??idx+1),'depth');
        }
      }
    }
    const rosterGroups=arr(roster?.athletes||roster?.roster);
    for(const g of rosterGroups){
      if(Array.isArray(g.items))for(const a of g.items)upsert(a,positionOf(a),'99','roster');
      else upsert(g,positionOf(g),99,'roster');
    }
    function injuryEntries(root){
      const list=arr(root?.injuries||root?.items);
      return list.flatMap(g=>{
        if(Array.isArray(g?.injuries)){
          if(g?.team?.id!=null&&String(g.team.id)!==String(teamId))return [];
          return g.injuries;
        }
        return [g];
      });
    }
    for(const x of injuryEntries(injuries)){
      if(x?.team?.id!=null&&String(x.team.id)!==String(teamId))continue;
      if(x?.athlete?.team?.id!=null&&String(x.athlete.team.id)!==String(teamId))continue;
      const id=idOf(x.athlete||x),name=norm(x.athlete?.displayName);
      if(!id&&!name)continue;
      const st=statusText(x.status||x.fantasy?.status);
      const date=x.date?new Date(x.date).getTime():null;
      const game=new Date(eventDate||Date.now()).getTime();
      // Old injury reports must never remove participants from historical finals.
      const isFresh=!date||(Number.isFinite(date)&&Number.isFinite(game)&&Math.abs(game-date)<10*86400000);
      if(activeGame&&isFresh&&unavailable(st))injuryMap.set(id||name,st);
    }
    for(const [id,c] of map){
      const st=statusText(c.athlete?.status);
      if(activeGame&&(unavailable(st)||injuryMap.has(id)||injuryMap.has(norm(c.athlete.displayName))))map.delete(id);
    }
    function groupType(g){
      const n=norm(g.name||g.displayName||g.type||g.title);
      if(n.includes('passing'))return 'passing';if(n.includes('rushing'))return 'rushing';
      if(n.includes('receiving'))return 'receiving';
      if(n.includes('defensive')||n.includes('defense'))return 'defense';
      const labs=arr(g.labels).map(norm);
      if(labs.includes('rec'))return 'receiving';if(labs.includes('car'))return 'rushing';
      if(labs.includes('catt'))return 'passing';if(labs.includes('tackles')||labs.includes('tot'))return 'defense';
      return null;
    }
    for(const g of arr(side?.statistics)){
      const type=groupType(g);if(!type)continue;
      for(const a of arr(g.athletes)){
        const ath=a.athlete||a,id=idOf(ath);
        if(!id||a.didNotPlay||ath.didNotPlay)continue;
        const keys=arr(g.keys).map(norm),labels=arr(g.labels).map(norm);
        if(!groups.has(id))groups.set(id,{});
        groups.get(id)[type]={a,keys,labels};
        if(!map.has(id))upsert(ath,positionOf(ath)||(type==='passing'?'QB':type==='rushing'?'RB':type==='receiving'?'WR':'LB'),95,'boxscore');
        else upsert(ath,positionOf(ath)||map.get(id)?.role,99,'boxscore');
      }
    }
    return [...map.values()].map(c=>({...c,groups:groups.get(c.id)||{}}));
  }

  // ESPN frequently names the receiver in the human-readable play text even
  // when a play's structured participants array is completely absent.
  // Never mistake this for a full 11-person snap feed.
  function uniquePlays(data){
    const raw=[];
    if(Array.isArray(data.plays))raw.push(...data.plays);
    else raw.push(...arr(data.plays?.all));
    for(const d of arr(data.drives?.previous))raw.push(...arr(d.plays));
    raw.push(...arr(data.drives?.current?.plays));
    const seen=new Set();
    return raw.filter(x=>{
      const key=String(x?.period?.number||'')+'|'+String(x?.clock?.displayValue||'')+
        '|'+String(x?.team?.id||x?.teamId||'')+'|'+String(x?.text||x?.id||'');
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }
  function receiverMention(play){
    const text=String(play?.text||'');
    if(!/\bpass\s+complete\b/i.test(text)||/\bpass\s+incomplete\b|\bintercepted\b/i.test(text))return null;
    const m=text.match(/\bpass\s+complete\b[\s\S]{0,130}?\bto\s+(?:#(\d{1,3})\s+)?(.+?)(?=\s+(?:caught\b|for\b|at\b|out\b|tackled\b|pushed\b|touchdown\b)|[,;()]|$)/i);
    if(!m)return null;
    const name=String(m[2]||'').replace(/\s+/g,' ').trim();
    if(!name||name.length>65)return null;
    const explicit=Number.isFinite(Number(play?.statYardage))&&play.statYardage!==null&&play.statYardage!==''
      ?Number(play.statYardage):null;
    const yardsAfterCatch=text.match(/\bcaught\b[\s\S]{0,110}?\bfor\s+(-?\d+)\s+yards?\b/i);
    const yardsFromDescription=text.match(/\bfor\s+(-?\d+)\s+yards?\b/i);
    const yards=explicit??(yardsAfterCatch?Number(yardsAfterCatch[1]):yardsFromDescription?Number(yardsFromDescription[1]):null);
    return {name,jersey:m[1]||'',yards,td:/\btouchdown\b/i.test(text)};
  }
  function matchMention(mention,pool,roles=['QB','RB','WR','TE']){
    if(!mention)return null;
    const target=norm(mention.name);
    const wantedLast=norm(mention.name.replace(/^\s*[A-Z]\.?\s*/i,''));
    const firstLetter=(mention.name.match(/^\s*([A-Za-z])\./)||[])[1]?.toLowerCase()||'';
    const eligible=pool.filter(c=>{
      if(!roles.includes(c.role))return false;
      const a=c.athlete||{};
      const jersey=String(a.jersey??a.uniformNumber??a.number??'').replace(/^0+(?=\d)/,'');
      if(mention.jersey&&jersey&&jersey!==mention.jersey.replace(/^0+(?=\d)/,''))return false;
      const fullname=String(a.displayName||a.fullName||'');
      const last=norm(a.lastName||fullname.trim().split(/\s+/).at(-1)||'');
      const first=String(a.firstName||fullname.trim().split(/\s+/)[0]||'').slice(0,1).toLowerCase();
      const nameCompatible=target===norm(fullname)||
        (Boolean(firstLetter)&&last===wantedLast&&first===firstLetter)||
        (Boolean(last)&&target.endsWith(last)&&(!firstLetter||first===firstLetter));
      return nameCompatible;
    });
    return eligible.length===1?eligible[0]:null;
  }

  // These credits identify only players *named* in one play, not everyone who
  // took the snap. For unusual/ambiguous descriptions, return no inferred ID.
  function leadingActor(play){
    const text=String(play?.text||'');
    const m=text.match(/#(\d{1,3})\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2}?)\s+(pass(?:es|ed)?|rush(?:es|ed)?|ran|scrambl(?:es|ed|ing)|sack(?:ed)?)(?=\s|$)/i);
    if(!m)return null;
    const verb=m[3].toLowerCase();
    const kind=/^pass/.test(verb)?'passer':/^sack/.test(verb)?'sack':/^scrambl/.test(verb)?'rusher':'rusher';
    return {kind,name:m[2].trim(),jersey:m[1]};
  }
  function tackleMentions(play){
    const text=String(play?.text||'');
    const out=[];
    for(const m of text.matchAll(/\(#(\d{1,3})\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})\)/g)){
      out.push({kind:'tackler',name:m[2].trim(),jersey:m[1]});
    }
    return out;
  }
  function creditedActors(play,pool,mode){
    if(!play)return [];
    const mentions=mode==='offense'?
      [leadingActor(play),receiverMention(play)&&{...receiverMention(play),kind:'receiver'}].filter(Boolean):
      tackleMentions(play);
    const credited=[];
    const used=new Set();
    for(const mention of mentions){
      const roles=mention.kind==='passer'?['QB']:
        mention.kind==='receiver'?['RB','WR','TE']:
        mention.kind==='tackler'?['CB','S','EDGE','LB']:['QB','RB','WR'];
      const athlete=matchMention(mention,pool,roles);
      if(!athlete||used.has(athlete.id))continue;
      used.add(athlete.id);
      credited.push({id:athlete.id,role:athlete.role,kind:mention.kind});
    }
    return credited;
  }
  function receivingFromPlays(data,pool,teamId){
    for(const play of uniquePlays(data)){
      const teamOfPlay=String(play?.team?.id||play?.teamId||play?.start?.team?.id||'');
      if(teamOfPlay&&teamOfPlay!==String(teamId))continue;
      const mention=receiverMention(play);
      const athlete=matchMention(mention,pool);
      if(!athlete)continue;
      const key=String(play?.id||play?.playId||play?.sequenceNumber||
        String(play?.period?.number||'')+'|'+String(play?.clock?.displayValue||'')+
        '|'+String(play?.text||''));
      const old=creditedReceptions.get(key);
      if(old&&old.id!==athlete.id)continue; // refuse disputed attribution
      // A corrected ESPN play can supply yardage missed in an earlier sample.
      creditedReceptions.set(key,{
        id:athlete.id,player:athlete,
        yards:mention.yards!==null?mention.yards:(old?.yards??null),
        td:mention.td||(old?.td||false)
      });
    }
    const totals=new Map();
    for(const receipt of creditedReceptions.values()){
      const prior=totals.get(receipt.id)||{
        rec:0,yards:0,knownYards:0,unknownYards:0,td:0,player:receipt.player
      };
      prior.rec++;
      if(receipt.yards!==null){prior.yards+=receipt.yards;prior.knownYards++}
      else prior.unknownYards++;
      if(receipt.td)prior.td++;
      totals.set(receipt.id,prior);
    }
    return totals;
  }
  function recoveredRecStats(c){
    const raw=[
      pickStat(c,'receiving',['receptions'],['rec']),
      pickStat(c,'receiving',['receivingyards'],['yds','recyds']),
      pickStat(c,'receiving',['receivingtouchdowns'],['td'])
    ];
    const derived=receivingPbp.get(c.id);
    const rawCount=raw[0]!=='—'&&Number.isFinite(Number(raw[0]))?Number(raw[0]):null;
    if(!derived||derived.rec<1||rawCount!==null&&rawCount>=derived.rec)
      return raw;
    // One or more named receptions are in ESPN's play log but not in its
    // receiving box score yet. Display provisional play-text totals and mark
    // the source explicitly. Never fabricate an unobserved touchdown or yard.
    usedPbpFallback=true;
    return [
      String(derived.rec),
      derived.unknownYards===0?String(derived.yards):'—',
      derived.td>0?String(Math.max(derived.td,Number(raw[2])||0)):(raw[2]!=='—'&&Number.isFinite(Number(raw[2]))?raw[2]:'—')
    ];
  }
  function pickStat(c,type,keys,labels){
    const g=c?.groups?.[type];if(!g)return '—';
    const candidates=arr(g.a?.stats);
    // ESPN has both ordered scalar groups and named stat-object variants.
    if(candidates.length&&typeof candidates[0]==='object'){
      const named=candidates.find(x=>keys.includes(norm(x?.name))||labels.includes(norm(x?.abbreviation||x?.shortDisplayName)));
      const value=named?.displayValue??named?.value;
      if(value!==null&&value!==undefined&&value!=='')return value;
    }
    let n=g.keys.findIndex(k=>keys.includes(k));
    if(n<0)n=g.labels.findIndex(k=>labels.includes(k));
    const v=n>=0?g.a.stats?.[n]:null;
    return v===null||v===undefined||v===''?'—':v;
  }
  function statsFor(c){
    const role=c.role;
    if(role==='QB')return {labels:['YDS','C/ATT','TD'],values:[
      pickStat(c,'passing',['passingyards'],['yds','passyds']),
      pickStat(c,'passing',['completionspassingattempts','completionsattempts'],['catt','compatt','cmpatt']),
      pickStat(c,'passing',['passingtouchdowns'],['td'])]};
    if(role==='RB'){
      const type=rbStatMode[c.id]==='receiving'?'receiving':'rushing';
      return type==='receiving'?{labels:['REC','YDS','TD'],values:recoveredRecStats(c)}:
        {labels:['ATT','YDS','TD'],values:[
        pickStat(c,'rushing',['rushingattempts'],['car','att','rushatt']),
        pickStat(c,'rushing',['rushingyards'],['yds','rushyds']),
        pickStat(c,'rushing',['rushingtouchdowns'],['td'])]};
    }
    if(role==='WR'||role==='TE')return {labels:['REC','YDS','TD'],values:recoveredRecStats(c)};
    const def=(keys,labels)=>pickStat(c,'defense',keys,labels);
    if(role==='EDGE')return {labels:['SACK','QB HIT','TFL'],values:[
      def(['sacks'],['sack','sacks']),def(['quarterbackhits','qbhits'],['qbht','qbhit']),def(['tacklesforloss'],['tfl'])]};
    if(role==='LB')return {labels:['TACK','TFL','SACK'],values:[
      def(['totaltackles','tackles'],['tot','tack','tackles']),def(['tacklesforloss'],['tfl']),def(['sacks'],['sack','sacks'])]};
    return {labels:['TACK','PD','INT'],values:[
      def(['totaltackles','tackles'],['tot','tack','tackles']),def(['passesdefended','passesdefensed'],['pd','pdef']),def(['interceptions'],['int'])]};
  }
  function recentPlay(data){
    const plays=[];
    const direct=data.plays?.all||data.plays;
    if(Array.isArray(direct))plays.push(...direct);
    for(const d of arr(data.drives?.previous))plays.push(...arr(d.plays));
    if(data.drives?.current)plays.push(...arr(data.drives.current.plays));
    for(let i=plays.length-1;i>=0;i--){
      const x=plays[i],label=String(x.type?.text||x.playType?.text||x.type?.displayName||x.text||'');
      if(/kickoff|punt|extra point|two.point|field goal|timeout|end of|penalty|coin toss/i.test(label))continue;
      if(/pass|rush|ran |run |sack|scramble|interception|fumble/i.test(label))return x;
    }
    return null;
  }
  function playIds(play){
    const found=new Set();
    for(const v of arr(play?.participants||play?.athletes||play?.players)){
      const id=idOf(v?.athlete||v?.player||v);
      if(id)found.add(id);
    }
    return found;
  }

  // All impact scoring uses only the SELECTED GAME's box score and its play
  // descriptions. ESPN group statistics can be strings or occasionally absent.
  function amount(v){
    if(v===null||v===undefined||v==='—'||v==='')return 0;
    const s=String(v).replace(/,/g,'').trim();
    return /^-?\d+(?:\.\d+)?$/.test(s)?Math.max(0,Number(s)):0;
  }
  function stat(c,type,keys,labels){
    return amount(pickStat(c,type,keys,labels));
  }
  function gameImpact(c,creditCount){
    const role=c.role;const passing=stat(c,'passing',['passingyards'],['yds','passyds']);
    const passingTd=stat(c,'passing',['passingtouchdowns'],['td']);
    const rushY=stat(c,'rushing',['rushingyards'],['yds','rushyds']);
    const rushA=stat(c,'rushing',['rushingattempts'],['car','att','rushatt']);
    const rushTd=stat(c,'rushing',['rushingtouchdowns'],['td']);
    const receiving=receivingPbp.get(c.id);
    const boxRec=stat(c,'receiving',['receptions'],['rec']);
    const rec=Math.max(boxRec,receiving?.rec||0);
    const boxY=stat(c,'receiving',['receivingyards'],['yds','recyds']);
    const recvY=Math.max(boxY,receiving?.unknownYards?0:receiving?.yards||0);
    const recTd=Math.max(stat(c,'receiving',['receivingtouchdowns'],['td']),receiving?.td||0);
    const t=stat(c,'defense',['totaltackles','tackles'],['tot','tack','tackles']);
    const tfl=stat(c,'defense',['tacklesforloss'],['tfl']);
    const sacks=stat(c,'defense',['sacks'],['sack','sacks']);
    const pd=stat(c,'defense',['passesdefended','passesdefensed'],['pd','pdef']);
    const ints=stat(c,'defense',['interceptions'],['int']);
    const ff=stat(c,'defense',['forcedfumbles'],['ff']);
    let score=0,kind='offense';
    if(role==='QB'){
      score=passing/25+passingTd*5+rushY/20+rushTd*6;
    }else if(role==='RB'){
      score=rushY/12+rushA*.24+rushTd*7+rec*1.5+recvY/14+recTd*7;
    }else if(role==='WR'||role==='TE'){
      score=rec*1.6+recvY/13+recTd*7;
    }else if(['CB','S','EDGE','LB'].includes(role)){
      kind='defense';
      score=t*1.1+tfl*2.5+sacks*6+pd*2+ints*8+ff*5;
    }else return null;
    const boxes=Object.values(c.groups||{});
    const boxPresent=boxes.some(x=>arr(x?.a?.stats).some(v=>v!==''&&v!==null&&v!==undefined&&v!=='—'));
    const credits=creditCount.get(c.id)||0;
    // Rows in ESPN's game box score are eligible even before a counting stat;
    // a roster/depth-chart entry alone is NOT a game participant.
    if(!boxPresent&&credits===0)return null;
    score+=Math.min(credits,5)*1.25;
    if(score===0&&boxPresent)score=.15;
    return {c,id:c.id,kind,score,credits};
  }
  function impactCredits(data,pool,teamId){
    const credits=new Map(),plays=uniquePlays(data);
    const selected=plays.slice(-30);
    for(const play of selected){
      const offenseId=String(play?.team?.id||play?.teamId||play?.start?.team?.id||'');
      const same=offenseId===String(teamId);
      if(!offenseId)continue; // no safe attribution for a team-less play
      const actors=creditedActors(play,pool,same?'offense':'defense');
      for(const actor of actors){
        const prior=credits.get(actor.id)||0;
        // Count individual credited involvement, not complete participation.
        credits.set(actor.id,prior+1);
      }
    }
    return credits;
  }
  function selectImpact(pool,data,teamId,state){
    const counts=impactCredits(data,pool,teamId);
    const scored=pool.map(c=>gameImpact(c,counts)).filter(Boolean)
      .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const rosterMap=new Map(scored.map(x=>[x.id,x]));
    if(state==='post'&&impactIds.length){
      const held=impactIds.map(id=>rosterMap.get(id)).filter(Boolean);
      // Preserve the last displayed game group at final when still available.
      if(held.length>=3)return {players:held.map(x=>x.c).slice(0,6),ranking:scored,source:'final-hold'};
    }
    // Keep balanced broadcast interest: 3 offense + 2 defense where available;
    // sixth slot goes to the highest remaining contributor in either category.
    let picked=[];
    const add=x=>{if(x&&!picked.some(a=>a.id===x.id)&&picked.length<6)picked.push(x)};
    const offense=scored.filter(x=>x.kind==='offense');
    const defense=scored.filter(x=>x.kind==='defense');
    for(const x of offense.slice(0,3))add(x);
    for(const x of defense.slice(0,2))add(x);
    for(const x of scored)add(x);
    // Stability: do not replace existing game contributors for tiny score leads.
    const prior=impactIds.map(id=>rosterMap.get(id)).filter(Boolean);
    if(prior.length&&picked.length===6){
      const used=new Set(picked.map(x=>x.id));
      for(const old of prior){
        if(used.has(old.id))continue;
        const sameKind=picked.filter(x=>x.kind===old.kind);
        const weakest=sameKind.sort((a,b)=>a.score-b.score)[0];
        if(weakest&&weakest.score-old.score<2.3){
          const idx=picked.findIndex(x=>x.id===weakest.id);
          if(idx>=0){used.delete(weakest.id);picked[idx]=old;used.add(old.id)}
        }
      }
    }
    // Keep familiar portrait positions stable as players change.
    const pickMap=new Map(picked.map(x=>[x.id,x]));
    const ordered=impactIds.map(id=>pickMap.get(id)).filter(Boolean);
    for(const x of picked)if(!ordered.some(y=>y.id===x.id))ordered.push(x);
    return {players:ordered.map(x=>x.c).slice(0,6),ranking:scored,source:'game-stats'};
  }
  function renderRow(row,c){
    const face=row.querySelector('.portrait'),name=row.querySelector('.player');
    const keys=[...row.querySelectorAll('.stats small')],vals=[...row.querySelectorAll('.stats b')];
    if(!c){face.textContent='—';name.textContent='PLAYER DATA UNAVAILABLE';keys.forEach(x=>x.textContent='—');vals.forEach(x=>x.textContent='—');return}
    name.textContent=c.athlete.displayName||'PLAYER';name.style.fontSize=name.textContent.length>17?'clamp(11px,2.6vw,16px)':'';
    const src=photo(c.athlete);face.textContent='';
    if(src){const img=document.createElement('img');img.src=src;img.alt='';
      img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
      img.onerror=()=>{face.textContent='HEADSHOT UNAVAILABLE'};face.appendChild(img);
    }else face.textContent='HEADSHOT UNAVAILABLE';
    const s=statsFor(c);
    keys.forEach((x,i)=>x.textContent=s.labels[i]||'—');
    vals.forEach((x,i)=>x.textContent=s.values[i]??'—');
  }
  async function update(){
    if(!eventId){band.textContent='AWAITING GAME';note.textContent='Select an actual football game from LEFT RIGHT.';return}
    if(busy)return;busy=true;
    try{
      const data=await get(base+'summary?event='+encodeURIComponent(eventId));
      const competition=data.header?.competitions?.[0]||{};
      const competitors=arr(competition.competitors);
      const match=competitors.find(x=>norm(x.team?.displayName)===norm(team)||norm(x.team?.name)===norm(team));
      if(!match)throw Error('Selected event does not contain this team');
      setHeader(match);setScore(match.score??'—');
      const logo=app.querySelector('.logo');
      const src=match.team?.logo||match.team?.logos?.[0]?.href;
      if(src){logo.src=src;logo.hidden=false}
      const rec=match.record||match.records||[];
      app.querySelector('.team-record').textContent=Array.isArray(rec)?(rec.find(x=>x.type==='total')||rec[0])?.summary||'':rec.summary||'';
      if(sport==='cfb')setRank(match.curatedRank?.current??match.team?.rank??match.rank);
      const tid=match.team?.id;
      if(!tid)throw Error('Game team ID unavailable');
      const state=competition.status?.type?.state||data.header?.competitions?.[0]?.status?.type?.state||'pre';
      const context=await getTeamContext(tid);
      const side=arr(data.boxscore?.players).find(x=>String(x.team?.id)===String(tid)||norm(x.team?.displayName)===norm(team));
      const pool=candidatePool(context.depth,context.roster,context.injuries,side,tid,false,data.header?.competitions?.[0]?.date||data.header?.competitions?.[0]?.startDate);
      const play=recentPlay(data);
      receivingPbp=receivingFromPlays(data,pool,tid);
      // Prefer a RB's latest individually credited action for stat format.
      if(play){
        const playTeam=String(play?.team?.id||play?.teamId||play?.start?.team?.id||'');
        if(playTeam===String(tid)){
          const c=creditedActors(play,pool,'offense');
          for(const x of c){
            if(x.role!=='RB')continue;
            if(x.kind==='receiver')rbStatMode[x.id]='receiving';
            if(x.kind==='rusher')rbStatMode[x.id]='rushing';
          }
        }
      }
      const selection=selectImpact(pool,data,tid,state);
      const shown=selection.players;
      if(shown.length===0&&rows.some(row=>!!row.querySelector('.player')?.textContent&&!/UNAVAILABLE|PENDING|PLAYER DATA/.test(row.querySelector('.player').textContent))){
        band.textContent='GAME DATA DELAYED';
        note.textContent='Holding the previous game contributors while ESPN stats are unavailable.';
        return;
      }
      if(shown.length)rememberImpact(shown);
      usedPbpFallback=false;
      rows.forEach((row,i)=>renderRow(row,shown[i]));
      band.textContent='GAME IMPACT PLAYERS';
      const missing=Math.max(0,6-shown.length);
      note.textContent='Six key contributors selected from this game’s box score and individually credited plays, not live on-field personnel. '+
        (selection.source==='final-hold'?'Final game group held. ':'')+
        (usedPbpFallback?'Receiving totals provisionally recovered from named plays; official totals take priority. ':'')+
        (missing?missing+' slots still awaiting game-participant data. ':'')+
        'Player roles and headshots may be unavailable or delayed.';
    }catch(e){
      band.textContent='PERSONNEL FEED RETRYING';
      note.textContent='Football personnel update unavailable: '+e.message+'. Previously received player data is retained where possible.';
    }finally{busy=false}
  }
  update();setInterval(update,30000);
})();