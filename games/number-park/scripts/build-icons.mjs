import sharp from 'sharp';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../public/icons/',import.meta.url),{recursive:true});
for(const size of [32,180,192,512])await sharp(new URL('../public/number-park.svg',import.meta.url).pathname).resize(size,size).png().toFile(new URL(`../public/icons/number-park-${size}.png`,import.meta.url).pathname);
await copyFile(new URL('../public/number-park.svg',import.meta.url),new URL('../public/favicon.svg',import.meta.url));
