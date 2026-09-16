import test from 'node:test';
import assert from 'node:assert/strict';
import { freshChess, actChess, publicChess, PUZZLES, HINT_PAUSE_MS } from '../chess-state.mjs';
const act = (p,type,now=10000,extra={},engine) => actChess(p,{type,revision:p.revision,requestId:crypto.randomUUID(),...extra},{now,engine});
async function start(){const p=freshChess();p.settings.band='guided';await act(p,'start',0,{lesson:'forcing-1'});await act(p,'begin');return p;}
async function play(p){const u=PUZZLES[p.session.ids[p.session.index]].line[p.session.ply];return act(p,'move',30000,{from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});}
test('Hints pace escalation on the server, survive reload and cannot reveal the next decision automatically',async()=>{
 const p=await start(),fen=publicChess(p).session.puzzle.fen;
 await act(p,'hint');assert.equal(p.session.hints,1);assert.equal(publicChess(p,10000).session.hint.waitMs,5000);
 for(let n=0;n<8;n++)assert.equal((await act(p,'hint',10001)).advanced,false);
 assert.equal(p.session.hints,1);assert.equal(publicChess(p,10001).session.hintFrom,undefined);
 const saved=JSON.parse(JSON.stringify(p));await act(saved,'hint',14999);assert.equal(saved.session.hints,1);
 await act(p,'hint',15000);assert.ok(publicChess(p,15000).session.hintFrom);assert.equal(publicChess(p,15000).session.hintTo,undefined);
 await act(p,'hint',20000);assert.ok(publicChess(p,20000).session.hintTo);
 await act(p,'hint',25000);assert.equal(p.session.hints,3);assert.equal(publicChess(p).session.puzzle.fen,fen);
 await play(p);assert.equal(publicChess(p).session.hintFrom,undefined);
 if(p.session.phase==='puzzle'){await act(p,'hint',30001);assert.equal(publicChess(p,30001).session.hint.stage,1);}
 while(p.session.phase==='puzzle')await play(p);
 assert.equal(p.session.results[0].independent,false);
 assert.ok(p.checks.length);assert.equal(p.completed['forcing-1'],undefined);
});
test('Assisted positions schedule a different same-band/theme position in later practice; help remains available',async()=>{
 const p=await start();await act(p,'hint');while(p.session.phase==='puzzle')await play(p);
 const source=p.session.ids[0],old=structuredClone(p.session);
 await act(p,'start',40000,{lesson:'forcing-2'});
 const [id,from]=Object.entries(p.session.checkOf)[0];assert.equal(from,source);
 assert.equal(PUZZLES[id].theme,PUZZLES[source].theme);assert.notEqual(PUZZLES[id].fen,PUZZLES[source].fen);assert.ok(!old.ids.includes(id));assert.equal(p.session.ids.length,5);
 await act(p,'begin');
 while(p.session.phase!=='summary'){if(p.session.phase==='puzzle')await play(p);else await act(p,'next');}
 assert.equal(p.checkHistory.at(-1).independent,true);assert.equal(p.checkHistory.at(-1).source,source);
 assert.equal(p.review[source].needsPractice,false);assert.equal(p.completed['forcing-2'].best,5);
});
test('Practice games reveal idea/piece/move separately and count one helped turn, not repeated taps',async()=>{
 const p=freshChess();let calls=0;const engine={analyze:async()=>{calls++;return {best:'e2e4'};}};
 await act(p,'game-start',0,{side:'w'},engine);
 await act(p,'game-hint',10000,{},engine);assert.equal(calls,0);assert.equal(p.game.hint.from,undefined);assert.equal(p.game.help,1);
 await act(p,'game-hint',12000,{},engine);assert.equal(p.game.help,1);
 await act(p,'game-hint',15000,{},engine);assert.equal(p.game.hint.from,'e2');assert.equal(p.game.hint.to,undefined);
 assert.equal(publicChess(p).game.coaching,undefined);
 await act(p,'game-hint',20000,{},engine);assert.equal(p.game.hint.to,'e4');assert.equal(calls,1);
 await act(p,'game-hint',25000,{},engine);assert.equal(p.game.help,1);assert.equal(p.game.hintedTurns,1);
 assert.equal(p.game.moves.length,0);
});
