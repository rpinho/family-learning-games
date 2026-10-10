// DevTools can open before Chrome has created its first page under build load.
export async function waitForPageTarget(readTargets,{attempts=100,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let i=0;i<attempts;i++){
  const target=(await readTargets()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
  if(target)return target;
  if(i+1<attempts)await wait(100);
 }
 throw Error('Test Chrome did not open a debuggable page.');
}
