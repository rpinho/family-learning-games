import {TRACKS,LASERS} from './arcade-audio.mjs';
export const CALM_FILES=['c4','d4','e4','g4','a4','c5'].map(n=>`calm-harp-${n}.m4a`).concat('calm-harp-strum.m4a','calm-soft.m4a');
export const AUDIO_FILES=new Set([...TRACKS,...LASERS].filter(x=>x.file).map(x=>x.file.split('/').at(-1)).concat('CREDITS.md',...CALM_FILES));
export const PRIVATE_AUDIO_FILES=new Set([...AUDIO_FILES].filter(name=>name.startsWith('synthesis-')));
export function audioRange(header,size){
  if(!header)return {start:0,end:size-1,partial:false};
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||!match[1]&&!match[2])return null;
  const suffix=!match[1],start=suffix?Math.max(0,size-Number(match[2])):Number(match[1]);
  const end=suffix||!match[2]?size-1:Math.min(size-1,Number(match[2]));
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
  return {start,end,partial:true};
}
