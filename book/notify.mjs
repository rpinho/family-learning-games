import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readJSON,atomicJSON,reviewEvent} from './review.mjs';
export async function notify({paths,date,kind,chapters,env=process.env}){
 const base=env.BOOK_REVIEW_URL||JSON.parse(await (await import('node:fs/promises')).readFile(join(paths.root,'book-review-settings.json'),'utf8')).url;
 const link=base+(base.includes('?')?'&':'?')+'date='+encodeURIComponent(date);
 const key=chapters.map(c=>`${c.player}:${c.meta?.review?.revision||c.title}`).join('|'),file=join(paths.book,'review-log',`${date}-${kind}-mail.json`);
 if((await readJSON(file))?.key===key)return {skipped:true,link};
 const body=(kind==='auto'?'The review deadline passed, so these chapters were published automatically:':`The Book drafts for ${date} are ready for your review:`)+'\n\n'+chapters.map(c=>`${c.name||c.player}: ${c.title}`).join('\n')+'\n\n'+link+'\n\n'+(kind==='auto'?'They will be ready in the morning.':'Play every route, approve, request changes or redo before 05:30 on the evening before the chapter.');
 await new Promise((resolve,reject)=>{const child=execFile(env.BOOK_NOTICE_PYTHON||'python3',[fileURLToPath(new URL('./notify.py',import.meta.url))],{env,timeout:45000},(e,out)=>e?reject(e):(console.log(out.trim()),resolve()));child.stdin.end(JSON.stringify({subject:`The Book — ${kind==='auto'?'automatically published':'review tomorrow'} (${date})`,body}));});
 await atomicJSON(file,{key,at:new Date().toISOString(),link});await reviewEvent(paths.book,{action:'email',date,kind});return {link};
}
