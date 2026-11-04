import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

// DevTools can open before Chrome has created its first page under build load.
export async function waitForPageTarget(readTargets,{attempts=100,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let i=0;i<attempts;i++){
  const target=(await readTargets()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
  if(target)return target;
  if(i+1<attempts)await wait(100);
 }
 throw Error('Test Chrome did not open a debuggable page.');
}

// One deadline covers the port file, listening socket and initial page. Inject IO/time
// so startup races can be tested without launching Chrome or sleeping.
export async function waitForChrome({profile,timeoutMs=30000,now=()=>performance.now(),
 wait=ms=>new Promise(r=>setTimeout(r,ms)),
 readPort=()=>readFile(join(profile,'DevToolsActivePort'),'utf8'),
 readTargets=async(port,remaining)=>{
  const response=await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(Math.max(1,Math.ceil(remaining)))});
  if(!response.ok)throw Error(`Chrome debugger HTTP ${response.status}`);
  return response.json();
 },}={}){
 const deadline=now()+timeoutMs;let stage='DevToolsActivePort';
 while(now()<deadline){
  try{
   const raw=await readPort(),line=raw.split('\n')[0].trim();
   // Chrome may have created the file before writing its contents.
   if(line){
    if(!/^\d+$/.test(line)||Number(line)<1||Number(line)>65535)throw Error('Invalid Chrome debugger port');
    stage='initial debuggable page';
    if(now()>=deadline)break;
    const targets=await readTargets(Number(line),deadline-now());
    if(!Array.isArray(targets))throw Error('Invalid Chrome debugger target list');
    const target=targets.find(t=>t?.type==='page'&&typeof t.webSocketDebuggerUrl==='string'&&/^ws:\/\//.test(t.webSocketDebuggerUrl));
    if(target&&now()<deadline)return target;
   }
  }catch(error){
   const code=error.cause?.code||error.code;
   if(!['ENOENT','ECONNREFUSED','ECONNRESET'].includes(code)&&error.name!=='TimeoutError')throw error;
  }
  const remaining=deadline-now();if(remaining>0)await wait(Math.min(100,remaining));
 }
 throw Error(`Test Chrome startup timed out waiting for ${stage} after ${timeoutMs}ms.`);
}
