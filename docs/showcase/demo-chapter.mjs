// Authored fictional documentation chapter, unrelated to household chapters or notes.
import {artFor} from '../../hub/public/book-scene.mjs';
export function demoChapter(library,{extras=false}={}) {
 const line=text=>({who:'narrator',text,voice:'af_heart',speed:.95});
 const scene=(bg,fx='none')=>({bg,actors:['hero','bo','grown-up','pip'].map(id=>({id,pose:'idle'})),props:[],fx});
 const pages=extras?[
  {id:'kick',kind:'beat',scene:{...scene('soccer-pitch'),props:[{id:'ball',n:1}]},caption:'Kick the letter B',say:[line('The next key is hiding on a football.')],beat:{id:'kick-b',kind:'kick-letter',letter:'B',balls:['D','B','P'],spoken:line('Kick B into the goal.'),notIt:line('Try B.'),done:line('The letter key is yours!')}},
  {id:'magic',kind:'story',scene:scene('castle-forest'),caption:'',say:[line('A magic word lights the forest path.')],magic:{word:'open',object:'the forest path',read:line('Open!'),after:[line('The path is open!')]}}
 ]:[
  {id:'gate',kind:'story',scene:scene('castle-gate','gate-open'),caption:'',gateKeys:3,gateReveal:'treasure-chest',say:[line('The three keys fly to the castle gate.'),line('Behind the doors, a treasure chest waits!')]},
  {id:'stones',kind:'beat',scene:scene('volcano'),caption:'Count the stones',say:[line('The fox wants to cross the crater. Count the stones together.')],beat:{id:'count-stones',kind:'count',painted:true,targetGroup:'stones',thing:'stones',n:12,spoken:line('Tap each painted stone.'),ask:line('How many stones?'),options:[11,12,13],answer:12,done:line('Twelve stones. We can cross!')}},
  {id:'choice',kind:'beat',scene:scene('treehouse-town'),caption:'Help the fox choose',say:[line('The fox says two plus one makes four. Is that right?')],beat:{id:'fox-choice',kind:'no',who:'pip',claim:line('Two plus one makes four!'),ask:line('Is the fox right?'),wrong:4,right:3,display:'2 + 1 = ?',ifYes:line('Look again. Try counting on your fingers.'),caught:line('You spotted it!'),fixSpoken:line('How much is two plus one?'),options:[2,3,4],hint:line('Start with two. Add one more.')}},
  {id:'end',kind:'story',scene:{...scene('pirate-ship','stars'),actors:['hero','bo','grown-up','pip'].map(id=>({id,pose:'cheer'}))},caption:'A new adventure awaits.',say:[line('Across the dock, a ship waits for the next adventure.')]}
 ];
 const cover={title:'The Three Golden Keys',line:line('The Three Golden Keys.'),scene:scene('castle-gate')};
 return {schema:'family-book-chapter-2',player:'beginner',name:'The Explorer',date:'2026-10-03',number:1,title:cover.title,level:'reader',cover,art:artFor([...pages,{scene:cover.scene}],library),pages,ui:{yes:line('Yes!'),tryAgain:line('Try again.'),readIt:line('Read the magic word.'),noPrompt:line('Tell the fox what you think.'),nextTime:line('Another adventure tomorrow.'),numbers:Object.fromEntries(Array.from({length:13},(_,i)=>[i+1,line(String(i+1))]))},summary:'A fictional adventure with three golden keys.',hook:'Another adventure tomorrow.',meta:{source:'authored fictional documentation demo'}};
}
