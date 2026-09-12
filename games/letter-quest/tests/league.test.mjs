import test from 'node:test';import assert from 'node:assert/strict';
import {freshProfile,leagueRows} from '../public/engine.mjs';import {claimLeague,advanceLeague,leagueScreen} from '../public/league.mjs';
import {navItems,routeTab} from '../public/hub.mjs';
test('Leaderboard naming is consistent while old league bookmarks remain valid',()=>{
 const p=freshProfile();assert.match(navItems('league',p),/aria-label="Leaderboard"/);assert.doesNotMatch(navItems('league',p),/aria-label="League"/);
 assert.match(leagueScreen(p),/Jade leaderboard/);assert.equal(routeTab('#league'),'league');assert.equal(routeTab('#leaderboard'),'league');
});
test('Claiming the crown preserves first place; advancing is separate and saves final standings',()=>{
 const p=freshProfile();assert.equal(claimLeague(p),false);assert.equal(advanceLeague(p),false);
 p.xp=300;assert.equal(claimLeague(p).gems,40);assert.equal(p.league,0);assert.equal(leagueRows(p)[0].you,true);assert.equal(p.crowns,1);
 assert.equal(claimLeague(p),false);assert.equal(p.gems,40);p.xp+=100;
 assert.equal(advanceLeague(p).league,1);assert.equal(p.leagueBase,400);assert.equal(p.leagueHistory[0].rows[0].xp,400);assert.equal(p.leagueHistory[0].rows[0].you,true);
 assert.equal(advanceLeague(p),false);assert.equal(p.gems,40);assert.equal(p.crowns,1);
 assert.match(leagueScreen(p,0),/Your preserved first-place finish/);assert.match(leagueScreen(p,0),/>400</);assert.match(leagueScreen(p,1),/Current/);
});
test('Previous gems remain browsable; old wins never invent missing XP or standings',()=>{
 const p=freshProfile('beginner');p.league=3;p.crowns=3;
 for(let i=0;i<3;i++){const html=leagueScreen(p,i);assert.match(html,/you’re number one/);assert.match(html,/complete standings were not saved/);assert.match(html,/>—</);}
 assert.match(leagueScreen(p,999),/Current/);p.name='<script>alert(1)</script>';assert.doesNotMatch(leagueScreen(p,0),/<script>/);
});
