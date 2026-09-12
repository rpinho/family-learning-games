// One in-flight operation per screen. Recovery reads; it NEVER replays a move.
export function createSaveClient({fetch:send,apply,status,report=(_name,_detail)=>{},timeoutMs=8000}){
 let player=null,profile=null,epoch=0,working=false,pending=false,controller=null;
 const clientId=`np-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
 let serial=0;
 const headers=()=>({'X-Game-Client':clientId,'X-Game-Request':`${clientId}-${++serial}`});
 const note=(name,detail)=>{try{report(name,{clientId,player,...detail});}catch{}};
 async function request(path,options={}){
  const c=new AbortController();controller=c;
  const timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
   const r=await send(path,{...options,cache:'no-store',signal:c.signal,headers:{...headers(),...options.headers}});
   const data=await r.json();
   if(!r.ok)throw Object.assign(Error(data.error||'Could not connect.'),{status:r.status});
   return data;
  }finally{clearTimeout(timer);if(controller===c)controller=null;}
 }
 function accept(data,token){
  if(token!==epoch||data.id!==player)return false;
  if(profile&&data.revision<profile.revision)return false;
  const changed=!profile||profile.revision!==data.revision;
  profile=data;if(changed)apply(data);return true;
 }
 async function perform(input,reason){
  if(!player)return null;
  if(working){if(!input)pending=true;return null;}
  if(input&&!profile)return null;
  working=true;const token=epoch,id=player,revision=profile?.revision;
  status({busy:true,error:'',notice:input?'':'Reconnecting…'});
  try{
   const data=await request('/api/'+id+(input?'/action':''),input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,revision})}:{});
   if(!accept(data,token))return null;
   if(!input){note('refreshed',{reason,from:revision,to:data.revision});status({busy:true,error:'',notice:reason==='initial'?'':'Game is up to date.'});}
   return data;
  }catch(e){
   if(token!==epoch)return null;
   note('request_failed',{reason,kind:input?.kind,revision,error:e.message,status:e.status});
   // A timeout can happen after the server saved the move. Read before letting
   // the child continue, without submitting the same answer a second time.
   if(input&&(e.status===409||!e.status||e.status>=500)){
    status({busy:true,error:'',notice:'Reconnecting…'});
    try{
     const data=await request('/api/'+id);
     if(accept(data,token)){
      note('recovered',{kind:input.kind,from:revision,to:data.revision});
      status({busy:true,error:'',notice:'Game reconnected. Keep playing.'});
     }
     return null;
    }catch(recovery){if(token!==epoch)return null;note('recovery_failed',{error:recovery.message});}
   }
   status({busy:true,error:e.status&&e.status<500&&e.status!==409?e.message:'Cannot reach your server. Keep this screen open, then tap Refresh.',notice:''});
   return null;
  }finally{
   if(token===epoch){working=false;status({busy:false});if(pending){pending=false;void perform(null,'queued');}}
  }
 }
 return {
  headers,
  select(id){epoch++;controller?.abort();controller=null;player=id;profile=null;working=false;pending=false;return perform(null,'initial');},
  action(input){return perform(input,'action');},
  refresh(reason='manual'){return perform(null,reason);},
  get busy(){return working;},
  dispose(){epoch++;controller?.abort();player=null;profile=null;working=false;pending=false;},
 };
}
