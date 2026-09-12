// Functional game renderer: positions, feet, ball, touchline and goal all encode
// the puzzle state. The same blocked lane is used by the server's rules.
export function createPitch(canvas){
 const c=canvas.getContext('2d');let round=null,animation=null,alive=true,previous=null,changed=0;
 const themes=[['#167f60','#1a8965','Garden pitch'],['#176b9a','#207ba9','Seaside pitch'],['#4857a2','#5868b5','Evening lights'],['#1c776c','#248a79','Cup day']];
 const xy={left:215,middle:400,right:585};
 function line(x,y,x2,y2,color,width){c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
 function circle(x,y,r,fill){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();}
 function text(s,x,y,size=20,color='#fff'){c.fillStyle=color;c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
 function feet(r){return r?.blocked==='left'?[240,440,350]:r?.blocked==='right'?[360,560,450]:[381,419,400];}
 function draw(t){if(!alive)return;requestAnimationFrame(draw);const dpr=Math.min(2,devicePixelRatio||1),rect=canvas.getBoundingClientRect(),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}c.setTransform(w/800,0,0,h/620,0,0);c.clearRect(0,0,800,620);
 const colors=themes[round?.theme||0];c.fillStyle=colors[0];c.fillRect(0,0,800,620);for(let i=0;i<8;i+=2){c.fillStyle=colors[1];c.fillRect(i*100,0,100,620);}c.strokeStyle='#b6f4c5a0';c.lineWidth=3;c.strokeRect(90,80,620,560);c.strokeRect(215,80,370,100);c.beginPath();c.arc(400,180,86,0,Math.PI);c.stroke();
 // Net is empty: beating the defender is the puzzle; shooting is automatic.
 const a=animation?Math.min(1,(t-animation.start)/animation.duration):0,goal=animation?.kind==='goal';const ripple=goal&&a>.8?Math.sin(t/40)*4:0;
 c.fillStyle='#e1ffff27';c.fillRect(300,30,200,80);for(let x=300;x<=500;x+=20)line(x,30,x+ripple,110,'#d9ffed80',1.5);for(let y=30;y<=110;y+=16)line(300,y,500,y+ripple,'#d9ffed80',1.5);line(300,110,300,30,'#f6ffec',7);line(300,30,500,30,'#f6ffec',7);line(500,30,500,110,'#f6ffec',7);
 if(round?.touchline){const left=round.touchline==='left';c.fillStyle='#183e4c99';c.fillRect(left?90:520,110,190,510);line(left?280:520,110,left?280:520,620,'#ffe596',5);text('OUT',left?175:625,470,20,'#ffe596');}
 let f=feet(round);if(previous&&t-changed<650){const old=feet(previous),k=Math.min(1,(t-changed)/650);f=f.map((x,i)=>old[i]+(x-old[i])*k);}
 const [lx,rx,body]=f;circle(body,375,77,'#063f442a');line(body-25,285,lx,365,'#243e57',25);line(body+25,285,rx,365,'#243e57',25);line(lx-18,381,lx+20,381,'#ffc35c',25);line(rx-20,381,rx+18,381,'#ffc35c',25);
 line(body-32,218,body-75,280,'#ffd6ad',18);line(body+32,218,body+75,280,'#ffd6ad',18);c.fillStyle='#f28c45';c.beginPath();c.roundRect(body-43,204,86,90,16);c.fill();text('D',body,264,38,'#fff3c1');circle(body,170,33,'#ffd6ad');c.fillStyle='#554039';c.beginPath();c.arc(body,163,34,Math.PI,Math.PI*2);c.fill();circle(body-11,174,3,'#243b44');circle(body+11,174,3,'#243b44');line(body-7,189,body+7,189,'#ac6850',3);
 if(round?.level<=2||animation?.kind==='blocked'){const x=xy[round?.blocked||'middle'];c.strokeStyle='#ffd078';c.lineWidth=4;c.beginPath();c.ellipse(x,400,50,13,0,0,Math.PI*2);c.stroke();}
 text('YOUR LEFT',210,530,16,'#d4f3dc');text('THROUGH',400,440,15,'#d4f3dc');text('YOUR RIGHT',590,530,16,'#d4f3dc');
 let bx=400,by=551,px=400,py=588;
 if(animation){const dest=xy[animation.move]||400;
  if(goal){if(a<.55){const k=a/.55;bx=400+(dest-400)*Math.sin(k*Math.PI/2);by=551-330*k;px=bx;py=by+37;}else{const k=(a-.55)/.45;bx=dest+(400-dest)*k;by=221-160*k;px=dest;py=258;}}
  else if(animation.kind==='blocked'){const k=Math.sin(a*Math.PI);bx=400+(dest-400)*k;by=551-153*k;px=bx;py=by+37;}
  else if(animation.kind==='recover'){const k=Math.sin(a*Math.PI);bx=400+(dest-400)*k*.65;by=551-150*k;px=bx;py=by+37;}
  else if(animation.kind==='feint'){bx=400+(dest-400)*Math.sin(a*Math.PI)*.3;}
 }
 circle(px,py,23,'#163346');circle(px,py-4,21,'#6fc4ff');text('YOU',px,py+2,11,'#103649');circle(bx,by+5,17,'#173c443b');circle(bx,by,14,'#fff');circle(bx,by,5,'#1f3e50');for(let j=0;j<5;j++){const an=j*Math.PI*2/5;circle(bx+Math.cos(an)*10,by+Math.sin(an)*10,3,'#1f3e50');}
 if(goal&&a>.78){text('GOAL!',400,480,64,'#fff3a5');for(let j=0;j<22;j++){const x=(j*137+t*.05)%800,y=(j*83+t*.12)%600;circle(x,y,4,j%2?'#fff':'#ffc953');}}
 }
 requestAnimationFrame(draw);
 return {set(r){previous=round;round=r;changed=performance.now();},animate(kind,move,duration=1200){animation={kind,move,start:performance.now(),duration};},clear(){animation=null;},dispose(){alive=false;}};
}
