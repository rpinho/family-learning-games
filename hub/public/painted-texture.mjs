// Visual regression metrics for rendered painting pixels, before actors/UI.
// A uniformly cropped reference distinguishes naturally soft paint from smear.
export function bandTexture({data,width,height},y0,y1){
 let n=0,gx=0,gy=0,lap=0,lap2=0;
 const gray=(x,y)=>{const i=(y*width+x)*4;return data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;};
 for(let y=Math.max(1,Math.floor(y0*height));y<Math.min(height-1,Math.ceil(y1*height));y++)
 for(let x=1;x<width-1;x++){
  const c=gray(x,y),l=gray(x-1,y),r=gray(x+1,y),t=gray(x,y-1),b=gray(x,y+1);
  gx+=(r-l)**2/4;gy+=(b-t)**2/4;const q=l+r+t+b-4*c;lap+=q;lap2+=q*q;n++;
 }
 return {gradient:(gx+gy)/n,laplacian:lap2/n-(lap/n)**2,horizontal:gx/n,vertical:gy/n};
}
export function comparePaintedTexture(actual,reference){
 if(actual.width!==reference.width||actual.height!==reference.height)throw Error('Painting frames must have equal dimensions');
 const bottom=bandTexture(actual,.6,.96),scene=bandTexture(actual,.05,.45),expected=bandTexture(reference,.6,.96);
 const ratio=(a,b)=>b>.01?a/b:1;
 const relativeGradient=ratio(bottom.gradient,expected.gradient),relativeLaplacian=ratio(bottom.laplacian,expected.laplacian);
 const direction=Math.max(ratio(bottom.horizontal,expected.horizontal),ratio(bottom.vertical,expected.vertical))/Math.max(.001,Math.min(ratio(bottom.horizontal,expected.horizontal),ratio(bottom.vertical,expected.vertical)));
 let error=0,n=0;for(let y=Math.floor(actual.height*.6);y<actual.height*.96;y++)for(let x=0;x<actual.width;x++)for(let c=0;c<3;c++){
  const i=(y*actual.width+x)*4+c;error+=Math.abs(actual.data[i]-reference.data[i]);n++;
 }
 const pixelError=error/n,failures=[];
 if(relativeGradient<.65)failures.push('bottom gradient energy lost');
 if(relativeLaplacian<.45)failures.push('bottom local sharpness lost');
 if(direction>2.5)failures.push('bottom texture stretched along one axis');
 // CSS image and canvas downsampling use different filters at fractional sizes.
 if(pixelError>10)failures.push('foreground differs from the uniform painting crop');
 return {ok:!failures.length,failures,bottom,scene,expected,bottomSceneRatio:ratio(bottom.gradient,scene.gradient),relativeGradient,relativeLaplacian,direction,pixelError};
}
