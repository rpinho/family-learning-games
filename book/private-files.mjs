// Confine family setup writes to the configured private root, including symlink checks.
import {mkdir,lstat,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,relative,join,dirname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
const bad=message=>Object.assign(Error(message),{status:400});
export async function safePrivatePath(root,file){
 root=resolve(root);const dest=resolve(file),rel=relative(root,dest);
 if(!rel||rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep))throw bad('Onboarding data must stay inside the private data directory.');
 await mkdir(root,{recursive:true,mode:0o700});
 if((await lstat(root)).isSymbolicLink())throw bad('Use a private data directory without symlinks.');
 let part=root;for(const bit of rel.split(sep)){part=join(part,bit);try{if((await lstat(part)).isSymbolicLink())throw bad('Private data paths must not contain symlinks.');}catch(e){if(e.code!=='ENOENT')throw e;}}
 return dest;
}
export async function writePrivateFile(root,file,value){
 file=await safePrivatePath(root,file);await mkdir(dirname(file),{recursive:true,mode:0o700});const tmp=file+'.tmp-'+randomUUID();
 try{await writeFile(tmp,value,{mode:0o600,flag:'wx'});await rename(tmp,file);}finally{await unlink(tmp).catch(()=>{});}
}
