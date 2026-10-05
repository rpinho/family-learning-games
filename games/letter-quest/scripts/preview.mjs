// Isolated, disposable QA saves. Never reads or rewrites the children's profiles.
import {mkdtemp,writeFile,symlink} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {freshProfile} from '../public/engine.mjs';
import {storyState} from '../public/story.mjs';
import {mazeState,mazeBoard,mazeAction,mazeQuestion,mazeClue,mazeGate} from '../public/maze.mjs';
const data=await mkdtemp(join(tmpdir(),'letter-quest-hub-qa-'));
const admin=freshProfile('admin');
Object.assign(admin,{seq:48,completed:18,inLesson:3,xp:1500,gems:80,chests:1});
if(process.env.QA_SOUND==='1'){
 admin.story={...storyState(admin),chapter:27};
 admin.maze={...mazeState(admin),level:57,ability:1,practiceSerial:4};
 const board=mazeBoard(admin);admin.maze.position=board.start;admin.maze.visited=[board.start];
}
if(process.env.QA_ADVENTURE==='1'){
 admin.story={...storyState(admin),chapter:9,history:Array.from({length:9},(_,chapter)=>({chapter,fixture:true}))};
 admin.maze={...mazeState(admin),level:3};const board=mazeBoard(admin),position=board.exit+board.size;
 Object.assign(admin.maze,{position,direction:0,solved:[position],visited:[position],tasks:{}});
}
if(process.env.QA_LEARNING==='1'){
 admin.maze={...mazeState(admin),level:14};const board=mazeBoard(admin);
 admin.maze.position=board.start;admin.maze.direction=mazeClue(admin)?.absolute||0;admin.maze.visited=[board.start];
 for(let step=0;step<300;step++){
  if(mazeGate(admin)){const q=mazeQuestion(admin);if(step>0&&q.type==='gap')break;mazeAction(admin,{kind:'answer',questionId:q.id,answer:q.answer});}
  const turn=(mazeClue(admin).absolute-admin.maze.direction+4)%4;if(turn)mazeAction(admin,{kind:'turn',turn:turn===3?-1:turn});mazeAction(admin,{kind:'forward'});
 }
}
await writeFile(join(data,'admin.json'),JSON.stringify(admin),{mode:0o600});
await symlink(join(homedir(),'.local/share/letter-quest/voice'),join(data,'voice'));
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'14319',HOST:'127.0.0.1',LETTER_QUEST_DATA:data},stdio:'inherit'});
// Responsive visual harness: iframe viewport dimensions are real CSS pixels.
const preview=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/qa'){
  const width=Math.min(1600,Math.max(320,Number(url.searchParams.get('width'))||1024));
  const height=Math.min(1200,Math.max(320,Number(url.searchParams.get('height'))||600));
  const tab=['matches','quests','adventure','league','parents','maze','soccer','reading','rescue'].includes(url.searchParams.get('tab'))?url.searchParams.get('tab'):'matches';
  res.setHeader('Content-Type','text/html');
  res.end(`<!doctype html><html><head><title>Isolated responsive QA</title></head><body style="margin:0;background:#dde3e1"><iframe title="Game viewport ${width} by ${height}" style="display:block;border:0;width:${width}px;height:${height}px" src="/?player=admin#${tab}"></iframe></body></html>`);return;
 }
 const upstream=http.request({hostname:'127.0.0.1',port:14319,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:14320'}},response=>{
  // Only the isolated QA proxy permits same-origin frames. Production stays frame-ancestors 'none'.
  const headers={...response.headers};if(headers['content-security-policy'])headers['content-security-policy']=headers['content-security-policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'");
  res.writeHead(response.statusCode,headers);response.pipe(res);
 });
 upstream.on('error',()=>{res.statusCode=503;res.end('QA server starting');});req.pipe(upstream);
});
preview.listen(14320,'127.0.0.1',()=>console.log(`QA only: http://127.0.0.1:14320/?player=admin#matches | ${data}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill(signal);preview.close();});
child.on('exit',()=>preview.close());
