// Original coach dialogue for the shared edition.
import {FAMILY_NAMES,WORDS,taskPrompt} from './engine.mjs';
import {storyVoiceLines} from './story.mjs';
import {mazeVoiceLines} from './maze.mjs';
import {soccerVoiceLines} from './soccer.mjs';
import {readingVoiceLines} from './reading.mjs';
import {briefLine,SHORT_FEEDBACK} from './voice.mjs';
import {FOUNDATION_WORDS} from './foundation.mjs';
export const ROOK_CHEERS = [
  'My hat just did a victory lap!',
  'That answer deserves a tiny trumpet.',
  'You earned a royal high five.',
  'One more try helped you get there.'
];
export const DIALOGUE = {
  rook_miss: [
    'Your point! My mustache is requesting a meeting.',
    'One point for you. I am practicing my impressed face.',
    'You got me. I was thinking about snacks.',
    'Your answer, your point. I will be over here looking dramatic.'
  ],
  rook_score: [
    'One point for Rook. Let us work through the answer together.',
    'One point for me. I will try to remain humble. No promises.',
    'The mustache still has a few tricks.',
    'I got that one! Someone write this down.'
  ],
  duel_win: [
    'You win. I am telling everyone I coached you.',
    'I demand a rematch. My mustache was blocking the board.',
    'Defeated by a tiny genius. There goes my afternoon.',
    'You beat me! I will recover after a dramatic snack.'
  ],
  duel_loss: [
    'I won this one. Quick, before you learn my tricks: rematch?',
    'A win for Rook! My victory dance is mostly eyebrows.',
    'This round is mine. The next one is up for grabs.',
    'Good game! I should enjoy this before you beat me.'
  ],
  duel_draw: [
    'A tie! Finally, a result my ego can handle.',
    'Perfectly matched. Suspiciously perfectly matched.',
    'A draw! We will need another round to settle this.',
    'Nobody lost. My mustache finds this acceptable.'
  ],
  success: [ROOK_CHEERS[0], ROOK_CHEERS[1],
    'Ah, a masterpiece in miniature!',
    'My moustache is positively impressed.',
    'A tiny move with tremendous style.',
    'You found it! Shall we call that detective work?',
    'I see you have been sharpening your skills.',
    'That deserves a very small royal parade.',
    'The letters are no match for your eagle eyes.',
    'Well spotted, my adventurous apprentice.',
    'Another little victory for your collection.',
    'A most distinguished bit of letter work.'
  ],
  trace: [
    'Look at that trail. You followed it all the way!',
    'Such splendid lines. My pencil is applauding.',
    'A letter fit for the royal library.',
    'Your hand knew just where to go.',
    'The gold dot would be very proud of you.',
    'From the first stroke to the last. Lovely work.',
    'You have turned a little trail into a proper letter.',
    'That letter has arrived in style.'
  ],
  memory: [
    'You remembered the shape all by yourself!',
    'No trail, and you still found the way. Splendid.',
    'A secret map, kept right inside your memory.',
    'Your very own letter, straight from memory.'
  ],
  assisted: [ROOK_CHEERS[3],
    'A little help, a little practice. That is how we learn.',
    'You followed the clue and found your way.',
    'We made a rather good team on that one.',
    'You stayed with it. I noticed.',
    'Every grand adventure includes a helping hand.'
  ],
  retry: [
    'Hmm. A little mystery. Let us look at the clue together.',
    'That one is still growing. Let us give it another try.',
    'An excellent moment for a little practice.',
    'No hurry, apprentice. We can work this out.',
    'A tricky one! I shall bring back our trusty guide.',
    'Our next move is simple. Take a breath, then try again.'
  ],
  direction: [
    'The gold dot is our starting square. Let us begin there.',
    'Follow the little arrow. It knows the way.',
    'Back to the gold dot, and off we go together.',
    'This trail has a starting point. Look for the gold dot.'
  ],
  lesson: [ROOK_CHEERS[2],
    'Five moves, one finished quest. Take a bow, apprentice!',
    'A splendid quest. The kingdom celebrates with you.',
    'You have earned a victory. I shall polish the trophy.',
    'The royal notebook records another quest complete.',
    'Your practice has paid off. What a lovely little adventure.'
  ],
  chest: [
    'Twenty five gems. The treasure is yours!',
    'A chest full of sparkle, earned by your own clever moves.',
    'Treasure inspection complete. Twenty five splendid gems.',
    'Behold your treasure! A reward for all that practice.'
  ],
  promotion: [
    'A crown for you, and a new league to explore!',
    'First place! I shall announce your arrival to the next kingdom.',
    'Forty gems, a royal crown, and a fresh adventure.',
    'The next gem league awaits its newest champion.'
  ]
};

export function feedbackCategory(challenge,result,helped=false){
  if(result.duel?.alreadyAwarded&&!result.duel.finished)return 'assisted';
  if(result.duel)return result.duel.finished?'duel_'+result.duel.outcome:result.duel.rookOk?'rook_score':'rook_miss';
  if(!result.ok)return result.reason==='direction'?'direction':'retry';
  if(result.lesson)return 'lesson';
  if(helped)return 'assisted';
  if(challenge.type==='trace'&&challenge.level>=3)return 'memory';
  return challenge.type==='trace'?'trace':'success';
}

// Each category exhausts its shuffled bag before repeating. Boundary repeats are excluded.
export function createDialoguePicker(random=Math.random){
  const bags=new Map(),last=new Map();
  return category=>{
    if(!DIALOGUE[category])throw Error('Unknown dialogue category');
    let bag=bags.get(category);
    if(!bag?.length){
      bag=[...DIALOGUE[category]];
      for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
      if(bag.at(-1)===last.get(category))[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
      bags.set(category,bag);
    }
    const line=bag.pop();last.set(category,line);return line;
  };
}

export const FIXED_LINES = [
  'Try drawing a line first.',
  'Hello, apprentice. I am Rook. Let us make something splendid together.',
  'I brought my A game. Also B, C, and a backup mustache.',
  'I tried to alphabetize my snacks. Then I ate the evidence.'
];

// Exact app prompt inventory, used to generate complete voiced sentences in advance.
export function allVoiceLines(){
  const lines=[...Object.values(DIALOGUE).flat(),...FIXED_LINES,...storyVoiceLines(),...mazeVoiceLines(),...soccerVoiceLines(),...readingVoiceLines(),'A point for Rook. Now let us solve it together.','First place! Your crown is yours. Stay and enjoy your victory.'];
  // Old open tabs can still ask for these clips during a deployment.
  lines.push('My strategy was excellent. My answer was not.','That letter was clearly wearing a disguise.','My mustache pressed the wrong button. Very unprofessional.');
  for(const {word} of WORDS)for(const type of ['spell','gap'])lines.push(taskPrompt({type,word}));
  lines.push(taskPrompt({type:'sequence'}));
  for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')lines.push(`The letter ${letter}.`);
  for(const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'){
    const name=(/^[a-z]$/.test(char)?'little ':'')+char.toUpperCase();
    lines.push(`Find ${name}.`,`Trace ${name}. Start at the gold dot. Follow the arrow.`,`Copy ${name}. Take your time.`,`Write ${name}. Take your time.`);
  }
  for(const name of [...FAMILY_NAMES,'Rook'])lines.push(`Build ${name}. Start at the left. Tap the letters in order.`);
  lines.push(...SHORT_FEEDBACK,...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(c=>`Letter ${c}.`));
  for(const word of FOUNDATION_WORDS)lines.push(`Complete the word ${word}. Choose the missing letter.`);
  return [...new Set([...lines,...lines.map(briefLine)])];
}
