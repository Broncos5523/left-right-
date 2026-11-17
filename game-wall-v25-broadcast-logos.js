// V25 Broadcast network logos — source is tvlogo.org's personal-use US TV logo collection.
// Verified filenames from https://www.tvlogo.org/united-states/ on November 16, 2026.
// These are reference images of existing networks, not newly created logos.
// Treat both network data and image availability as optional. NEVER show a placeholder for an unknown network.
(()=>{
'use strict';
const SOURCES=Object.freeze({
  "ABC": "https://www.tvlogo.org/united-states/abc-us.png",
  "CBS": "https://www.tvlogo.org/united-states/cbs-logo-white-us.png",
  "FOX": "https://www.tvlogo.org/united-states/fox-us.png",
  "NBC": "https://www.tvlogo.org/united-states/nbc-logo-flat-us.png",
  "The CW": "https://www.tvlogo.org/united-states/the-cw-us.png",
  "ION": "https://www.tvlogo.org/united-states/ion-television-us.png",
  "ESPN": "https://www.tvlogo.org/united-states/espn-us.png",
  "ESPN2": "https://www.tvlogo.org/united-states/espn-2-us.png",
  "ESPNEWS": "https://www.tvlogo.org/united-states/espnews-us.png",
  "ESPNU": "https://www.tvlogo.org/united-states/espn-u-us.png",
  "ESPN+": "https://www.tvlogo.org/united-states/espn-plus-us.png",
  "ESPN Deportes": "https://www.tvlogo.org/united-states/espn-deportes-us.png",
  "FS1": "https://www.tvlogo.org/united-states/fox-sports-1-us.png",
  "FS2": "https://www.tvlogo.org/united-states/fox-sports-2-us.png",
  "FOX Deportes": "https://www.tvlogo.org/united-states/fox-sports-deportes-flat-us.png",
  "FOX Sports": "https://www.tvlogo.org/united-states/fox-sports-us.png",
  "NESN": "https://www.tvlogo.org/united-states/nesn-us.png",
  "NESN+": "https://www.tvlogo.org/united-states/nesn-plus-us.png",
  "NBC Sports Boston": "https://www.tvlogo.org/united-states/nbcsn-boston-us.png",
  "NBC Sports Boston Plus": "https://www.tvlogo.org/united-states/nbcsn-boston-us.png",
  "NBC Sports Network": "https://www.tvlogo.org/united-states/nbcsn-us.png",
  "NFL Network": "https://www.tvlogo.org/united-states/nfl-network-us.png",
  "NFL RedZone": "https://www.tvlogo.org/united-states/nfl-red-zone-us.png",
  "NBA TV": "https://www.tvlogo.org/united-states/nba-tv-us.png",
  "NHL Network": "https://www.tvlogo.org/united-states/nhl-network-us.png",
  "MLB Network": "https://www.tvlogo.org/united-states/mlb-network-us.png",
  "CBS Sports Network": "https://www.tvlogo.org/united-states/cbs-sports-network-us.png",
  "Big Ten Network": "https://www.tvlogo.org/united-states/big-ten-network-us.png",
  "ACC Network": "https://www.tvlogo.org/united-states/acc-network-us.png",
  "SEC Network": "https://www.tvlogo.org/united-states/sec-network-hz-us.png",
  "TNT": "https://www.tvlogo.org/united-states/tnt-us.png",
  "TBS": "https://www.tvlogo.org/united-states/tbs-us.png",
  "truTV": "https://www.tvlogo.org/united-states/tru-tv-us.png",
  "USA Network": "https://www.tvlogo.org/united-states/usa-us.png",
  "Golf Channel": "https://www.tvlogo.org/united-states/nbc-golf-channel-us.png",
  "Tennis Channel": "https://www.tvlogo.org/united-states/tennis-channel-us.png",
  "Sportsman Channel": "https://www.tvlogo.org/united-states/sportsman-channel-us.png",
  "TUDN": "https://www.tvlogo.org/united-states/tudn-us.png",
  "Telemundo": "https://www.tvlogo.org/united-states/telemundo-us.png",
  "Telemundo Deportes": "https://www.tvlogo.org/united-states/telemundo-deportes-us.png",
  "Paramount+": "https://www.tvlogo.org/united-states/paramount-plus-us.png",
  "FOX Sports 4K Events 1": "https://www.tvlogo.org/united-states/fox-sports-us.png",
  "FOX Sports 4K Events 2": "https://www.tvlogo.org/united-states/fox-sports-us.png",
  "NBC Sports 4K": "https://www.tvlogo.org/united-states/nbc-sports-us.png",
  "NBC 4K Events": "https://www.tvlogo.org/united-states/nbc-logo-flat-us.png",
  "Golf Channel 4K": "https://www.tvlogo.org/united-states/nbc-golf-channel-us.png",
  "USA 4K": "https://www.tvlogo.org/united-states/usa-us.png",
  "Telemundo 4K": "https://www.tvlogo.org/united-states/telemundo-us.png"
});
const ALIASES=Object.freeze({
  "wpri": "CBS",
  "wbz": "CBS",
  "cbs tv": "CBS",
  "wnac": "FOX",
  "wfxt": "FOX",
  "wj ar": "NBC",
  "wjar": "NBC",
  "wlne": "ABC",
  "wcvb": "ABC",
  "wlwc": "The CW",
  "wlvi": "The CW",
  "cw": "The CW",
  "ion tv": "ION",
  "wpxq": "ION",
  "nbcsb": "NBC Sports Boston",
  "nbcsn boston": "NBC Sports Boston",
  "nbcsports boston": "NBC Sports Boston",
  "nbc sports boston plus": "NBC Sports Boston Plus",
  "nesn plus": "NESN+",
  "fs 1": "FS1",
  "fox sports 1": "FS1",
  "fs 2": "FS2",
  "fox sports 2": "FS2",
  "btn": "Big Ten Network",
  "big ten": "Big Ten Network",
  "accn": "ACC Network",
  "ac cn": "ACC Network",
  "secn": "SEC Network",
  "sec network": "SEC Network",
  "cbssn": "CBS Sports Network",
  "cbs sports net": "CBS Sports Network",
  "espn u": "ESPNU",
  "espn news": "ESPNEWS",
  "espn plus": "ESPN+",
  "nfln": "NFL Network",
  "nfl red zone": "NFL RedZone",
  "red zone": "NFL RedZone",
  "trutv": "truTV",
  "tru tv": "truTV",
  "usa": "USA Network",
  "tennis": "Tennis Channel",
  "n b c sports boston": "NBC Sports Boston",
  "nbcs": "NBC Sports Boston"
});
const norm=value=>String(value||'').trim().replace(/^watch\s+/i,'').replace(/\s+·\s+(?:HD|SD|channel|numeric backup).*$/i,'')
  .replace(/\s+·\s+(?:W[A-Z0-9]{3,6})(?:\s*\([^)]+\))?$/i,'')
  .replace(/\s+/g,' ').toLowerCase();
const canon=new Map(Object.keys(SOURCES).map(name=>[norm(name),name]));
function normalize(input){
 const key=norm(input);
 return canon.get(key)||ALIASES[key]||null;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[ch]));
function resolved(route){
 if(!route||route.status&&route.status!=='ready')return null;
 const name=normalize(typeof route==='string'?route:route.name||route.id||route.voice||'');
 if(!name)return null;
 return {name,src:SOURCES[name]};
}
function badge(route,options={}){
 const item=resolved(route);
 if(!item)return ''; // User rule: no broadcaster = no icon, label, or placeholder.
 const compact=options.compact!==false;
 const text=options.text!==false;
 const cls='networkLogoBadge'+(compact?' is-compact':'');
 const label=esc(item.name);
 return '<span class="'+cls+'" title="'+label+'">'+
  '<img src="'+esc(item.src)+'" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">'+
  (text?'<span>'+label+'</span>':'')+'</span>';
}
window.ManCaveNetworkLogos=Object.freeze({normalize,resolved,badge,sources:SOURCES});
})();