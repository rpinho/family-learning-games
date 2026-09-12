// Functional top-down pitch: position, velocity and tackle reach are game state.
export function createLivePitch(canvas){
 const c=canvas.getContext('2d');let shown=null,last=0;
 const themes=[['#12744f','#187e57','PARK'],['#176c8e','#207897','COAST'],['#3c4e89','#465a97','NIGHT'],['#146b66','#207972','CUP']];
 function line(x,y,X,Y,color,width=3){c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
 function disc(x,y,r,color){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
 function label(text,x,y,size=18,color='#fff'){c.fillStyle=color;c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillText(text,x,y);}
 function actor(x,y,vx,vy,color,name){disc(x,y+7,25,'#082e4244');disc(x,y,24,color);c.strokeStyle='#fff';c.lineWidth=3;c.stroke();const angle=Math.atan2(vy,vx);line(x+Math.cos(angle)*13,y+Math.sin(angle)*13,x+Math.cos(angle)*30,y+Math.sin(angle)*30,'#fff',7);label(name,x,y+5,12,'#102d3d');}
 return {draw(s,{paused=true,target=null,ready=false}={}){
  if(!s)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}c.setTransform(w/800,0,0,h/620,0,0);
  const now=performance.now(),k=Math.min(1,(now-last)/65);last=now;
  if(!shown||shown.seed!==s.seed||shown.level!==s.level)shown={seed:s.seed,level:s.level,px:s.player.x,py:s.player.y,dx:s.defender.x,dy:s.defender.y,bx:s.ball.x,by:s.ball.y};
  for(const[key,v]of Object.entries({px:s.player.x,py:s.player.y,dx:s.defender.x,dy:s.defender.y,bx:s.ball.x,by:s.ball.y}))shown[key]+=(v-shown[key])*k;
  const [a,b,title]=themes[Math.floor(s.seed/3)%4],{left,right}=s.cfg;c.fillStyle=a;c.fillRect(0,0,800,620);
  for(let i=0;i<8;i+=2){c.fillStyle=b;c.fillRect(i*100,0,100,620);}
  c.fillStyle='#092d3c66';c.fillRect(0,0,left,620);c.fillRect(right,0,800-right,620);c.strokeStyle='#c6ffe699';c.lineWidth=3;c.strokeRect(left,85,right-left,510);
  c.fillStyle='#bcfce020';c.fillRect(left,85,right-left,70);c.setLineDash([12,12]);line(left+10,150,right-10,150,'#c6ffe6');c.setLineDash([]);label('DRIBBLE ACROSS',400,120,22,'#e0fff0');label(title,right-60,592,14,'#c5eddb');
  s.trail.forEach((p,i)=>disc(p.x,p.y,2+i/9,`rgba(126,215,255,${i/s.trail.length*.3})`));
  if(target&&!paused&&!s.outcome){c.strokeStyle='#c6eeff66';c.lineWidth=2;c.beginPath();c.arc(target.x,target.y,14,0,Math.PI*2);c.stroke();}
  const d=s.defender;
  if(d.mode==='windup'){line(shown.dx,shown.dy,d.aimX,d.aimY,'#ffd35c99',8);disc(shown.dx,shown.dy,36,'#ffd45d55');}
  if(d.mode==='recover'){c.strokeStyle='#ffe195';c.lineWidth=4;c.beginPath();c.arc(shown.dx,shown.dy,33,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,d.timer/s.cfg.recovery));c.stroke();}
  actor(shown.dx,shown.dy,d.vx,d.vy,d.mode==='recover'?'#ffd281':'#ff9650','D');
  actor(shown.px,shown.py,s.player.vx,s.player.vy,'#76d7ff','YOU');
  disc(shown.bx,shown.by+3,13,'#082f4244');disc(shown.bx,shown.by,12,'white');disc(shown.bx,shown.by,4,'#173245');for(let i=0;i<5;i++)disc(shown.bx+Math.cos(i*1.256)*8,shown.by+Math.sin(i*1.256)*8,2.3,'#173245');
  if(s.outcome||paused){const text=s.outcome==='escaped'?'PAST THE DEFENDER!':s.outcome==='tackled'?'Ball taken. Try a new move.':s.outcome==='practice'?'Take a breather.':ready?'Drag anywhere to dribble':'Lifted finger · paused';c.fillStyle='#102b3bd9';c.beginPath();c.roundRect(120,420,560,70,22);c.fill();label(text,400,464,s.outcome==='tackled'?25:28,s.outcome==='escaped'?'#ffe388':'#fff');}
 },reset(){shown=null;}};
}
