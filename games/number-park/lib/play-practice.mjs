export const takeAwayPrompt=n=>`Take away ${n}. How many are left?`;
// No target-count clamp: children can remove too many and put them back.
export const toggleRemoval=(removed,index)=>removed.includes(index)?removed.filter(i=>i!==index):[...removed,index];
export const PATTERN_UNITS=[[0,1],[0,0,1],[0,1,1],[0,1,2],[0,0,1,1],[0,1,0,2],[0,0,1,2],[0,1,1,2],[0,1,2,1],[0,1,2,3],[0,1,2,2]];
export const PATTERN_THEMES=[['🔴','🔷','⭐','🟩'],['🍎','🍌','🍇','🍓'],['🐶','🐱','🐸','🐟'],['🚗','🚂','✈️','🚲'],['🌞','🌙','🌈','☁️'],['⚽','🏀','🏈','🎾'],['🚀','🪐','🛸','👽'],['🐙','🐠','🦀','🐳'],['🌻','🌷','🌵','🌲'],['🥁','🎺','🎸','🎹'],['🦋','🐝','🐞','🐌'],['🦕','🦖','🥚','🌋']];
export const PATTERN_MAX=7;
export const clampPattern=n=>Math.max(1,Math.min(PATTERN_MAX,Math.round(Number(n))||1));
export function patternLevel(p={}){
 const rows=(p.history||[]).filter(h=>h.question?.patternVersion===3);
 const manual=p.patternManual;
 let level=String(p.id).split('_')[0]==='beginner'?4:2,start=0,streak=0,misses=0;
 if(manual&&Number.isInteger(manual.after)&&manual.after>=0&&manual.after<=rows.length){level=clampPattern(manual.level);start=manual.after;}
 for(const h of rows.slice(start)){
  if(h.ok&&!h.helped){misses=0;if(++streak>=5){level=Math.min(PATTERN_MAX,level+1);streak=0;}}
  else if(h.ok&&h.helped)streak=0;
  else{streak=0;if(++misses>=2){level=Math.max(1,level-1);misses=0;}}
 }
 return level;
}
export function patternQuestion(r,round,p={}){
 const pick=n=>Math.floor(r()*n),shuffle=a=>a.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
 const level=patternLevel(p),families=level===1?[0]:level===2?[1,2,3]:[1,2,3,4,5,6,7,8,9,10];
 const family=families[(round+pick(families.length))%families.length],theme=pick(PATTERN_THEMES.length);let symbols=shuffle(PATTERN_THEMES[theme]);
 if(level>=6){symbols=['circle:coral','circle:teal','square:coral','square:teal'];if(round%2)symbols=['circle:gold','square:gold','square:teal','circle:teal'];symbols=shuffle(symbols);}
 const unit=PATTERN_UNITS[family].map(i=>symbols[i]),phase=pick(unit.length),length=Math.min(10,unit.length*2+pick(Math.min(3,unit.length)));
 if(level===5||level===7&&round%2===0){
  const symbol=PATTERN_THEMES[theme][0],start=1+pick(2),length=4,sequence=Array.from({length},(_,i)=>symbol.repeat(start+i)),mode=round%2?'missing':'next',blank=mode==='missing'?1+pick(2):undefined;
  const answer=symbol.repeat(start+(blank??length));if(blank!==undefined)sequence[blank]=null;
  return {kind:'pattern',patternVersion:3,level,mode,growing:true,theme,sequence,blank,answer,options:shuffle(Array.from({length:4},(_,i)=>symbol.repeat(mode==='next'?start+2+i:start+i))),prompt:mode==='missing'?'Find the missing picture.':'What comes next?'};
 }
 const mode=round%3===2?'repair':level===1?'next':level===3&&round%2===0?'pair':level>=4?'missing':round%2?'missing':'next';
 const sequence=Array.from({length},(_,i)=>unit[(i+phase)%unit.length]);let answer=unit[(length+phase)%unit.length],options=shuffle(symbols),blank;
 if(mode==='missing'||mode==='repair'){blank=unit.length+pick(length-unit.length-1);answer=sequence[blank];sequence[blank]=null;}
 // Sometimes find the beginning, not just continue the end. Two full repeats
 // remain visible as evidence; this changes the task without raising the tier.
 const position=mode==='missing'&&round%4===3?'start':'middle';
 if(position==='start'){sequence[blank]=answer;blank=0;answer=sequence[0];sequence[0]=null;}
 if(mode==='pair'){answer=[answer,unit[(length+phase+1)%unit.length]].join(' ');options=shuffle([answer,...shuffle(symbols.flatMap(a=>symbols.map(b=>a+' '+b)).filter(s=>s!==answer)).slice(0,3)]);}
 return {kind:'pattern',patternVersion:3,level,mode,twoAttributes:level>=6,family,theme,sequence,unit,phase,blank,position,answer,options,prompt:mode==='repair'?'Drag a picture into the gap.':position==='start'?'Which picture starts the pattern?':mode==='missing'?'Find the missing picture.':mode==='pair'?'Which two pictures come next?':'What comes next?'};
}
export const nearPatternGap=(x,y,rect)=>x>=rect.left-24&&x<=rect.right+24&&y>=rect.top-24&&y<=rect.bottom+24;
