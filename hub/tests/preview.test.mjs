import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {previewRoute,cookieOf,running,bannerHTML} from '../preview-route.mjs';
// Previews: routing through the staging site (pure) and the deploy tool's registry rules (no services started).
const reg={previews:{pond:{name:'pond',game:'hub',port:5400,state:'active'},slalom:{name:'slalom',game:'word-arcade',card:'letter-slalom',port:5401,state:'approved'},old:{name:'old',game:'hub',port:5402,state:'rejected'}}};
const req=(cookie)=>({headers:cookie?{cookie}:{}});const url=p=>new URL(p,'https://x');
test('opening, using and leaving a preview through the staging site',()=>{
 let r=previewRoute(req(),url('/preview/pond/?player=beginner'),reg);assert.equal(r.kind,'enter');assert.equal(r.location,'/?player=beginner');assert.match(r.cookie,/^fg_preview=pond; Path=\//);
 r=previewRoute(req(),url('/preview/slalom/?player=admin'),reg);assert.equal(r.location,'/?player=admin#letter-slalom');
 assert.equal(previewRoute(req(),url('/preview/old/'),reg).kind,'unknown','a rejected preview cannot be opened');
 assert.equal(previewRoute(req(),url('/preview/../x/'),reg),null,'a path that climbs out is not a preview');
 assert.equal(previewRoute(req('fg_preview=pond'),url('/api/book?player=beginner'),reg).kind,'hub','a hub preview gets everything');
 assert.equal(previewRoute(req('a=1; fg_preview=slalom'),url('/g/word-arcade/beginner/'),reg).kind,'game','a game preview gets its game');
 assert.equal(previewRoute(req('fg_preview=slalom'),url('/api/config'),reg),null,'and nothing else');
 assert.equal(previewRoute(req('fg_preview=old'),url('/'),reg),null,'a stopped preview is ignored');
 assert.equal(previewRoute(req(),url('/'),reg),null,'no cookie: the normal staging site');
 const ex=previewRoute(req('fg_preview=pond'),url('/preview/exit'),reg);assert.equal(ex.kind,'exit');assert.match(ex.cookie,/Max-Age=0/);
 assert.equal(cookieOf(req('fg_preview=Pond')),null);assert.ok(running(reg,'slalom'));assert.match(bannerHTML('pond'),/PREVIEW · pond/);
});
test('the deploy tool keeps at most three previews and gives each its own ports',()=>{
 const cli=readFileSync(new URL('../../scripts/deploy/cli.mjs',import.meta.url),'utf8');
 const part=cli.slice(cli.indexOf('const PREVIEWS ='),cli.indexOf('function previewEnv('));
 const c={join:(...a)=>a.join('/'),ROOT:'/r',cfg:{},readJSON:()=>({previews:{}}),listenerPid:()=>null};vm.createContext(c);vm.runInContext(part+';this.ports=previewPorts;this.max=MAX_PREVIEWS;this.running=runningPreviews;this.NAME=PREVIEW_NAME;',c);
 assert.equal(c.max,3);
 assert.equal(JSON.stringify(c.ports({previews:{a:{state:'active',port:5400,uiPort:5401}}},()=>null)),'[5402,5403]');
 assert.equal(JSON.stringify(c.ports({previews:{}},p=>p===5400)),'[5401,5402]','a busy port is skipped');
 assert.equal(c.running({previews:{a:{state:'active'},b:{state:'approved'},x:{state:'rejected'}}}).length,2);
 assert.ok(c.NAME.test('pond-story')&&!c.NAME.test('Pond')&&!c.NAME.test('../x'));
 assert.ok(cli.includes("if (run.length >= MAX_PREVIEWS) die("),'a fourth preview is refused');
 assert.ok(cli.includes("renameSync(p.dir, join(to, 'preview'))")&&!/rmSync\(p\.dir/.test(cli),'reject moves, never deletes');
});
