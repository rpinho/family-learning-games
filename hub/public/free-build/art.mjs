// Original code-drawn wooden, rubber and enamel toys; no downloaded art or audio.
export const colors={block:'#cc8957',bounce:'#71998b',gear:'#e0ad46',ball:'#c77360'};
export function drawPiece(c,p){
 c.save();c.translate(p.x,p._returnY??p.y);c.rotate(p.a);c.lineWidth=3;c.strokeStyle=p.type==='block'?'#825734':'#425f58';c.fillStyle=colors[p.type];
 if(p.type==='gear'){
  c.beginPath();for(let i=0;i<48;i++){const a=i*Math.PI/24,r=i%4===0||i%4===3?p.w/2:p.w/2-9;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();
  for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.arc(Math.cos(a)*25,Math.sin(a)*25,8,0,Math.PI*2);c.fillStyle='#b47f2e';c.fill();}
  c.beginPath();c.arc(0,0,13,0,Math.PI*2);c.fillStyle='#f8e7bb';c.fill();c.stroke();c.beginPath();c.arc(0,0,4,0,Math.PI*2);c.fillStyle='#546c60';c.fill();
  // Raised wooden handle, distinct from the flat gear body and central peg.
  c.beginPath();c.moveTo(0,0);c.lineTo(30,0);c.strokeStyle='#725437';c.lineWidth=8;c.stroke();
  c.beginPath();c.arc(30,0,13,0,Math.PI*2);c.fillStyle='#68482f';c.fill();
  c.beginPath();c.arc(30,-3,11,0,Math.PI*2);c.fillStyle='#f3d5a0';c.fill();c.strokeStyle='#725437';c.lineWidth=2;c.stroke();
 }else if(p.type==='ball'){
  c.beginPath();c.arc(0,0,p.w/2,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(0,0,p.w/2-10,-2.6,-.6);c.strokeStyle='#efad91';c.lineWidth=6;c.stroke();
 }else{
  c.beginPath();c.roundRect(-p.w/2,-p.h/2,p.w,p.h,p.type==='bounce'?14:6);c.fill();c.stroke();
  c.strokeStyle=p.type==='bounce'?'#c7e6c9':'#e9b580';c.lineWidth=4;c.beginPath();c.moveTo(-p.w/2+12,-p.h/2+10);c.lineTo(p.w/2-12,-p.h/2+10);c.stroke();
  if(p.type==='bounce'){c.beginPath();c.moveTo(-24,9);c.quadraticCurveTo(-12,-6,0,9);c.quadraticCurveTo(12,24,24,9);c.stroke();}
 }
 c.restore();
}
export function icon(type){const gear=type==='gear';return `<svg viewBox="0 0 140 110" aria-hidden="true"><g fill="${colors[type]}" stroke="#4f6656" stroke-width="4">${gear?'<path d="M60 8h20l4 13 12-4 14 14-5 13 13 5v20l-13 5 5 13-14 14-12-5-4 13H60l-4-13-12 5-14-14 5-13-13-5V49l13-5-5-13 14-14 12 4z"/><circle cx="70" cy="58" r="15" fill="#f7e6bc"/>':type==='ball'?'<circle cx="70" cy="55" r="40"/><path d="M42 46q12-24 39-17" fill="none" stroke="#efad91"/>':`<rect x="12" y="28" width="116" height="58" rx="${type==='bounce'?16:6}"/><path d="M25 40h90" stroke="${type==='bounce'?'#c7e6c9':'#e9b580'}"/>${type==='bounce'?'<path d="M42 64q14-18 28 0t28 0" fill="none" stroke="#c7e6c9"/>':''}`}</g></svg>`;}
