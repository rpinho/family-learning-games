// Manual app refresh is navigation, not save reconciliation. Automatic recovery
// stays separate: it must never discard a child's local work or reload a screen.
export function refreshURL(href,{player,tab,open,sound},stamp=Date.now()){
 const url=new URL(href);
 url.searchParams.set('player',player);
 url.searchParams.set('tab',tab);
 url.searchParams.set('resume',open?'1':'0');
 url.searchParams.set('quiet',sound?'0':'1');
 url.searchParams.set('_refresh',String(stamp));
 return url.href;
}
export function createAppRefresh({read,fetch:send,confirm,navigate,status,stop=()=>{},report=(_name,_detail)=>{},timeoutMs=5000}){
 let working=false;
 return {
  get busy(){return working;},
  async refresh(){
   if(working||read().saving)return false;
   working=true;status({busy:true,error:'',notice:'Checking for app updates…'});stop();
   let navigating=false;
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
   try{
    const response=await send('/health',{cache:'no-store',signal:controller.signal});
    if(!response.ok||!(await response.json()).ok)throw Error('unavailable');
    const state=read();
    if(state.saving)return false;
    if(state.draft&&!confirm('Refresh the app? Saved progress stays safe. Any unfinished drawing or answer on this screen will restart. Choose Cancel to keep working or save your drawing first.'))return false;
    report('app_refresh',{tab:state.tab});
    navigate(refreshURL(state.href,state));
    navigating=true;
    // Keep actions locked until navigation actually replaces this document.
    return true;
   }catch{
    status({busy:true,error:'Cannot reach your server. Your screen is still here. Try Refresh when connected.',notice:''});
    return false;
   }finally{
    clearTimeout(timer);
    // A successful navigation retains the lock; cancelled/failed attempts do not.
    if(!navigating){working=false;status({busy:false,notice:''});}
   }
  },
 };
}
