export const takeAwayPrompt=n=>`Take away ${n}. How many are left?`;
// No target-count clamp: children can remove too many and put them back.
export const toggleRemoval=(removed,index)=>removed.includes(index)?removed.filter(i=>i!==index):[...removed,index];
export const PATTERN_UNITS=[[0,1],[0,0,1],[0,1,1],[0,1,2],[0,0,1,1],[0,1,0,2],[0,0,1,2],[0,1,1,2],[0,1,2,1],[0,1,2,3]];
export const PATTERN_THEMES=[['🔴','🔷','⭐','🟩'],['🍎','🍌','🍇','🍓'],['🐶','🐱','🐸','🐟'],['🚗','🚂','✈️','🚲'],['🌞','🌙','🌈','☁️'],['⚽','🏀','🏈','🎾'],['🚀','🪐','🛸','👽'],['🐙','🐠','🦀','🐳'],['🌻','🌷','🌵','🌲'],['🥁','🎺','🎸','🎹'],['🦋','🐝','🐞','🐌'],['🦕','🦖','🥚','🌋']];
export function patternLevel(p={}){
 let level=2,streak=0,misses=0;
 for(const h of p.history||[]){
  if(h.question?.patternVersion!==2)continue;
  if(h.ok&&!h.helped){misses=0;if(++streak>=5){level=Math.min(3,level+1);streak=0;}}
  else{streak=0;if(++misses>=2){level=Math.max(1,level-1);misses=0;}}
 }
 return level;
}
export function patternQuestion(r,round,p={}){
 const pick=n=>Math.floor(r()*n),shuffle=a=>a.map(v=>[r(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
 const level=patternLevel(p),families=level===1?[0,1,2,3,4,5]:[3,4,5,6,7,8,9];
 const family=families[(round+pick(families.length))%families.length],theme=pick(PATTERN_THEMES.length),symbols=shuffle(PATTERN_THEMES[theme]);
 const unit=PATTERN_UNITS[family].map(i=>symbols[i]),phase=pick(unit.length),length=unit.length*2+pick(Math.min(3,unit.length));
 const mode=round%3===2?'repair':level===1?'next':level===3&&round%2===0?'pair':round%2?'missing':'next';
 const sequence=Array.from({length},(_,i)=>unit[(i+phase)%unit.length]);let answer=unit[(length+phase)%unit.length],options=shuffle(symbols),blank;
 if(mode==='missing'||mode==='repair'){blank=unit.length+pick(length-unit.length-1);answer=sequence[blank];sequence[blank]=null;}
 // Sometimes find the beginning, not just continue the end. Two full repeats
 // remain visible as evidence; this changes the task without raising the tier.
 const position=mode==='missing'&&round%4===3?'start':'middle';
 if(position==='start'){sequence[blank]=answer;blank=0;answer=sequence[0];sequence[0]=null;}
 if(mode==='pair'){answer=[answer,unit[(length+phase+1)%unit.length]].join(' ');options=shuffle([answer,...shuffle(symbols.flatMap(a=>symbols.map(b=>a+' '+b)).filter(s=>s!==answer)).slice(0,3)]);}
 return {kind:'pattern',patternVersion:2,level,mode,family,theme,sequence,unit,phase,blank,position,answer,options,prompt:mode==='repair'?'Drag a picture into the gap.':position==='start'?'Which picture starts the pattern?':mode==='missing'?'Find the missing picture.':mode==='pair'?'Which two pictures come next?':'What comes next?'};
}
export const nearPatternGap=(x,y,rect)=>x>=rect.left-24&&x<=rect.right+24&&y>=rect.top-24&&y<=rect.bottom+24;
