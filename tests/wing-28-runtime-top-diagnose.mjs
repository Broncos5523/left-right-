/* Public staged runtime lexical audit. No Firebase use or TV commands. */
const host='https://man-cave-28-page.broncos5523.workers.dev';
const files=['/staging/player.js','/production/board-runtime.js',
 '/production/spotlight-state.js','/production/live-nfl-page2.js',
 '/staging/boards/page2_nfl.html','/staging/board-standalone-host.js'];
for(const file of files){
 try{
  const resp=await fetch(host+file);
  const source=await resp.text();
  const terms=/(window\.top|window\.parent|top\.MC|parent\.MC|mc-board-load-failed|mc-board-ready|MCBoard\.ready)/g;
  let m,n=0,out=[];
  while((m=terms.exec(source))&&n++<55){
   out.push(source.slice(Math.max(0,m.index-155),Math.min(source.length,m.index+195))
    .replace(/\s+/g,' ').slice(0,360));
  }
  console.log('RUNTIME_PUBLIC_AUDIT',JSON.stringify({file,status:resp.status,length:source.length,
   matches:n,contexts:out}));
 }catch(e){console.log('RUNTIME_PUBLIC_AUDIT_ERROR',file,String(e));}
}
