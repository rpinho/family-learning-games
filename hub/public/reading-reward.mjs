// Reusable short literacy stops. Reading difficulty is independent of game speed.
export const WORDS=['cat','hat','mat','sat','bat','rat','cap','tap','map','nap','sun','run','fun','bun','dog','log','pig','dig','big','pin','fin','hen','pen','ten'];
const LETTERS='MSATPNCFHDRBLG';
const NAMES={A:'ay',B:'bee',C:'see',D:'dee',E:'ee',F:'ef',G:'jee',H:'aitch',I:'eye',J:'jay',K:'kay',L:'el',M:'em',N:'en',O:'oh',P:'pee',Q:'cue',R:'ar',S:'ess',T:'tee',U:'you',V:'vee',W:'double you',X:'ex',Y:'why',Z:'zee'};
export const letterName=c=>NAMES[c.toUpperCase()]||c;
export function makeReward(serial,level=0){
 const tier=Math.max(0,Math.min(3,level)),word=WORDS[serial%WORDS.length],letter=LETTERS[serial%LETTERS.length];
 let prompt,answer,display,others,model;
 if(tier<2){answer=tier?letter.toLowerCase():letter;display=tier?letter:'';prompt=`Find ${letter}.`;model=`${letterName(letter)}.`;others=[...LETTERS].filter(c=>c!==letter).map(c=>tier?c.toLowerCase():c);}
 else if(tier===2){answer=word[0];display='_'+word.slice(1);prompt=`Make ${word}. Find the first letter.`;model=`${letterName(answer)} starts ${word}.`;others=[...LETTERS.toLowerCase()].filter(c=>c!==answer);}
 else{answer=word;display='';prompt=`Find ${word}.`;model=word;others=WORDS.filter(w=>w!==word);}
 const distractors=[others[serial%others.length],others[(serial+5)%others.length]],options=[...new Set([answer,...distractors])];
 const shift=serial%3;options.push(...options.splice(0,shift));
 return {id:`reading-${serial}`,serial,tier,prompt,cue:tier<2?`Find ${letterName(letter)}.`:prompt,display,answer,options,model,errors:0,helped:false,done:false};
}
export function freshReading(initialLevel=1){return {level:initialLevel===1?0:1,serial:0,stars:0,clean:0,struggles:0,history:[],pending:null};}
export function finishReward(reading,q,skipped=false){
 const independent=!skipped&&!q.helped&&q.errors===0;
 if(!skipped)reading.stars++;
 reading.clean=independent?reading.clean+1:0;
 reading.struggles=independent?0:reading.struggles+1;
 if(reading.clean>=3&&reading.level<3){reading.level++;reading.clean=0;}
 if(reading.struggles>=2&&reading.level>0){reading.level--;reading.struggles=0;}
 q.done=true;q.skipped=skipped;
 const result={id:q.id,tier:q.tier,target:q.answer,errors:q.errors,helped:q.helped,independent,skipped};
 reading.history.push(result);reading.history=reading.history.slice(-150);return result;
}
export const READING_LINES=[...new Set(['Letter reward!','Try another.','Your dribble still counts.','Nice!','Listen, then choose.',...Array.from({length:WORDS.length*LETTERS.length},(_,i)=>[0,1,2,3].flatMap(t=>{const q=makeReward(i,t);return [q.cue,q.model,...q.options.map(o=>o.length===1?letterName(o):o)];})).flat()])];
