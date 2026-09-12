// Deterministic format/size exports from the approved original PNG. No art generation.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../public/icons/',import.meta.url);await mkdir(root,{recursive:true});
const input=process.argv[2];if(!input)throw Error('Pass the approved square master PNG path');
await copyFile(input,new URL('master-v1.png',root));
for(const size of [16,32,48,180,192,512])execFileSync('/usr/bin/sips',['-z',String(size),String(size),input,'--out',fileURLToPath(new URL(`app-${size}-v1.png`,root))],{stdio:'ignore'});
const sizes=[16,32,48],images=await Promise.all(sizes.map(n=>readFile(new URL(`app-${n}-v1.png`,root))));
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
images.forEach((png,i)=>{const pos=6+i*16;header[pos]=header[pos+1]=sizes[i];header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(png.length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=png.length;});
await writeFile(new URL('favicon-v1.ico',root),Buffer.concat([header,...images]));
console.log('Exported PNGs 16/32/48/180/192/512 and a multi-size ICO');
