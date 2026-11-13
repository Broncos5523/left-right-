/* LEFT RIGHT football probable-personnel prototype. No approved HTML/CSS changes.
 * ESPN feeds are unofficial and may omit injury, chart, and play data.
 * This development build does NOT claim confirmed complete snap personnel.
 */
(function(){
  if(sport!=='nfl'&&sport!=='cfb')return;
  const path=sport==='nfl'?'football/nfl':'football/college-football';
  const eventId=p.get('eventId'), norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const rows=[...app.querySelectorAll('.row')],band=app.querySelector('.band'),note=app.querySelector('.note');
  const roles=['QB','RB','WR','TE','CB','S','EDGE','LB'];
  const teamCache={id:null,stamp:0,depth:null,roster:null,injuries:null};
  const remembered={offense:[],defense:[]};
  let lastPlayId='',rbStatMode={},busy=false;
  const base='https://site.api.espn.com/apis/site/v2/sports/'+path+'/';
  const arr=x=>Array.isArray(x)?x:[];
  const statusText=x=>String(typeof x==='string'?x:x?.displayName||x?.name||x?.type||x?.description||x?.abbreviation||'');
  const idOf=x=>String(x?.id||x?.athlete?.id||x?.player?.id||'');
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
  function rememberKey(mode){return 'lr-football-personnel-v1:'+sport+':'+eventId+':'+norm(team)+':'+mode}
  function prior(mode){
    if(remembered[mode].length)return remembered[mode];
    try{const x=JSON.parse(localStorage.getItem(rememberKey(mode))||'[]');if(Array.isArray(x))return x.map(String)}catch(e){}
    return [];
  }
  function save(mode,items){
    const ids=items.map(x=>x.id);
    remembered[mode]=ids;
    try{localStorage.setItem(rememberKey(mode),JSON.stringify(ids))}catch(e){}
  }
  async function get(url){
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok)throw Error('ESPN '+res.status);return res.json();
  }
  async function getTeamContext(teamId){
    if(teamCache.id===String(teamId)&&Date.now()-teamCache.stamp<600000)return teamCache;
    const root=base+'teams/'+encodeURIComponent(teamId);
    const responses=await Promise.allSettled([get(root+'/depthcharts'),get(root+'/roster'),get(root+'/injuries')]);
    const [depth,roster,injuries]=responses.map(x=>x.status==='fulfilled'?x.value:null);
    // A missing injury report is UNKNOWN availability, not proof of good health.
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
      const id=idOf(x),name=norm(x.athlete?.displayName);
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
  function pickStat(c,type,keys,labels){
    const g=c?.groups?.[type];if(!g)return '—';
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
      return type==='receiving'?{labels:['REC','YDS','TD'],values:[
        pickStat(c,'receiving',['receptions'],['rec']),
        pickStat(c,'receiving',['receivingyards'],['yds','recyds']),
        pickStat(c,'receiving',['receivingtouchdowns'],['td'])]}:
        {labels:['ATT','YDS','TD'],values:[
        pickStat(c,'rushing',['rushingattempts'],['car','att','rushatt']),
        pickStat(c,'rushing',['rushingyards'],['yds','rushyds']),
        pickStat(c,'rushing',['rushingtouchdowns'],['td'])]};
    }
    if(role==='WR'||role==='TE')return {labels:['REC','YDS','TD'],values:[
      pickStat(c,'receiving',['receptions'],['rec']),
      pickStat(c,'receiving',['receivingyards'],['yds','recyds']),
      pickStat(c,'receiving',['receivingtouchdowns'],['td'])]};
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
      const x=plays[i],label=String(x.type?.text||x.type?.displayName||x.text||'');
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
  function select(pool,mode,confirmed){
    const eligible=new Map(pool.map(x=>[x.id,x]));
    const ranking=(role)=>pool.filter(x=>x.role===role).sort((a,b)=>a.rank-b.rank||(a.source==='depth'?-1:1));
    const saved=prior(mode).map(id=>eligible.get(id)).filter(Boolean);
    let chosen=[];
    const add=x=>{if(x&&!chosen.some(c=>c.id===x.id)&&chosen.length<6)chosen.push(x)};
    const byRole=(role)=>{const list=ranking(role);return list.find(x=>!chosen.some(c=>c.id===x.id))};
    if(mode==='offense'){
      // QB and WR1/2 are stable unless a new unavailable status or real replacement evidence exists.
      add(saved.find(x=>x.role==='QB')||byRole('QB'));
      const wrSaved=saved.filter(x=>x.role==='WR');
      add(wrSaved[0]||byRole('WR'));add(wrSaved[1]||byRole('WR'));
      const dynamic=saved.filter(x=>!chosen.some(c=>c.id===x.id));
      for(const x of dynamic)add(x);
      const defaults=['RB','WR','TE','WR','TE','RB'];
      for(const role of defaults)add(byRole(role));
    }else{
      for(const role of ['CB','CB','EDGE','EDGE','S','LB'])add(saved.find(x=>x.role===role&&!chosen.some(c=>c.id===x.id))||byRole(role));
      for(const x of saved)add(x);
      for(const role of ['CB','EDGE','S','LB'])add(byRole(role));
    }
    // Replace an inferred dynamic player only when identified on a newer play.
    // Untargeted players remain estimates; play-by-play does not disclose full personnel.
    const confirmedPlayers=[...confirmed].map(id=>eligible.get(id)).filter(x=>x&&(mode==='offense'?['QB','RB','WR','TE'].includes(x.role):['CB','S','EDGE','LB'].includes(x.role)));
    for(const x of confirmedPlayers){
      if(chosen.some(c=>c.id===x.id))continue;
      if(mode==='offense'){
        if(x.role==='QB'){const i=chosen.findIndex(c=>c.role==='QB');if(i>=0)chosen[i]=x;continue}
        const candidates=chosen.map((c,i)=>({c,i})).filter(v=>v.i>=3);
        const same=candidates.find(v=>v.c.role===x.role);
        const slot=same?.i??candidates[candidates.length-1]?.i;
        if(slot!==undefined)chosen[slot]=x;
      }else{
        const same=chosen.findIndex(c=>c.role===x.role&&!confirmed.has(c.id));
        const slot=same>=0?same:5;
        chosen[slot]=x;
      }
    }
    // Deduplicate after replacements; fill a freed slot with the most plausible eligible candidate.
    chosen=[...new Map(chosen.map(c=>[c.id,c])).values()];
    const priority=mode==='offense'?['RB','WR','TE','WR','TE']:['CB','EDGE','S','LB'];
    for(const r of priority)add(byRole(r));
    return chosen.slice(0,6);
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
      const pool=candidatePool(context.depth,context.roster,context.injuries,side,tid,state!=='post',data.header?.competitions?.[0]?.date||data.header?.competitions?.[0]?.startDate);
      const play=recentPlay(data),pid=String(play?.id||play?.sequenceNumber||'');
      const confirmed=playIds(play);
      const playTeamId=String(play?.team?.id||competition.situation?.possession||'');
      const mode=playTeamId&&playTeamId!==String(tid)?'defense':'offense';
      if(pid&&pid!==lastPlayId){
        lastPlayId=pid;
        const isPass=/pass|reception|catch/i.test(play?.text||play?.type?.text||'');
        const isRush=/rush|ran |run |carry/i.test(play?.text||play?.type?.text||'');
        for(const id of confirmed){
          const c=pool.find(x=>x.id===id);
          if(c?.role==='RB'){
            if(isPass)rbStatMode[id]='receiving';
            else if(isRush)rbStatMode[id]='rushing';
          }
        }
      }
      const selected=select(pool,mode,confirmed);
      if(selected.length)save(mode,selected);
      rows.forEach((row,i)=>renderRow(row,selected[i]));
      band.textContent=selected.length?'PROBABLE '+mode.toUpperCase():'PERSONNEL DATA PENDING';
      const missing=6-selected.length;
      note.textContent=selected.length
        ?'Probable last-snap personnel, not an official on-field feed. Eligible depth-chart/roster players and ESPN current-game stats. '+(confirmed.size?confirmed.size+' participants identified in latest available play. ':'No usable participant IDs in latest play; last eligible lineup retained. ')+(missing?missing+' roster slots lack verified player data. ':'')+'Data and availability may be delayed.'
        :'ESPN returned neither usable team depth-chart/roster data nor current-game player details. The board will retry; no players have been invented.';
    }catch(e){
      band.textContent='PERSONNEL FEED RETRYING';
      note.textContent='Football personnel update unavailable: '+e.message+'. Previously received player data is retained where possible.';
    }finally{busy=false}
  }
  update();setInterval(update,30000);
})();