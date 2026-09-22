import test from 'node:test';import assert from 'node:assert/strict';
import {hintView,drawHint} from '../public/hint-view.mjs';
test('Requested help distinguishes backtracking from a new branch without changing play',()=>{
 const a={trail:[0,1,2]},before=JSON.stringify(a);
 assert.equal(hintView(a,{stage:2,junction:2,cells:[2,1]},8).backtrack,true);
 assert.equal(hintView(a,{stage:2,junction:2,cells:[2,3]},8).backtrack,false);
 assert.equal(hintView(a,{stage:1,junction:2,cells:[2]},8).backtrack,false);
 assert.equal(hintView(a,{stage:2,junction:2,cells:[2,1]},30).zoom,false);
 assert.deepEqual(hintView(a,{stage:2,junction:2,cells:[2,1]},8),{focus:2,zoom:true,backtrack:true,spoken:'Go back along your trail. Follow the arrow.'});
 assert.equal(JSON.stringify(a),before);
});
test('Each branch direction has a high-contrast arrow within its one-cell corridor',()=>{
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const strokes=[];let points=[];const ctx={save(){},restore(){},setLineDash(){},beginPath(){points=[]},arc(){},moveTo(x,y){points.push([x,y])},lineTo(x,y){points.push([x,y])},stroke(){strokes.push({color:this.strokeStyle,width:this.lineWidth,points:[...points]})}};
  drawHint(ctx,id=>id?[dx*30,dy*30]:[0,0],30,[0,1]);
  assert.deepEqual(strokes.map(s=>s.color),['#fff','#702080','#fff','#702080']);
  const arrow=strokes[3];assert.equal(arrow.points.length,5);
  assert.deepEqual(arrow.points[1],[dx*30*.82,dy*30*.82]);
  assert(strokes[2].width>arrow.width);
  assert(arrow.points.every(([x,y])=>Math.abs(x)<=30&&Math.abs(y)<=30));
 }
});
