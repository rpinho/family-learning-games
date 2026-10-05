import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {dayNotesStore} from '../daynotes-service.mjs';
// Synthetic presets only (Beginner, Explorer); an isolated day-notes directory.
async function hub(){
 const data=await mkdtemp(join(tmpdir(),'family-hub-daynotes-')),notes=join(data,'daynotes');
 const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{...process.env,FAMILY_CONFIG:'',FAMILY_DATA:data,FAMILY_BOOK:join(data,'book'),FAMILY_DAYNOTES:notes,FAMILY_DEPLOY_DIR:'',FAMILY_CHANNEL:'',PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 const out=await new Promise((resolve,reject)=>{child.stdout.once('data',x=>resolve(String(x)));child.once('exit',c=>reject(Error('exit '+c)));});
 return {data,notes,child,base:'http://127.0.0.1:'+out.match(/localhost:(\d+)/)[1]};
}
const post=(base,body,type='application/json')=>fetch(base+'/api/daynotes',{method:'POST',headers:{'Content-Type':type},body:JSON.stringify(body)});

test('Day notes: one store for live and staging, a preview keeps its own',()=>{
 assert.equal(dayNotesStore({deployDir:'/r/live',channel:'live',bookDir:'/r/book'}),'/r/book/daynotes');
 assert.equal(dayNotesStore({deployDir:'/r/staging',channel:'staging',bookDir:'/r/staging-data/book'}),'/r/book/daynotes');
 assert.equal(dayNotesStore({deployDir:'/r/previews/x/deploy',channel:'preview',bookDir:'/r/previews/x/book'}),'/r/previews/x/book/daynotes');
 assert.equal(dayNotesStore({env:{FAMILY_DAYNOTES:'/elsewhere'},deployDir:'/r/live',channel:'live',bookDir:'/r/book'}),'/elsewhere');
});

test('Day notes page and API: add, list, delete; private files; children only from the presets',async()=>{
 const {base,child,notes}=await hub();
 try{
  const page=await fetch(base+'/daynotes');assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);
  const html=await page.text();assert.match(html,/id="note-text"/);assert.match(html,/daynotes\.mjs/);assert.match(html,/id="gate"/);
  for(const f of ['/daynotes.mjs','/daynotes.css','/menu-options.mjs'])assert.equal((await fetch(base+f)).status,200,f);
  assert.equal((await fetch(base+'/daynotes/../server.mjs')).status,404);
  let j=await(await fetch(base+'/api/daynotes')).json();
  assert.deepEqual(j.children.map(c=>c.id),['beginner','explorer'],'admin is not a child');assert.deepEqual(j.notes,[]);
  assert.equal((await post(base,{child:'beginner',text:'  '})).status,400);
  assert.equal((await post(base,{child:'admin',text:'hello'})).status,400);
  assert.equal((await post(base,{child:'beginner',text:'x'},'text/plain')).status,415);
  j=await(await post(base,{child:'beginner',text:'We rode the golf cart to the park',from:'mom'})).json();
  assert.equal(j.notes.length,1);assert.equal(j.notes[0].child,'beginner');assert.equal(j.notes[0].from,'mom');assert.equal(j.notes[0].date,j.today);
  j=await(await post(base,{child:'both',text:'a memory',memory:true,from:'nobody'})).json();
  assert.equal(j.notes[0].text,'a memory','newest first');assert.equal(j.notes[0].memory,true);assert.equal(j.notes[0].from,'dad');
  const file=join(notes,j.today+'.json');assert.equal(((await stat(file)).mode&0o777),0o600);
  assert.equal(JSON.parse(await readFile(file,'utf8')).notes.length,2);
  j=await(await post(base,{remove:j.notes[1].id})).json();assert.deepEqual(j.notes.map(n=>n.text),['a memory']);
  assert.equal((await post(base,{remove:'20200101-nothere'})).status,404);
  assert.equal((await fetch(base+'/api/daynotes',{method:'DELETE'})).status,405);
  // a cross-site page cannot write a note
  assert.equal((await fetch(base+'/api/daynotes',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{"child":"both","text":"x"}'})).status,403);
 }finally{child.kill();}
});

test('The day notes page is reached only from Grown-ups, never from a child’s home',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const dialog=html.match(/<section id="parent-options"[\s\S]*?<\/section><button id="change-player"/)?.[0]||'';
 assert.match(dialog,/href="\/daynotes"/,'the link sits inside the grown-ups options (shown only after the grown-ups question)');
 assert.equal(html.split('/daynotes').length-1,1,'and nowhere else on the page');
 const hubJs=await readFile(new URL('../public/hub.mjs',import.meta.url),'utf8');assert.doesNotMatch(hubJs,/\/daynotes/);
 const page=await readFile(new URL('../public/daynotes.mjs',import.meta.url),'utf8');assert.match(page,/parentChallenge/,'the page asks the grown-ups question itself');
});
