export const SETS = Object.freeze([
  {id:'a', name:'Short a', words:['mat','sat','pat','pan','man','map']},
  {id:'i', name:'Short i', words:['sit','pit','pin','tin','tip','sip']},
  {id:'ai', name:'Mix a and i', words:['pan','pin','pit','pat','sat','sit','sip','tip','tin','tan']},
  {id:'o', name:'Short o', words:['pot','hot','hop','mop','pop']},
  {id:'u', name:'Short u', words:['sun','run','rug','mug','mud','bud','bun']},
  {id:'e', name:'Short e', words:['pet','net','met','men','pen']},
]);

// Authored picture coverage, not a second teaching sequence. Order comes from SETS.
export const PICTURE_WORDS = Object.freeze(['sun','fox','top','cup','mat','pan','man','map','pin','tin','pot','mop','rug','mug','bud','bun','net','pen','cat','hat','bat','rat','cap','can','fan','van','bag','tag','jam','ram','pig','wig','fig','lip','box','dog','log','nut','hut','tub','cub','bus','bed','leg','peg','jet','hen']);
export const SUBJECTS = Object.freeze(['cat','fox','dog','pig','hen']);
// Each row is hand authored. Alternatives are other visible subjects/actions.
// a/the are both true for the same pictured event; was/got are both true for its result.
const subjectChoices = {cat:['cat','fox','pig'],fox:['fox','dog','hen'],dog:['dog','cat','pig'],pig:['pig','hen','fox'],hen:['hen','cat','dog']};
const row=(id,subject,action)=>({id,words:action==='sat'||action==='ran'?['the',subject,action]:[subject,'was',action],
 choices:action==='sat'||action==='ran'?[['the','a'],subjectChoices[subject],['sat','ran']]:[subjectChoices[subject],['was','got'],['wet','red']],
 scene:{subject,action},answers:action==='sat'||action==='ran'?[['the',subject,action],['a',subject,action]]:[[subject,'was',action],[subject,'got',action]]});
export const SENTENCES=Object.freeze([
 row('cat-sat','cat','sat'),row('fox-ran','fox','ran'),row('dog-sat','dog','sat'),row('pig-ran','pig','ran'),row('hen-sat','hen','sat'),
 row('cat-ran','cat','ran'),row('fox-sat','fox','sat'),row('dog-ran','dog','ran'),row('pig-sat','pig','sat'),row('hen-ran','hen','ran'),
 row('cat-wet','cat','wet'),row('fox-red','fox','red'),row('dog-wet','dog','wet'),row('pig-red','pig','red'),row('hen-wet','hen','wet'),
 row('cat-red','cat','red'),row('fox-wet','fox','wet'),row('dog-red','dog','red'),row('pig-wet','pig','wet'),row('hen-red','hen','red'),
]);
export const NUMBER_WORDS=Object.freeze({11:'eleven',12:'twelve',13:'thirteen',14:'fourteen',15:'fifteen',16:'sixteen',17:'seventeen',18:'eighteen',19:'nineteen',20:'twenty',21:'twenty-one',22:'twenty-two',23:'twenty-three',24:'twenty-four',25:'twenty-five',26:'twenty-six',27:'twenty-seven',28:'twenty-eight',29:'twenty-nine',30:'thirty'});
export const COIN_POOLS=Object.freeze([[11,13,14,17,18,19],[11,12,13,14,15,16,17,18,19,20],[21,22,23,24,25,26,27,28,29,30]]);
