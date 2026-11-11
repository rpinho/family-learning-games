import {accessSync,constants} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

// Prefer an explicit executable, then ordinary browser installations. No private tool paths.
export function findChrome(env=process.env,platform=process.platform,home=homedir()) {
 const candidates=env.CHROME?[env.CHROME]:platform==='darwin'?[
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  join(home,'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
 ]:platform==='win32'?[
  ...[env.PROGRAMFILES,env['PROGRAMFILES(X86)'],env.LOCALAPPDATA].filter(Boolean).flatMap(dir=>[
   join(dir,'Google/Chrome/Application/chrome.exe'),join(dir,'Microsoft/Edge/Application/msedge.exe'),
  ]),
 ]:['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/opt/google/chrome/chrome'];
 return candidates.find(path=>{try{accessSync(path,constants.X_OK);return true;}catch{return false;}})||null;
}
export const chromeSkip='No Chrome found; install Chrome or set CHROME to its executable to run this browser test.';
