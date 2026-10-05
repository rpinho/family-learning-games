import { ANIMALS, ANIMAL_PROMPT, ANIMAL_OBSERVE, animalPrompt, balanceObservationPrompt } from './balance.mjs';
export const KINDER_BALANCE_GAME = {
  id: 'balance-k',
  icon: '⚖️',
  title: 'Animal balance',
  description: 'Who weighs more? Make the blocks balance.',
};
export const KINDER_BALANCE_HELP =
  'Put the animals on the pans, then weigh them. The heavier pan goes down. Add blocks to make the pans level.';
export function kinderBalanceQuestion(r, round) {
  if (round % 2) {
    const target = 1 + Math.floor(r() * 10);
    return {
      kind: 'balance',
      kinderBalance: true,
      mode: 'blocks',
      target,
      max: 10,
      answer: target,
      prompt: 'Make the pans level.',
      options: [],
      fingerprint: JSON.stringify(['balance-k', target]),
    };
  }
  const small = ANIMALS.slice(0, 6),
    large = ANIMALS.slice(11),
    a = small[Math.floor(r() * small.length)],
    b = large[Math.floor(r() * large.length)];
  const [left, right] = r() < 0.5 ? [a, b] : [b, a];
  return {
    kind: 'balance',
    kinderBalance: true,
    mode: 'animals',
    left: { ...left },
    right: { ...right },
    max: 1,
    answer: Number(right.kg > left.kg),
    options: [0, 1],
    prompt: 'Who weighs more?',
    fingerprint: JSON.stringify(['balance-k', left.name, right.name]),
  };
}
export const kinderBalancePrompt = q => q.mode==='animals'
 ? [animalPrompt(q)]
 : [`There ${q.target===1?'is 1 block':'are '+q.target+' blocks'} on this pan. Can you add blocks to make the pans level?`];
export const kinderBalanceFeedback = (q,result) => q.mode==='blocks'
 ? `Both pans have ${q.target} ${q.target===1?'block':'blocks'}. They are level!`
 : `${(result.answer===0?q.left:q.right).name} weighs more. The heavier pan goes down.`;
export const kinderCountLine = count => count===0 ? 'The pan is empty. Try adding a block.' : `Now there ${count===1?'is 1 block':'are '+count+' blocks'} on your pan.`;
export function kinderBalanceVoiceLines(){const animals=[];for(const left of ANIMALS.slice(0,6))for(const right of ANIMALS.slice(11))animals.push(animalPrompt({left,right}),animalPrompt({left:right,right:left}));return [balanceObservationPrompt({kinderBalance:true}),...animals,KINDER_BALANCE_HELP,ANIMAL_PROMPT,ANIMAL_OBSERVE,...ANIMALS.map(a=>`${a.name} weighs more. The heavier pan goes down.`),...Array.from({length:10},(_,i)=>kinderBalancePrompt({mode:'blocks',target:i+1})[0]),...Array.from({length:10},(_,i)=>kinderBalanceFeedback({mode:'blocks',target:i+1})),...Array.from({length:11},(_,i)=>kinderCountLine(i))];}
