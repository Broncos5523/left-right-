/* MAN CAVE SPORTS BOOK — football box scores. The approved scoreboard CSS is intentionally untouched. */
(function(){
  if(sport!=='cfb')return; // NFL now uses its dedicated live six-slot engine
  const path=sport==='nfl'?'football/nfl':'football/college-football';
  const eventId=p.get('eventId');
  const band=app.querySelector('.band');
  const note=app.querySelector('.note');
  const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const rows=[...app.querySelectorAll('.row')];
  const personnel=window.ManCaveFootballPersonnel||null;
  const rosterCache=new Map();
  band.textContent='ON FIELD';
  async function rosterFor(teamId,season){
    const key=String(teamId)+':'+String(season),cached=rosterCache.get(key);
    if(cached&&Date.now()-cached.at<20*60*1000)return cached.promise;
    const url='https://site.api.espn.com/apis/site/v2/sports/'+path+'/teams/'+encodeURIComponent(teamId)+'/roster?season='+encodeURIComponent(season);
    const promise=(async()=>{
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)throw Error('Roster HTTP '+r.status);
      const data=await r.json();
      if(!Array.isArray(data.athletes))throw Error('No official roster positions');
      return data;
    })().catch(error=>{rosterCache.delete(key);throw error;});
    rosterCache.set(key,{at:Date.now(),promise});
    return promise;
  }
  function easternDate(iso){
    const date=new Date(iso);
    if(!Number.isFinite(date.getTime()))return '';
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
      timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(date).map(x=>[x.type,x.value]));
    return parts.year+parts.month+parts.day;
  }
  async function scoreboardFor(summary,cacheKey){
    const date=easternDate(summary.header?.competitions?.[0]?.date);
    if(!date)return null;
    const url='https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?dates='+date+'&limit=500&_='+cacheKey;
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw Error('Scoreboard HTTP '+r.status);
    return r.json();
  }

  function logoFor(teamData){
    const t=teamData||{};
    if(t.logo)return t.logo;
    if(t.logos?.[0]?.href)return t.logos[0].href;
    if(sport==='cfb' && t.id)return 'https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(t.id)+'.png';
    if(sport==='nfl' && t.abbreviation)return 'https://a.espncdn.com/i/teamlogos/nfl/500/'+encodeURIComponent(t.abbreviation.toLowerCase())+'.png';
    return '';
  }
  function stat(item,keys,labels){
    const k=item.keys.findIndex(x=>keys.includes(norm(x)));
    const l=k<0?item.labels.findIndex(x=>labels.includes(norm(x))):k;
    return l<0?'—':(item.a.stats?.[l]??'—');
  }
  function statsFor(item){
    const role=item.role;
    if(role==='QB')return {
      labels:['YDS','C/ATT','TD'],
      values:[
        stat(item,['passingyards'],['yds','passyds']),
        stat(item,['completionspassingattempts','completionsattempts'],['catt','compatt','cmpatt']),
        stat(item,['passingtouchdowns'],['td'])
      ]
    };
    if(role==='RB')return {
      labels:['ATT','YDS','TD'],
      values:[
        stat(item,['rushingattempts'],['car','att','rushatt']),
        stat(item,['rushingyards'],['yds','rushyds']),
        stat(item,['rushingtouchdowns'],['td'])
      ]
    };
    return {
      labels:['REC','YDS','TD'],
      values:[
        stat(item,['receptions'],['rec']),
        stat(item,['receivingyards'],['yds','recyds']),
        stat(item,['receivingtouchdowns'],['td'])
      ]
    };
  }
  function getGroupType(group){
    const id=norm(group.name||group.title||group.type||group.displayName);
    if(id.includes('passing'))return 'passing';
    if(id.includes('rushing'))return 'rushing';
    if(id.includes('receiving'))return 'receiving';
    const headings=(group.labels||[]).map(norm);
    if(headings.some(x=>['catt','compatt','cmpatt'].includes(x)))return 'passing';
    if(headings.includes('rec'))return 'receiving';
    if(headings.includes('car'))return 'rushing';
    return null;
  }
  function selectPlayers(side){
    const groups=side?.statistics||[];
    const byType={passing:[],rushing:[],receiving:[]};
    for(const group of groups){
      const type=getGroupType(group);
      if(!type)continue;
      const keys=(group.keys||[]).map(norm),labels=(group.labels||[]).map(norm);
      for(const a of group.athletes||[]){
        if(a.didNotPlay||a.athlete?.didNotPlay)continue;
        const athlete=a.athlete||{};
        const id=String(athlete.id||athlete.displayName||'');
        const position=String(athlete.position?.abbreviation||athlete.position?.name||'').toUpperCase();
        if(!id)continue;
        const role=type==='passing'?'QB':type==='rushing'?'RB':'WR';
        const item={a,athlete,id,position,role,keys,labels};
        // A player must have at least one actual box-score stat before being considered a contributor.
        if(!Array.isArray(a.stats)||!a.stats.some(v=>v!==null&&v!==undefined&&v!==''&&v!=='—'))continue;
        byType[type].push(item);
      }
    }
    const unique=new Set(),selected=[];
    function add(items,limit){
      let taken=0;
      for(const item of items){
        if(selected.length>=6||taken>=limit)break;
        if(unique.has(item.id))continue;
        unique.add(item.id);selected.push(item);taken++;
      }
    }
    // QB / RB / WR are display roles, not a claim they are on the field.
    add(byType.passing.filter(x=>x.position==='QB'),1);
    if(!selected.length)add(byType.passing,1);
    add(byType.rushing.filter(x=>['RB','FB','HB'].includes(x.position)),2);
    // Live ESPN CFB box scores often omit athlete.position entirely.
    // Before filling receivers, include actual rushing contributors who are
    // not the QB. Never guess a name or fabricate a player's game statistics.
    const passerIds=new Set(byType.passing.map(x=>x.id));
    const rushSlots=2-selected.filter(x=>x.role==='RB').length;
    if(rushSlots>0)add(byType.rushing.filter(x=>!passerIds.has(x.id)),rushSlots);
    add(byType.receiving.filter(x=>['WR','TE'].includes(x.position)),3);
    add(byType.receiving,6);
    add(byType.rushing,6);
    return selected.slice(0,6);
  }
  function renderPlayer(row,item){
    const portrait=row.querySelector('.portrait');
    const name=row.querySelector('.player');
    const labels=[...row.querySelectorAll('.stats small')];
    const values=[...row.querySelectorAll('.stats b')];
    if(!item){
      portrait.textContent='—';name.textContent='NO VERIFIED PLAYER';name.style.fontSize='';
      values.forEach(v=>v.textContent='—');return;
    }
    if((item.side==='offense'||item.side==='defense')&&personnel){
      name.textContent=item.name||'PLAYER';
      name.style.fontSize=name.textContent.length>17?'clamp(11px,2.6vw,16px)':'';
      name.setAttribute('title',item.verified
        ?'ESPN current-game contributor':'Official team roster, not confirmed on field');
      portrait.textContent='';
      const logoSrc=app.querySelector('.logo')?.src||'';
      const headshot=typeof item.headshot==='string'?item.headshot:'';
      if(headshot||logoSrc){
        const img=document.createElement('img');img.src=headshot||logoSrc;img.alt='';
        img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
        img.onerror=()=>{
          if(img.src!==logoSrc&&logoSrc)img.src=logoSrc;
          else portrait.textContent='HEADSHOT UNAVAILABLE';
        };
        portrait.appendChild(img);
      }else portrait.textContent='HEADSHOT UNAVAILABLE';
      const valuesFor=personnel.displayStats(item);
      labels.forEach((el,i)=>el.textContent=valuesFor.labels[i]||'—');
      values.forEach((el,i)=>el.textContent=valuesFor.values[i]??'—');
      return;
    }
    name.textContent=item.athlete.displayName||'PLAYER';
    name.style.fontSize=name.textContent.length>17?'clamp(11px,2.6vw,16px)':'';
    portrait.textContent='';
    const headshot=item.athlete.headshot?.href||item.athlete.headshot;
    if(typeof headshot==='string'&&/^https:\/\//.test(headshot)){
      const img=document.createElement('img');
      img.src=headshot;img.alt='';
      img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
      img.onerror=()=>{portrait.textContent='HEADSHOT UNAVAILABLE'};
      portrait.appendChild(img);
    }else portrait.textContent='HEADSHOT UNAVAILABLE';
    const data=statsFor(item);
    labels.forEach((el,i)=>el.textContent=data.labels[i]||'—');
    values.forEach((el,i)=>el.textContent=data.values[i]??'—');
  }
  // A refreshed feed must not overlap an earlier slow ESPN request, and the
  // last good screen must remain visible if ESPN briefly fails.
  const sync={eventId,lastAttempt:null,lastSuccess:null,lastError:null,players:[],scores:null,
    mode:null,possessionTeamId:null,possessionSource:null,rosterFallbackCount:0,verifiedCount:0};
  window.__LR_FOOTBALL_SYNC__=sync;
  let fetching=false;
  async function update(){
    if(fetching)return;
    if(!eventId){
      band.textContent='ON FIELD';
      note.textContent='Choose an actual NFL or college football matchup in the LEFT RIGHT controller to show current-game statistics.';
      return;
    }
    try{
      fetching=true;
      sync.lastAttempt=new Date().toISOString();
      const cacheKey=Math.floor(Date.now()/20000);
      const source='https://site.api.espn.com/apis/site/v2/sports/'+path+'/summary?event='+encodeURIComponent(eventId)+'&_='+cacheKey;
      const response=await fetch(source,{cache:'no-store'});
      if(!response.ok)throw Error('ESPN HTTP '+response.status);
      const data=await response.json();
      const competitors=data.header?.competitions?.[0]?.competitors||[];
      const match=competitors.find(x=>norm(x.team?.displayName)===norm(team)||norm(x.team?.name)===norm(team));
      if(!match)throw Error('Selected team is absent from event');
      setHeader(match);
      setScore(match.score??'—');
      const src=logoFor(match.team);
      const logo=app.querySelector('.logo');
      if(src){logo.src=src;logo.hidden=false}
      const records=match.record||match.records||[];
      const record=Array.isArray(records)?(records.find(x=>x.type==='total')||records[0])?.summary||'':(records.summary||'');
      app.querySelector('.team-record').textContent=record;
      if(sport==='cfb')setRank(match.curatedRank?.current??match.team?.rank??match.rank);
      const side=data.boxscore?.players?.find(x=>(match.team?.id!=null&&x.team?.id!=null&&String(x.team.id)===String(match.team.id))||norm(x.team?.displayName)===norm(team)||norm(x.team?.abbreviation)===norm(match.team?.abbreviation));
      // Existing selected-game final board continues to show KEY PLAYERS.
      // While live, college football uses possession to select the offense on
      // one TV and the defense on the other. ESPN does not expose exact
      // on-field six; official roster members may fill empty spots.
      const isFinal=Boolean(data.header?.competitions?.[0]?.status?.type?.completed||
        data.header?.competitions?.[0]?.status?.type?.state==='post');
      let players=selectPlayers(side);
      if(sport==='cfb'&&personnel&&!isFinal){
        const season=Number(String(data.header?.competitions?.[0]?.date||'').slice(0,4))||new Date().getFullYear();
        const results=await Promise.allSettled([
          rosterFor(match.team.id,season),scoreboardFor(data,cacheKey)
        ]);
        const roster=results[0].status==='fulfilled'?results[0].value:null;
        const scoreboard=results[1].status==='fulfilled'?results[1].value:null;
        const current=personnel.possession(data,scoreboard,eventId,sync.possessionTeamId);
        if(current.teamId)sync.possessionTeamId=current.teamId;
        sync.possessionSource=current.source;
        // When feeds temporarily omit possession, retain the last confirmed mode.
        const mode=current.teamId?
          (String(match.team.id)===current.teamId?'offense':'defense'):
          (sync.mode||null);
        if(mode==='offense'||mode==='defense'){
          players=mode==='offense'?
            personnel.selectOffense(side,roster):
            personnel.selectDefense(side,roster);
          sync.mode=mode;
        }
      }else if(isFinal){
        sync.mode='final';
      }
      rows.forEach((row,i)=>renderPlayer(row,players[i]));
      setGamePhaseHeading(data);
      sync.rosterFallbackCount=players.filter(x=>x&&x.verified===false).length;
      sync.verifiedCount=players.length-sync.rosterFallbackCount;
      sync.lastSuccess=new Date().toISOString();
      sync.lastError=null;
      sync.players=players.map(x=>x.name||x.athlete?.displayName||x.athlete?.name||'');
      sync.scores={team:match.team?.displayName||team,score:match.score,state:data.header?.competitions?.[0]?.status?.type?.state};
      note.textContent=players.length
        ?(sync.mode==='defense'?'Defensive view: game contributors plus official roster fallback. Stats are current-game tackles, sacks, TFL, passes defended or interceptions. No exact on-field personnel guarantee.'
          :sync.mode==='offense'?'Offensive view: game contributors plus official roster fallback. Missing player game stats show dashes; no exact on-field personnel guarantee.'
          :'Final/other game contributors, based on verified ESPN box scores.')
        :'No player data available from ESPN; retained last-known details when possible.';
    }catch(e){
      /* Keep the most recent game-phase heading during ESPN outages. */
      sync.lastError=String(e.message||e);
      note.textContent='Could not update the selected football game: '+e.message+'. Previously received scoreboard data is retained where possible.';
    }finally{
      fetching=false;
    }
  }
  update();
  setInterval(update,20000);
  // Returning to a suspended Silk tab also triggers a fresh read.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
  window.addEventListener('focus',update);
  window.addEventListener('online',update);
})();
