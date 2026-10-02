// Private review slots. JSON is the commit point; the calm lines travel inside it as well.
import {readFile,writeFile,mkdir,rename,copyFile,open,unlink,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
export const readJSON=async f=>{try{return JSON.parse(await readFile(f,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
export function slot(book,player,date,review=false){if(!/^[\w-]+$/.test(player)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid player or date.');return join(book,player,...(review?['review']:[]),date);}
export async function atomicJSON(file,value){await mkdir(join(file,'..'),{recursive:true,mode:0o700});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,1),{mode:0o600});await rename(tmp,file);}
export async function withSlotLock(book,player,date,fn,{waitMs=0}={}){const base=slot(book,player,date),file=base+'.review-lock';await mkdir(join(base,'..'),{recursive:true,mode:0o700});let fd;
 try{fd=await open(file,'wx',0o600);}catch(e){if(e.code!=='EEXIST')throw e;let pid;try{pid=Number(await readFile(file,'utf8'));process.kill(pid,0);}catch(err){if(err.code==='ESRCH'){await unlink(file);return withSlotLock(book,player,date,fn);}}if(waitMs>0){await new Promise(r=>setTimeout(r,Math.min(1000,waitMs)));return withSlotLock(book,player,date,fn,{waitMs:waitMs-1000});}throw Object.assign(Error('This chapter is busy. Try again shortly.'),{status:409});}
 await fd.writeFile(String(process.pid));try{return await fn();}finally{await fd.close();await unlink(file);}}
export async function backupSlot(base,tag='replaced'){const back=join(base,'..',tag,base.split('/').at(-1)+'-'+randomUUID());let saved=false;
 for(const ext of ['.json','.md','.calm.json','.review.json']){try{await mkdir(back,{recursive:true,mode:0o700});await copyFile(base+ext,join(back,base.split('/').at(-1)+ext));saved=true;}catch(e){if(e.code!=='ENOENT')throw e;}}return saved?back:null;}
export async function reviewEvent(book,event){await mkdir(join(book,'review-log'),{recursive:true,mode:0o700});await appendFile(join(book,'review-log','events.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n',{mode:0o600});
 if(event.action==='changes'){const settings=await readJSON(join(book,'..','book-review-settings.json'));if(settings?.kbLog)await appendFile(settings.kbLog,`\n- ${new Date().toISOString()} **Book review — ${event.player}, ${event.date}:** ${event.note.replace(/\n/g,' ')} (draft ${event.revision}).\n`,{mode:0o600});}
}
export async function requestChanges({book,player,date,revision,note,by='grown-up'}){return withSlotLock(book,player,date,async()=>{
 const base=slot(book,player,date,true),ch=await readJSON(base+'.json');if(!ch||ch.meta?.review?.revision!==revision)throw Object.assign(Error('The draft changed. Reload before reviewing.'),{status:409});
 if(['approved','auto'].includes(ch.meta.review.state))throw Object.assign(Error('Already published. Create a new draft first.'),{status:409});
 const text=String(note||'').trim();if(!text||text.length>2000)throw Object.assign(Error('Write a note (up to 2000 characters).'),{status:400});
 const notes=await readJSON(base+'.review.json')||{notes:[]};notes.notes.push({at:new Date().toISOString(),by,text,revision});await atomicJSON(base+'.review.json',notes);
 ch.meta.review.state='changes';await atomicJSON(base+'.json',ch);await reviewEvent(book,{action:'changes',player,date,note:text,revision,by});return ch;
 });}
