// Encode screenshot sequences after visual review. No audio or descriptive metadata is retained.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
const dir=process.env.CAPTURE_DIR;if(!dir)throw Error('Set CAPTURE_DIR to the reviewed frame directory.');
const out=fileURLToPath(new URL('../media/',import.meta.url));
const ffmpeg=process.env.FFMPEG||'ffmpeg';
const run=args=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});
run(['-framerate','10','-i',resolve(dir,'frame-%05d.jpg'),'-vf','scale=in_range=pc:out_range=tv,format=yuv420p,sidedata=delete:type=ICC_PROFILE','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-color_range','tv','-r','30','-an','-map_metadata','-1','-metadata:s:v:0','encoder=','-fflags','+bitexact','-flags:v','+bitexact','-bsf:v','filter_units=remove_types=6','-movflags','+faststart',resolve(out,'highlights.mp4')]);
// ffmpeg writes a compressor label and handler name even with -map_metadata -1.
// Clear those fixed-size text fields without altering atom sizes or codec configuration.
const videoPath=resolve(out,'highlights.mp4'),video=await readFile(videoPath);
function stripLabels(start,end){for(let at=start;at+8<=end;){const len=video.readUInt32BE(at),type=video.toString('ascii',at+4,at+8);if(len<8||at+len>end)throw Error('Invalid MP4 atom.');
 if(['moov','trak','mdia','minf','stbl'].includes(type))stripLabels(at+8,at+len);
 if(type==='stsd')stripLabels(at+16,at+len);
 if(type==='avc1')video.fill(0,at+50,at+82);
 if(type==='hdlr')video.fill(0,at+32,at+len);
 at+=len;
}}
stripLabels(0,video.length);await writeFile(videoPath,video);
run(['-i',resolve(out,'highlights.mp4'),'-filter_complex','fps=6,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-an','-map_metadata','-1','-loop','0',resolve(out,'highlights.gif')]);
for(const [name,limit] of [['highlights.mp4',10_000_000],['highlights.gif',8_000_000]]){
 const {size}=await stat(resolve(out,name));if(size>limit)throw Error(`${name} exceeds its ${limit}-byte review limit (${size} bytes).`);
 console.log(`${name}: ${size} bytes`);
}
// Chrome PNGs have no identifying metadata; retain only image chunks to make that explicit.
for(const folder of [out,fileURLToPath(new URL('screenshots/',import.meta.url))]){
 for(const file of (await readdir(folder)).filter(f=>f.endsWith('.png'))){
  const path=resolve(folder,file),buf=await readFile(path),parts=[buf.subarray(0,8)];
  for(let at=8;at<buf.length;){const length=buf.readUInt32BE(at),end=at+length+12,type=buf.toString('ascii',at+4,at+8);if(['IHDR','IDAT','IEND'].includes(type))parts.push(buf.subarray(at,end));at=end;}
  await writeFile(path,Buffer.concat(parts));
 }
}
