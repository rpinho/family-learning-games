// Finite, original lines for full games against the coach (same stock voice as the lessons).
// The lines never say the coach's name, so a private install can show its own name on screen.
// Reactions are rare by design: key moments only, never a line every move.
export const MATCH_VOICE = {
  howTo: "Tap a piece to see where it can go. Then tap a dot to move it.",
  startWhite: "You have the white pieces, so you go first.",
  startBlack: "I have white this time, so I go first. Here I come!",
  resume: "Welcome back! Our game is right where we left it.",
  good: [
    "Ooh, good move!",
    "Nice one. I did not see that coming.",
    "That is a strong move. Hmm.",
    "Clever! My moustache is worried.",
  ],
  youCapture: [
    "Hey! That was my piece!",
    "Ouch. Good capture.",
    "You got one of my pieces. Nicely done.",
  ],
  pounce: [
    "Oops! That piece was not protected. I will take it.",
    "Ooh, a free piece for me. Watch out for loose pieces!",
    "Thank you! Always check if your piece is safe.",
  ],
  youCheck: ["Check! My king has to move.", "Whoa, check! Let me think.", "Check! Nice attack."],
  meCheck: ["Check! Watch out for your king.", "Check! Can you keep your king safe?"],
  youPromote: ["Your pawn made it all the way. Promotion!"],
  mePromote: ["My pawn made it to the end. Promotion!"],
  takeback: ["Okay, one take-back. Choose carefully!"],
  resign: ["Good game. Let's play again soon."],
  youWin: [
    "Checkmate! You beat me. Great game!",
    "You won! Well played. I will be ready next time.",
    "Checkmate! My king is stuck. You win!",
  ],
  meWin: [
    "Checkmate! Good game. Let's play again!",
    "I won this time. You played well. Rematch?",
    "Checkmate. That was a fun game. Want to try again?",
  ],
  draw: ["It's a draw. Nobody wins this time. Good game!"],
  stalemate: ["Stalemate! The king cannot move, but it is not in check. That's a draw."],
  recapBest: "Let's look at your best move of the game.",
  recapTurn: "Let's look at the moment the game changed.",
  bestWhy: "This move was strong. Can you see why?",
  turnPlayed: "Here you played this move.",
  turnBetter: "This move was even better. Watch.",
  idea: {
    mate: "There is a checkmate on the board. Can you find it?",
    free: "Hmm. I left something unprotected. Can you find it?",
    danger: "One of your pieces is in danger. Keep it safe.",
    inCheck: "Your king is in check. Move it, block, or capture the attacker.",
    check: "Look for a check. Checks are forcing!",
    fork: "Can one piece attack two of mine at once?",
    develop: "Bring a new piece into the game.",
    castle: "Can you castle? It keeps your king safe.",
    promote: "One of your pawns is close to the end. Push it!",
    threat: "What is your opponent threatening? Check that before choosing your next move.",
  },
  arrow: "Try this move. Follow the arrow.",
};
export function matchVoiceLines() {
  return [...new Set(Object.values(MATCH_VOICE).flatMap((v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v : Object.values(v))))];
}
