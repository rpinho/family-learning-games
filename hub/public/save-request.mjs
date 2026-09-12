// A settled/rejected request must never remain a "saving" latch. No automatic
// POST retries: after an uncertain timeout, reload state before another move.
export function createSaveQueue(){
 let tail=Promise.resolve(),active=0;
 return {
  busy:()=>active>0,
  run(task){active++;const work=tail.catch(()=>{}).then(task);const settled=work.finally(()=>{active--;});tail=settled;return settled;}
 };
}
export async function fetchJSON(url,options={},timeoutMs=10000){
 const controller=new AbortController();let timer;
 try{
  return await Promise.race([
   (async()=>{const r=await fetch(url,{...options,signal:controller.signal});const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Could not connect.'),{status:r.status,code:d.code});return d;})(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('Connection timed out. Tap Refresh to check your saved game.'));controller.abort();},timeoutMs);})
  ]);
 }finally{clearTimeout(timer);}
}
