import {buildLearner} from '../learner.mjs';
import {planChapter} from '../plan.mjs';
// Synthetic players and saves for the Book tests. No real child data.
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export const NOW=Date.parse('2026-03-10T15:00:00Z');
const at=(h)=>new Date(NOW-h*36e5).toISOString();
export function saves(kind){
 const young=kind==='young';
 return {
  'letter-quest':{id:kind,completed:young?6:40,skills:{'find:A':{level:3},'find:B':{level:1},'find:E':{level:0}},placement:null,
   foundation:{stage:1,skills:{cat:{seen:6,hits:5,errors:0},duck:{seen:5,hits:1,errors:4}}},
   reading:{skills:{decode:{level:young?1:2},sentence:{level:1}},results:[{ok:true,mistakes:0,question:{word:'sun'}},{ok:true,mistakes:0,question:{word:'sun'}}],history:[]},
   maze:{level:young?3:40,history:[{at:at(20),level:2}]},story:{chapter:2},history:[{at:at(20),key:'gap:cat',ok:true}]},
  'number-park':young?{id:kind,completed:{count:4},history:[{at:at(20),game:'count',question:{kind:'count',answer:7},ok:true},{at:at(21),game:'subtract',question:{kind:'subtract',total:9,remove:2},ok:false}]}
   :{id:kind,history:[
    ...Array.from({length:6},(_,i)=>({at:at(30+i),game:'cookies',question:{track:'x-math-1',skill:'cookies',kind:'cookies',plan:'drag3',fade:'show',mode:'share',plates:4,total:16},ok:true,helped:i===0})),
    {at:at(20),game:'mix',question:{track:'x-math-1',skill:'multiply',kind:'multiply',a:6,b:7,total:42},ok:false,helped:false}]},
  'word-arcade':{id:kind,games:{rhyme:{level:2}},builder:{skills:{frog:{seen:3,hits:3,errors:0}}}},
  'maze-garden':{level:5,maker:{completed:3},history:Array.from({length:6},(_,i)=>({type:'requested-harder',at:new Date(NOW-20*36e5+i*500).toISOString()}))},
  'target-trail':{level:1,bullseyes:4,sling:{rounds:2,stages:{letters:1},history:[{at:at(20),mode:'letters',correct:3}]},history:[]},
  'three-in-a-row':{games:3,wins:1,draws:1,history:[{at:at(20)}]},
  hub:{goals:4,dribbles:2,history:[]}
 };
}
// A complete temporary deployment: deploy.json, game data dirs with saves + logs, hub config, profiles.
export async function deployment({players=['young','older']}={}){
 const root=await mkdtemp(join(tmpdir(),'book-test-'));
 const games={};
 for(const g of ['letter-quest','number-park','word-arcade','maze-garden','target-trail','three-in-a-row','hub']){
  const dir=join(root,'data',g);await mkdir(join(dir,'logs'),{recursive:true});games[g]={data:dir};
  for(const p of players)await writeFile(join(dir,p+'.json'),JSON.stringify(saves(p)[g]));
 }
 await writeFile(join(root,'data','maze-garden','logs','2026-03-09.jsonl'),[
  {at:at(20),player:'older',event:'client',type:'word-break',detail:JSON.stringify({kind:'sentence',answer:'Bo and Max run to the net.',misses:9,ms:6000})},
  {at:at(19),player:'older',event:'client',type:'word-break',detail:JSON.stringify({kind:'sentence',answer:'A red bug sat on Bo.',misses:8,ms:5000})},
  {at:at(18),player:'older',kind:'word-break',type:'client',detail:JSON.stringify({kind:'sentence',answer:'Is Bo in the net?',misses:6,ms:4000})},
  {at:at(18),player:'young',kind:'word-break',type:'client',detail:JSON.stringify({kind:'find-letter',answer:'B',misses:0,ms:2000})}
 ].map(r=>JSON.stringify(r)).join('\n')+'\n');
 await writeFile(join(root,'data','hub','logs','2026-03-09.jsonl'),JSON.stringify({at:at(20),type:'client',player:'young',kind:'open_game',detail:'maze-garden/maker'})+'\n');
 await writeFile(join(root,'data','hub','config.json'),JSON.stringify({players:[{id:'young',name:'Ada'},{id:'older',name:'Leo'},{id:'admin',name:'Admin'}],games:{}}));
 await writeFile(join(root,'data','hub','book-notes.json'),JSON.stringify({notes:[{id:'1',date:'2026-03-09',at:at(5),text:'Leo scored a goal',player:'older'},{id:'2',date:'2026-03-09',at:at(5),text:'we built the robot track',player:null}]}));
 await writeFile(join(root,'deploy.json'),JSON.stringify({games}));
 await mkdir(join(root,'book'),{recursive:true});
 await writeFile(join(root,'book','profiles.json'),JSON.stringify({
  young:{age:5,interests:['dinosaurs'],companions:[{name:'Bo',kind:'a big gentle bear',emoji:'🐻'}],sibling:'Leo',mathTrack:'early'},
  older:{age:8,interests:['robots','soccer'],companions:[{name:'Gizmo',kind:'a small robot pup',emoji:'🤖'}],sibling:'Ada',mathTrack:'facts',tricks:[{id:'sentence-position',text:'guesses sentence tiles by position',source:'parent'}]},
  _lint:{extra:['Smithers']}
 }));
 const recap=join(root,'recap');await mkdir(recap);
 await writeFile(join(recap,'2026-03-09.json'),JSON.stringify({date:'2026-03-09',kids:[{player:'older',name:'Leo',played:true,minutes:12,apps:{'letter-quest':{played:true,minutes:12,labyrinth:{gatesAnswered:10,gatesCorrect:8},stuck:['labyrinth word duck: 3 misses'],story:[]}}},{player:'young',name:'Ada',played:false,apps:{}}]}));
 await writeFile(join(recap,'2026-03-09.md'),'# Family learning games\n\n## Leo\n- **Time:** about 12 min\n\n## Ada\nNo play.\n');
 const env={FAMILY_DEPLOY_ROOT:root,FAMILY_RECAP_DIR:recap,FAMILY_TZ:'UTC',FAMILY_CONFIG:'',FAMILY_DATA:''};
 return {root,env};
}

export const young=buildLearner({player:'young',name:'Ada',profile:{age:5,mathTrack:'early',companions:[{name:'Bo',kind:'a big gentle bear',emoji:'🐻'}],interests:['dinosaurs']},now:NOW,saves:saves('young')});
export const older=buildLearner({player:'older',name:'Leo',profile:{age:8,mathTrack:'facts',companions:[{name:'Gizmo',kind:'a small robot pup',emoji:'🤖'}],interests:['robots']},now:NOW,saves:saves('older')});
export const plans=(dates=['2026-03-10','2026-03-11','2026-03-12','2026-03-13','2026-03-14'])=>dates.flatMap(d=>[planChapter(young,{date:d,profile:{sibling:'Leo'}}),planChapter(older,{date:d,profile:{sibling:'Ada'}})]);
