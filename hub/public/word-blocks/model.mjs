import {SETS} from './content.mjs';
const secure=(profile,word)=>(profile?.words?.[word]?.careful||0)>=3;
import {FAMILIES} from '../word-families.mjs';
import {PICTURE_WORDS,NUMBER_WORDS,COIN_POOLS} from './content.mjs';
export const LOOK_MS=2500, RUN_LENGTH=6, STEP_WORDS=4;
const vocabulary=[...new Set([...Object.values(FAMILIES).flat(),...SETS.flatMap(s=>s.words)])].filter(w=>!['fat','bad','mad','sad','ham','cut','hit','bit'].includes(w));
const fail=message=>{throw Object.assign(Error(message),{status:409});};
export function neighbours(word,index){
 const pool=vocabulary.filter(w=>w!==word&&[...w].every((c,i)=>i===index||c===word[i]));
 const letters=[word[index],...new Set(pool.map(w=>w[index]).filter(c=>index!==0||!('bd'.includes(c)&&'bd'.includes(word[0]))))];
 if(index===0&&letters.includes('b')&&letters.includes('d'))letters.splice(letters.indexOf(word[0]==='d'?'b':'d'),1);
 return letters.slice(0,4);
}
export function wordChoices(word,step){
 const all=[0,1,2].map(i=>neighbours(word,i));
 const active=step===0?[0]:step===1?[1]:step===2?[0,1]:[0,1,2];
 if(active.some(i=>all[i].length<2))return null;
 return all.map((a,i)=>active.includes(i)?a:[word[i]]);
}
export function spellingOrder(practice={},known=[]){
 const secureWords=PICTURE_WORDS.filter(w=>known.includes(w)||secure({words:practice.words||{}},w));
 return [...new Set([...secureWords,...SETS.flatMap(s=>s.words).filter(w=>PICTURE_WORDS.includes(w))])];
}
export function sentenceChoices(row,step,allowed){
 const choices=row.choices.map(c=>c.filter(w=>allowed.has(w)));
 if(choices.some((c,i)=>!c.includes(row.words[i])))return null;
 const movable=choices.map((c,i)=>c.length>1?i:-1).filter(i=>i>=0);
 // Subject first, then action/object, then the linking word/article.
 const order=[['sat','ran'].includes(row.scene.action)?1:0,2,['sat','ran'].includes(row.scene.action)?0:1];
 const active=[...new Set(order)].filter(i=>movable.includes(i)).slice(0,step+1);
 if(active.length<step+1)return null;
 return choices.map((c,i)=>active.includes(i)?c:[row.words[i]]);
}
export const freshBlocks=()=>({schema:1,revision:0,current:null,progress:{spelling:{step:0,group:0,seen:[],review:[],cursor:0,clean:{}},sentences:{step:0,group:0,seen:[],review:[],cursor:0,clean:{}},coins:{step:0,runs:0,cursor:0}},words:{},sessions:0});
const shuffled=(a,random)=>a.map(v=>({v,r:random()})).sort((a,b)=>a.r-b.r).map(x=>x.v);
export function startRound(p,activity,context,now,random){
 const prog=p.progress[activity];
 if(activity==='coins'){
  const pool=COIN_POOLS[prog.step],count=context.compact?4:6;
  const numbers=Array.from({length:Math.min(count,pool.length)},(_,i)=>pool[(prog.cursor+i)%pool.length]);prog.cursor=(prog.cursor+numbers.length)%pool.length;
  p.current={activity,phase:'play',cards:shuffled(numbers.flatMap(n=>[{n,kind:'number'},{n,kind:'word'}]),random),open:[],matched:[],turns:0,started:now,round:0,tries:0};return;
 }
 const groups=activity==='spelling'?[context.words.filter(w=>context.known.includes(w)||secure(context.practice,w)),...SETS.map(set=>set.words.filter(w=>PICTURE_WORDS.includes(w)))].filter(g=>g.length):null;
 const groupWords=groups?.[Math.min(prog.group||0,groups.length-1)];
 const rows=activity==='spelling'?groupWords.map(word=>({id:word,words:[...word],choices:wordChoices(word,prog.step),scene:{word}})):
  context.sentences.map(row=>({...row,choices:sentenceChoices(row,prog.step,context.allowed)}));
 const ready=rows.filter(r=>r.choices);
 if(!ready.length&&activity==='spelling'&&(prog.group||0)<groups.length-1){prog.group=(prog.group||0)+1;prog.step=0;prog.seen=[];prog.position=0;return startRound(p,activity,context,now,random);}
 if(!ready.length)fail('No pictures ready for this step. A grown-up can check the word pack.');
 const due=prog.review.find(x=>x.after<=prog.cursor&&ready.some(r=>r.id===x.id));
 const selected=(due&&ready.find(r=>r.id===due.id))||ready[(prog.position||0)%ready.length];
 if(due)due.after=prog.cursor+3;else prog.position=(prog.position||0)+1;
 const previous=p.current;
 p.current={activity,phase:'play',id:selected.id,target:activity==='spelling'?selected.id:selected.words.join(' '),choices:selected.choices,
  values:selected.choices.map((c,i)=>c.length===1?c[0]:c[(c.indexOf(selected.words[i])+1)%c.length]),
  answers:selected.answers||[selected.words],scene:selected.scene,step:prog.step,turns:0,tries:0,firstRight:null,started:now,
  round:previous?.activity===activity&&previous.phase==='right'?previous.round+1:0,limit:Math.min(STEP_WORDS,ready.length)};
 prog.cursor++;
}
export function blocksAct(p,input,{now=Date.now(),random=Math.random,...context}={}){
 const s=p.current;let result={action:input.type};
 switch(input.type){
  case 'start':
   if(!['spelling','sentences','coins'].includes(input.activity))fail('Choose a shelf picture.');
   p.paused ||= {};
   if(s&&s.phase!=='finish'){if(s.activity===input.activity)break;p.paused[s.activity]=s;}
   if(p.paused[input.activity]){p.current=p.paused[input.activity];delete p.paused[input.activity];break;}
   startRound(p,input.activity,context,now,random);p.sessions++;break;
  case 'shelf':
   // Preserve the activity; shelf is a client view. Only a finished run may start another.
   fail('Use resume for your saved activity.');break;
  case 'turn':{
   if(!s||s.phase!=='play'||s.activity==='coins'||!Number.isInteger(input.index)||!s.choices[input.index]||s.choices[input.index].length<2||![1,-1].includes(input.direction))fail('Turn an open block.');
   const i=input.index,c=s.choices[i];s.values[i]=c[(c.indexOf(s.values[i])+input.direction+c.length)%c.length];s.turns++;break;
  }
  case 'press':{
   if(!s||s.phase!=='play'||s.activity==='coins')fail('Turn the blocks first.');
   const right=s.answers.some(a=>a.every((v,i)=>s.values[i]===v)),seconds=Math.max(0,now-s.started)/1000;
   if(!s.tries)s.firstRight=right;
   const counted=right&&s.tries===0&&now-s.started>=LOOK_MS;s.tries++;
   const closest=s.answers.slice().sort((a,b)=>a.filter((v,i)=>v!==s.values[i]).length-b.filter((v,i)=>v!==s.values[i]).length)[0];
   result={...result,activity:s.activity,word:s.target,step:s.step,turns:s.turns,seconds,firstPressRight:s.firstRight,right,counted,
    wrong:s.values.map((v,i)=>closest[i]===v?-1:i).filter(i=>i>=0)};
   if(right){
    if(s.activity==='sentences')result.spoken=s.values.join(' ');
    s.phase='right';s.counted=counted;
    const prog=p.progress[s.activity];
    const summary=p.words[s.target]||={tries:0,firstRight:0,careful:0};summary.tries+=s.tries;summary.firstRight+=s.firstRight?1:0;summary.careful+=counted?1:0;
    if(counted){prog.review=prog.review.filter(r=>r.id!==s.id);if(!prog.seen.includes(s.id))prog.seen.push(s.id);prog.clean[s.id]=(prog.clean[s.id]||0)+1;}
    else if(!prog.review.some(r=>r.id===s.id))prog.review.push({id:s.id,after:prog.cursor+2});
   }
   break;
  }
  case 'next':{
   if(!s||s.phase!=='right')fail('Press when the picture matches.');
   if(s.activity==='coins')fail('Choose the next pair.');
   if(s.round+1>=RUN_LENGTH){s.phase='finish';const prog=p.progress[s.activity],max=s.activity==='spelling'?3:2;
    if(prog.seen.length>=s.limit&&!prog.review.length){if(prog.step<max)prog.step++;else if(s.activity==='spelling'){prog.group++;prog.step=0;}prog.seen=[];prog.position=0;}
   }else startRound(p,s.activity,context,now,random);
   break;
  }
  case 'flip':{
   if(!s||s.activity!=='coins'||s.phase!=='play'||!Number.isInteger(input.index)||!s.cards[input.index]||s.matched.includes(input.index)||s.open.includes(input.index)||s.open.length===2)fail('Turn a face-down coin.');
   s.open.push(input.index);s.turns++;
   if(s.open.length===2){
    const [a,b]=s.open.map(i=>s.cards[i]),matched=a.n===b.n&&a.kind!==b.kind;
    result={...result,activity:'coins',word:NUMBER_WORDS[a.n],step:p.progress.coins.step,turns:s.turns,seconds:Math.max(0,now-s.started)/1000,firstPressRight:null,right:matched,counted:false};
    if(matched){s.matched.push(...s.open);s.open=[];result.spoken=NUMBER_WORDS[a.n];
     if(s.matched.length===s.cards.length){s.phase='finish';const prog=p.progress.coins;prog.runs++;if(prog.runs%2===0&&prog.step<2)prog.step++;}
    }else s.hideAfter=now+900;
    s.tries++;if(s.tries>=18){s.phase='finish';s.open=[];}
   }
   break;
  }
  case 'hide':
   if(!s||s.activity!=='coins'||s.open.length!==2||now<s.hideAfter)fail('Look at the two cards.');s.open=[];delete s.hideAfter;break;
  default:fail('Unknown activity action.');
 }
 p.revision++;return result;
}
