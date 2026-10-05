// A log snapshot belongs to the submitted id, even when act() moves to the next gate.
export function answerQuestion(session,input){
 if(!['answer','help'].includes(input?.kind)||input.questionId==null)return null;
 const q=[session?.q,...(session?.gates||[])].find(q=>q&&String(q.id)===String(input.questionId));
 return q?structuredClone(q):null;
}
