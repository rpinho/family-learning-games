export function shortPrompt(q){
 if(!q)return '';
 if(q.game==='rhyme')return `What rhymes with ${q.word}?`;
 if(q.focus==='lowercase')return q.prompt;
 if(q.game==='flashcards'&&q.deck==='letters')return q.prompt;
 if(['blaster','builder','beats','orbit','flashcards'].includes(q.game))return `The word is ${q.word}.`;
 if(q.game==='transform')return `Change ${q.from} to ${q.word}.`;
 if(q.game==='train')return q.word;
 if(q.game==='search')return `Find ${q.word}.`;
 return q.prompt;
}
export const needsWordClue=q=>['rhyme','lowercase','blaster','builder','beats','transform','train','search','orbit','flashcards'].includes(q?.game);
export const shouldAnnounce=(q,chatEnabled)=>!!q&&(chatEnabled||needsWordClue(q));
