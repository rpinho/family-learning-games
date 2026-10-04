// Encode continuous native browser recordings, with gentle dissolves and no audio.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const dir=process.env.CAPTURE_DIR;if(!dir)throw Error('Set CAPTURE_DIR.');
const ffmpeg=process.env.FFMPEG||'ffmpeg';
const clips=JSON.parse(await readFile(resolve(dir,'clips.json')));
const order=['world-walk-talk-map','world-treasure','book-gate','book-count','letter-quest','number-park','maze-garden','chess','target-trail'];
const selected=order.map(id=>{const clip=clips.find(c=>c.id===id);if(!clip)throw Error('Missing clip '+id);return clip;});
const args=[],filters=[];
for(const [i,c]of selected.entries()){args.push('-ss',String(c.start),'-t',String(c.duration),'-i',c.path);filters.push(`[${i}:v]setpts=PTS-STARTPTS,fps=25,setsar=1,format=yuv420p,settb=AVTB[v${i}]`);}
let duration=selected[0].duration,last='v0';
for(let i=1;i<selected.length;i++){const output='mix'+i;filters.push(`[${last}][v${i}]xfade=transition=fade:duration=0.36:offset=${(duration-.36).toFixed(2)},fps=25,settb=AVTB[${output}]`);last=output;duration+=selected[i].duration-.36;}
const out=resolve('docs/media'),videoPath=resolve(out,'highlights.mp4');
const run=a=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...a],{stdio:'inherit'});
run([...args,'-filter_complex',filters.join(';'),'-map',`[${last}]`,'-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-color_range','tv','-an','-map_metadata','-1','-metadata:s:v:0','encoder=','-fflags','+bitexact','-flags:v','+bitexact','-bsf:v','filter_units=remove_types=6','-movflags','+faststart',videoPath]);
// Remove container descriptive fields, retaining codec configuration and atom lengths.
const video=await readFile(videoPath);
function strip(start,end){for(let at=start;at+8<=end;){const len=video.readUInt32BE(at),type=video.toString('ascii',at+4,at+8);if(len<8||at+len>end)throw Error('Invalid MP4 atom');if(['moov','trak','mdia','minf','stbl'].includes(type))strip(at+8,at+len);if(type==='stsd')strip(at+16,at+len);if(type==='avc1')video.fill(0,at+50,at+82);if(type==='hdlr')video.fill(0,at+32,at+len);at+=len;}}
strip(0,video.length);await writeFile(videoPath,video);
run(['-i',videoPath,'-filter_complex','fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-an','-map_metadata','-1','-loop','0',resolve(out,'highlights.gif')]);
for(const [name,limit]of [['highlights.mp4',10_000_000],['highlights.gif',8_000_000]]){const {size}=await stat(resolve(out,name));if(size>limit)throw Error(name+' exceeds limit');console.log(name,size+' bytes');}
console.log('Duration:',duration.toFixed(2),'seconds · silent · native 25 fps');
