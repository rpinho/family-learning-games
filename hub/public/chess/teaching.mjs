// Instructional board diagrams, drawn from the actual legal position.
export function drawTeachingOverlay(root, board, move, example){
 root.querySelector('.teaching-overlay')?.remove();
 const host=root.querySelector('.board-coordinates');if(!host)return;
 const point=s=>{const el=root.querySelector(`[data-square="${s}"]`);if(!el)return null;const a=el.getBoundingClientRect(),b=host.getBoundingClientRect();return [(a.left-b.left+a.width/2)/b.width*800,(a.top-b.top+a.height/2)/b.height*800];};
 const from=point(move.from),to=point(move.to);if(!from||!to)return;
 const route=(a,b,knight)=>`M${a.join(' ')} ${knight?`L${a[0]} ${b[1]} `:''}L${b.join(' ')}`;
 const targets=board.board().flat().filter(p=>p&&p.color!==move.color&&['k','q','r'].includes(p.type)&&board.attackers(p.square,move.color).includes(move.to));
 const fork=targets.length>=2&&move.color==='w';
 const paths=fork?targets.map(p=>route(to,point(p.square),move.piece==='n')):[route(from,to,move.piece==='n')];
 host.insertAdjacentHTML('beforeend',`<svg class="teaching-overlay ${fork?'fork-diagram':''}" viewBox="0 0 800 800" role="img" aria-label="${fork?'One piece attacks two targets. A fork.':move.piece==='n'?'Two squares then one sideways. A knight jump.':'Follow the move.'}"><defs><marker id="teach-tip" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5Z" fill="#ffbf36"/></marker></defs>${paths.map(d=>`<path class="teaching-route" d="${d}" pathLength="1" marker-end="url(#teach-tip)"/>`).join('')}</svg>`);
 if(fork){const heading=root.querySelector('.arena-prompt h1');if(heading)heading.innerHTML=forkTitleIcon()+'Fork · two targets';}
}
export function forkTitleIcon(){return '<svg class="fork-title-icon" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 36V22M6 4V15Q6 24 16 24Q26 24 26 15V4"/></svg>';}
