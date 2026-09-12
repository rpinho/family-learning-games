import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function backupProfile(data,profile){
 if(!['explorer','beginner','admin'].includes(profile.id))throw Error('Unknown profile');
 const directory=path.join(data,'backups');await mkdir(directory,{recursive:true,mode:0o700});
 const name=`${profile.id}-r${profile.revision}-${Date.now()}-${randomUUID()}.json`;
 await writeFile(path.join(directory,name),JSON.stringify(profile,null,2),{mode:0o600,flag:'wx'});
 return name;
}
