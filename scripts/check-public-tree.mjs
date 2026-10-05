import {resolve} from 'node:path';
import {checkTree} from './public-policy.mjs';
const {files,issues}=checkTree(resolve('.'),process.env.PUBLIC_SYNC_BASE);
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log(`PASS: ${files} tracked files; 0 privacy hits${process.env.PUBLIC_SYNC_BASE?'; 0 new commit-message hits':''}. Manual asset review remains required.`);
