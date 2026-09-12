// Functional game renderer: positions, feet, ball and touchline all encode
// the puzzle state. The same blocked lane is used by the server's rules.
export function createPitch(canvas){
 const c=canvas.getContext('2d');let round=null,animation=null,alive=true,previous=null,changed=0;
 const themes=[['#167f60','#1a8965','Garden pitch'],['#176b9a','#207ba9','Seaside pitch'],['#4857a2','#5868b5','Evening lights'],['#1c776c','#248a79','Cup day']];
 const xy={left:215,middle:400,right:585};
 function line(x,y,x2,y2,color,width){c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
 function circle(x,y,r,fill){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();}
 function text(s,x,y,size=20,color='#fff'){c.fillStyle=color;c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
 function feet(r){if(r?.balanced)return [380,420,400];if(r?.blocked==='left')return r.gap?[240,440,320]:[255,293,310];if(r?.blocked==='right')return r.gap?[360,560,480]:[507,545,490];return [380,420,400];}
 function draw(t){if(!alive)return;requestAnimationFrame(draw);const dpr=Math.min(2,devicePixelRatio||1),rect=canvas.getBoundingClientRect(),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}c.setTransform(w/800,0,0,h/620,0,0);c.clearRect(0,0,800,620);
 const colors=themes[round?.theme||0];c.fillStyle=colors[0];c.fillRect(0,0,800,620);for(let i=0;i<8;i+=2){c.fillStyle=colors[1];c.fillRect(i*100,0,100,620);}c.strokeStyle='#b6f4c5a0';c.lineWidth=3;c.strokeRect(90,80,620,560);
 const a=animation?Math.min(1,(t-animation.start)/animation.duration):0,escaped=animation?.kind==='escaped';
 c.setLineDash([12,14]);line(110,95,690,95,'#b6f4c580',2);c.setLineDash([]);
 if(round?.touchline){const left=round.touchline==='left';c.fillStyle='#183e4c99';c.fillRect(left?90:520,110,190,510);line(left?280:520,110,left?280:520,620,'#ffe596',5);text('OUT',left?175:625,470,20,'#ffe596');}
 let f=feet(round);if(previous&&t-changed<650){const old=feet(previous),k=Math.min(1,(t-changed)/650);f=f.map((x,i)=>old[i]+(x-old[i])*k);}
 const [lx,rx,body]=f;circle(body,375,77,'#063f442a');line(body-25,285,lx,365,'#243e57',25);line(body+25,285,rx,365,'#243e57',25);line(lx-18,381,lx+20,381,'#ffc35c',25);line(rx-20,381,rx+18,381,'#ffc35c',25);
 line(body-32,218,body-75,280,'#ffd6ad',18);line(body+32,218,body+75,280,'#ffd6ad',18);c.fillStyle='#f28c45';c.beginPath();c.roundRect(body-43,204,86,90,16);c.fill();text('D',body,264,38,'#fff3c1');circle(body,170,33,'#ffd6ad');c.fillStyle='#554039';c.beginPath();c.arc(body,163,34,Math.PI,Math.PI*2);c.fill();circle(body-11,174,3,'#243b44');circle(body+11,174,3,'#243b44');line(body-7,189,body+7,189,'#ac6850',3);
 if(!escaped||a<.83){text('YOUR LEFT',210,530,18,'#d4f3dc');text('YOUR RIGHT',590,530,18,'#d4f3dc');}
 let bx=400,by=551,px=400,py=588;
 if(animation){const dest=animation.move==='middle'?(lx+rx)/2:xy[animation.move]||400;
  if(escaped){const k=a*a*(3-2*a);px=400+(dest-400)*Math.sin(Math.min(1,k*2)*Math.PI/2);py=588-455*k;bx=px+Math.sin(a*Math.PI*8)*7;by=py-28-Math.abs(Math.sin(a*Math.PI*8))*8;}
  else if(animation.kind==='blocked'){const k=Math.sin(a*Math.PI);bx=400+(dest-400)*k;by=551-153*k;px=bx;py=by+37;}
  else if(animation.kind==='recover'){const k=Math.sin(a*Math.PI);bx=400+(dest-400)*k*.85;by=551-220*k;px=bx;py=by+30;}
  else if(animation.kind==='feint'){px=400+(dest-400)*Math.sin(a*Math.PI)*.45;bx=400+(dest-400)*Math.sin(a*Math.PI)*.08;}
 }
 circle(px,py,23,'#163346');circle(px,py-4,21,'#6fc4ff');text('YOU',px,py+2,11,'#103649');circle(bx,by+5,17,'#173c443b');circle(bx,by,14,'#fff');circle(bx,by,5,'#1f3e50');for(let j=0;j<5;j++){const an=j*Math.PI*2/5;circle(bx+Math.cos(an)*10,by+Math.sin(an)*10,3,'#1f3e50');}
 if(escaped&&a>.83){text('PAST THE DEFENDER!',400,495,36,'#fff3a5');text('And you kept the ball.',400,532,23,'#fff');}
 }
 requestAnimationFrame(draw);
 return {set(r){if(JSON.stringify(r)!==JSON.stringify(round)){previous=round;round=structuredClone(r);changed=performance.now();}},animate(kind,move,duration=1200){animation={kind,move,start:performance.now(),duration};},clear(){animation=null;},dispose(){alive=false;}};
}
