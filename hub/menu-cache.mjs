import {Worker} from 'node:worker_threads';
import {CATALOG} from './public/catalog.mjs';
const ids=CATALOG.map(g=>g.id);
const fallback=()=>({order:[...ids],ready:false});
// Always serve a snapshot. One bounded background scan may update future visits.
// A smart home list (home-order.mjs) is kept only when well formed; `onHome` hears each new day's list once.
// A new worker parses up to HISTORY days of logs from scratch, which under heavy machine load can take far longer than
// a warm (incremental) scan; it gets `coldTimeoutMs`. Killing it at the warm limit threw its parsed files away, so the
// next worker started from zero again and the home list stayed unranked.
const validHome=h=>!!h&&typeof h.day==='string'&&Array.isArray(h.order)&&h.order.length>0&&h.order.length<=40&&h.order.every(id=>typeof id==='string'&&/^[a-z0-9-]{1,40}$/.test(id))&&new Set(h.order).size===h.order.length;
export function cachedMenuOrderService({sources,players,home={},timeZone='UTC',skillsDir=null,clock=Date.now,onError=()=>{},onHome=()=>{},timeoutMs=15000,coldTimeoutMs=120000,makeWorker=()=>new Worker(new URL('./menu-worker.mjs',import.meta.url),{workerData:{sources,players,home,timeZone,skillsDir}})}){
 let worker=null,warm=false,pending=false,timer=null,nextRefresh=0,closed=false;
 const cache=new Map(),homeErrors=new Map();
 function fail(current,error){
  if(worker!==current||closed)return;
  worker=null;pending=false;clearTimeout(timer);nextRefresh=clock()+60000;
  void current.terminate();onError(String(error?.message||error));
 }
 function refresh(){
  if(closed||pending||clock()<nextRefresh)return;
  pending=true;nextRefresh=clock()+60000;
  try{
   if(!worker){
    const current=worker=makeWorker();warm=false;current.unref?.();
    current.on('message',data=>{
     if(worker!==current||closed)return;
     if(data.error){fail(current,data.error);return;}
     clearTimeout(timer);pending=false;warm=true;
     for(const player of players){const ranking=data.rankings?.[player];if(ranking&&Array.isArray(ranking.order)&&ranking.order.length===ids.length&&new Set(ranking.order).size===ids.length&&ranking.order.every(id=>ids.includes(id))){
      const fresh=validHome(ranking.home)?ranking.home:null,before=cache.get(player)?.home;
      const {homeError,...rest}=ranking;cache.set(player,{...rest,home:fresh||before||null,ready:true});
      if(fresh&&(before?.day!==fresh.day||before.order.join()!==fresh.order.join()))try{onHome(player,fresh);}catch{}
      if(homeError&&homeErrors.get(player)!==homeError)onError('home: '+homeError);homeErrors.set(player,homeError);
     }}
    });
    current.on('error',e=>fail(current,e));
    current.on('exit',code=>{if(worker===current)fail(current,`Menu worker exited (${code})`);});
   }
   const current=worker;timer=setTimeout(()=>fail(current,'Menu scan timed out'),warm?timeoutMs:Math.max(timeoutMs,coldTimeoutMs));timer.unref?.();worker.postMessage('refresh');
  }catch(e){if(worker)fail(worker,e);else{pending=false;onError(String(e?.message||e));}}
 }
 const interval=setInterval(refresh,60000);interval.unref?.();refresh();
 return {
  ranking(player){if(!players.includes(player))throw Error('Unknown player');refresh();return cache.get(player)||fallback();},
  close(){closed=true;clearInterval(interval);clearTimeout(timer);void worker?.terminate();worker=null;},
 };
}
