// Coverage records real touched clue tiles, not distance or repeated taps.
export function brushCoverage(points,seen=new Set(),radius=.105){
 for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;for(let y=0;y<8;y++)for(let x=0;x<12;x++){const cx=(x+.5)/12,cy=(y+.5)/8;if(Math.hypot(cx-p.x,cy-p.y)<=radius)seen.add(y*12+x);}}
 return {seen,complete:seen.size>=60};
}
