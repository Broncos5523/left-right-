/* Man Cave Production v2 REVIEW. Data/fit adapters over the exact approved HTML. */
(() => {
  'use strict';
  const board = new URL(document.currentScript.src, location.href).searchParams.get('board') || '';
  const sport = ({broncos:'nfl',celtics:'nba',bruins:'nhl',redsox:'mlb',fever:'wnba',arizona_cfb:'cfb',arizona_cbb:'cbb'})[board.slice(6)] || board.slice(6);
  const origin = location.origin;
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const API_HOSTS = new Set(['site.api.espn.com','site.web.api.espn.com','sports.core.api.espn.com','statsapi.mlb.com','api-web.nhle.com','api.nhle.com']);
  const IMAGE_HOSTS = new Set(['a.espncdn.com','assets.nhle.com','www.mlbstatic.com','img.mlbstatic.com','cdn.nba.com','cdn.wnba.com']);
  const nativeFetch = window.fetch.bind(window);
  document.documentElement.dataset.mcBoard = board;
  window.__MC_BOARD = board;
  const link=document.createElement('link'); link.rel='stylesheet'; link.href=origin+'/runtime.css';document.head.append(link);
  window.fetch = (input, init={}) => {
    const url=typeof input==='string'?input:input?.url;
    try {
      if(API_HOSTS.has(new URL(url,location.href).hostname)) {
        const options={...init};delete options.mode;
        return nativeFetch(origin+'/proxy?url='+encodeURIComponent(url),options);
      }
    } catch (_) {}
    return nativeFetch(input,init);
  };
  const imageURL = value => {
    try { return IMAGE_HOSTS.has(new URL(value,location.href).hostname) ? origin+'/proxy?url='+encodeURIComponent(value) : value; }
    catch (_) { return value || ''; }
  };
  // CFB Page 2 image reliability: keep the approved HTML untouched while preferring
  // stable packaged NCAA logos where the live ESPN cache already contains verified bytes.
  // Player fallbacks are real roster/headshot sources from the schools (or On3 for Legree),
  // never generated/substitute player art.
  const CFB_LOCAL_TEAM_IDS=new Set(["142","145","154","194","197","201","2229","2294","2390","2393","245","248","2483","251","252","254","256","2567","26","2633","2641","2655","30","333","344","48","55","61","68","77","84","87","96","99"]);
  const CFB_PLAYER_FALLBACKS={
    '5212654':['https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/oregonstate.sidearmsports.com/images/2026/3/9/02112026_FB_Headshot_AtkinsonBraden_1748.jpg'],
    '5146712':['https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/broncosports.com/images/2026/7/28/Riley__Dylan.JPG'],
    '5289510':['https://on3static.com/cdn-cgi/image/height=320,width=320,format=auto,metadata=none/uploads/assets/904/609/609904.png'],
    '5079689':['https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/texassports_com/images/2026/6/26/Simmons_ColinCropped.png'],
    '5087950':['/hosted/page2_cfb/assets/headshots/kingston-lopa-clean.png','https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/calberk.sidearmsports.com/images/2026/8/13/Kingston_Lopa_Cal__Football_Cropped__26-0226_141318-647_Al_Sermeno.jpg'],
    '5079720':['https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/ohiostatebuckeyes.com/images/2026/8/3/04_Smith__Jeremiah.jpg']
  };
  const CFB_TEAM_FALLBACKS={
    '204':['https://on3static.com/uploads/assets/137/150/150137.svg'],
    '25':['https://commons.wikimedia.org/wiki/Special:Redirect/file/California_Golden_Bears_logo.svg'],
    '167':['https://commons.wikimedia.org/wiki/Special:Redirect/file/New_Mexico_Lobos_wordmark.svg']
  };
  // CBB Page 2 image reliability. Seven current school marks are packaged from the
  // exact approved HTML / last-good ESPN cache. Remaining schools get a real alternate
  // logo source, while player fallbacks point only to the same named athlete.
  const CBB_LOCAL_TEAM_FILES={
    '127':'127.png','2426':'2426.webp','252':'252.png','264':'264.png','96':'96.png','333':'333.png','57':'57.png'
  };
  const CBB_PLAYER_FALLBACKS={
    '5142718':['https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/4685654.png','https://cdn.nba.com/headshots/nba/latest/1040x760/1643407.png'],
    '5281370':['https://images.sidearmdev.com/convert?type=webp&url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fwashington.sidearmsports.com%2Fimages%2F2025%2F9%2F29%2F6_Hannes_Steinbach.png'],
    '4711255':['https://images.sidearmdev.com/convert?type=webp&url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fmsuspartans.com%2Fimages%2F2023%2F9%2F27%2FFears_Jeremy_2324_ZYjkO.jpg'],
    '5105698':['https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/5314522.png'],
    '4848637':['https://ukathletics.com/imgproxy/jb0LXPZrxtJjZ1wnt8G7mTLjQ8w7GXdsVv9v9VjXgiU/fit/600/800/ce/0/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3VrYXRobGV0aWNzLWNvbS8yMDI2LzA2LzJhYTNlODU3LTIwMjZtaWxhbm1vbWNpbG92aWNfMDFjdy1zY2FsZWQuanBn.png'],
    '5242560':['https://images.sidearmdev.com/crop?height=803&type=webp&url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fbgsufalcons.com%2Fimages%2F2025%2F9%2F2%2FCampbell_Javontae_2.png&width=603']
  };
  const CBB_TEAM_FALLBACKS={
    '2132':['https://logotyp.us/file/cincinnati-bearcats.svg'],
    '2460':['https://commons.wikimedia.org/wiki/Special:Redirect/file/Uni_panthers_logo_2000.png'],
    '172':['https://commons.wikimedia.org/wiki/Special:Redirect/file/Cornell_%22C%22_logo.svg'],
    '91':['https://img.athleticbusiness.com/files/base/abmedia/all/image/2022/03/Bellarmine.6228bfcb9b288.png?auto=format%2Ccompress&fit=max&q=70&w=1200']
  };
  const NBA_PAGE1_LOCAL_LOGOS=new Set(['ATL','BKN','BOS','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAS','SAC','TOR','UTA','WAS']);
  const NHL_PAGE1_LOCAL_LOGOS=new Set(['ANA','BOS','BUF','CAR','CBJ','CGY','CHI','COL','DAL','DET','EDM','FLA','LA','MIN','MTL','NJ','NSH','NYI','NYR','OTT','PHI','PIT','SEA','SJ','STL','TB','TOR','UTA','VAN','VGK','WPG','WSH']);
  const MLB_PAGE1_LOCAL_LOGOS=new Set(['ARI','ATH','ATL','BAL','BOS','CHC','CIN','CLE','COL','CWS','DET','HOU','KC','LAA','LAD','MIA','MIL','MIN','NYM','NYY','PHI','PIT','SD','SEA','SF','STL','TB','TEX','TOR','WSH']);
  const WNBA_PAGE1_LOCAL_LOGOS=new Set(['ATL','WAS','IND','NYL','CHI','TOR','CON','MIN','GSV','LVA','DAL','POR','PHX','LAS','SEA']);
  const nbaPage1Logo=team=>{
    if(board!=='page1_nba'||!team)return team?.logo;
    let abbr=String(team.abbr||'').toUpperCase();
    if(abbr==='NY')abbr='NYK';if(abbr==='GS')abbr='GSW';if(abbr==='SA')abbr='SAS';
    return NBA_PAGE1_LOCAL_LOGOS.has(abbr)?`/hosted/page1_nba/assets/local-logos/${abbr}.png`:team.logo;
  };
  const nhlPage1Logo=team=>{
    if(board!=='page1_nhl'||!team)return team?.logo;
    const abbr=String(team.abbr||'').toUpperCase();
    return NHL_PAGE1_LOCAL_LOGOS.has(abbr)?`/hosted/page1_nhl/assets/local-logos/${abbr}.png`:(team.officialLogo||team.logo);
  };
  const mlbPage1Logo=team=>{
    if(board!=='page1_mlb'||!team)return team?.logo;
    let abbr=String(team.abbr||'').toUpperCase();
    if(abbr==='CHW')abbr='CWS';
    return MLB_PAGE1_LOCAL_LOGOS.has(abbr)?`/hosted/page1_mlb/assets/local-logos/${abbr}.png`:team.logo;
  };
  const wnbaPage1Logo=team=>{
    if(board!=='page1_wnba'||!team)return team?.logo;
    let abbr=String(team.abbr||'').toUpperCase();
    const map={NY:'NYL',GS:'GSV',LV:'LVA',WSH:'WAS'};abbr=map[abbr]||abbr;
    return WNBA_PAGE1_LOCAL_LOGOS.has(abbr)?`/hosted/page1_wnba/assets/local-logos/${abbr}.png`:team.logo;
  };
  const cfbTeamImage=team=>board==='page2_cfb'&&team?.id&&CFB_LOCAL_TEAM_IDS.has(String(team.id))?`/hosted/page2_cfb/assets/local-logos/${team.id}.png`:team?.logo;
  const cbbTeamImage=team=>board==='page2_cbb'&&team?.id&&CBB_LOCAL_TEAM_FILES[String(team.id)]?`/hosted/page2_cbb/assets/local-logos/${CBB_LOCAL_TEAM_FILES[String(team.id)]}`:team?.logo;
  const boardTeamImage=team=>board==='page1_nba'?nbaPage1Logo(team):board==='page1_nhl'?nhlPage1Logo(team):board==='page1_mlb'?mlbPage1Logo(team):board==='page1_wnba'?wnbaPage1Logo(team):board==='page2_cfb'?cfbTeamImage(team):board==='page2_cbb'?cbbTeamImage(team):team?.logo;
  const boardTeamFallbacks=team=>board==='page2_cfb'?(CFB_TEAM_FALLBACKS[String(team?.id)]||[]):board==='page2_cbb'?(CBB_TEAM_FALLBACKS[String(team?.id)]||[]):[];
  const boardPlayerFallbacks=player=>board==='page2_cfb'?(CFB_PLAYER_FALLBACKS[String(player?.id)]||[]):board==='page2_cbb'?(CBB_PLAYER_FALLBACKS[String(player?.id)]||[]):[];
  const armImageFallbacks=(img,fallbacks=[])=>{
    if(!img)return;
    const clean=[...new Set((fallbacks||[]).filter(Boolean))];
    if(clean.length){img.dataset.mcFallbacks=JSON.stringify(clean);img.dataset.mcFallbackIndex='0';}
    else {delete img.dataset.mcFallbacks;delete img.dataset.mcFallbackIndex;}
    delete img.dataset.mcDirectRetry;
  };
  const setImageNode=(img,url,alt='',fallbacks=[])=>{if(img&&url){armImageFallbacks(img,fallbacks);img.src=imageURL(url);img.alt=alt;img.classList.remove('asset-missing');img.style.removeProperty('display');}};
  const setText=(selector,value,root=document)=>{const node=$(selector,root);if(node && value!==undefined && value!==null)node.textContent=String(value);};
  const setImage=(selector,url,root=document,alt='',fallbacks=[])=>{const img=$(selector,root);setImageNode(img,url,alt,fallbacks);};
  const record=team=>team.record?.replace(/,.*$/,'') || [team.wins,team.losses,...(sport==='nhl'?[team.otLosses ?? 0]:(team.ties?[team.ties]:[]))].filter(v=>v!==null&&v!==undefined).join('-');
  const favorite={nfl:'7',nba:'2',nhl:'1',mlb:'2',wnba:'5',cfb:'12',cbb:'12'}[sport];
  let lastFeed=null, refreshPending=false, tickerConfig=null, tickerFingerprint='', errors=[];
  const zone=sport==='cfb'&&board.startsWith('page3_')?'America/Phoenix':'America/New_York';
  const zoneLabel=zone==='America/Phoenix'?'AZ':'ET';
  const fmt=event=>event.timeValid===false?'TIME TBD':new Date(event.date).toLocaleString('en-US',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).replace(',',' ·').toUpperCase()+' '+zoneLabel;
  function report(ok,message) {parent.postMessage({type:'mc-live-status',board,ok,msg:message,at:Date.now()},origin);}
  function fit() {
    let node=null, width=1080,height=1920;
    if(board.startsWith('page3_'))node=$('#board');
    else if(board==='page2_nba'){node=$('#stage');width=1080;height=1920;}
    else if(board.startsWith('page2_'))node=$('#stage');
    else if(['page1_nhl','page1_wnba','page1_cfb'].includes(board))node=$('#shell');
    else if(board==='page1_mlb')node=$('#stage');
    if(!node)return;
    const scale=Math.min(innerWidth/width,innerHeight/height);
    const left=(innerWidth-width*scale)/2,top=(innerHeight-height*scale)/2;
    if(board==='page2_cbb') {
      const wrap=$('#fit');if(wrap){wrap.style.width=width*scale+'px';wrap.style.height=height*scale+'px';wrap.style.position='absolute';wrap.style.left=left+'px';wrap.style.top=top+'px';}
      node.style.setProperty('position','absolute','important');node.style.setProperty('left','0px','important');node.style.setProperty('top','0px','important');
    } else {
      node.style.setProperty('position','absolute','important');node.style.setProperty('left',left+'px','important');node.style.setProperty('top',top+'px','important');
    }
    node.style.setProperty('transform-origin','0 0','important');node.style.setProperty('transform',`scale(${scale})`,'important');
    node.style.setProperty('width',width+'px','important');node.style.setProperty('height',height+'px','important');
  }
  function proxyImages(root=document) {
    $$('img[src]',root).forEach(img=>{
      const src=img.getAttribute('src');
      // NFL, NBA, NHL, MLB, WNBA and CFB Page 2 get one direct-CDN retry if the localhost image proxy cannot
      // reach ESPN. Do not immediately re-proxy that retry via the observer.
      if(['page1_nba','page1_mlb','page1_wnba','page2_nfl','page2_nba','page2_nhl','page2_mlb','page2_wnba','page2_cfb','page2_cbb'].includes(board)&&img.dataset.mcDirectRetry==='1')return;
      if(!src || src.startsWith(origin+'/proxy') || src.startsWith('/proxy'))return;
      const proxied=imageURL(src);if(proxied!==src)img.src=proxied;
    });
  }
  function tickerElement() {return $('#track,#tickerTrack,.wnbaTickerTrack,.tickerTrack,.ticker-track,.ticker .track');}
  function configureTicker(track) {
    if(tickerConfig)return tickerConfig;
    const sample=track.querySelector('.item,.tickerGame,.ticker-game,.wnbaTickerGame,.tickgame,.game')||track.firstElementChild;
    const img=sample?.querySelector('img'), text=sample?.querySelector('.time,.tickerTime,.kick,small')||sample;
    const css=text?getComputedStyle(text):getComputedStyle(track), imageCSS=img?getComputedStyle(img):null;
    tickerConfig={font:css.fontSize,logoW:imageCSS?.width||'28px',logoH:imageCSS?.height||'28px',family:css.fontFamily,color:css.color};
    return tickerConfig;
  }
  function filteredTicker(feed) {
    let selected=feed.ticker?.selected||[];
    // Preserve AP TOP 25 + ARIZONA identity on the Arizona football ticker.
    if(sport==='cfb'&&board==='page3_arizona_cfb') selected=selected.filter(e=>e.away.id===favorite||e.home.id===favorite||Number(e.away.seed)<=25&&Number(e.away.seed)>0||Number(e.home.seed)<=25&&Number(e.home.seed)>0);
    return selected;
  }
  // Board 9 private NBA Page 2 source-retention and ticker behavior.
  const nbaP2AwardKey='nba_p2_last_valid_award_v7p';
  const nbaP2TickerKey='nba_p2_last_valid_ticker_v7p';
  function nbaP2ValidAward(data){
    const a=data?.items?.[0];
    return !!(a && typeof a.name==='string' && a.name.trim() && typeof a.publisher==='string' && a.publisher.trim() && typeof a.date==='string' && a.date.trim());
  }
  function nbaP2PreserveAward(feed){
    if(board!=='page2_nba')return feed;
    const current=feed?.awards;
    if(nbaP2ValidAward(current)){
      try{localStorage.setItem(nbaP2AwardKey,JSON.stringify({awards:current,savedAt:Date.now()}));}catch(_){}
      return feed;
    }
    try{
      const saved=JSON.parse(localStorage.getItem(nbaP2AwardKey));
      const expectedSeason=current?.season ?? feed?.context?.year;
      if(saved?.awards && saved.awards.season===expectedSeason && nbaP2ValidAward(saved.awards))return {...feed,awards:saved.awards};
    }catch(_){}
    return feed;
  }
  function nbaP2EligibleTickerEvent(e){
    if(!e?.away || !e?.home || !e?.date)return false;
    if(e.completed || e.state==='post')return false;
    if(/postponed|cancelled|canceled|suspended/i.test(e.status||''))return false;
    return e.state==='in' || e.state==='pre';
  }
  function nbaP2SelectTicker(feed,now=Date.now()){
    if(board!=='page2_nba')return feed;
    const raw=(feed.ticker?.selected||[]).filter(nbaP2EligibleTickerEvent);
    const unique=[...new Map(raw.map(e=>[String(e.id),e])).values()];
    const live=unique.filter(e=>e.state==='in').sort((a,b)=>new Date(a.date)-new Date(b.date));
    let selected=[],selection='nba-48h',message='';
    if(live.length){selected=live;selection='live';}
    else if(feed.context?.mode==='offseason'){selection='offseason';message='SEE YOU NEXT SEASON';}
    else{
      const future=unique.filter(e=>e.state==='pre'&&new Date(e.date).getTime()>=now).sort((a,b)=>new Date(a.date)-new Date(b.date));
      const cutoff=now+48*60*60*1000;
      const within=future.filter(e=>new Date(e.date).getTime()<=cutoff);
      if(within.length){selected=within;selection='nba-48h';}
      else if(future.length){selected=[future[0]];selection='nba-next';}
      else{
        try{
          const saved=JSON.parse(localStorage.getItem(nbaP2TickerKey));
          const kept=(saved?.selected||[]).filter(nbaP2EligibleTickerEvent).filter(e=>e.state==='in'||new Date(e.date).getTime()>=now);
          if(kept.length){selected=kept;selection=saved.selection||'nba-last-valid';}
          else message='NEXT NBA GAME TBD';
        }catch(_){message='NEXT NBA GAME TBD';}
      }
    }
    const ticker={...(feed.ticker||{}),selected,selection,message};
    if(selected.length){try{localStorage.setItem(nbaP2TickerKey,JSON.stringify({selected,selection,savedAt:Date.now()}));}catch(_){}}
    return {...feed,ticker};
  }
  function nbaP2Apply(feed){return nbaP2SelectTicker(nbaP2PreserveAward(feed));}
  function paintTicker(feed,force=false) {
    let track=tickerElement();
    if(!track&&board==='page1_mlb') {
      const footer=$('.ticker');if(footer){const pill=$('.pill',footer);$$(':scope > span:not(.pill)',footer).forEach(e=>e.remove());const viewport=document.createElement('div');viewport.style.cssText='min-width:0;flex:1;overflow:hidden;height:100%;display:flex;align-items:center';track=document.createElement('div');viewport.append(track);footer.append(viewport);}
    }
    if(!track)return;
    const events=filteredTicker(feed), finger=JSON.stringify(events.map(e=>[e.id,e.date,e.state,e.away.score,e.home.score,e.status,e.timeValid,e.away.logo,e.home.logo]));
    if(!force&&finger===tickerFingerprint&&track.classList.contains('mc-ticker-track'))return;
    tickerFingerprint=finger;
    const previousTransform=getComputedStyle(track).transform;
    const previousOffset=previousTransform.startsWith('matrix(')?Math.abs(Number(previousTransform.slice(7,-1).split(',')[4])||0):0;
    const config=configureTicker(track), root=$('#board,.board,#stage,#shell')||document.body;
    track.classList.add('mc-ticker-track');
    track.style.setProperty('--mc-ticker-font',config.font);
    track.style.setProperty('--mc-ticker-logo-w',config.logoW);
    track.style.setProperty('--mc-ticker-logo-h',config.logoH);
    track.style.fontFamily=config.family;
    const item=event=>{
      let detail=fmt(event);
      if(event.state==='in')detail=`${event.away.score??'—'}–${event.home.score??'—'} · ${event.status||'LIVE'}`;
      else if(event.completed||event.state==='post')detail=`${event.away.score??'—'}–${event.home.score??'—'} · FINAL`;
      const tickerAbbr=['nba','mlb','wnba','cfb','cbb'].includes(sport)||board==='page1_nhl';
      const awayAbbr=tickerAbbr?`<b class="mc-ticker-abbr">${esc(event.away.abbr)}</b>`:'';
      const homeAbbr=tickerAbbr?`<b class="mc-ticker-abbr">${esc(event.home.abbr)}</b>`:'';
      const awayLogo=boardTeamImage(event.away),homeLogo=boardTeamImage(event.home);
      return `<div class="mc-ticker-item" title="${esc(event.away.name+' at '+event.home.name)}"><img class="mc-ticker-logo" src="${esc(imageURL(awayLogo))}" alt="${esc(event.away.abbr)}">${awayAbbr}<span>@</span><img class="mc-ticker-logo" src="${esc(imageURL(homeLogo))}" alt="${esc(event.home.abbr)}">${homeAbbr}<span class="mc-ticker-status">${esc(detail)}</span></div>`;
    };
    const emptyMessage=feed.ticker?.message||(board==='page2_nba'?'NEXT NBA GAME TBD':'NO RECENT FINALS OR GAMES IN THE NEXT 7 DAYS');
    const html=events.length?events.map(item).join(''):`<div class="mc-ticker-item">${esc(emptyMessage)}</div>`;
    track.innerHTML=`<div class="mc-ticker-set">${html}</div>`;
    const set=track.firstElementChild;
    // Fill one loop at least as wide as its viewport, then duplicate that set.
    const viewport=track.parentElement;
    let copies=0;
    while(set.offsetWidth<viewport.clientWidth&&copies<8){set.insertAdjacentHTML('beforeend',html);copies++;}
    const twin=set.cloneNode(true);twin.setAttribute('aria-hidden','true');track.append(twin);
    const distance=set.offsetWidth;
    const ratio=root.getBoundingClientRect().width/(root.offsetWidth||1);
    const displayWidth=root.getBoundingClientRect().width;
    const duration=displayWidth>0?distance*ratio/(24*displayWidth/720):60;
    track.style.setProperty('--mc-ticker-distance',distance+'px');
    track.style.setProperty('--mc-ticker-duration',Math.max(20,duration)+'s');
    if(previousOffset&&distance>0)requestAnimationFrame(()=>{
      const animation=track.getAnimations?.().find(a=>a.animationName==='mc-production-ticker');
      if(animation)animation.currentTime=(previousOffset%distance)/distance*Math.max(20,duration)*1000;
    });
    track.dataset.selection=feed.ticker?.selection||'';
    track.dataset.games=events.length;
    setText('.ticker-label',feed.ticker?.selection==='live'?'LIVE':'SCORES / NEXT 7 DAYS');
  }
  function flatTeams(feed) {return (feed.standings?.groups||[]).flatMap(g=>g.entries||[]);}
  const aliases={sixers:'76ers',blazers:'trailblazers',wolves:'timberwolves',cavs:'cavaliers',mavs:'mavericks',habs:'canadiens',leafs:'mapleleafs',jackets:'bluejackets',as:'athletics',chisox:'whitesox',niners:'49ers'};
  function findTeam(label,teams) {
    let wanted=norm(label);wanted=aliases[wanted]||wanted;
    return teams.find(t=>[t.name,t.short,t.abbr].some(v=>norm(v)===wanted))||teams.find(t=>norm(t.name).endsWith(wanted)&&wanted.length>=4);
  }
  function updateStandings(feed) {
    const teams=flatTeams(feed);if(!teams.length)return 0;
    const cfg={nfl:['.teamrow','.teamName','.record'],nba:['.standing-row','.team-name','.record'],nhl:['.srow','.sname','.srec'],mlb:['.standRow','.standName','.standRec'],wnba:['.standing-row','.teamname','.record']}[sport];
    if(!cfg)return 0;
    let count=0;const parents=new Map();
    $$(cfg[0]).forEach(row=>{
      const name=$(cfg[1],row);if(!name)return;
      const label=row.dataset.teamLabel||name.childNodes[0]?.textContent?.trim()||name.textContent.trim();row.dataset.teamLabel=label;
      const team=findTeam(label,teams);if(!team)return;
      row.dataset.teamId=team.id;row.__mcTeam=team;setText(cfg[2],record(team),row);count++;
      if(sport==='nhl')setText('.pts',team.points??'—',row);
      if(!parents.has(row.parentElement))parents.set(row.parentElement,[]);parents.get(row.parentElement).push(row);
    });
    parents.forEach(rows=>{
      rows.sort((a,b)=>sport==='nfl'||sport==='mlb'?(Number(b.__mcTeam.pct)-Number(a.__mcTeam.pct))||(Number(a.__mcTeam.seed)-Number(b.__mcTeam.seed)):Number(a.__mcTeam.seed||999)-Number(b.__mcTeam.seed||999));
      const parent=rows[0].parentElement;
      rows.forEach((row,i)=>{
        parent.append(row);setText('.rank',i+1,row);
        if(sport==='nba'){row.classList.remove('playoff','playin','out');row.classList.add(i<6?'playoff':i<10?'playin':'out');}
      });
    });
    return count;
  }
  function applyTeamRow(row,team,seed,score,selectors) {
    const [seedSel,nameSel,scoreSel,imgSel]=selectors;
    row.classList.remove('winner','win','adv','out');
    if(!team) {
      if(seedSel)setText(seedSel,'—',row);setText(nameSel,'TBD',row);if(scoreSel)setText(scoreSel,'',row);const img=$(imgSel,row);if(img)img.style.visibility='hidden';return;
    }
    if(seedSel)setText(seedSel,seed??team.seed??'—',row);
    setText(nameSel,board==='page1_nfl'?team.abbr:team.short||team.name,row);
    if(scoreSel)setText(scoreSel,score??'',row);
    const img=$(imgSel,row),logo=boardTeamImage(team);if(img&&logo){img.style.visibility='visible';img.src=imageURL(logo);img.alt=team.name;}
    row.title=team.name;
  }
  function updateNFLBracket(feed) {
    const teams=flatTeams(feed), mode=feed.context.mode;
    const groups=feed.standings?.groups||[];
    const byConf={AFC:[],NFC:[]};
    for(const group of groups){const conf=/AFC|American Football/i.test(group.name)?'AFC':/NFC|National Football/i.test(group.name)?'NFC':null;if(conf)byConf[conf].push(...group.entries);}
    for(const conf of ['AFC','NFC']) {
      const pool=byConf[conf].sort((a,b)=>Number(a.seed||999)-Number(b.seed||999));
      const root=$$('.huntSide').find(n=>$('.huntLabel',n)?.textContent===conf);
      if(root)$$('.huntCard',root).forEach((card,i)=>{const t=pool[i+7];if(t){setText('.huntName',t.short,card);setText('.huntRec',record(t),card);setImage('img',t.logo,card,t.name);}});
      if(mode==='season') {
        $$(`.treeGame.${conf.toLowerCase()} .treeRow:not(.placeholder)`).forEach(row=>{
          const seed=Number($('.treeSeed',row)?.textContent),team=pool.find(t=>Number(t.seed)===seed);if(team)applyTeamRow(row,team,seed,record(team),['.treeSeed','.treeName','.treeRec','img']);
        });
      }
    }
    const actual=feed.postseason||[];
    if(mode!=='season'&&actual.length) {
      const round=note=>/super bowl/i.test(note)?'superbowl':/conference championship|afc championship|nfc championship/i.test(note)?'confchamp':/divisional/i.test(note)?'divr':/wild card/i.test(note)?'wc':null;
      const grouped={};for(const e of actual){const r=round(e.note);if(!r)continue;const conf=byConf.AFC.some(t=>t.id===e.away.id)?'afc':'nfc';const key=r==='superbowl'?r:r+' '+conf;(grouped[key]||=[]).push(e);}
      for(const [key,events] of Object.entries(grouped)) {
        const boxes=key==='superbowl'?$$('.treeGame.superbowl'):$$('.treeGame.'+key.replace(' ','.'));
        events.sort((a,b)=>a.date.localeCompare(b.date));boxes.forEach((box,i)=>{const e=events[i];if(!e)return;$$('.treeRow',box).forEach((row,j)=>{row.classList.remove('placeholder');const t=j===0?e.away:e.home;let img=$('img',row);if(!img){const slot=$('.treeLogo',row);if(slot){img=document.createElement('img');slot.append(img);}}applyTeamRow(row,t,t.seed,t.score,['.treeSeed','.treeName','.treeRec','img']);});});
      }
    }
    setText('.treeSubLabel',mode==='season'?'CURRENT PROJECTED SEEDS':`${feed.context.label} ${mode==='postseason'?'LIVE PLAYOFF STATUS':'COMPLETED PLAYOFFS'}`);
    const titles=$$('.board > .sectionTitle');if(titles[1])titles[1].textContent=mode==='season'?'IF THE PLAYOFFS STARTED TODAY • BRACKET':`${feed.context.label} PLAYOFF TREE`;
  }
  function paintMatch(box,match,rowSelector,fields) {
    if(!box)return;
    const members=[...(match?.teams||[])].sort((a,b)=>Number(a?.seed||999)-Number(b?.seed||999));
    $$(rowSelector,box).forEach((row,i)=>{
      const team=members[i];
      if(team&&!$(fields[3],row)) {
        const holder=$('.treeLogo,.teamlogo,.mini,.fflogoCell,.placeholder-logo',row);
        if(holder){if(holder.classList.contains('placeholder-logo')){holder.className='teamlogo';holder.textContent='';}holder.append(document.createElement('img'));}
      }
      if(team)row.classList.remove('placeholder','placeholder-team');
      applyTeamRow(row,team,team?.seed,team?.score,fields);
      if(team&&match?.winner===team.id)row.classList.add('winner','win','adv');
    });
    box.dataset.eventId=match?.eventId||'';box.title=match?.summary||'CURRENT SEED PROJECTION • WINNER TBD';
    if(match){setText('.gameNote',match.summary,box);setText('.match-head',match.stage.toUpperCase()+' • '+(match.winner?'FINAL':match.state==='in'?'LIVE':match.state==='pre'?'UPCOMING':'SERIES STATUS'),box);}
    else setText('.gameNote','WINNER TBD',box);
  }
  function updateNbaPage1Mode(feed,model){
    if(board!=='page1_nba')return;
    const mode=feed.context.mode, label=feed.context.label, year=Number(feed.context.year||0);
    const seasonLabel=mode==='season'||mode==='postseason'?`${year-1}–${String(year).slice(-2)}`:label;
    setText('.header .mode',mode==='preseason'?'PRESEASON MODE':mode==='season'?'REGULAR SEASON':mode==='postseason'?'POSTSEASON':'OFFSEASON');
    setText('.header .sub',mode==='season'?'NBA • STANDINGS & PLAYOFF WATCH':mode==='postseason'?'NBA • STANDINGS & PLAYOFF TREE':`NBA • STANDINGS & ${model?.season||feed.context.statsYear} PLAYOFF RECAP`);
    setText('.standings .section-title > span',`${seasonLabel} ${mode==='season'?'LIVE':'FINAL'} STANDINGS`);
    setText('.standings .section-title > small',mode==='preseason'?'REFERENCE UNTIL OCT 20':mode==='season'?'TOP 6 PLAYOFFS • 7–10 PLAY-IN':mode==='postseason'?'FINAL REGULAR-SEASON SEEDS':'LAST COMPLETED REGULAR SEASON');
  }
  function updateNhlPage1Mode(feed,model){
    if(board!=='page1_nhl')return;
    const mode=feed.context.mode, label=feed.context.label, year=Number(model?.season||feed.context.statsYear||0);
    const seasonText=mode==='season'?`${label} SEASON • CURRENT PLAYOFF PROJECTION`:mode==='postseason'?`${label} POSTSEASON • CURRENT PLAYOFF STATUS`:`${label} • ${year} STANLEY CUP PLAYOFF RECAP`;
    setText('.header .sub',seasonText);
    setText('.section-title small',mode==='season'?'CURRENT SNAPSHOT • BOSTON HIGHLIGHTED • NHL OFFICIAL ORDER':mode==='postseason'?'FINAL REGULAR-SEASON SEEDS • BOSTON HIGHLIGHTED':'LAST COMPLETED SEASON • BOSTON HIGHLIGHTED');
    setText('.note',mode==='season'?'IF THE PLAYOFFS STARTED TODAY • FIRST-ROUND FIELD ONLY • LATER ROUNDS AND WINNERS REMAIN TBD':mode==='postseason'?'CURRENT STANLEY CUP PLAYOFF STATUS • ACTUAL RESULTS ONLY':`${year} STANLEY CUP PLAYOFF TREE • COMPLETED RESULTS`);
  }
  function updateMlbPage1Mode(feed,model){
    if(board!=='page1_mlb')return;
    const mode=feed.context.mode, year=Number(model?.season||feed.context.statsYear||0);
    const finalStandings=mode==='postseason'||mode==='offseason'||mode==='preseason';
    setText('.subtitle',mode==='season'?`${year} DIVISION STANDINGS • CURRENT POSTSEASON PROJECTION`:mode==='postseason'?`FINAL ${year} DIVISION STANDINGS • CURRENT POSTSEASON STATUS`:`FINAL ${year} DIVISION STANDINGS • ${year} POSTSEASON RECAP`);
    setText('.sectionTitle > span','DIVISION STANDINGS');
    setText('.sectionTitle > small',finalStandings?'REGULAR SEASON FINAL':'CURRENT REGULAR SEASON');
    setText('.elimTitle > small','BOSTON HIGHLIGHTED');
  }
  function updateWnbaPage1Mode(feed,model){
    if(board!=='page1_wnba')return;
    const mode=feed.context.mode,year=Number(model?.season||feed.context.statsYear||0);
    const sub=mode==='season'?`CURRENT ${year} CONFERENCE STANDINGS • PLAYOFF PROJECTION`:mode==='postseason'?`FINAL ${year} CONFERENCE STANDINGS • CURRENT WNBA PLAYOFF STATUS`:`FINAL ${year} CONFERENCE STANDINGS • ${year} POSTSEASON RECAP`;
    setText('.header .sub',sub);
    const topTitle=$$('.section-title').find(n=>!n.classList.contains('bracket-title'));
    if(topTitle)setText('small',mode==='season'?'CURRENT REGULAR SEASON':'REGULAR SEASON FINAL',topTitle);
  }
  function updateProBracket(feed) {
    const model=feed.playoffs;if(!model)return;
    const actual=model.kind==='actual', matches=model.matches||[];
    const group=(stage,conf='')=>matches.filter(m=>m.stage===stage&&(!conf||m.conference===conf));
    const status=actual?(feed.context.mode==='postseason'?'CURRENT PLAYOFF STATUS':'LAST COMPLETED PLAYOFFS'):'CURRENT PROJECTED SEEDS';
    const finals=group(sport==='mlb'?'world':'final')[0];
    const winner=finals?.teams.find(t=>t&&t.id===finals.winner);
    if(sport==='nfl') {
      updateNFLBracket({...feed,postseason:[]});
      const fields=['.treeSeed','.treeName','.treeRec','img'];
      if(actual){['afc','nfc'].forEach(conf=>[['first','wc'],['second','divr'],['conference','confchamp']].forEach(([stage,cls])=>$$('.treeGame.'+cls+'.'+conf).forEach((box,i)=>paintMatch(box,group(stage,conf)[i],'.treeRow',fields))));paintMatch($('.treeGame.superbowl'),finals,'.treeRow',fields);}
      return;
    }
    if(sport==='nba') {
      const boxes=$$('.matchup'),fields=['.seed','.abbr','strong','img'];
      const put=(indices,stage,conf)=>indices.forEach((n,i)=>paintMatch(boxes[n],group(stage,conf)[i],'.mrow',fields));
      put([0,1,2,3],'first','east');put([4,5],'second','east');put([6],'conference','east');
      paintMatch(boxes[7],finals,'.mrow',fields);put([8],'conference','west');put([9,10],'second','west');put([11,12,13,14],'first','west');
      setText('.playoffs .section-title > span',model.season+' NBA PLAYOFF TREE');
      setText('.playoffs .section-title > small',winner?winner.name.toUpperCase()+' • CHAMPIONS':status);
      updateNbaPage1Mode(feed,model);
      const champ=$('.champion');
      if(champ){
        if(winner){setImage('.champ-logo img',boardTeamImage(winner),champ,winner.name);setText('.logo-fallback',winner.abbr||'',champ);setText('b',`${model.season} CHAMPS`,champ);champ.style.visibility='visible';}
        else if(!actual){setText('b','CHAMPION TBD',champ);const img=$('.champ-logo img',champ);if(img)img.style.visibility='hidden';}
      }
    }
    if(sport==='mlb') {
      const fields=['.seed','.bName','.series','img'];
      const realTeam=t=>t&&String(t.abbr||'').toUpperCase()!=='TBD'&&String(t.name||'').toUpperCase()!=='TBD';
      ['al','nl'].forEach(conf=>{
        const boxes=$$('.game.'+conf), byStage={wc:boxes.slice(0,2),ds:boxes.slice(2,4),cs:boxes.slice(4,5)};
        [['wc',2],['ds',2],['cs',1]].forEach(([stage,count])=>{for(let i=0;i<count;i++){
          const box=byStage[stage][i];if(!box)continue;
          let match=group(conf+stage)[i];
          if(!actual&&stage==='wc')match=group('first',conf)[i];
          if(!actual&&stage==='ds'){
            const pool=flatTeams(feed).filter(t=>t.path.some(p=>p.includes(conf==='al'?'American':'National'))).sort((a,b)=>Number(a.seed)-Number(b.seed));
            match={stage:conf+stage,conference:conf,teams:[pool[i]?{...pool[i],score:''}:null,null],summary:'WINNER TBD'};
          }
          if(!actual&&stage==='cs')match=null;
          paintMatch(box,match,'.bTeam',fields);
          const title=stage==='wc'?'WILD CARD':stage==='ds'?conf.toUpperCase()+'DS':conf.toUpperCase()+'CS';
          setText('.gameTitle',title+(match?.winner?' • FINAL':match?.state==='in'?' • LIVE':''),box);
          if($('.gameNote',box))setText('.gameNote',match?.summary||(actual?'SERIES TBD':'WINNER TBD'),box);
        }});
      });
      setText('.postTitle > span',model.season+' '+(actual?'POSTSEASON BRACKET':'PROJECTED POSTSEASON'));
      setText('.postTitle small',feed.context.mode==='postseason'?'CURRENT SERIES STATUS':status);
      const finalTeams=(finals?.teams||[]).filter(realTeam);
      if(winner)setText('.worldBox span',finals.summary);
      else if(finalTeams.length===2)setText('.worldBox span',finals?.state==='pre'?'UPCOMING • '+fmt(finals):(finals?.summary||'SERIES STATUS'));
      else setText('.worldBox span',feed.context.mode==='postseason'?'MATCHUP TBD • STARTS OCTOBER 23':actual?'COMPLETED WORLD SERIES':'MATCHUP TBD • WINNERS NOT PROJECTED');
      updateMlbPage1Mode(feed,model);
      if(actual){
        const stageRank={alwc:1,nlwc:1,alds:2,nlds:2,alcs:3,nlcs:3,world:4}, eliminated=new Map();
        for(const m of matches){if(!m.winner)continue;for(const t of m.teams||[]){if(t&&t.id!==m.winner&&realTeam(t))eliminated.set(String(t.id),{team:t,stage:m.stage,rank:stageRank[m.stage]||0});}}
        let list=[...eliminated.values()].sort((a,b)=>(b.team.id===favorite)-(a.team.id===favorite)||b.rank-a.rank||String(a.team.name).localeCompare(String(b.team.name)));
        const favIndex=list.findIndex(x=>String(x.team.id)===String(favorite));if(favIndex>0)list.unshift(list.splice(favIndex,1)[0]);
        $$('.elimCard').forEach((card,i)=>{const item=list[i];if(!item)return;const t=item.team;setImage('.elimLogo img',boardTeamImage(t),card,t.name);setText('.elimLogo span',t.abbr,card);setText('strong',t.short||t.name,card);setText('small',(item.stage||'').toUpperCase().replace('ALWC','AL WC').replace('NLWC','NL WC').replace('ALDS','ALDS').replace('NLDS','NLDS').replace('ALCS','ALCS').replace('NLCS','NLCS'),card);card.classList.toggle('favorite',String(t.id)===String(favorite));});
      }
    }
    if(sport==='wnba') {
      const fields=['.seed','.br-name','.series','img'];
      const title=(box,label,match)=>{
        if(!box)return;
        const state=match?.winner?'FINAL':match?.state==='in'?'LIVE':match?.state==='pre'?'UPCOMING':'SERIES STATUS';
        setText('.match-head',label+' • '+state,box);
      };
      const first=group('first');const left=$$('.round-col')[0],right=$$('.round-col').at(-1);
      const topSeed=m=>Math.min(...(m?.teams||[]).filter(Boolean).map(t=>Number(t.seed||999)));
      const firstOrdered=[first.find(m=>topSeed(m)===1),first.find(m=>topSeed(m)===4),first.find(m=>topSeed(m)===2),first.find(m=>topSeed(m)===3)];
      [left,right].forEach((col,i)=>$$('.match',col).forEach((box,j)=>{const match=firstOrdered[i*2+j];paintMatch(box,match,'.team-line',fields);title(box,'FIRST ROUND',match);}));
      const semis=group('second');const semiOrdered=[...semis].sort((a,b)=>topSeed(b)-topSeed(a));
      $$('.semis').forEach(col=>$$('.match',col).forEach((box,i)=>{const match=semiOrdered[i];paintMatch(box,match,'.team-line',fields);title(box,'SEMIFINAL',match);}));
      setText('.bracket-title > span',model.season+' '+(actual?'POSTSEASON BRACKET':'PROJECTED PLAYOFF FIELD'));setText('.bracket-title small',status);
      const finalLabel=finals?(winner?finals.summary:finals.teams.map(t=>t.abbr).join(' @ ')+' • '+(finals.state==='pre'?new Date(finals.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}):finals.summary)):status;
      setText('.finals-card span',finalLabel);
      updateWnbaPage1Mode(feed,model);
      if(actual){
        const stageRank={first:1,second:2,final:3}, eliminated=new Map();
        for(const m of matches){if(!m.winner)continue;for(const t of m.teams||[]){if(t&&t.id!==m.winner){const previous=eliminated.get(String(t.id));const rank=stageRank[m.stage]||0;if(!previous||rank>previous.rank)eliminated.set(String(t.id),{team:t,stage:m.stage,rank});}}}
        let list=[...eliminated.values()].sort((a,b)=>(b.team.id===favorite)-(a.team.id===favorite)||b.rank-a.rank||Number(a.team.seed||999)-Number(b.team.seed||999));
        const favIndex=list.findIndex(x=>String(x.team.id)===String(favorite));if(favIndex>0)list.unshift(list.splice(favIndex,1)[0]);
        $$('.elim-card').forEach((card,i)=>{const item=list[i];if(!item)return;const t=item.team;setImage('img',boardTeamImage(t),card,t.name);setText('.logo-fallback',t.abbr||'',card);setText('.name',t.short||t.name,card);setText('.why',item.stage==='second'?'SEMIFINAL':item.stage==='first'?'R1':'FINALS',card);card.classList.toggle('favorite',String(t.id)===String(favorite));});
        const footer=$$('.footer > span:not(.pill)');
        if(footer[0])footer[0].innerHTML='<span class="dot">•</span> '+esc(semis[0]?.summary||'SEMIFINAL STATUS');
        if(footer[1])footer[1].innerHTML='<span class="dot">•</span> '+esc(semis[1]?.summary||'SEMIFINAL STATUS');
        if(footer[2])footer[2].innerHTML='<span class="dot">•</span> '+esc(finals?.state==='pre'?'FINALS BEGIN '+new Date(finals.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase():finals?.summary||'FINALS STATUS');
      }
    }
    if(sport==='nhl') {
      const cols=$$('.bracket > .col'),fields=[null,'span:nth-child(2)','b','img'];
      [[cols[0],'first','west'],[cols[1],'second','west'],[cols[2],'conference','west'],[cols[3],'conference','east'],[cols[4],'second','east'],[cols[5],'first','east']].forEach(([col,stage,conf])=>{if(col)$$('.match',col).forEach((box,i)=>paintMatch(box,group(stage,conf)[i],'.mteam',fields));});
      setText('.bracket-title > span',model.season+' '+(actual?'STANLEY CUP PLAYOFF TREE':'STANLEY CUP PLAYOFF PROJECTION'));setText('.bracket-title small',winner?winner.name.toUpperCase()+' • CHAMPIONS':status);
      setText('.finalbox span',actual?(finals?.summary||'SERIES TBD'):'MATCHUP TBD • WINNERS NOT PROJECTED');
      setText('.champs',winner?winner.name.toUpperCase()+' • CHAMPIONS':actual?'ROAD TO THE STANLEY CUP':'CHAMPION TBD');
      updateNhlPage1Mode(feed,model);
    }
  }
  function paintCollegeRecap(feed) {
    if(sport!=='cfb')return;
    const matches=feed.playoffs?.matches||[], columns=$$('.bracket > .col');
    const fields=['.seed','.mn','b','img'];
    const stageMatches=stage=>matches.filter(m=>m.stage===stage);
    const first=stageMatches('first'),used=new Set();
    const choose=(box,list)=>{
      const seeds=$$('.seed',box).map(n=>Number(n.textContent)).filter(Boolean);
      const match=list.find(m=>!used.has(m)&&m.teams.some(t=>seeds.includes(Number(t?.seed))))||list.find(m=>!used.has(m));
      if(match)used.add(match);return match;
    };
    [columns[0],columns[5]].forEach(col=>{if(col)$$('.match',col).forEach(box=>paintMatch(box,choose(box,first),'.mteam',fields));});
    used.clear();const quarter=stageMatches('second');
    [columns[1],columns[4]].forEach(col=>{if(col)$$('.match',col).forEach(box=>paintMatch(box,choose(box,quarter),'.mteam',fields));});
    used.clear();const semi=stageMatches('conference');
    [columns[2],columns[3]].forEach(col=>{if(col)$$('.match',col).forEach(box=>paintMatch(box,choose(box,semi),'.mteam',fields));});
    const final=stageMatches('final')[0],winner=final?.teams.find(t=>t.id===final.winner);
    setText('.bracket-title > span',feed.context.label+' CFP PLAYOFF TREE');
    setText('.bracket-title small',feed.context.mode==='postseason'?'CURRENT PLAYOFF STATUS':'LAST COMPLETED PLAYOFFS');
    setText('.finalbox span',final?(final.teams.map(t=>t.short||t.abbr).join(' @ ')+' • '+final.teams.map(t=>t.score||'—').join('–')):'NATIONAL CHAMPIONSHIP • TBD');
    const champ=$('.champ');if(champ)champ.innerHTML=esc(winner?winner.short.toUpperCase()+' • CHAMPION':'CHAMPION TBD')+'<small>'+esc(feed.context.label+' CFP')+'</small>';
    setText('.f4-label span','NO ACTIVE PROJECTION • COMPLETED PLAYOFF FIELD ABOVE');
    $$('.f4-tile').forEach(tile=>{setText('div b','—',tile);setText('div span','—',tile);const img=$('img',tile);if(img)img.style.visibility='hidden';});
  }
  function paintCbbTournament(feed) {
    if(sport!=='cbb')return false;
    const model=feed.playoffs||{}, matches=model.matches||[];
    if(model.kind!=='actual'||!matches.length)return false;
    const panes=$$('.region-pane'), regionOrder=['East','West','South','Midwest'];
    const stages=['first','second','sweet','elite'];
    const seedOrder=[1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15];
    const seedIndex=seed=>{const n=Number(seed),i=seedOrder.indexOf(n);return i<0?999:i;};
    const ordered=list=>[...list].sort((a,b)=>{
      const ai=Math.min(...(a.teams||[]).filter(Boolean).map(t=>seedIndex(t.seed)));
      const bi=Math.min(...(b.teams||[]).filter(Boolean).map(t=>seedIndex(t.seed)));
      return ai-bi || String(a.date||'').localeCompare(String(b.date||''));
    });
    const paint=(box,match)=>{
      if(!box)return;
      const members=[...(match?.teams||[])].filter(Boolean).sort((a,b)=>seedIndex(a.seed)-seedIndex(b.seed));
      $$('.teamrow',box).forEach((row,i)=>{
        const team=members[i];
        if(team&&!$('img',row)){
          const holder=$('.mini',row);if(holder){const img=document.createElement('img');holder.append(img);}
        }
        applyTeamRow(row,team,team?.seed,team?.score,['.s','.tn','.sc','img']);
        row.classList.remove('winner','win','adv','out');
        if(team&&match?.winner===team.id)row.classList.add('winner','win','adv');
      });
      if(match){box.dataset.eventId=match.eventId||'';box.title=match.summary||'';}
    };
    panes.slice(0,4).forEach((pane,i)=>{
      const region=regionOrder[i], regionMatches=matches.filter(m=>m.region===region);
      const rounds=$$('.round',pane);
      stages.forEach((stage,k)=>{
        const list=ordered(regionMatches.filter(m=>m.stage===stage));
        $$('.match',rounds[k]).forEach((box,j)=>paint(box,list[j]));
      });
      setText('.regionTop strong',region.toUpperCase()+' REGION',pane);
      setText('.regionTop span',`${model.season} NCAA TOURNAMENT`,pane);
    });
    const finalPane=panes[4], eliteWinners={};
    for(const region of regionOrder){
      const elite=matches.find(m=>m.region===region&&m.stage==='elite');
      if(elite?.winner)eliteWinners[elite.winner]=region;
    }
    const semis=matches.filter(m=>m.stage==='conference');
    const semiKey=m=>{
      const regs=(m.teams||[]).map(t=>eliteWinners[t?.id]).filter(Boolean);
      if(regs.includes('East'))return 0;if(regs.includes('Midwest'))return 1;
      return String(m.date||'');
    };
    semis.sort((a,b)=>String(semiKey(a)).localeCompare(String(semiKey(b))));
    if(finalPane){
      setText('.regionTop strong','FINAL FOUR',finalPane);
      setText('.regionTop span',`${model.season} NCAA TOURNAMENT`,finalPane);
      const boxes=$$('.semibox',finalPane);
      boxes.forEach((box,i)=>{
        const match=semis[i], members=[...(match?.teams||[])].filter(Boolean).sort((a,b)=>{
          const ar=eliteWinners[a.id],br=eliteWinners[b.id];
          const priority={East:0,South:1,Midwest:2,West:3};
          return (priority[ar]??99)-(priority[br]??99);
        });
        $$('.ffrow',box).forEach((row,j)=>{
          const team=members[j];
          applyTeamRow(row,team,team?.seed,team?.score,['.ffseed','.ffname','b','img']);
          row.classList.remove('winner','win','adv','out');
          if(team&&match?.winner===team.id)row.classList.add('winner','win','adv');
        });
      });
      const final=matches.find(m=>m.stage==='final'),winner=final?.teams?.find(t=>t&&t.id===final.winner);
      setText('.fftitle span:first-child',`FINAL FOUR • ${model.season}`,finalPane);
      setText('.fftitle span:last-child','NATIONAL CHAMPIONSHIP',finalPane);
      if(winner){
        setImage('.champLogo',winner.logo,finalPane,winner.name);
        setText('.champText b',(winner.short||winner.name).toUpperCase(),finalPane);
        const scores=(final.teams||[]).map(t=>t?.score||'—');
        setText('.champText > span',`${model.season} NATIONAL CHAMPION • ${scores.join('–')}`,finalPane);
      } else {
        setText('.champText b','CHAMPION TBD',finalPane);
        setText('.champText > span',`${model.season} NCAA TOURNAMENT`,finalPane);
      }
    }
    const isCurrent=Number(model.season)===Number(feed.context.year);
    const isPost=isCurrent&&feed.context.mode==='postseason';
    setText('#tourTitle',isPost?`${model.season} NCAA TOURNAMENT`:`${model.season} NCAA TOURNAMENT RECAP`);
    setText('#tourSub',isPost?'CURRENT TOURNAMENT • LIVE / FINAL RESULTS':'LAST COMPLETED TOURNAMENT • REGIONS + FINAL FOUR ROTATION');
    setText('#subhead',feed.context.mode==='preseason'?`${feed.context.year-1}–${String(feed.context.year).slice(-2)} PRESEASON SNAPSHOT • AP RANKINGS + LAST COMPLETED TOURNAMENT`:feed.context.mode==='season'?`${feed.context.label} SEASON • AP RANKINGS + LAST COMPLETED TOURNAMENT`:`${feed.context.label} • NCAA TOURNAMENT STATUS`);
    setText('#note',isPost?'CURRENT NCAA TOURNAMENT • EAST, WEST, SOUTH, MIDWEST + FINAL FOUR ROTATE ABOVE • FIRST FOUR OUT BELOW REMAINS SEPARATE.':`${feed.context.mode==='preseason'?'PRESEASON MODE • ':''}LAST COMPLETED ${model.season} NCAA TOURNAMENT ROTATES ABOVE • FIRST FOUR OUT BELOW REMAINS THE APPROVED STATIC BRACKETOLOGY SNAPSHOT.`);
    const rot=$('#rotator'),grid=$('#liveGrid');if(rot)rot.style.display='block';if(grid)grid.style.display='none';
    return true;
  }
  function updateCollege(feed) {
    const ranks=feed.rankings?.poll?.ranks||[],season=Number(feed.rankings?.season?.year);
    if(!ranks.length){if(sport==='cbb'){setText('.sectionbar small','AP POLL TEMPORARILY UNAVAILABLE • LAST-GOOD BOARD RETAINED');if(feed.playoffs?.kind==='actual')paintCbbTournament(feed);return $$('#power .r').length;}return 0;}
    const teams=flatTeams(feed),rows=$$(sport==='cfb'?'.rankrow':'#power .r');
    rows.forEach((row,i)=>{const entry=ranks[i];if(!entry)return;const team=entry.team||{};const detail=teams.find(t=>t.id===String(team.id));
      if(sport==='cfb'){setText('.rnum',entry.current||i+1,row);setText('.rteam',team.location||team.shortDisplayName||team.nickname||team.name,row);setText('.rrec',detail?record(detail):entry.recordSummary||team.recordSummary||'—',row);if(detail)setText('.conf',shortConference(detail.group),row);}
      else {if(row.children[0])row.children[0].textContent=entry.current||i+1;if(row.children[2])row.children[2].textContent=(team.location||team.shortDisplayName||team.nickname||team.name).toUpperCase();}
      setImage('img',team.logo||team.logos?.[0]?.href,row,team.displayName||team.nickname);
    });
    const own=teams.find(t=>t.id===favorite),ownRank=ranks.find(r=>String(r.team.id)===favorite)?.current;
    if(sport==='cfb') {
      setText('.titlebar small',`${feed.rankings.poll.name} • ${new Date(feed.rankings.poll.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`);
      if(own)setText('.favorite-main span',`FAVORITE WATCH • ${record(own)} OVERALL • ${ownRank?'#'+ownRank:(feed.rankings.poll.others||[]).some(r=>String(r.team?.id)===favorite)?'RECEIVING VOTES':'UNRANKED'}`);
      const pollYear=feed.rankings.poll.season?.year||feed.context.year;
      setText('.header .sub',pollYear+' AP TOP 25 • '+(feed.context.mode==='season'?'IF THE PLAYOFF STARTED TODAY':feed.context.mode==='postseason'?'CURRENT PLAYOFF STATUS':feed.context.label+' FINAL RECORDS'));
      setText('.bracket-title > span',feed.context.label+' CFP • '+(feed.context.mode==='season'?'IF THE PLAYOFF STARTED TODAY':'PLAYOFF TREE'));
      const projection=feed.rankings.projectionPoll.ranks||ranks;
      const seeded=feed.playoffs?.field||[];
      // Preserve the approved AP-poll projection method and its untouched tree.
      if(feed.context.mode==='season'){
        const columns=$$('.bracket > .col'), fields=['.seed','.mn','b','img'];
        const project=(box,seeds)=>{
          if(!box)return;$$('.mteam',box).forEach((row,i)=>{
            const n=seeds[i],team=n?seeded[n-1]:null;
            if(team)row.classList.remove('placeholder-team');else row.classList.add('placeholder-team');
            if(team&&!$('img',row)){const holder=$('.teamlogo,.placeholder-logo',row);if(holder){holder.className='teamlogo';holder.textContent='';holder.append(document.createElement('img'));}}
            applyTeamRow(row,team,n,n<=4?'BYE':'',fields);
          });
        };
        [[columns[0],[[8,9],[5,12]]],[columns[5],[[7,10],[6,11]]],
         [columns[1],[[1,null],[4,null]]],[columns[4],[[2,null],[3,null]]],
         [columns[2],[[null,null]]],[columns[3],[[null,null]]]].forEach(([col,pairs])=>{if(col)$$('.match',col).forEach((box,i)=>project(box,pairs[i]));});
        setText('.bracket-title small',`${feed.playoffs?.method||feed.rankings.projectionPoll.name} • PROJECTION`);
        setText('.f4-label span','NEXT TEAMS OUTSIDE THE PROJECTED FIELD');
        setText('.finalbox span',feed.context.year===2026?'JANUARY 25, 2027 • LAS VEGAS':'NATIONAL CHAMPIONSHIP • WINNERS TBD');
        $$('.f4-tile').forEach((tile,i)=>{const t=feed.playoffs?.out?.[i];if(!t)return;setText('div b',(t.short||t.location||t.name).toUpperCase(),tile);setText('div span',record(teams.find(x=>x.id===String(t.id))||{}),tile);setImage('img',t.logo||t.logos?.[0]?.href,tile,t.displayName||t.name);const img=$('img',tile);if(img)img.style.visibility='visible';});
      }
    } else {
      setText('.sectionbar b',feed.rankings.poll.name.toUpperCase());setText('.sectionbar small',(season<feed.context.year?'LAST COMPLETED • ':'')+(feed.rankings.poll.date?.slice(0,10)||'CURRENT POLL'));
      // Never fabricate a full NCAA bracket from the AP poll. A verified ESPN
      // tournament archive is rendered below; during the regular season it remains
      // clearly labelled as last-completed context until a verified Bracketology
      // feed is available from the provider.
      if(ownRank)setText('.favmain span',`FAVORITE WATCH • #${ownRank} AP`);
    }
    if(sport==='cfb'&&feed.playoffs?.kind==='actual')paintCollegeRecap(feed);
    if(sport==='cbb'&&feed.playoffs?.kind==='actual')paintCbbTournament(feed);
    return rows.length;
  }
  function shortConference(name) {return ({'Southeastern Conference':'SEC','Big Ten Conference':'B1G','Big 12 Conference':'B12','Atlantic Coast Conference':'ACC','FBS Independents':'IND','Pac-12 Conference':'PAC','American Conference':'AAC','Mountain West Conference':'MWC','Sun Belt Conference':'SBC','Sun Belt - East':'SBC','Sun Belt - West':'SBC','Pac-12':'PAC','Conference USA':'CUSA','Mid-American Conference':'MAC'})[name]||name||'';}
  function updateLeaders(feed) {
    let count=0;
    const cards=$$('.leader-card,#leaderGrid .card');
    (feed.leaders?.players||[]).forEach(player=>{
      const card=cards.find(c=>norm($('.leader-kicker span,.label',c)?.textContent)===norm(player.label));if(!card)return;
      setText('.leader-name,h3',player.name.toUpperCase(),card);setText('.leader-stat strong,.value',player.value,card);
      setText('.leader-team span,.leader-school span,.copy .team',player.team.name||player.team.short,card);
      const playerFallbacks=boardPlayerFallbacks(player);
      const playerPrimary=board==='page2_cfb'&&String(player.id)==='5087950'?playerFallbacks[0]:player.headshot;
      const playerRest=board==='page2_cfb'&&String(player.id)==='5087950'?playerFallbacks.slice(1):playerFallbacks;
      setImage('img.player-photo,img.head',playerPrimary,card,player.name,playerRest);
      $$('img.team-watermark,img.school-watermark,img.mini-logo,img.teamLogo',card).forEach(img=>{
        const logo=boardTeamImage(player.team);
        if(logo)setImageNode(img,logo,player.team.name,boardTeamFallbacks(player.team));
      });
      if(player.team.color)card.style.setProperty('--tc','#'+player.team.color);
      if(player.team.alternateColor)card.style.setProperty('--tc2','#'+player.team.alternateColor);
      const finalLeaders=['offseason','preseason'].includes(feed.context.mode)||(['mlb','wnba'].includes(sport)&&feed.context.mode==='postseason');
      // NBA Page 2 Site11 owns these approved labels/footers; refresh values without flattening its broadcast copy.
      if(board!=='page2_nba')setText('.leader-footer',`${feed.context.label} ${finalLeaders?'FINAL':'REGULAR SEASON'} • ESPN`,card);
      card.dataset.athleteId=player.id;card.dataset.season=player.season;count++;
    });
    const finalLeaders=['offseason','preseason'].includes(feed.context.mode)||(['mlb','wnba'].includes(sport)&&feed.context.mode==='postseason');
    const label=`${feed.context.label} ${finalLeaders?'FINAL':'LIVE'}`;
    if(board!=='page2_nba'){setText('#seasonLabel,.season span',label);setText('#modeLabel,.section-title span',label+' • ESPN LEADERS');}
    return count;
  }
  function statValue(award,names) {for(const name of names){const s=award.stats?.[name];if(s&&s.displayValue!==undefined)return s.displayValue;}return '—';}
  function updateTeamPanels(feed) {
    const panels=feed.teamPanels;if(!panels)return;
    if(board.startsWith('page2_')) {
      const cards=$$('.team-card,.teamCard');
      (panels.leaders||[]).forEach(value=>{
        const card=cards.find(c=>norm($('.team-cat,.tlabel',c)?.textContent)===norm(value.label));if(!card)return;
        setText('.team-name,.tname',value.team.short||value.team.name,card);
        setText('.team-stat strong,.tval',value.value,card);
        setImage('img.team-logo,img',boardTeamImage(value.team),card,value.team.name,boardTeamFallbacks(value.team));
        if(value.team.color)card.style.setProperty('--tc','#'+value.team.color);
      });
      const finalLeaders=['preseason','offseason'].includes(feed.context.mode)||(['mlb','wnba'].includes(sport)&&feed.context.mode==='postseason');
      // Preserve the approved Site11 team-section season line on NBA Page 2.
      if(board!=='page2_nba')setText('.team-header span',`${feed.context.label} • ${finalLeaders?'FINAL':'LIVE'} LEADERS`);
    } else {
      const cards=$$('#teamstats .rank,#offense .rank,#defense .rank');
      (panels.snapshot||[]).forEach(value=>{
        const card=cards.find(c=>norm($('.lbl',c)?.textContent)===norm(value.label));if(!card||value.value==='—')return;
        setText('.num',value.value,card);setText('.place',value.rank?'#'+value.rank+' '+(sport==='cfb'||sport==='cbb'?'NCAA':sport.toUpperCase()):'',card);
      });
      const note=$('#statshead .season-note,#statshead .preseason-note');if(note)note.textContent=feed.context.label+' '+(['preseason','offseason'].includes(feed.context.mode)?'FINAL':'LIVE');
    }
  }
  function paintSnapshot(feed) {
    const schedule=(feed.schedule||[]).filter(e=>e.completed||e.state==='post').filter(e=>Number.isFinite(Number(e.away.score))&&Number.isFinite(Number(e.home.score))).sort((a,b)=>a.date.localeCompare(b.date));
    let completed=schedule;
    const current=schedule.filter(e=>Number(e.season?.year)===Number(feed.context.year));
    if(current.length)completed=current;
    if(feed.context.mode!=='preseason')completed=completed.filter(e=>Number(e.season?.type)!==1);
    const last=completed.at(-1);
    if(last) {
      const slot=$('#lastgame');if(slot){const scoreClass=board==='page3_arizona_cfb'?'score':'pts';slot.innerHTML=[last.away,last.home].map((t,i)=>`${i?'<div class="at">@</div>':''}<div class="side"><img src="${esc(imageURL(t.logo))}" alt="${esc(t.name)}"><div class="${scoreClass}">${esc(t.score)}</div></div>`).join('');}
      setText('#lastdate,#lastmeta',fmt(last)+' · FINAL');
      const own=last.away.id===favorite?last.away:last.home,opponent=last.away.id===favorite?last.home:last.away;
      const won=Number(own.score)>Number(opponent.score),tied=Number(own.score)===Number(opponent.score);
      setText('#resultline,#lastresult',(own.short||own.name).toUpperCase()+' '+(tied?'TIE':won?'WIN':'LOSS'));
      if(board==='page3_broncos')$('#board')?.classList.toggle('broncos-win',won);
      const five=$('#five');if(five)five.innerHTML=completed.slice(-5).map(e=>{
        const t=e.away.id===favorite?e.away:e.home,o=e.away.id===favorite?e.home:e.away;
        const outcome=Number(t.score)>Number(o.score)?'W':Number(t.score)===Number(o.score)?'T':sport==='nhl'&&/OT|SO/.test(e.status)?'OTL':'L';
        return `<div class="game"><img src="${esc(imageURL(o.logo))}" alt="${esc(o.name)}"><div class="finalscore">${esc(t.score)}–${esc(o.score)}</div><div class="outcome ${outcome==='W'?'w':outcome==='OTL'?'otl':outcome==='L'?'l':''}">${outcome}</div></div>`;
      }).join('');
    }
    const own=flatTeams(feed).find(t=>t.id===favorite);
    if(own) {
      const pre=feed.context.mode==='preseason'&&current.length>0;
      if(!pre)setText('#record',record(own));
      if(!pre&&own.streak)setText('#streak',own.streak);
      if(sport==='nfl'){
        const west=flatTeams(feed).filter(t=>['7','12','13','24'].includes(t.id)).sort((a,b)=>Number(b.pct)-Number(a.pct)||Number(a.seed)-Number(b.seed));
        const rank=west.findIndex(t=>t.id===favorite);if(rank>=0)setText('#division','#'+(rank+1));setText('#seed','#'+own.seed);
      }
      if(sport==='nhl')setText('#east','#'+own.seed);
    }
    updateTeamPanels(feed);paintNext(feed);
  }
  function updateAwards(feed) {
    const data=feed.awards;if(!data?.items?.length)return;
    const award=data.items[0],winner=data.kind==='winner';
    if(sport==='nba') {
      if(board==='page2_nba'){
        setImage('.hero-photo',award.headshot,document,award.name);
        setImage('.hero-team-logo',boardTeamImage(award.team),document,award.team?.name);
        setImage('.hero-team img',boardTeamImage(award.team),document,award.team?.name);
        setText('.hero-team span',award.team?.name);
        const heroName=$('.hero-name');if(heroName){const parts=String(award.name||'').trim().toUpperCase().split(/\s+/);heroName.innerHTML=parts.length>1?esc(parts.slice(0,-1).join(' '))+'<br>'+esc(parts.at(-1)):esc(parts[0]||'MVP WATCH');}
        setText('.hero-label',winner?'OFFICIAL KIA NBA MVP':`${award.publisher.toUpperCase()} • CURRENT MVP WATCH`);
        const main=$('.hero-main-stat strong');if(main)main.textContent=winner?'MVP':'#1';
        setText('.hero-main-stat > span',winner?'AWARD WINNER':'MVP WATCH');
        const stats=[['avgPoints','PPG'],['avgRebounds','RPG'],['avgAssists','APG']];
        $$('.hero-substats > div').forEach((cell,i)=>{setText('b',statValue(award,[stats[i][0]]),cell);setText('span',stats[i][1],cell);});
        setText('.hero-note',`${award.publisher} • ${award.date} • ${winner?'Official announced result':'Current sourced MVP frontrunner'}.`);
        const ribbon=$('.hero-ribbon');if(ribbon){const winnerLabel=`${Number(award.season)-1}–${String(award.season).slice(-2)} NBA MVP`;const raceLabel=`${feed.context?.label||award.season} MVP RACE`;ribbon.innerHTML=`${esc(winner?winnerLabel:raceLabel)} <span>• ${winner?'WINNER':'CURRENT PROJECTION'}</span>`;}
        return;
      }
      setText('.heroHead',winner?`${award.season-1}–${String(award.season).slice(-2)} NBA MVP`:`${feed.context.label} MVP RACE`);
      setText('.heroCopy .name',award.name.toUpperCase());setText('.heroCopy .kicker',winner?'LAST COMPLETED SEASON • KIA NBA MVP':award.publisher.toUpperCase());
      setImage('.heroVisual .wemby',award.headshot,document,award.name);
      const odds=$('.odds');if(odds)odds.innerHTML=winner?'MVP <small>AWARD WINNER</small>':'#1 <small>MVP WATCH</small>';
      const stats=[['avgPoints','PPG'],['avgRebounds','RPG'],['avgAssists','APG']];$$('.heroCopy .mini > div').forEach((cell,i)=>{setText('b',statValue(award,[stats[i][0]]),cell);setText('span',stats[i][1],cell);});
      const labels=$$('.heroCopy .kicker');if(labels[1])labels[1].textContent=`${award.publisher} • ${award.date}`;
      return;
    }
    if(sport==='mlb') {
      const copies=$$('.mvp-copy');
      const panels=$$('.mvp-side,.mvp-panel,.mvp-contender');
      const names=$$('.hero .mvp-name');
      data.items.forEach((a,i)=>{const name=names[i];if(!name)return;const root=name.closest('.mvp-side,.mvp-panel,.mvp-contender')||name.parentElement.parentElement;
        setText('.mvp-name',a.name.toUpperCase(),root);setImage('.mvp-photo',a.headshot,root,a.name);setImage('.mvp-watermark',a.team?.logo,root,a.team?.name);setImage('.mvp-team img',a.team?.logo,root,a.team?.name);setText('.mvp-team span',a.team?.name,root);
        const odds=$('.mvp-odds',root);if(odds)odds.textContent=winner?`${a.season} ${a.league} MVP`:'#1 '+a.league+' MVP WATCH';
        setText('.mvp-note',`${a.publisher} • ${a.date}`,root);
        $$('.mvp-stats > div',root).forEach((cell,k)=>{const map=i===0?[['avg','AVG'],['homeRuns','HR'],['RBIs','RBI']]:[['avg','AVG'],['homeRuns','HR'],['stolenBases','SB']];setText('b',statValue(a,[map[k]?.[0]]),cell);});
      });
      return;
    }
    setText('.hero-name',award.name.toUpperCase());setText('.hero-label',`${winner?'ANNOUNCED WINNER':'PUBLISHED PROJECTION'} • ${award.publisher}`.toUpperCase());
    if(!(sport==='cbb'&&winner)){
      const awardFallbacks=boardPlayerFallbacks(award);
      setImage('.hero-photo',award.headshot,document,award.name,awardFallbacks);
      const awardLogo=boardTeamImage(award.team);
      const awardLogoFallbacks=boardTeamFallbacks(award.team);
      setImage('.hero-team-logo,.hero-school-logo',awardLogo,document,award.team?.name,awardLogoFallbacks);
      setImage('.hero-team img,.hero-school img',awardLogo,document,award.team?.name,awardLogoFallbacks);setText('.hero-team span,.hero-school span',award.team?.name);
    }
    const main=$('.hero-main-stat strong');if(main)main.textContent=winner?(sport==='cbb'?'#1':'MVP'):'#1';
    setText('.hero-main-stat > span',winner?(sport==='cbb'?'OVERALL':'AWARD WINNER'):(sport==='nhl'?'HART WATCH':sport==='cfb'?'HEISMAN WATCH':'MVP WATCH'));
    setText('.hero-note',`${award.publisher} • ${award.date} • ${winner?'Actual announced result':'Editorial projection'}.`);
    if(sport==='cfb')setText('.safe-note',`COLLEGE FOOTBALL PAGE 2 • ${feed.context.label} ${['offseason','preseason'].includes(feed.context.mode)?'FINAL':'LIVE'} LEADERS • HEISMAN SOURCE ${award.date}`);
    const specs={nfl:[['QBRating','quarterbackRating','PASSER RTG'],['passingTouchdowns','PASS TD'],['passingYards','PASS YDS']],nhl:[['gamesPlayed','games','GAMES'],['assists','ASSISTS'],['points','POINTS']],wnba:[['avgPoints','PPG'],['avgRebounds','RPG'],['avgBlocks','BPG']],cfb:[['receptions','REC'],['receivingYards','REC YDS'],['receivingTouchdowns','REC TD']],cbb:[['avgPoints','PPG'],['avgRebounds','RPG'],['avgAssists','APG']]}[sport]||[];
    $$('.hero-substats > div').forEach((cell,i)=>{const spec=specs[i];if(!spec||sport==='cbb'&&winner)return;setText('b',statValue(award,spec.slice(0,-1)),cell);setText('span',spec.at(-1),cell);});
    const ribbon=$('.hero-ribbon');if(ribbon)ribbon.innerHTML=`${esc(winner?(sport==='cbb'?'NBA DRAFT • #1 OVERALL PICK':award.publisher.toUpperCase()):sport==='nhl'?'HART TROPHY WATCH':sport==='cfb'?'HEISMAN WATCH':'MVP WATCH')} <span>• ${winner?'WINNER':'CURRENT PROJECTION'}</span>`;
  }
  function paintNext(feed) {
    const schedule=feed.schedule||[],now=Date.now();
    const live=schedule.find(e=>e.state==='in'&&!e.completed&&!/postponed|cancell?ed|suspended/i.test(e.status));
    const next=live||schedule.filter(e=>e.state==='pre'&&!/postponed|cancell?ed|suspended/i.test(e.status)&&new Date(e.date).getTime()>=now).sort((a,b)=>a.date.localeCompare(b.date))[0];
    const slot=$('#nextlogos,#nextgame');if(!slot)return;
    const root=slot.closest('.gamebox,.next-game,.panel,.glass')||slot.parentElement; if(getComputedStyle(root).position==='static')root.style.position='relative';
    let badge=$('#livepill',root)||$('.mc-live-badge',root);
    if(!badge){badge=document.createElement('span');badge.className='mc-live-badge';badge.textContent='LIVE';root.append(badge);}
    badge.classList.toggle('show',!!live);badge.style.display=live?'block':'none';slot.classList.toggle('mc-live-slot',!!live);
    const heading=$('#nexthead,.section-h,.head',root);if(heading)heading.textContent=live?'LIVE GAME':'NEXT GAME';
    if(!next){slot.innerHTML='';delete root.dataset.eventId;delete root.dataset.gameState;setText('#nexttime,#nextmeta','SCHEDULE TBD');setText('#venue','NEXT GAME WILL APPEAR WHEN PUBLISHED');return;}
    const cfb=board==='page3_arizona_cfb';
    const logo=t=>`<img src="${esc(imageURL(t.logo))}" alt="${esc(t.name)}">`;
    if(cfb)slot.innerHTML=`<div class="side">${logo(next.away)}<div class="score">${live?esc(next.away.score??'—'):'—'}</div></div><div class="at">@</div><div class="side">${logo(next.home)}<div class="score">${live?esc(next.home.score??'—'):'—'}</div></div>`;
    else if(live)slot.innerHTML=`<div class="mc-live-side">${logo(next.away)}<strong class="mc-live-score">${esc(next.away.score??'—')}</strong></div><span>@</span><div class="mc-live-side">${logo(next.home)}<strong class="mc-live-score">${esc(next.home.score??'—')}</strong></div>`;
    else slot.innerHTML=logo(next.away)+'<span>@</span>'+logo(next.home);
    setText('#nexttime,#nextmeta',live?next.status||'IN PROGRESS':fmt(next));setText('#venue',next.venue+(Number(next.season?.type)===1?' • PRESEASON':''));
    root.dataset.eventId=next.id;root.dataset.gameState=next.state;
  }
  function hookOriginalRenders() {
    // Keep the approved board's own status/stat renderers. Its obsolete ticker and
    // Next Game selection are superseded by the shared production feed.
    if(typeof window.renderTicker==='function')window.renderTicker=()=>{};
    if(typeof window.updateTicker==='function')window.updateTicker=async()=>{if(lastFeed)paintTicker(lastFeed);};
    if(typeof window.refreshTicker==='function')window.refreshTicker=async()=>{if(lastFeed)paintTicker(lastFeed);};
    ['renderGames','renderSchedule','updateGames','renderNext','renderLast','renderFive','loadSchedule','loadStandings','loadRankings'].forEach(name=>{const original=window[name];if(typeof original==='function')window[name]=function(...args){const result=original.apply(this,args);const paint=()=>{if(lastFeed){paintSnapshot(lastFeed);paintTicker(lastFeed);fit();}};if(result?.then)result.then(paint).catch(()=>{});else paint();return result;};});
    ['updateStats','loadStats'].forEach(name=>{const original=window[name];if(typeof original==='function')window[name]=async function(...args){const result=await original.apply(this,args);if(lastFeed)updateTeamPanels(lastFeed);return result;};});
  }
  function render(feed) {
    if(board==='page2_nba')feed=nbaP2Apply(feed);
    lastFeed=feed;let items=0;
    if(board.startsWith('page1_')){items=updateStandings(feed);if(['cfb','cbb'].includes(sport))items=updateCollege(feed);else updateProBracket(feed);}
    if(board.startsWith('page2_')){items=updateLeaders(feed);updateAwards(feed);updateTeamPanels(feed);}
    if(board.startsWith('page3_')){paintSnapshot(feed);items=(feed.schedule?.length||0);}
    paintTicker(feed);proxyImages();fit();
    const partial=feed.dataState!=='current'||feed.leaders?.errors?.length||errors.length;
    const status=feed.dataState==='last-good'?'LAST-GOOD CACHED DATA':partial?'DATA CHECK • REVIEW REQUIRED':`DATA VERIFIED • ${items} ITEMS`;
    report(!partial&&items>0,status);
    window.__MC_QA={board,items,dataState:feed.dataState,context:feed.context,tickerGames:filteredTicker(feed).length,tickerSelection:feed.ticker?.selection,warnings:feed.warnings||[],leaderErrors:feed.leaders?.errors||[],imageErrors:errors,checkedAt:feed.fetchedAt};
  }
  async function refresh() {
    if(refreshPending)return;refreshPending=true;
    try {
      const response=await nativeFetch(origin+'/api/board/'+board,{cache:'no-store'});if(!response.ok)throw Error(response.status);
      const feed=await response.json();render(feed);localStorage.setItem('mc-v2-feed-'+board,JSON.stringify(feed));
    } catch(error) {
      if(lastFeed)render({...lastFeed,dataState:'last-good'});
      else try{const saved=JSON.parse(localStorage.getItem('mc-v2-feed-'+board));if(saved)render({...saved,dataState:'last-good'});else report(false,'SOURCE UNAVAILABLE • NEEDS FIX');}catch(_){report(false,'SOURCE UNAVAILABLE • NEEDS FIX');}
    } finally {refreshPending=false;}
  }
  addEventListener('resize',()=>{fit();if(lastFeed)paintTicker(lastFeed,true);});
  document.addEventListener('error',event=>{
    if(event.target?.tagName!=='IMG')return;
    const img=event.target,url=img.src;
    if(['page1_nba','page1_mlb','page1_wnba','page2_nfl','page2_nba','page2_nhl','page2_mlb','page2_wnba','page2_cfb','page2_cbb'].includes(board)&&img.dataset.mcDirectRetry!=='1'&&url.startsWith(origin+'/proxy')){
      try {
        const upstream=new URL(url).searchParams.get('url');
        if(upstream&&IMAGE_HOSTS.has(new URL(upstream).hostname)){
          img.dataset.mcDirectRetry='1';
          if(['page2_mlb','page2_wnba','page2_cfb','page2_cbb'].includes(board))img.addEventListener('load',()=>img.classList.remove('asset-missing'),{once:true});
          img.src=upstream;return;
        }
      } catch (_) {}
    }
    // CFB/CBB Page 2 get verified same-player / alternate-logo fallbacks before an image is
    // considered failed. This prevents an ESPN DNS/CDN miss from blanking the approved board.
    if(['page2_cfb','page2_cbb'].includes(board)&&img.dataset.mcFallbacks){
      try {
        const fallbacks=JSON.parse(img.dataset.mcFallbacks)||[];
        const index=Number(img.dataset.mcFallbackIndex||0);
        if(index<fallbacks.length){
          img.dataset.mcFallbackIndex=String(index+1);img.dataset.mcDirectRetry='1';
          img.addEventListener('load',()=>img.classList.remove('asset-missing'),{once:true});
          img.src=fallbacks[index];return;
        }
      } catch (_) {}
    }
    if(!url.startsWith('data:')){errors.push({alt:img.alt,url});report(false,'IMAGE SOURCE FAILED • NEEDS FIX');}
  },true);
  function armCbbApprovedHeroFallbacks(){
    if(board!=='page2_cbb')return;
    const photo=$('.hero-photo');
    if(photo)armImageFallbacks(photo,['https://a.espncdn.com/i/headshots/nba/players/full/1643407.png','https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/4685654.png']);
    $$('.hero-school-logo,.hero-school img').forEach(img=>armImageFallbacks(img,['https://a.espncdn.com/i/teamlogos/nba/500/wsh.png']));
  }
  function start(){
    fit();armCbbApprovedHeroFallbacks();proxyImages();hookOriginalRenders();
    new MutationObserver(records=>{records.forEach(record=>{if(record.type==='attributes')proxyImages(record.target.parentNode||document);else record.addedNodes.forEach(node=>{if(node.nodeType===1){if(node.tagName==='IMG')proxyImages(node.parentNode);else proxyImages(node);}});});}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
    refresh();setInterval(refresh,30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();