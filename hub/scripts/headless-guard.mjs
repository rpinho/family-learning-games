// Every check that starts a headless Chrome must close it, however the check ends: normally, on an error, on Ctrl-C or
// SIGTERM, and even when the check itself is killed with SIGKILL (a tiny watchdog shell kills Chrome once the check's
// process is gone). A leftover headless Chrome from the app bundle blocks the family's desktop Chrome from updating.
import {spawn} from 'node:child_process';
export function guardChrome(proc){
 const kill=()=>{try{if(proc.exitCode===null&&proc.signalCode===null)proc.kill('SIGKILL');}catch{}};
 process.on('exit',kill);
 for(const [sig,code] of [['SIGINT',130],['SIGTERM',143],['SIGHUP',129]])process.once(sig,()=>{kill();process.exit(code);});
 if(!process.listenerCount('uncaughtException'))process.on('uncaughtException',e=>{kill();console.error(e);process.exit(1);});
 if(!process.listenerCount('unhandledRejection'))process.on('unhandledRejection',e=>{kill();console.error(e);process.exit(1);});
 try{spawn('/bin/sh',['-c',`while kill -0 ${process.pid} 2>/dev/null && kill -0 ${proc.pid} 2>/dev/null; do sleep 2; done; kill -9 ${proc.pid} 2>/dev/null`],{detached:true,stdio:'ignore'}).unref();}catch{}
 return proc;}
