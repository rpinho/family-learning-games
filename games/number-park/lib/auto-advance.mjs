// Only advance the exact successful question that scheduled the timer.
// Navigation, hidden tabs, errors, and a changed save all cancel it.
export function scheduleAdvance({session,player,revision,active,read,advance,delay=850,setTimer=setTimeout,clearTimer=clearTimeout}){
 if(!active||!session?.result?.ok||session.finished)return ()=>{};
 const questionId=session.question.id;
 const timer=setTimer(()=>{const now=read();if(now.active&&now.player===player&&now.revision===revision&&now.session?.question.id===questionId&&now.session.result?.ok&&!now.session.finished)advance();},delay);
 return ()=>clearTimer(timer);
}
