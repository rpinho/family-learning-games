// Take the lock synchronously, before waiting for pending handwriting saves.
export function exclusiveReadingAction(run, setBusy) {
 let active=false;
 return async (...args)=>{
  if(active)return;
  active=true;setBusy(true);
  try{return await run(...args);}finally{active=false;setBusy(false);}
 };
}
