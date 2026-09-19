// Authored generic picture prototypes. Never derived from saved learner artwork.
export function picturePrototype(kind, variant=0){
 const oval=(cx,cy,rx,ry,start=0,end=Math.PI*2)=>Array.from({length:41},(_,i)=>[cx+rx*Math.cos(start+(end-start)*i/40),cy+ry*Math.sin(start+(end-start)*i/40)]);
 const tilt=(variant%5-2)*.04;
 let ink;
 if(kind==='tree'){
  const wide=8+variant%11,branches=3+variant%3;
  ink=[[[50-wide,12],[50+wide,12],[50+wide,91],[50-wide,91],[50-wide,12]]];
  for(let i=0;i<branches;i++){const y=24+i*55/(branches-1),reach=35+(variant+i)%12;ink.push([[50-wide+(variant%3)*wide*.5,y],[50-reach,y-5-(variant%7)]]);ink.push([[50+wide-(variant%3)*wide*.5,y+2],[50+reach,y-3-(variant%9)]]);}
 }else{
  const full=kind==='person',cy=full?23:49,rx=full?13:28,ry=full?14:35;
  ink=[oval(50,cy,rx,ry)];
  if(variant%3!==0){ink.push([[50-rx*.38,cy-ry*.15],[50-rx*.38+.5,cy-ry*.15+.5]],[[50+rx*.38,cy-ry*.15],[50+rx*.38+.5,cy-ry*.15+.5]],oval(50,cy+ry*.05,rx*.6,ry*.55,0,Math.PI));}
  if(variant%2)for(let i=0;i<5;i++)ink.push([[50-rx*.7+i*rx*.35,cy-ry*.8],[50-rx+i*rx*.4,cy-ry*1.23]]);
  if(full){
   if(variant%4<2)ink.push([[50,cy+ry],[50,66]],[[50,45],[25,57]],[[50,45],[75,57]],[[50,66],[31,92]],[[50,66],[70,92]]);
   else ink.push([[43,cy+ry-2],[39,91]],[[57,cy+ry-2],[62,91]],[[43,40],[26,70]],[[57,40],[75,70]]);
  }
 }
 return ink.map(s=>s.map(([x,y])=>[Math.max(1,Math.min(99,x+(y-50)*tilt)),Math.max(1,Math.min(99,y))]));
}
