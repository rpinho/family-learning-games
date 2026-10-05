import {mkdtemp,symlink,writeFile} from 'node:fs/promises';
import {freshProfile,action,makeQuestion} from '../lib/math.mjs';
import {join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
const data=await mkdtemp(join(tmpdir(),'number-park-qa-'));
if(process.env.QA_REPAIR==='1'){
 const p=freshProfile('admin');action(p,{kind:'start',game:'pattern',revision:0});p.session.round=2;p.session.question=makeQuestion(p,'pattern',2);
 await writeFile(join(data,'admin.json'),JSON.stringify(p),{mode:0o600});
}
await symlink(join(homedir(),'.local/share/number-park/voice'),join(data,'voice'));
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NUMBER_PARK_DATA:data,PORT:'14322',HOST:'127.0.0.1'},stdio:'inherit'});
console.log(`QA saves: ${data}`);
for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>child.kill(s));
