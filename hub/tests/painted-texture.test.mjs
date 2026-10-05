import test from 'node:test';import assert from 'node:assert/strict';
import {comparePaintedTexture} from '../public/painted-texture.mjs';
const painting=()=>{const width=96,height=120,data=new Uint8ClampedArray(width*height*4);let seed=17;
 for(let i=0;i<data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const v=70+(seed>>>24)/2;data.set([v,v+20,v,255],i);}return {data,width,height};};
test('a naturally painted foreground with the same uniform crop passes',()=>{const p=painting();const r=comparePaintedTexture(p,p);assert.equal(r.ok,true);assert.equal(r.relativeGradient,1);assert.equal(r.relativeLaplacian,1);assert.equal(r.pixelError,0);});
test('blurred lower band fails while upper scene remains intact',()=>{const p=painting(),a={...p,data:p.data.slice()};
 for(let y=60;y<p.height;y++)for(let x=0;x<p.width;x++)for(let c=0;c<3;c++){let total=0,n=0;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const yy=Math.max(60,Math.min(p.height-1,y+dy)),xx=Math.max(0,Math.min(p.width-1,x+dx));total+=p.data[(yy*p.width+xx)*4+c];n++;}a.data[(y*p.width+x)*4+c]=total/n;}
 const r=comparePaintedTexture(a,p);assert.equal(r.ok,false);assert.ok(r.failures.includes('bottom local sharpness lost'));assert.ok(r.relativeGradient<.65);});
test('a repeated narrow ground strip fails on directional texture and changed pixels',()=>{const p=painting(),a={...p,data:p.data.slice()};
 for(let y=60;y<p.height;y++)for(let x=0;x<p.width;x++){const src=(60*p.width+x)*4;a.data.set(p.data.slice(src,src+4),(y*p.width+x)*4);}
 const r=comparePaintedTexture(a,p);assert.equal(r.ok,false);assert.ok(r.direction>2.5);assert.ok(r.pixelError>3);});
