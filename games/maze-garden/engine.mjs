export const VERSION = 'maze-garden-2026-09-16-junction-hints';
export const MAX_LEVEL = 27;
export const baseline = player => player==='explorer'?12:player==='beginner'?6:6;
export const gridSize = level => 9+2*(Math.max(1,Math.min(MAX_LEVEL,level))-1);
export const PLAYERS = {explorer:'Explorer',beginner:'Beginner',admin:'Admin · Admin'};
export const THEMES = [
 {name:'Garden trails',animal:'🐰',goal:'🥕',wall:'#17734d',floor:'#efffe7',accent:'#f7ab28',back:'#b4e5bc'},
 {name:'Coral coves',animal:'🐢',goal:'🏝️',wall:'#146784',floor:'#e2faff',accent:'#ff8d6b',back:'#95dfe9'},
 {name:'Honey hills',animal:'🐝',goal:'🌼',wall:'#805217',floor:'#fff7ce',accent:'#e68b13',back:'#f5d36e'},
 {name:'Moon paths',animal:'🚀',goal:'🪐',wall:'#6455ac',floor:'#f0edff',accent:'#c54fa4',back:'#bfb3ed'},
 {name:'Frosty tracks',animal:'🐧',goal:'🐟',wall:'#287aa1',floor:'#f0fcff',accent:'#dc745b',back:'#b2deed'},
 {name:'Jungle crossings',animal:'🐒',goal:'🍌',wall:'#386e28',floor:'#f1f8d5',accent:'#c76c22',back:'#c3df7d'},
 {name:'Foxglove woods',animal:'🦊',goal:'🏡',wall:'#8d4264',floor:'#fff0f5',accent:'#df7835',back:'#e8b5cb'},
 {name:'Dragon valley',animal:'🐉',goal:'💎',wall:'#246a65',floor:'#e6fff9',accent:'#bd57ba',back:'#92d5c9'}
];
export function random(seed) {let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const shuffle=(a,r)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function neighbors(m,id){const x=id%m.n,y=Math.floor(id/m.n);return [[x,y-1],[x+1,y],[x,y+1],[x-1,y]].filter(([a,b])=>a>=0&&b>=0&&a<m.n&&b<m.n).map(([a,b])=>b*m.n+a).filter(i=>m.cells[i]!==null);}
export function route(m,start,goal){const queue=[start],prev=new Map([[start,null]]);for(let k=0;k<queue.length;k++){let v=queue[k];if(v===goal)break;for(const w of m.cells[v]||[]){if(!prev.has(w)){prev.set(w,v);queue.push(w);}}}if(!prev.has(goal))return [];let out=[];for(let v=goal;v!==null;v=prev.get(v))out.push(v);return out.reverse();}
// One decision at a time: first locate a junction, then show its outgoing branch.
export function decisionHint(a) {
 const path=route(a,a.trail.at(-1),a.goal);
 const index=path.findIndex(id=>a.cells[id].length>=3);
 const at=index<0?path.length-1:index;
 const junction=path[at];
 return {junction,cells:path.slice(at,at+2)};
}
export function requestHint(a,now=Date.now()) {
 const decision=decisionHint(a),key=String(decision.junction);
 a.hintDecisions??={};
 let hint=a.hintDecisions[key];
 if(!hint){hint={stage:1,readyAt:now+5000};a.hintDecisions[key]=hint;a.hints++;}
 else if(hint.stage===1&&now>=hint.readyAt)hint.stage=2;
 a.hintCue={...hint,junction:decision.junction,cells:hint.stage===2?decision.cells:[decision.junction]};
}
function candidate(level,seed,shape){const r=random(seed),n=gridSize(level),mid=(n-1)/2;
 const active=(x,y)=>shape===1?Math.abs(x-mid)+Math.abs(y-mid)<=Math.floor(n*.76):shape===2?(Math.abs(x-mid)<=Math.floor(n*.34)||Math.abs(y-mid)<=Math.floor(n*.34)):shape===3?(Math.abs(x-mid)<=mid-Math.floor(Math.min(y,n-1-y)/3)):true;
 const cells=Array.from({length:n*n},(_,i)=>active(i%n,Math.floor(i/n))?[]:null);const m={n,cells,shape,seed};const first=cells.findIndex(c=>c!==null),seen=new Set([first]),stack=[first];
 // Growing-tree mix: retain long runs but add substantial branching, not one long snake.
 while(stack.length){const at=r()<.78?stack.length-1:Math.floor(r()*stack.length);let v=stack[at],next=shuffle(neighbors(m,v).filter(i=>!seen.has(i)),r)[0];if(next===undefined){stack.splice(at,1);continue;}cells[v].push(next);cells[next].push(v);seen.add(next);stack.push(next);}
 // Put both endpoints on the outline, like a paper maze's entrance and exit.
 function far(s){let best=s,dist=new Map([[s,0]]),q=[s];for(let k=0;k<q.length;k++)for(const v of cells[q[k]])if(!dist.has(v)){dist.set(v,dist.get(q[k])+1);q.push(v);if(neighbors(m,v).length<4&&dist.get(v)>dist.get(best))best=v;}return best;}
 m.start=far(first);m.goal=far(m.start);m.solution=route(m,m.start,m.goal);
 m.metrics={cells:seen.size,deadEnds:cells.filter(c=>c?.length===1).length,junctions:cells.filter(c=>c?.length>=3).length,decisions:m.solution.filter(i=>cells[i].length>=3).length,steps:m.solution.length-1};return m;
}
export function makeMaze(level,seed,shapeOverride){const shape=shapeOverride??(seed>>>0)%4;const quality=m=>m.metrics.steps+4*m.metrics.decisions;let m=candidate(level,seed,shape);for(let k=1;k<6;k++){let alt=candidate(level,seed+k*991,shape);if(quality(alt)>quality(m))m=alt;}return m;}
export function newProfile(player){return {player,calibration:2,level:baseline(player),completed:0,stars:0,streak:0,struggles:0,revision:0,mode:'pure',history:[],active:null};}
export function recalibrate(p,seed){if(p.calibration===2)return false;if(p.active)(p.archivedMazes??=[]).push(p.active);p.calibration=2;p.level=Math.max(baseline(p.player),Math.min(MAX_LEVEL,p.level||1));p.streak=0;p.struggles=0;p.active=startMaze(p,seed);return true;}
export function puzzleFor(player,seed,index){const r=random(seed+index*101),pick=a=>a[Math.floor(r()*a.length)];if(player==='explorer'){
 const names=['ALEXANDRA','ALEXANDRA','JAMIE','CHARLIE','JESSICA'],name=pick(names),position=Math.floor(r()*name.length),answer=name[position];
 const options=shuffle([...new Set([answer,...shuffle('ACDFIMNORST'.split(''),r)])].slice(0,3),r);
 return {prompt:`Find ${answer.toLowerCase()}.`,spoken:`Find the lowercase letter ${answer}.`,context:`${name.slice(0,position)}[${answer}]${name.slice(position+1)}`,options:options.map(x=>x.toLowerCase()),answer:answer.toLowerCase()};
 }if(index%2){const a=pick(['🔴','⭐','🟦']),b=pick(['🟢','🌙','🔶']);return {prompt:'What comes next?',spoken:'What comes next in the pattern?',context:`${a} ${b} ${a} ${b} ${a} ?`,options:shuffle([a,b,'💜'],r),answer:b};}
 const count=2+Math.floor(r()*7);return {prompt:'How many stars?',spoken:'Count the stars. How many?',context:'⭐ '.repeat(count),options:shuffle([String(count),String(count+1),String(count-1)],r),answer:String(count)};
}
export function startMaze(p,seed=Date.now()>>>0){const maze=makeMaze(p.level,seed,p.completed===0?0:undefined);return {...maze,id:`${seed}-${p.completed}-${p.level}`,level:p.level,theme:p.completed%THEMES.length,mode:p.mode,trail:[maze.start],moves:0,hints:0,wrong:0,startedAt:Date.now(),finished:false,checkpoints:p.mode==='puzzles'?[.35,.7].map((f,i)=>({cell:maze.solution[Math.floor((maze.solution.length-1)*f)],solved:false,puzzle:puzzleFor(p.player,seed,i)})):[]};}
export function pendingPuzzle(a){return a.checkpoints.find(c=>c.cell===a.trail.at(-1)&&!c.solved);}
export function move(a,to){if(a.finished||pendingPuzzle(a))return false;const from=a.trail.at(-1);if(!a.cells[from]?.includes(to))return false;const prior=a.trail.indexOf(to);if(prior>=0)a.trail.length=prior+1;else a.trail.push(to);a.moves++;return true;}
export function complete(p,now=Date.now()){const a=p.active;if(!a||a.finished||a.trail.at(-1)!==a.goal||a.checkpoints.some(c=>!c.solved))return false;a.finished=true;const ratio=a.moves/(a.solution.length-1),clean=a.hints===0&&ratio<=1.6;const difficult=ratio>3.5;
 p.completed++;p.stars+=3;p.streak=clean?p.streak+1:0;p.struggles=difficult?p.struggles+1:0;
 let change='same';if(clean&&p.level<MAX_LEVEL){p.level=Math.min(MAX_LEVEL,p.level+(ratio<=1.15?2:1));p.streak=0;p.struggles=0;change='up';}else if(p.struggles>=2&&p.level>1){p.level--;p.struggles=0;change='down';}
 p.history.push({id:a.id,level:a.level,theme:a.theme,mode:a.mode,moves:a.moves,optimal:a.solution.length-1,hints:a.hints,stars:3,independent:a.hints===0,wrong:a.wrong,seconds:Math.round((now-a.startedAt)/1000),change,at:new Date(now).toISOString()});p.history=p.history.slice(-500);return true;}
export function action(p,input){const a=p.active;switch(input.type){case 'recalibrate':recalibrate(p,input.seed);break;case 'start':if(!a||a.finished)p.active=startMaze(p,input.seed);break;
 case 'moves':if(!a||input.maze!==a.id)throw Error('This maze has changed. Refresh to continue.');if(!Array.isArray(input.cells)||input.cells.length>1000)throw Error('Invalid trail');for(const id of input.cells){if(!Number.isInteger(id)||!move(a,id))throw Error('That trail crosses a wall or a puzzle stop.');}complete(p);break;
 case 'answer':{const c=pendingPuzzle(a);if(!c)throw Error('No puzzle here');if(String(input.answer)===c.puzzle.answer)c.solved=true;else a.wrong++;complete(p);break;}
 case 'hint':if(a&&!a.finished){requestHint(a);}break;
 case 'mode':if(!['pure','puzzles'].includes(input.mode))throw Error('Invalid mode');p.mode=input.mode;break;
 case 'level':if(![-1,1].includes(input.delta))throw Error('Invalid level');p.level=Math.max(1,Math.min(MAX_LEVEL,p.level+input.delta));p.streak=0;p.struggles=0;break;
 case 'challenge':if(![-2,-1,1,2].includes(input.delta))throw Error('Invalid challenge');p.history.push({id:a?.id,type:input.delta>0?'requested-harder':'requested-easier',level:a?.level,at:new Date().toISOString()});p.history=p.history.slice(-500);p.level=Math.max(1,Math.min(MAX_LEVEL,p.level+Math.sign(input.delta)));p.streak=0;p.struggles=0;p.active=startMaze(p,input.seed);break;
 case 'new':p.history.push({id:a?.id,type:'skipped',level:a?.level,at:new Date().toISOString()});p.history=p.history.slice(-500);p.active=startMaze(p,input.seed);break;
 default:throw Error('Unknown action');}p.revision++;return p;}
// Sample a finger segment in grid coordinates. Stop at the first wall; never wrap or teleport.
export function traceSegment(a,from,to){const dx=to.x-from.x,dy=to.y-from.y,steps=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))*8)||1,out=[];for(let k=1;k<=Math.min(steps,512);k++){const x=Math.floor(from.x+dx*k/steps),y=Math.floor(from.y+dy*k/steps);if(x<0||y<0||x>=a.n||y>=a.n)break;const cell=y*a.n+x,current=a.trail.at(-1);if(cell===current)continue;if(!move(a,cell))break;out.push(cell);if(pendingPuzzle(a)||cell===a.goal)break;}return out;}
