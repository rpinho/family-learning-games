export function fit(step,id){const target=['rectangle','triangle'][step];return {right:!!target&&target===id,next:target===id?Math.min(2,step+1):step};}
