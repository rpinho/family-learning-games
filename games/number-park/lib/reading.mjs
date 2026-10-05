// A bounded, explicit beginner path. Practice stars are not a reading rating.
export const PHONEMES={m:'m',a:'æ',s:'s',t:'t',p:'p',i:'ɪ',n:'n',c:'k',o:'ɑ',d:'d',g:'ɡ',h:'h',e:'ɛ',r:'ɹ'};
export const PACKS=[
 {name:'First sounds',newSounds:['m','a','s','t'],pairs:[['mat','sat'],['sat','mat']],words:['mat','sat','am','at'],stories:['Sam sat.']},
 {name:'More little words',newSounds:['p','i','n'],pairs:[['map','nap'],['tap','tip'],['pan','pin'],['sit','sat']],words:['map','nap','tap','tip','pan','pin','sit','tin','pat','pit'],stories:['Pat sat.','Sam sat.']},
 {name:'Word explorers',newSounds:['c','o','d','g'],pairs:[['cat','cot'],['cap','cat'],['dog','dot'],['pan','can']],words:['cat','cot','cap','dog','dot','can','dig','tag','got','cop'],stories:['Sam can dig.','Pat can nap.']},
 {name:'Read little stories',newSounds:['h','e','r'],pairs:[['hat','hot'],['hen','pen'],['rat','ram'],['pet','pot']],words:['hat','hot','hen','pen','rat','ram','pet','pot','red','net','ten','hop','ran','ham'],stories:['Sam can hop.','Sam ran.']},
];
export const soundKey=l=>'Reading sound '+l+'.';
export const wordKey=w=>'Reading word '+w+'.';
export const freshReading=()=>({version:1,level:0,lessons:0,stars:0,history:[],seen:{},session:null});
const fail=m=>{throw Object.assign(Error(m),{status:400});};
const known=level=>PACKS.slice(0,level+1).flatMap(p=>p.newSounds);
const mix=(a,seed)=>{const b=[...a];for(let i=b.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;};
export function readingLesson(r,revision,now){
 const pack=PACKS[r.level],pair=pack.pairs[r.lessons%pack.pairs.length],letters=known(r.level);
 const due=Object.entries(r.seen).filter(([w,t])=>!pair.includes(w)&&now-t>=86400000&&[...w].every(l=>letters.includes(l))).sort((a,b)=>a[1]-b[1]);
 const candidates=pack.words.filter(w=>!pair.includes(w)),word=due[0]?.[0]||candidates.find(w=>!r.seen[w])||candidates[r.lessons%candidates.length];
 const target=pack.newSounds[r.lessons%pack.newSounds.length],choices=mix([target,...mix(letters.filter(l=>l!==target),revision+7).slice(0,2)],revision+21);
 const bank=mix([...new Set([...pair[0],...pair[1],...letters.slice(0,2)])],revision+41);
 const questions=[
  {kind:'sounds',letters:pack.newSounds,prompt:'Tap each letter to hear its sound.'},
  {kind:'listen',target,options:choices,prompt:'Which letter makes this sound?'},
  {kind:'blend',word:pair[0],prompt:'Tap the sounds. Slide to join them.'},
  {kind:'build',word:pair[0],bank,prompt:'Build the word you hear.'},
  {kind:'change',word:pair[1],from:pair[0],bank,prompt:'Change one letter. Make the new word.'},
  {kind:'read',word,novel:!r.seen[word],delayed:!!due.length,prompt:'Read this word to your grown-up.'},
  {kind:'story',text:pack.stories[r.lessons%pack.stories.length],prompt:'Read this little story together.'},
 ].map((q,i)=>({...q,id:`read:${revision}:${i}`,heard:[],attempts:0,helped:false,result:null,started:now}));
 return {level:r.level,round:0,questions,finished:false,started:now};
}
export function readingAction(p,input,now){
 const r=p.reading??freshReading();
 if(input.kind==='reading_start'){
  if(!r.session||r.session.finished)r.session=readingLesson(r,p.revision,now);
  p.reading=r;return;
 }
 const s=r.session,q=s?.questions[s.round];if(!s||s.finished||input.questionId!==q?.id)fail('This reading activity has changed. Refresh your game.');
 if(input.kind==='reading_next'){
  if(!q.result?.ok)fail('Finish this activity first.');
  if(s.round<s.questions.length-1){s.round++;s.questions[s.round].started=now;}
  else{
   s.finished=true;r.lessons++;
   const evidence=r.history.filter(h=>h.level===r.level),reads=new Set(evidence.filter(h=>h.kind==='read'&&h.independent).map(h=>h.word));
   // Two different adult-observed reads AND multiple independent letter/spelling
   // checks. Assisted practice and tapping through stories cannot raise a level.
   if(reads.size>=2&&evidence.filter(h=>['listen','build','change'].includes(h.kind)&&h.independent).length>=5)r.level=Math.min(PACKS.length-1,r.level+1);
  }
 }else{
  if(q.result?.ok)fail('This activity is already saved.');
  if(input.kind==='reading_sound'){
   const letters=q.kind==='sounds'?q.letters:q.kind==='blend'?[...q.word]:[];
   if(!Number.isInteger(input.index)||input.index<0||input.index>=letters.length)fail('Choose one of these sounds.');
   if(!q.heard.includes(input.index))q.heard.push(input.index);
  }else if(input.kind==='reading_hint'){
   q.helped=true;if(q.word)r.seen[q.word]=now;
  }else if(input.kind==='reading_answer'){
   let ok=false,parent=false;
   if(q.kind==='sounds'||q.kind==='blend'){
    const n=q.kind==='sounds'?q.letters.length:q.word.length;if(q.heard.length!==n)fail('Hear each sound first.');
    if(input.answer!=='done')fail('Finish the sounds first.');ok=true;
   }else if(q.kind==='listen'){if(!q.options.includes(input.answer))fail('Choose a listed letter.');ok=input.answer===q.target;}
   else if(q.kind==='build'||q.kind==='change'){
    if(typeof input.answer!=='string'||input.answer.length!==q.word.length||![...input.answer].every(l=>q.bank.includes(l)))fail('Put a letter in every space.');ok=input.answer===q.word;
   }else{
    if(input.observer!=='grownup'||!['alone','together'].includes(input.answer))fail('Ask a grown-up to listen and check.');
    parent=true;ok=true;if(input.answer==='together')q.helped=true;
   }
   const independent=ok&&!q.helped&&q.attempts===0&&!['sounds','blend','story'].includes(q.kind);
   const observation={at:new Date(now).toISOString(),kind:q.kind,level:s.level,word:q.word||null,target:q.target||null,answer:input.answer,ok,independent,helped:q.helped,parentConfirmed:parent,novel:!!q.novel,delayed:!!q.delayed,attempt:q.attempts+1,durationMs:Math.max(0,Math.min(86400000,now-q.started))};
   r.history=[...r.history,observation].slice(-1000);q.attempts++;
   if(!ok){q.helped=true;q.result={ok:false,stars:0};}
   else{const stars=independent?2:1;r.stars+=stars;q.result={ok:true,stars,independent};}
   if(q.word)r.seen[q.word]=now;
  }else fail('Unknown reading action.');
 }
 p.reading=r;
}
export function readingVoiceLines(){return [...new Set([
 ...PACKS.flatMap(p=>p.words).map(wordKey),...PACKS.flatMap(p=>p.stories),...Object.keys(PHONEMES).map(soundKey),
 'Tap each letter to hear its sound.','Which letter makes this sound?','Tap the sounds. Slide to join them.','Build the word you hear.','Change one letter. Make the new word.','Read this word to your grown-up.','Read this little story together.','Let’s try it together.','Your reading garden grew!'
 ])];}
