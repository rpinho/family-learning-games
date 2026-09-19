import {Worker} from 'node:worker_threads';
import {CATALOG} from './public/catalog.mjs';
const ids=CATALOG.map(g=>g.id);
const fallback=()=>({order:[...ids],ready:false});
// Always serve a snapshot. One bounded background scan may update future visits.
export function cachedMenuOrderService({sources,players,clock=Date.now,onError=()=>{},timeoutMs=15000,makeWorker=()=>new Worker(new URL('./menu-worker.mjs',import.meta.url),{workerData:{sources,players}})}){
 let worker=null,pending=false,timer=null,nextRefresh=0,closed=false;
 const cache=new Map();
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
    const current=worker=makeWorker();current.unref?.();
    current.on('message',data=>{
     if(worker!==current||closed)return;
     if(data.error){fail(current,data.error);return;}
     clearTimeout(timer);pending=false;
     for(const player of players){const ranking=data.rankings?.[player];if(ranking&&Array.isArray(ranking.order)&&ranking.order.length===ids.length&&new Set(ranking.order).size===ids.length&&ranking.order.every(id=>ids.includes(id)))cache.set(player,{...ranking,ready:true});}
    });
    current.on('error',e=>fail(current,e));
    current.on('exit',code=>{if(worker===current)fail(current,`Menu worker exited (${code})`);});
   }
   const current=worker;timer=setTimeout(()=>fail(current,'Menu scan timed out'),timeoutMs);timer.unref?.();worker.postMessage('refresh');
  }catch(e){if(worker)fail(worker,e);else{pending=false;onError(String(e?.message||e));}}
 }
 const interval=setInterval(refresh,60000);interval.unref?.();refresh();
 return {
  ranking(player){if(!players.includes(player))throw Error('Unknown player');refresh();return cache.get(player)||fallback();},
  close(){closed=true;clearInterval(interval);clearTimeout(timer);void worker?.terminate();worker=null;},
 };
}
