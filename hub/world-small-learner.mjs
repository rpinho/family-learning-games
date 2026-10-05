import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {patternLevel} from '../games/number-park/lib/play-practice.mjs';

const read=async path=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
// Reads only. The caller's copied Book/learner/game folders can be supplied by
// the replay harness; neither compilation nor a save migration happens here.
export async function smallLearnerProfile(bookDir,player,profile={},paths={}){
 if(profile.world!=='small'&&!(profile.age<=5))return profile;
 const learnerDir=paths.learnerDir||process.env.WORLD_LEARNER_DIR||process.env.FAMILY_LEARNER||join(dirname(bookDir),'learner');
 const deployment=await read(join(dirname(process.env.FAMILY_DEPLOY_DIR||bookDir),'deploy.json')),configured=deployment?.games?.['number-park']?.data;
 const staging=process.env.FAMILY_CHANNEL==='staging'&&process.env.FAMILY_DEPLOY_DIR?join(dirname(process.env.FAMILY_DEPLOY_DIR),'staging-data','number-park'):null;
 const numberParkDir=paths.numberParkDir||process.env.NUMBER_PARK_DATA||staging||(configured?(configured.startsWith('~/')?join(homedir(),configured.slice(2)):configured):join(dirname(dirname(bookDir)),'number-park'));
 const [learner,learnerModel,numberPark]=await Promise.all([read(join(learnerDir,player+'-learner.json')),read(join(learnerDir,player+'.json')),read(join(numberParkDir,player+'.json'))]);
 return {...profile,learner:learner||profile.learner,learnerModel:learnerModel||profile.learnerModel,patternLevel:numberPark?patternLevel(numberPark):profile.patternLevel};
}
