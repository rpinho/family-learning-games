// Bounded, parent-directed repetition. Counters persist across maze levels;
// names practice spelling/position, separately from ordinary word reading.
// Fictional spelling examples, not player identities or a real family.
export const FAMILY=['Alexandra','Jamie','Charlie','Jessica'];
const NAME_BAG=[0,1,0,2,0,3,0,1,0,0];
export const AT_WORDS=[['cat','🐱'],['hat','🎩'],['mat',''],['bat','🦇'],['rat','🐀']].map(([word,picture])=>({word,picture,tier:1,family:'at'}));
export const EXTRA_WORDS=[['map','🗺️'],['cap','🧢'],['tap','🚰'],['log','🪵']].map(([word,picture])=>({word,picture,tier:1}));
export const namePositionLine=(name,position)=>`${name[position].toUpperCase()} is letter number ${position+1} in ${name}.`;
export function familyNameQuestion(player,serial=0){
 const names=player==='beginner'?['Jamie','Alexandra','Charlie','Jessica']:FAMILY;
 const slot=serial%NAME_BAG.length,name=names[NAME_BAG[slot]],ownTurn=Math.floor(serial/10)*6+NAME_BAG.slice(0,slot).filter(n=>n===0).length;
 const focus=Math.floor(serial/10)%name.length;
 const char=name[focus].toUpperCase(),unique=[...name.toUpperCase()].filter(c=>c===char).length===1;
 const mode=unique&&Math.floor(serial/10)%2===0?'locate':'position';
 return {type:'name',name,focus,char,mode,answer:String(focus),options:Array.from(name,(_,i)=>String(i)),prompt:mode==='locate'?`Find ${char} in ${name}.`:`Tap letter number ${focus+1} in ${name}.`};
}
export function familyNameVoiceLines(){
 return FAMILY.flatMap(name=>[`${name}.`,...Array.from(name,(c,i)=>[`Find ${c.toUpperCase()} in ${name}.`,`Tap letter number ${i+1} in ${name}.`,namePositionLine(name,i)]).flat()]);
}
const AT_BAG=[true,true,false,true,false,true,false,true,false,true];
export function practiceWord(serial,pool,recent=[]){
 const slot=serial%10,isAt=AT_BAG[slot],category=isAt?AT_WORDS:pool.filter(w=>!w.word.endsWith('at'));
 const count=Math.floor(serial/10)*(isAt?6:4)+AT_BAG.slice(0,slot).filter(x=>x===isAt).length;
 const candidates=category.map((_,i)=>category[(count+i)%category.length]);
 return candidates.find(w=>!recent.slice(-2).includes(w.word))||candidates[0];
}
