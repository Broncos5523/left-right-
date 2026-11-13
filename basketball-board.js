/* MAN CAVE SPORTS BOOK — LEFT RIGHT shared basketball player-selection engine.
 * NCAA CBB: use an exact five-player ESPN active=true group when available.
 * NBA/WNBA: active=true is NOT verified as on-court; retain box-score presentation.
 * Uses the existing APPROVED scoreboard and five player rows without CSS changes.
 * Official live on-court status is not guaranteed by ESPN's unofficial Site API.
 */
(function(){
  if(!['nba','wnba','cbb'].includes(sport))return;
  const paths={nba:'basketball/nba',wnba:'basketball/wnba',cbb:'basketball/mens-college-basketball'};
  const leaguePath=paths[sport];
  const eventId=p.get('eventId');
  const band=app.querySelector('.band'),note=app.querySelector('.note'),meta=app.querySelector('.meta');
  const rows=Array.from(app.querySelectorAll('.row'));
  const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const list=x=>Array.isArray(x)?x:[];
  const key='LR-BASKETBALL-LINEUP-v1:'+sport+':'+(eventId||'none')+':'+norm(team);
  let heldIds=[];
  let heldPlayers=new Map();
  let fetching=false;
  try{
    const cached=JSON.parse(localStorage.getItem(key)||'[]');
    if(Array.isArray(cached))heldIds=cached.filter(x=>typeof x==='string').slice(0,5);
  }catch(e){}

  // ESPN can list the same player in more than one statistics group.
  // Merge by player ID BEFORE counting active=true and BEFORE choosing five.
  function normalizePlayers(side){
    const byId=new Map();
    for(const group of list(side?.statistics)){
      const keys=list(group.keys).map(norm),labels=list(group.labels).map(norm);
      for(const entry of list(group.athletes)){
        const athlete=entry?.athlete||{};
        const id=String(athlete.id||'');
        if(!id)continue;
        const current=byId.get(id)||{
          id,athlete:{},active:false,starter:false,didNotPlay:false,groups:[],scoreEntry:false
        };
        current.athlete={...current.athlete,...athlete};
        current.active=current.active||entry.active===true||athlete.active===true;
        current.starter=current.starter||entry.starter===true||athlete.starter===true;
        current.didNotPlay=current.didNotPlay||entry.didNotPlay===true||athlete.didNotPlay===true;
        current.groups.push({entry,keys,labels});
        current.scoreEntry=current.scoreEntry||list(entry.stats).some(x=>x!==null&&x!==undefined&&x!==''&&x!=='—');
        byId.set(id,current);
      }
    }
    return [...byId.values()].filter(item=>!item.didNotPlay);
  }

  function stableSort(next,previous){
    if(next.length!==5)return next;
    const nextMap=new Map(next.map(x=>[x.id,x]));
    const ordered=previous.slice(0,5).map(id=>nextMap.get(id)||null);
    if(!ordered.length)return next;
    const used=new Set(ordered.filter(Boolean).map(x=>x.id));
    const newcomers=next.filter(x=>!used.has(x.id));
    for(let i=0;i<5;i++)if(!ordered[i])ordered[i]=newcomers.shift()||null;
    return ordered.filter(Boolean);
  }

  // Pure selector; only CBB gets the active=true on-court treatment until each
  // other league has independently passed a real substitution comparison.
  function selectFive(items,previous,league,state){
    const byId=new Map(items.map(x=>[x.id,x]));
    const active=items.filter(x=>x.active);
    const held=previous.map(id=>byId.get(id)).filter(Boolean);
    const starters=items.filter(x=>x.starter);

    if(league==='cbb'&&state==='in'&&active.length===5){
      return {players:stableSort(active,previous),source:'active-five',activeCount:5};
    }
    if(held.length===5){
      return {players:held,source:'held',activeCount:active.length};
    }
    if(starters.length===5&&state==='pre'){
      return {players:starters,source:'projected-starters',activeCount:active.length};
    }
    // No invented on-court claims. Before stats, prefer starters. Once playing,
    // choose game participants; this is a fallback, not a substituted lineup.
    const ranked=items.slice().sort((a,b)=>{
      const aScore=Number(a.scoreEntry)*2+Number(a.starter);
      const bScore=Number(b.scoreEntry)*2+Number(b.starter);
      return bScore-aScore;
    });
    const candidates=(state==='pre'&&starters.length>0?starters:ranked).slice(0,5);
    return {players:candidates,source:'game-participants',activeCount:active.length};
  }

  function pickStat(item,keys,labels){
    for(const g of item?.groups||[]){
      const byKey=g.keys.findIndex(x=>keys.includes(x));
      const index=byKey>=0?byKey:g.labels.findIndex(x=>labels.includes(x));
      if(index<0)continue;
      const value=g.entry.stats?.[index];
      if(value!==null&&value!==undefined&&value!=='')return value;
    }
    return '—';
  }
  function totals(item){
    return [
      pickStat(item,['points'],['pts']),
      pickStat(item,['rebounds','totalrebounds'],['reb']),
      pickStat(item,['assists'],['ast'])
    ];
  }
  function renderRow(row,item){
    const portrait=row.querySelector('.portrait'),name=row.querySelector('.player');
    const labels=[...row.querySelectorAll('.stats small')],values=[...row.querySelectorAll('.stats b')];
    if(!item){
      if(row.dataset.playerId)return; // retain previously displayed player when data disappears
      portrait.textContent='—';name.textContent='PLAYER DATA PENDING';
      labels.forEach((x,i)=>x.textContent=['PTS','REB','AST'][i]);
      values.forEach(x=>x.textContent='—');return;
    }
    const athlete=item.athlete||{};
    if(row.dataset.playerId!==item.id){
      row.dataset.playerId=item.id;
      name.textContent=athlete.displayName||athlete.fullName||'PLAYER';
      name.style.fontSize=name.textContent.length>17?'clamp(11px,2.6vw,16px)':'';
      portrait.textContent='';
      const src=athlete.headshot?.href||(typeof athlete.headshot==='string'?athlete.headshot:'');
      if(typeof src==='string'&&/^https:\/\//.test(src)){
        const img=document.createElement('img');
        img.src=src;img.alt='';img.style.cssText='height:10vh;max-width:100%;object-fit:contain';
        img.onerror=()=>{if(row.dataset.playerId===item.id)portrait.textContent='HEADSHOT UNAVAILABLE'};
        portrait.appendChild(img);
      }else portrait.textContent='HEADSHOT UNAVAILABLE';
    }
    const stat=totals(item);
    labels.forEach((x,i)=>x.textContent=['PTS','REB','AST'][i]);
    values.forEach((x,i)=>x.textContent=stat[i]??'—');
  }

  async function update(){
    if(!eventId){
      band.textContent='AWAITING GAME';
      note.textContent='Choose an actual basketball matchup in LEFT RIGHT to load current-game players.';
      return;
    }
    if(fetching)return;
    fetching=true;
    try{
      const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+leaguePath+'/summary?event='+encodeURIComponent(eventId),{cache:'no-store'});
      if(!response.ok)throw Error('ESPN HTTP '+response.status);
      const data=await response.json();
      const competition=data.header?.competitions?.[0]||{};
      const match=list(competition.competitors).find(x=>norm(x.team?.displayName)===norm(team)||norm(x.team?.name)===norm(team));
      if(!match)throw Error('Selected team not found in this ESPN event');
      setHeader(match);setScore(match.score??'—');
      const logo=app.querySelector('.logo');
      const src=match.team?.logo||match.team?.logos?.[0]?.href;
      if(src){logo.src=src;logo.hidden=false}
      const records=match.record||match.records||[];
      app.querySelector('.team-record').textContent=Array.isArray(records)?(records.find(x=>x.type==='total')||records[0])?.summary||'':records.summary||'';
      if(sport==='cbb')setRank(match.curatedRank?.current??match.team?.rank??match.rank);
      const side=list(data.boxscore?.players).find(x=>
        (match.team?.id!=null&&x.team?.id!=null&&String(x.team.id)===String(match.team.id))||
        norm(x.team?.displayName)===norm(team));
      const state=competition.status?.type?.state||'unknown';
      const items=normalizePlayers(side);
      for(const item of items)heldPlayers.set(item.id,item);
      const selection=selectFive(items,heldIds,sport,state);
      // Saved game-specific player names/headshots can survive temporary missing rows.
      let players=selection.players.slice(0,5);
      if(players.length<5&&heldIds.length===5&&state!=='pre'){
        const fallback=heldIds.map(id=>heldPlayers.get(id)).filter(Boolean);
        if(fallback.length===5)players=fallback;
      }
      if(players.length===5){
        heldIds=players.map(x=>x.id);
        try{localStorage.setItem(key,JSON.stringify(heldIds))}catch(e){}
      }
      rows.forEach((row,i)=>renderRow(row,players[i]));
      if(sport==='cbb'&&selection.source==='active-five'&&players.length===5){
        band.textContent='ESPN ACTIVE FIVE';
        note.textContent='ESPN identifies five active players for this game. Tested against the North Alabama–Miami broadcast, but not independently verified for every college game. Current-game points, rebounds and assists shown; updates may lag substitutions.';
      }else if(selection.source==='held'&&sport==='cbb'){
        band.textContent='LAST KNOWN FIVE';
        note.textContent='Holding the last selected five because the current feed did not provide a complete five-player group. This is not a confirmed live lineup. Current-game statistics may be delayed.';
      }else{
        band.textContent='GAME PARTICIPANTS';
        note.textContent=(sport==='nba'||sport==='wnba'
          ?'Current-game ESPN participants. The active flag is not yet verified as on-court for this league.'
          :'No complete ESPN active five is available. Showing eligible player information; this is not a verified on-court lineup.')+
          ' Stats show current-game PTS, REB and AST where supplied.';
      }
      if(meta)meta.textContent='ESPN · '+selection.source.toUpperCase();
    }catch(error){
      if(meta)meta.textContent='BASKETBALL FEED RETRYING';
      note.textContent='Unable to refresh selected basketball game: '+error.message+'. Last displayed lineup and statistics are being retained.';
    }finally{fetching=false}
  }
  // Test-only access in browser DevTools; never a requirement for the TV.
  if(typeof window!=='undefined')window.__LR_BASKETBALL_TEST__={normalizePlayers,selectFive,stableSort,totals};
  update();
  setInterval(update,20000);
})();