// Diagnostics follow the activity being played; this function never changes a save.
export function actionLogRow(p,input,beforeCompleted,beforeMakerCompleted){
 const maker=input.type.startsWith('maker-'),maze=maker?p.maker?.challenge:p.active;
 return {player:p.player,event:input.type,maze:maze?.id,revision:p.revision,grid:maker?(maze?.n||p.maker?.size):maze?.n,metrics:maze?.metrics,
  cells:input.cells,answer:input.answer,mode:input.mode,delta:input.delta,hint:input.type==='hint'?maze?.hintCue:undefined,
  completed:!maker&&p.completed>beforeCompleted?p.history.at(-1):undefined,
  ...(maker?{makerCompleted:p.maker?.completed||0,makerFinished:(p.maker?.completed||0)>beforeMakerCompleted,makerEditing:!!p.maker?.editing}:{})};
}
