// Resolve the item answered, never the replacement question shown after a success.
export function answeredQuestion(source,row){
 const id=row.input?.questionId;
 const candidates=source==='word-arcade'?[row.answeredQuestion,row.before?.q,...(row.before?.gates||[]),row.after?.q]:
  [row.challenge,row.result?.question,row.result?.shot?.question,row.before?.question];
 if(id!=null)return candidates.find(q=>q&&String(q.id)===String(id))||null;
 return candidates.find(Boolean)||null; // older diagnostics without question ids
}
export function readingMeta(source,row){
 const q=answeredQuestion(source,row);if(!q)return {taggingUnresolved:true};
 const task=q.type||q.kind||q.game;
 const readTask=['word','read','read-word','decode','asteroids'].includes(task)&&q.options?.length>1;
 const position=q.position??q.blank;
 return {task,readTask,choices:q.options?.length||0,ms:Number.isFinite(row.input?.durationMs)?row.input.durationMs:null,
  ...(source==='word-arcade'&&row.after?.q?.id!==q.id&&!row.answeredQuestion?{taggingRepaired:true}:{}),
  ...(['gap','spell','blaster'].includes(task)&&Number.isInteger(position)?{gapPosition:position===0?'initial-consonant':position===String(q.word||'').length-1?'final-consonant':'vowel'}:{}),
  ...(q.support||q.options?.length===1?{modelled:true}:{})};
}
