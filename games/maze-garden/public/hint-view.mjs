// Requested help should remain legible on dense boards, including a return along the trail.
export function hintView(a, cue, cellWidth) {
 const from=a.trail.indexOf(cue.cells[0]),to=a.trail.indexOf(cue.cells[1]);
 const backtrack=cue.stage===2&&from>0&&to>=0&&to<from;
 return {focus:cue.junction,zoom:cellWidth<24,backtrack,
  spoken:cue.stage===1?'Look at the circle. Which way could you go?':backtrack?'Go back along your trail. Follow the arrow.':'Try the arrow, then find the next turn.'};
}

export function drawHint(ctx,at,s,cells) {
 if(!cells.length)return;
 const [x,y]=at(cells[0]);
 const stroke=(path,width,color)=>{ctx.beginPath();path();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
 ctx.save();ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';
 const ring=()=>ctx.arc(x,y,s*.43,0,Math.PI*2);
 stroke(ring,s*.19,'#fff');stroke(ring,s*.09,'#702080');
 if(cells.length>1){
  const [tx,ty]=at(cells[1]),dx=(tx-x)/s,dy=(ty-y)/s;
  const ex=x+dx*s*.82,ey=y+dy*s*.82;
  const arrow=()=>{ctx.moveTo(x+dx*s*.38,y+dy*s*.38);ctx.lineTo(ex,ey);ctx.moveTo(ex-dx*s*.23-dy*s*.2,ey-dy*s*.23+dx*s*.2);ctx.lineTo(ex,ey);ctx.lineTo(ex-dx*s*.23+dy*s*.2,ey-dy*s*.23-dx*s*.2);};
  stroke(arrow,s*.23,'#fff');stroke(arrow,s*.11,'#702080');
 }
 ctx.restore();
}
