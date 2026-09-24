// Measure a local attempt independently of wall-clock corrections after resume.
export function elapsedMs(start,now=performance.now()){
 return Math.min(86400000,Math.max(0,now-start));
}
