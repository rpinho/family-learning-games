export const FREE_DRAWING_WIDTH=160;
export const FREE_DRAWING_HEIGHT=100;
export const FREE_DRAWING_OVERSCAN=8;
export const FREE_DRAWING_SPACE='wide-160';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function drawingPoint(clientX,clientY,rect,free=false){
 if(free)return [
  clamp((clientX-rect.x)*FREE_DRAWING_WIDTH/rect.width,-FREE_DRAWING_OVERSCAN,FREE_DRAWING_WIDTH+FREE_DRAWING_OVERSCAN),
  clamp((clientY-rect.y)*FREE_DRAWING_HEIGHT/rect.height,-FREE_DRAWING_OVERSCAN,FREE_DRAWING_HEIGHT+FREE_DRAWING_OVERSCAN),
 ];
 const size=Math.min(rect.width,rect.height);
 return [
  clamp((clientX-rect.x-(rect.width-size)/2)*100/size,0,100),
  clamp((clientY-rect.y-(rect.height-size)/2)*100/size,0,100),
 ];
}

export const validFreeInk=ink=>Array.isArray(ink)&&ink.length<=150&&ink.every(s=>Array.isArray(s)&&s.length<=700&&s.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=-FREE_DRAWING_OVERSCAN&&p[0]<=FREE_DRAWING_WIDTH+FREE_DRAWING_OVERSCAN&&p[1]>=-FREE_DRAWING_OVERSCAN&&p[1]<=FREE_DRAWING_HEIGHT+FREE_DRAWING_OVERSCAN));
export const safeFreeInk=ink=>validFreeInk(ink)?ink:[];
export function wideDrawingInk(ink,space){
 const safe=safeFreeInk(ink);
 if(space===FREE_DRAWING_SPACE)return safe;
 const inset=(FREE_DRAWING_WIDTH-FREE_DRAWING_HEIGHT)/2;
 return safe.map(stroke=>stroke.map(([x,y])=>[x+inset,y]));
}
