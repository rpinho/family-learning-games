// Invented documentation chapter. Only the repository's generic picture library is used.
export function demoChapter(library) {
 const line=text=>({who:'narrator',text,voice:'af_heart',speed:.95});
 const scene=bg=>({bg,actors:['hero','grown-up','bo','pip'].map(id=>({id,pose:'idle'})),props:[],fx:'none'});
 const art=Object.fromEntries(['backgrounds','actors','props'].map(kind=>[kind,Object.fromEntries(Object.entries(library[kind]).map(([id,a])=>[id,kind==='actors'?{...a,poses:Object.fromEntries(Object.entries(a.poses).map(([pose,p])=>[pose,{...p,url:'/book-art/'+p.file}]))}:{...a,url:'/book-art/'+a.file}]))]));
 return {schema:'family-book-chapter-2',player:'beginner',name:'The Hero',date:'2026-10-03',number:1,title:'The Star on the Hill',level:'reader',cover:{title:'The Star on the Hill',line:line('The Star on the Hill.'),scene:scene('meadow')},art,
 pages:[
 {id:'p1',kind:'story',scene:scene('meadow'),caption:'A star is missing!',say:[line('Bo and Pip have found a map. A star is missing from the castle!')]},
 {id:'p2',kind:'beat',scene:scene('forest'),caption:'Count the stars',say:[line('Count the stars to open the forest gate.')],beat:{id:'count-stars',kind:'count',thing:'star',n:4,spoken:line('Tap each star.'),ask:line('How many stars?'),options:[3,4,5],answer:4,done:line('Four stars. The gate is open!')}},
 {id:'p3',kind:'beat',scene:scene('pitch'),caption:'Kick the letter B',say:[line('Bo needs a letter key to open the next gate.')],beat:{id:'kick-b',kind:'kick-letter',letter:'B',balls:['D','B','P'],spoken:line('Kick B into the goal.'),notIt:line('Try B.'),done:line('The letter key is yours!')}},
 {id:'p4',kind:'story',scene:scene('castle'),caption:'',say:[line('A magic word shines on the castle gate.')],magic:{word:'open',object:'the castle gate',read:line('Open!'),after:[line('The gate opens and the star shines!')]}},
 {id:'p5',kind:'beat',scene:scene('night'),caption:'Help Pip choose',say:[line('Pip wants to put the star upside down. Can you help?')],beat:{id:'pip-choice',kind:'no',who:'pip',claim:line('The star has six points!'),ask:line('Is Pip right?'),wrong:6,right:5,display:'How many points?',ifYes:line('Look again. Count the points.'),caught:line('You spotted it!'),fixSpoken:line('How many points does the star have?'),options:[4,5,6],hint:line('Count all five points.')}},
 {id:'p6',kind:'story',scene:{...scene('night'),props:[{id:'star',n:1}],fx:'stars'},caption:'The star is home.',say:[line('The star is home. Bo and Pip dance under the night sky.')]}
 ],ui:{yes:line('Yes!'),tryAgain:line('Try again.'),readIt:line('Read the magic word.'),noPrompt:line('Tell Pip what you think.'),nextTime:line('Another adventure tomorrow.'),numbers:Object.fromEntries([1,2,3,4,5].map(n=>[n,line(String(n))]))},summary:'A fictional star adventure.',hook:'Another adventure tomorrow.',meta:{source:'authored generic documentation demo'}};
}
