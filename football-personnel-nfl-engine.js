/* LEFT RIGHT NFL dedicated six-slot player selection — preview only.
 * Preserve approved six-row layout and display current game statistics.
 * Protected QB, rush leader, receiving leader, 2 EDGE; other roles change ONLY
 * when a new eligible credited play appears; no time-based rotation or duplicates.
 * Mode switches on current possession when positively identified.
 */
(function(){
  if(sport!=='nfl')return;
  const path='football/nfl';
  const eventId=p.get('eventId'), norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const rows=[...app.querySelectorAll('.row')],band=app.querySelector('.band'),note=app.querySelector('.note');
  const roles=['QB','RB','WR','TE','CB','S','DB','EDGE','DL','LB'];
  const teamCache={id:null,stamp:0,depth:null,roster:null};
  const stateKey='lr-six-slot-nfl-v2:'+eventId+':'+norm(team);
  let slotState={offense:[null,null,null,null,null,null],defense:[null,null,null,null,null,null],
    processed:[],lastMode:'offense',lastActionByRB:{},lastDbSlot:5};
  try{
    const prev=JSON.parse(localStorage.getItem(stateKey)||'null');
    if(prev&&Array.isArray(prev.offense)&&Array.isArray(prev.defense)){
      slotState={...slotState,...prev,offense:prev.offense.slice(0,6),defense:prev.defense.slice(0,6),
        processed:Array.isArray(prev.processed)?prev.processed.slice(-500):[],
        lastActionByRB:prev.lastActionByRB||{}};
    }
  }catch(e){}
  function persistSlots(){try{localStorage.setItem(stateKey,JSON.stringify(slotState))}catch(e){}}
  let lastPlayId='',rbStatMode={},busy=false,receivingPbp=new Map(),rushingPbp=new Map(),usedPbpFallback=false;
  const creditedReceptions=new Map(); // event-scoped receipts, keyed by ESPN play ID
  const creditedRushes=new Map(); // event-scoped rushing receipts (same dedupe and retention policy)
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
    if(['CB','NB'].includes(x))return 'CB';if(x==='DB')return 'DB';
    if(['FS','SS','S','SAF'].includes(x))return 'S';
    if(['DE','EDGE','ED','LE','RE','LDE','RDE'].includes(x))return 'EDGE';
    if(['DT','NT','DL','NOSE','NG','TACKLE'].includes(x))return 'DL';
    if(['LB','OLB','ILB','MLB','WLB','SLB','ROLB','LOLB'].includes(x))return 'LB';
    return '';
  };
  const positionOf=x=>x?.position?.abbreviation||x?.position?.name||x?.position?.displayName||x?.position||'';

  async function get(url){
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok)throw Error('ESPN '+res.status);return res.json();
  }
  async function getTeamContext(teamId){
    if(teamCache.id===String(teamId)&&Date.now()-teamCache.stamp<600000)return teamCache;
    const root=base+'teams/'+encodeURIComponent(teamId);
    const responses=await Promise.allSettled([get(root+'/depthcharts'),get(root+'/roster')]);
    const [depth,roster]=responses.map(x=>x.status==='fulfilled'?x.value:null);
    if(teamCache.id!==String(teamId)){teamCache.depth=null;teamCache.roster=null}
    teamCache.id=String(teamId);teamCache.stamp=Date.now();
    if(depth)teamCache.depth=depth;
    if(roster)teamCache.roster=roster;
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
    for(const dc of arr(depth?.depthCharts||depth?.depthcharts||depth?.depthchart)){
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
      if(seen.has(key)||/\bNo Play\b/i.test(String(x?.text||''))||String(x?.type?.text||'')==='Penalty')return false;
      seen.add(key);return true;
    });
  }
  // NFL completed passes name the receiver without a jersey #, e.g.
  // "B.Nix pass short right to E.Engram to CAR 19 for 19 yards".
  function receiverMention(play){
    const text=String(play?.text||''),type=String(play?.type?.text||'');
    if(!/^(Pass Reception|Passing Touchdown)$/i.test(type)||
      /\bNo Play\b|\bintercepted\b|\bpass incomplete\b|\bintended for\b/i.test(text))return null;
    const m=text.match(/\bpass\b[\s\S]{0,75}?\bto\s+([A-Z](?:\.[A-Z])*\.[A-Za-z][A-Za-z'-]*(?:\s+(?:Jr\.?|II|III|IV))?)(?=\s|[,;.]|$)/i);
    if(!m)return null;
    const numeric=text.match(/\bfor\s+(-?\d+)\s+yards?\b/i);
    const raw=play?.statYardage!==undefined&&play?.statYardage!==null&&play?.statYardage!==''?
      Number(play.statYardage):null;
    const yards=Number.isFinite(raw)?raw:numeric?Number(numeric[1]):/\bno gain\b/i.test(text)?0:null;
    return {name:m[1],jersey:'',yards,td:/\btouchdown\b/i.test(text)};
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
      const last=norm(String(a.lastName||fullname.trim().split(/\s+/).at(-1)||'').replace(/\s+(?:Jr\.?|Sr\.?|II|III|IV)$/i,''));
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
    const text=String(play?.text||''),type=String(play?.type?.text||'');
    if(/\bNo Play\b/i.test(text)||type==='Penalty')return null;
    if(/^(Pass Reception|Pass Incompletion|Passing Touchdown|Pass Interception Return)$/i.test(type)){
      const m=text.match(/\b([A-Z](?:\.[A-Z])*\.[A-Za-z][A-Za-z'-]*)\s+pass\b/i);
      return m?{kind:'passer',name:m[1],jersey:''}:null;
    }
    if(/^(Rush|Rushing Touchdown)$/i.test(type)){
      const m=text.match(/\b([A-Z](?:\.[A-Z])*\.[A-Za-z][A-Za-z'-]*)\s+(?:(?:up\s+the\s+middle)|left|right|scrambles?|kneels?|rushes?)(?=\s|$)/i);
      return m?{kind:'rusher',name:m[1],jersey:''}:null;
    }
    return null;
  }
  function tackleMentions(play){
    const text=String(play?.text||''),type=String(play?.type?.text||'');
    if(/\bNo Play\b/i.test(text)||type==='Penalty')return [];
    const out=[],seen=new Set();
    function add(token){
      const m=String(token||'').trim().match(/^([A-Z](?:\.[A-Z])*\.[A-Za-z][A-Za-z'-]*(?:\s+(?:Jr\.?|II|III|IV))?)$/i);
      if(!m)return;
      const key=norm(m[1]);if(seen.has(key))return;seen.add(key);
      out.push({kind:'tackler',name:m[1],jersey:''});
    }
    // NFL credits normally live in parentheses, often semicolon-separated.
    for(const group of text.matchAll(/\(([^()]{1,150})\)/g)){
      let inside=String(group[1]||'').trim();
      if(/^sack\s+split\s+by\s+/i.test(inside))
        inside=inside.replace(/^sack\s+split\s+by\s+/i,'');
      for(const item of inside.split(/\s*;\s*|\s+and\s+/i))add(item);
    }
    // Interceptions and some recoveries credit the defender in free text.
    for(const m of text.matchAll(/\b(?:intercepted|sacked|broken\s+up|tackled|recovered)\s+by\s+([A-Z](?:\.[A-Z])*\.[A-Za-z][A-Za-z'-]*)/gi))add(m[1]);
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
        mention.kind==='tackler'?['CB','S','DB','EDGE','DL','LB']:['QB','RB','WR'];
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
  function statsFor(c,slot){
    const role=c.role;
    if(role==='QB')return {labels:['YDS','C/ATT','TD'],values:[
      pickStat(c,'passing',['passingyards'],['yds','passyds']),
      pickStat(c,'passing',['completionspassingattempts','completionsattempts'],['catt','compatt','cmpatt']),
      pickStat(c,'passing',['passingtouchdowns'],['td'])]};
    if(role==='RB'){
      const type=slot==='rushLeader'?'rushing':rbStatMode[c.id]==='receiving'?'receiving':'rushing';
      return type==='receiving'?{labels:['REC','YDS','TD'],values:recoveredRecStats(c)}:
        {labels:['ATT','YDS','TD'],values:recoveredRushStats(c)};
    }
    if(role==='WR'||role==='TE')return {labels:['REC','YDS','TD'],values:recoveredRecStats(c)};
    const def=(keys,labels)=>pickStat(c,'defense',keys,labels);
    if(role==='EDGE'||role==='DL')return {labels:['TACK','SACK','TFL'],values:[
      def(['totaltackles','tackles'],['tot','tack','tackles']),def(['sacks'],['sack','sacks']),def(['tacklesforloss'],['tfl'])]};
    if(role==='LB')return {labels:['TACK','TFL','SACK'],values:[
      def(['totaltackles','tackles'],['tot','tack','tackles']),def(['tacklesforloss'],['tfl']),def(['sacks'],['sack','sacks'])]};
    return {labels:['TACK','PD','INT'],values:[
      def(['totaltackles','tackles'],['tot','tack','tackles']),def(['passesdefended','passesdefensed'],['pd','pdef']),
      (def(['interceptions'],['int'])!=='—'?def(['interceptions'],['int']):pickStat(c,'interceptions',['interceptions'],['int']))]};
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

  // Position eligibility is strict for WR/TE/DB, with OLB as an EDGE fallback
  // for 3-4 defensive alignments and DE as an unused DL fallback if needed.
  function amount(v){if(v===null||v===undefined||v==='—'||v==='')return 0;
    const t=String(v).replace(/,/g,'').trim();return /^-?\d+(?:\.\d+)?$/.test(t)?Math.max(0,Number(t)):0}
  function stat(c,type,keys,labels){return amount(pickStat(c,type,keys,labels))}
  const SLOT_ROLES={
    offense:['QB','RB','RB','WR','WR','TE'],
    defense:['EDGE','EDGE','LB','DL','S','CB']
  };
  function pos(c){
    return String(positionOf(c?.athlete)||'').toUpperCase().replace(/[^A-Z]/g,'');
  }
  function roleFits(c,mode,index,relaxed=false){
    if(!c)return false;
    const target=SLOT_ROLES[mode][index],position=pos(c);
    // Generic DL is the final EDGE display fallback when ESPN lacks a specific
    // EDGE/DE/RE/LE. Display role is not evidence of actual edge alignment.
    if(target==='EDGE')return c.role==='EDGE'||(relaxed&&(c.role==='DL'||c.role==='LB'&&/^(OLB|LOLB|ROLB)$/.test(position)));
    if(target==='DL')return c.role==='DL'||(relaxed&&c.role==='EDGE');
    if(target==='LB')return c.role==='LB';
    if((target==='S'||target==='CB')&&c.role==='DB')return relaxed;
    return c.role===target;
  }
  function playerPriority(a,b){return (a.rank??99)-(b.rank??99)||a.id.localeCompare(b.id)}
  function eligible(pool,mode,index,used){
    const available=pool.filter(c=>!used.has(c.id)&&roleFits(c,mode,index));
    if(available.length)return available.sort(playerPriority);
    if(mode==='defense'&&(index===0||index===1)){
      // Prefer exact EDGE/DE/RE/LE, then verified roster DL candidates when
      // a source cannot distinguish ends. Anchors remain static after selection.
      const dl=pool.filter(c=>c.role==='DL'&&!used.has(c.id));
      if(dl.length)return dl.sort((a,b)=>{
        const aBox=a.groups?.defense?1:0,bBox=b.groups?.defense?1:0;
        const impact=c=>stat(c,'defense',['totaltackles','tackles'],['tot','tack','tackles'])+
          3*stat(c,'defense',['sacks'],['sack','sacks'])+
          2*stat(c,'defense',['tacklesforloss'],['tfl']);
        return bBox-aBox||impact(b)-impact(a)||playerPriority(a,b);
      });
      return pool.filter(c=>!used.has(c.id)&&c.role==='LB'&&
        /^(OLB|LOLB|ROLB)$/.test(pos(c))).sort(playerPriority);
    }
    if(mode==='defense'&&(index===3||index===4||index===5)){
      return pool.filter(c=>!used.has(c.id)&&roleFits(c,mode,index,true)).sort(playerPriority);
    }
    return [];
  }
  function rushLeader(pool){
    const all=pool.filter(c=>c.role==='RB').sort(playerPriority);
    if(!all.length)return null;
    const ranking=all.map(c=>{
      const raw=stat(c,'rushing',['rushingyards'],['yds','rushyds']);
      const fromPlay=rushingPbp.get(c.id)||{yards:0,attempts:0};
      const yards=Math.max(raw,fromPlay.yards||0);
      const attempts=Math.max(stat(c,'rushing',['rushingattempts'],['car','att']),fromPlay.attempts);
      return {c,yards,attempts};
    }).sort((a,b)=>b.yards-a.yards||b.attempts-a.attempts||playerPriority(a.c,b.c));
    const hadAction=ranking.some(x=>x.yards>0||x.attempts>0);
    return (hadAction?ranking[0].c:all[0]);
  }
  function receptionLeader(pool){
    const all=pool.filter(c=>c.role==='WR').sort(playerPriority);
    if(!all.length)return null;
    const ranking=all.map(c=>{
      const pbp=receivingPbp.get(c.id);
      const yards=Math.max(stat(c,'receiving',['receivingyards'],['yds','recyds']),pbp?.knownYards&&pbp.unknownYards===0?pbp.yards:0);
      const rec=Math.max(stat(c,'receiving',['receptions'],['rec']),pbp?.rec||0);
      return {c,yards,rec};
    }).sort((a,b)=>b.yards-a.yards||b.rec-a.rec||playerPriority(a.c,b.c));
    return ranking.some(x=>x.yards>0||x.rec>0)?ranking[0].c:all[0];
  }
  function playKey(play){
    return String(play?.id||play?.playId||play?.sequenceNumber||
      [play?.period?.number,play?.clock?.displayValue,play?.team?.id,play?.text].join('|'));
  }
  function orderedPlays(data){
    const indexed=uniquePlays(data).map((play,i)=>({play,i}));
    // Complete ESPN game logs normally arrive chronologically. Sort when
    // explicit quarter and clock are available to correct drive-order overlap.
    indexed.sort((a,b)=>{
      const pa=Number(a.play?.period?.number),pb=Number(b.play?.period?.number);
      if(Number.isFinite(pa)&&Number.isFinite(pb)&&pa&&pb&&pa!==pb)return pa-pb;
      const seconds=x=>{const m=String(x?.clock?.displayValue||'').match(/^(\d{1,2}):(\d{2})$/);
        return m?Number(m[1])*60+Number(m[2]):null};
      const sa=seconds(a.play),sb=seconds(b.play);
      if(pa&&pa===pb&&sa!==null&&sb!==null&&sa!==sb)return sb-sa;
      return a.i-b.i;
    });
    return indexed.map(x=>x.play);
  }
  function rushingFromPlays(data,pool,teamId){
    // Retain previously verified rushing plays when ESPN sends a partial log.
    for(const play of orderedPlays(data)){
      if(String(play?.team?.id||play?.teamId||play?.start?.team?.id||'')!==String(teamId))continue;
      const actor=creditedActors(play,pool,'offense').find(x=>x.kind==='rusher'&&x.role==='RB');
      if(!actor)continue;
      const key=playKey(play),previous=creditedRushes.get(key);
      if(previous&&previous.id!==actor.id)continue;
      const text=String(play?.text||'');
      const m=text.match(/\bfor\s+(-?\d+)\s+yards?\b/i);
      const yards=play.statYardage!==undefined&&play.statYardage!==null&&play.statYardage!==''?
        Number(play.statYardage):(m?Number(m[1]):null);
      creditedRushes.set(key,{id:actor.id,yards:Number.isFinite(yards)?yards:(previous?.yards??null),
        td:/\btouchdown\b/i.test(text)||(previous?.td||false)});
    }
    const result=new Map();
    for(const item of creditedRushes.values()){
      const cur=result.get(item.id)||{attempts:0,yards:0,knownYards:0,unknownYards:0,td:0};
      cur.attempts++;
      if(item.yards!==null){cur.yards+=item.yards;cur.knownYards++}
      else cur.unknownYards++;
      if(item.td)cur.td++;
      result.set(item.id,cur);
    }
    return result;
  }
  function recoveredRushStats(c){
    const raw=[
      pickStat(c,'rushing',['rushingattempts'],['car','att','rushatt']),
      pickStat(c,'rushing',['rushingyards'],['yds','rushyds']),
      pickStat(c,'rushing',['rushingtouchdowns'],['td'])
    ];
    const derived=rushingPbp.get(c.id);
    const official=raw[0]!=='—'&&Number.isFinite(Number(raw[0]))?Number(raw[0]):null;
    if(!derived||derived.attempts===0||official!==null&&official>=derived.attempts)return raw;
    usedPbpFallback=true;
    return [String(derived.attempts),derived.unknownYards===0?String(derived.yards):'—',
      derived.td?String(Math.max(derived.td,Number(raw[2])||0)):
      raw[2]!=='—'&&Number.isFinite(Number(raw[2]))?raw[2]:'—'];
  }
  function findPossession(data,competition,tid){
    const candidates=[
      competition.situation?.possession,data.situation?.possession,
      competition.situation?.possessionId,data.situation?.possessionId,
      data.drives?.current?.team?.id
    ];
    const flagged=arr(competition.competitors).find(x=>x.possession===true||x.hasPossession===true);
    if(flagged?.team?.id)candidates.push(flagged.team.id);
    const found=candidates.map(x=>x&&typeof x==='object'?(x.team?.id||x.id||''):x)
      .map(x=>String(x||'')).find(x=>arr(competition.competitors).some(c=>String(c.team?.id)===x));
    if(found)return found===String(tid)?'offense':'defense';
    // No reliable possession identifier: hold the last known side, never
    // pretend the previous snap is necessarily the current possession.
    return slotState.lastMode||'offense';
  }
  function chooseSix(pool,mode,statics,credits){
    const prev=Array.isArray(slotState[mode])?slotState[mode].slice(0,6):[];
    const result=Array(6).fill(null),used=new Set();
    const get=id=>pool.find(c=>c.id===String(id));
    const set=(idx,c)=>{if(!c||used.has(c.id)||!roleFits(c,mode,idx,true))return false;
      result[idx]=c;used.add(c.id);return true};
    if(mode==='offense'){
      set(0,statics.qb);
      set(1,statics.rb);
      set(3,statics.wr);
    }else{
      // EDGE anchors do not change just because another defender made a play.
      const anchors=[0,1];
      for(const i of anchors){
        const saved=get(prev[i]);
        if(!set(i,saved))set(i,eligible(pool,mode,i,used)[0]);
      }
    }
    const dynamic=mode==='offense'?[2,4,5]:[2,3,4,5];
    // First try newly credited players (in chronological order, last wins).
    // A generic ESPN DB is *not* proof of S or CB. It can fill either position,
    // but each credited play must choose ONE position, never both.
    const lastCredits=new Map();
    for(const credit of credits){
      const c=get(credit.id);
      if(!c||used.has(c.id))continue;
      if(mode==='defense'&&c.role==='DB'){
        // Use broad DB only when a precise S/CB role isn't available for that
        // slot. When both are broad DB, alternate assignment on new credited
        // plays; never use a clock/timer to rotate.
        const prevSlot=[4,5].find(idx=>prev[idx]===c.id);
        let target=prevSlot;
        if(target===undefined){
          const mayReplace=[4,5].filter(idx=>{
            const existing=get(prev[idx]);
            const exact=existing&&existing.role===SLOT_ROLES.defense[idx];
            const hasExact=pool.some(x=>x.role===SLOT_ROLES.defense[idx]);
            return !exact&&!hasExact;
          });
          const preferred=slotState.lastDbSlot===4?5:4;
          target=mayReplace.includes(preferred)?preferred:mayReplace[0];
        }
        if(target!==undefined){
          // A new DB replaces only the chosen generic DB slot.
          lastCredits.set(target,c);
          slotState.lastDbSlot=target;
        }
        continue;
      }
      for(const idx of dynamic){
        if(roleFits(c,mode,idx)&&!used.has(c.id))lastCredits.set(idx,c);
      }
    }
    for(const idx of dynamic){
      const next=lastCredits.get(idx);
      if(next)set(idx,next);
    }
    for(const idx of dynamic){
      if(result[idx])continue;
      const saved=get(prev[idx]);
      if(set(idx,saved))continue;
      // If a dynamic player has just become the protected leader, prefer
      // the former leader as the new dynamic player (same position).
      const displaced=mode==='offense'&&idx===2?get(prev[1]):mode==='offense'&&idx===4?get(prev[3]):null;
      if(set(idx,displaced))continue;
      // Kickoff fallback from the depth chart. No timed rotation.
      set(idx,eligible(pool,mode,idx,used)[0]);
    }
    return result;
  }
  function creditEvents(data,pool,tid){
    const processed=new Set(slotState.processed);
    const fresh=[];
    for(const play of orderedPlays(data)){
      const id=playKey(play);
      if(!id||processed.has(id))continue;
      processed.add(id);
      const offenseId=String(play?.team?.id||play?.teamId||play?.start?.team?.id||'');
      if(!offenseId)continue;
      const ownOffense=offenseId===String(tid);
      for(const credit of creditedActors(play,pool,ownOffense?'offense':'defense')){
        fresh.push({...credit,mode:ownOffense?'offense':'defense'});
        if(ownOffense&&credit.role==='RB'){
          if(credit.kind==='receiver')slotState.lastActionByRB[credit.id]='receiving';
          if(credit.kind==='rusher')slotState.lastActionByRB[credit.id]='rushing';
        }
      }
    }
    slotState.processed=[...processed].slice(-500);
    return fresh;
  }
  function selectSlots(pool,data,tid,state){
    rushingPbp=rushingFromPlays(data,pool,tid);
    receivingPbp=receivingFromPlays(data,pool,tid);
    const formerOffense=slotState.offense.slice(),formerDefense=slotState.defense.slice();
    const ranks=pool.filter(c=>c.role==='QB').sort((a,b)=>{
      // Starting QB comes from actual game passing activity if known.
      const statA=stat(a,'passing',['passingattempts'],['att'])+stat(a,'passing',['passingyards'],['yds'])/200;
      const statB=stat(b,'passing',['passingattempts'],['att'])+stat(b,'passing',['passingyards'],['yds'])/200;
      return statB-statA||playerPriority(a,b);
    });
    const statics={qb:ranks[0]||null,rb:rushLeader(pool),wr:receptionLeader(pool)};
    const events=state==='post'&&slotState.processed.length?[]:creditEvents(data,pool,tid);
    slotState.offense=chooseSix(pool,'offense',statics,events.filter(x=>x.mode==='offense')).map(x=>x?.id||null);
    slotState.defense=chooseSix(pool,'defense',statics,events.filter(x=>x.mode==='defense')).map(x=>x?.id||null);
    for(const [id,action] of Object.entries(slotState.lastActionByRB))rbStatMode[id]=action;
    return {offense:slotState.offense.map(id=>id),defense:slotState.defense.map(id=>id),
      eventCredits:events.length,formerOffense,formerDefense};
  }
  function renderRow(row,c,slot){
    const face=row.querySelector('.portrait'),name=row.querySelector('.player');
    const keys=[...row.querySelectorAll('.stats small')],vals=[...row.querySelectorAll('.stats b')];
    if(!c){face.textContent='—';name.textContent='PLAYER DATA UNAVAILABLE';keys.forEach(x=>x.textContent='—');vals.forEach(x=>x.textContent='—');return}
    name.textContent=c.athlete.displayName||'PLAYER';name.style.fontSize=name.textContent.length>17?'clamp(11px,2.6vw,16px)':'';
    const src=photo(c.athlete);face.textContent='';
    if(src){const img=document.createElement('img');img.src=src;img.alt='';
      img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
      img.onerror=()=>{face.textContent='HEADSHOT UNAVAILABLE'};face.appendChild(img);
    }else face.textContent='HEADSHOT UNAVAILABLE';
    const s=statsFor(c,slot);
    keys.forEach((x,i)=>x.textContent=s.labels[i]||'—');
    vals.forEach((x,i)=>x.textContent=s.values[i]??'—');
  }
  async function update(){
    if(!eventId){band.textContent='AWAITING GAME';note.textContent='Select a football game to see its key contributors.';return}
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
      const pool=candidatePool(context.depth,context.roster,null,side,tid,false,data.header?.competitions?.[0]?.date||data.header?.competitions?.[0]?.startDate);
      // Build both modes from depth-chart fallback + game-leading stats +
      // newly credited plays. Switching possession does not reset either mode.
      const selection=selectSlots(pool,data,tid,state);
      // Review-only override for viewing both sides of a completed NFL game.
      const forced=p.get('previewMode');
      const mode=forced==='offense'||forced==='defense'?forced:
        state==='post'?slotState.lastMode:findPossession(data,competition,tid);
      slotState.lastMode=mode;
      const selectedIds=mode==='defense'?slotState.defense:slotState.offense;
      const shown=selectedIds.map(id=>id?pool.find(c=>c.id===id)||null:null);
      persistSlots();
      if(shown.every(x=>!x)&&rows.some(row=>!!row.querySelector('.player')?.textContent&&!/UNAVAILABLE|PENDING|PLAYER DATA/.test(row.querySelector('.player').textContent))){
        band.textContent='GAME DATA DELAYED';
        note.textContent='Holding the previous game contributors while ESPN stats are unavailable.';
        return;
      }
      usedPbpFallback=false;
      rows.forEach((row,i)=>renderRow(row,shown[i],mode==='offense'&&i===1?'rushLeader':''));
      band.textContent=mode==='offense'?'OFFENSIVE CONTRIBUTORS':'DEFENSIVE CONTRIBUTORS';
      const missing=shown.filter(x=>!x).length;
      note.textContent='Protected leaders from current-game stats; other positions change only after credited plays. '+
        (state==='post'?'Final game players held. ':'')+
        (missing?missing+' positions awaiting eligible depth-chart players. ':'')+
        (usedPbpFallback?'Some rushing/receiving figures are provisional from ESPN play descriptions. ':'')+
        'No duplicates, no timed rotation, no on-field personnel claim.';
    }catch(e){
      band.textContent='GAME STATS RETRYING';
      note.textContent='Game impact refresh unavailable: '+e.message+'. Previously displayed player names and current-game stats are retained.';
    }finally{busy=false}
  }
  update();setInterval(update,30000);
})();