/* MAN CAVE SPORTS BOOK — football box scores. The approved scoreboard CSS is intentionally untouched. */
(function(){
  if(sport!=='nfl' && sport!=='cfb')return;
  const path=sport==='nfl'?'football/nfl':'football/college-football';
  const eventId=p.get('eventId');
  const band=app.querySelector('.band');
  const note=app.querySelector('.note');
  const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const rows=[...app.querySelectorAll('.row')];
  band.textContent='OFFENSIVE CONTRIBUTORS';

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
    add(byType.passing,1);
    add(byType.rushing.filter(x=>['RB','FB','HB'].includes(x.position)),2);
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
  async function update(){
    if(!eventId){
      band.textContent='AWAITING GAME';
      note.textContent='Choose an actual NFL or college football matchup in the LEFT RIGHT controller to show current-game statistics.';
      return;
    }
    try{
      const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+path+'/summary?event='+encodeURIComponent(eventId),{cache:'no-store'});
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
      const side=data.boxscore?.players?.find(x=>String(x.team?.id||'')===String(match.team?.id||'')||norm(x.team?.displayName)===norm(team)||norm(x.team?.abbreviation)===norm(match.team?.abbreviation));
      const players=selectPlayers(side);
      rows.forEach((row,i)=>renderPlayer(row,players[i]));
      band.textContent=players.length?'OFFENSIVE CONTRIBUTORS':'GAME STATS PENDING';
      note.textContent=players.length
        ?'Current-game ESPN offensive box-score contributors. These are not verified players on the field. QB: pass yards/completions-attempts/TD; RB: carries/rush yards/TD; WR/TE: catches/receiving yards/TD. Feed may be delayed.'
        :'No verified offensive game statistics yet. Player rows will populate when box-score data becomes available.';
    }catch(e){
      band.textContent='GAME DATA UNAVAILABLE';
      note.textContent='Could not update the selected football game: '+e.message+'. Previously received scoreboard data is retained where possible.';
    }
  }
  update();
  setInterval(update,45000);
})();
