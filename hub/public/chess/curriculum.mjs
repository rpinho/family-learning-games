// Original coaching, sequenced around short positions instead of opening memorization.
export const COURSE_VERSION = "rook-academy-1";
export const UNITS = [
  {
    id: "forcing",
    theme: "fork",
    name: "See the whole line",
    subtitle: "Checks, captures, then the reply",
    color: "#7964c5",
    symbol: "◇",
    idea: "A tempting first move is only half a plan. Picture the opponent’s strongest reply, then find your next move.",
    question: "Before you move, ask: what must they answer?",
    hints: [
      "Look at checks and captures first. Which one creates two threats?",
      "A fork works when one piece attacks two important targets. Count the defenders too.",
    ],
    lessons: [
      "Find the forcing move",
      "Two threats, one move",
      "Look one reply further",
      "Choose the move order",
      "Connect the ideas",
      "Calculation checkpoint",
    ],
  },
  {
    id: "deflection",
    theme: "deflection",
    name: "Pull the guard away",
    subtitle: "Make a defender choose",
    color: "#268f87",
    symbol: "↗",
    idea: "A defender cannot be in two places at once. Give it an urgent job somewhere else, then use the square it leaves behind.",
    question: "Which defender is doing the important job?",
    hints: [
      "Find the piece guarding your target. Can you force it away?",
      "A check or capture may pull the guard away with tempo. Look at the position after it responds.",
    ],
    lessons: [
      "Find the guard",
      "Offer a distraction",
      "Pull with check",
      "Follow the defender",
      "A second target",
      "Deflection checkpoint",
    ],
  },
  {
    id: "guard",
    theme: "capturingDefender",
    name: "Remove the defender",
    subtitle: "Trade for the piece that matters",
    color: "#c17c36",
    symbol: "×",
    idea: "Do not count only the piece you capture. Ask what it was defending. Removing a small guard can win a much bigger prize.",
    question: "What becomes loose if that guard disappears?",
    hints: [
      "Trace the defenders of the king or valuable pieces.",
      "Consider capturing a defender first, even if your piece can be recaptured. Calculate the follow-up.",
    ],
    lessons: [
      "Who protects whom?",
      "Remove, then collect",
      "A guard near the king",
      "Trade with a purpose",
      "Two jobs to break",
      "Defender checkpoint",
    ],
  },
  {
    id: "between",
    theme: "intermezzo",
    name: "First, something stronger",
    subtitle: "The in-between move",
    color: "#b76079",
    symbol: "!",
    idea: "You do not always have to recapture immediately. A stronger threat in between can change the whole exchange.",
    question: "Before recapturing, is there a forcing move?",
    hints: [
      "Do not reply automatically. Check for a check first.",
      "Look for an urgent threat that makes the opponent answer before you finish the exchange.",
    ],
    lessons: [
      "Pause before recapturing",
      "Check in between",
      "Change the exchange",
      "Refuse the obvious reply",
      "A surprising order",
      "In-between checkpoint",
    ],
  },
  {
    id: "clearance",
    theme: "clearance",
    name: "Open the line",
    subtitle: "Make room for your next piece",
    color: "#5784b7",
    symbol: "↔",
    idea: "Sometimes your own piece is in the way. Move it with a threat so a rook, bishop or queen can use the line behind it.",
    question: "Which line would be powerful if it were clear?",
    hints: [
      "Look behind your pieces: which rook, bishop or queen wants an open line?",
      "A forcing move can clear a square or diagonal without giving the opponent time to defend.",
    ],
    lessons: [
      "Find the blocked line",
      "Clear a square",
      "Clear with tempo",
      "The piece behind",
      "Open, then strike",
      "Clearance checkpoint",
    ],
  },
  {
    id: "discovery",
    theme: "discoveredAttack",
    name: "Reveal the attack",
    subtitle: "Two pieces working as one",
    color: "#769546",
    symbol: "✦",
    idea: "Moving one piece can uncover another piece’s attack. Find a useful job for the moving piece as well.",
    question: "What attack appears when this piece moves?",
    hints: [
      "Find two of your pieces lined up with a target.",
      "Move the front piece with check or another threat. The piece behind supplies the second attack.",
    ],
    lessons: [
      "The hidden attacker",
      "Move with a threat",
      "Discover with check",
      "Two attacks at once",
      "Choose the landing square",
      "Discovery checkpoint",
    ],
  },
  {
    id: "mate",
    theme: "mateIn3",
    name: "Weave a mating net",
    subtitle: "Cover escapes before the finish",
    color: "#9c6898",
    symbol: "♛",
    idea: "Checkmate is about escape squares. Look for forcing checks, but keep track of where the king can go after each one.",
    question: "Where could the king escape next?",
    hints: [
      "List the king’s escape squares before choosing a check.",
      "Use your pieces together. One drives the king; another covers the way out.",
    ],
    lessons: [
      "Count the exits",
      "Drive, then close",
      "A rook and a helper",
      "A queen with support",
      "Three-move calculation",
      "Mating-net checkpoint",
    ],
  },
  {
    id: "quiet",
    theme: "quietMove",
    name: "The quiet threat",
    subtitle: "Strong moves do not always check",
    color: "#498e91",
    symbol: "…",
    idea: "When forcing moves do not work, improve the threat. A quiet move can attack a weakness or take away an escape.",
    question: "What would you like to play on the next move?",
    hints: [
      "You may not need a check or a capture immediately.",
      "Build a threat the opponent cannot comfortably meet. Look at escape squares and undefended pieces.",
    ],
    lessons: [
      "Imagine the threat",
      "Improve one piece",
      "Take away an escape",
      "Create two problems",
      "A move worth waiting for",
      "Quiet-move checkpoint",
    ],
  },
  {
    id: "defense",
    theme: "defensiveMove",
    name: "Find the resource",
    subtitle: "Defend actively, not automatically",
    color: "#b28046",
    symbol: "◆",
    idea: "When you are under pressure, name the threat first. Then compare a defense, a trade and a forcing counterattack.",
    question: "What is the opponent threatening?",
    hints: [
      "Identify the threat before starting your own attack.",
      "Look for checks, useful exchanges or a square that solves more than one problem.",
    ],
    lessons: [
      "Name the danger",
      "Trade out of trouble",
      "Counterattack with tempo",
      "Save the important piece",
      "Stay resourceful",
      "Defense checkpoint",
    ],
  },
  {
    id: "pawns",
    theme: "advancedPawn",
    name: "Race to promotion",
    subtitle: "Count moves and stop counterplay",
    color: "#7c934a",
    symbol: "♙",
    idea: "A passed pawn can be worth more than a piece. Count both sides’ moves to promotion and watch for checks that change the race.",
    question: "Who promotes first, and will it be with check?",
    hints: [
      "Count the moves to promotion on both sides.",
      "Look for a forcing move before pushing. A check, capture or sacrifice may buy the one tempo you need.",
    ],
    lessons: [
      "Count the race",
      "A pawn with tempo",
      "Support the passer",
      "Stop the other runner",
      "Choose the promotion",
      "Pawn-race checkpoint",
    ],
  },
  {
    id: "rooks",
    theme: "rookEndgame",
    name: "Make the rook active",
    subtitle: "Checks, cut-offs and passed pawns",
    color: "#5b81ae",
    symbol: "♜",
    idea: "An active rook can attack pawns and restrict a king at the same time. Before taking a pawn, check whether your rook will become passive.",
    question: "Can your rook do two useful jobs?",
    hints: [
      "Look for checking distance, open files and exposed pawns.",
      "Consider activity before material. A forcing rook move may cut off the king or protect your passer.",
    ],
    lessons: [
      "Activate the rook",
      "Check from the side",
      "Cut off the king",
      "Support promotion",
      "Convert carefully",
      "Rook-ending checkpoint",
    ],
  },
  {
    id: "combinations",
    theme: "sacrifice",
    name: "Put it all together",
    subtitle: "Calculate the sacrifice all the way",
    color: "#9b7154",
    symbol: "★",
    idea: "A sacrifice is a calculated exchange for something more important: a king attack, a promotion or a decisive material gain.",
    question: "What do you get after their strongest reply?",
    hints: [
      "Look for forcing moves, but count what you give up and what you get back.",
      "Combine the ideas: remove a guard, open a line or lure the king. Calculate until the point is clear.",
    ],
    lessons: [
      "Calculate the offer",
      "Open the king",
      "Give, then recover",
      "Connect two motifs",
      "Trust the full line",
      "Academy checkpoint",
    ],
  },
];
// The five themed steps rise through the selected difficulty band; checkpoint mixes earlier units.
const STEPS = [
  "Recognize the pattern",
  "Find their best reply",
  "Calculate before moving",
  "Try without hints",
  "Stretch your calculation",
  "Mixed checkpoint",
];
export const LESSONS = UNITS.flatMap((u, unit) =>
  u.lessons.map((name, step) => ({
    id: `${u.id}-${step + 1}`,
    unit,
    step,
    name:
      step === 0
        ? u.lessons[0]
        : step === 5 && unit === 0
          ? "Calculation checkpoint"
          : STEPS[step],
    kind: step === 5 ? "checkpoint" : step === 0 ? "discover" : "practice",
  })),
);
export const unitFor = (id) => UNITS.find((u) => u.id === id) || UNITS[0];
export const lessonFor = (id) => LESSONS.find((l) => l.id === id);
export const NAMES = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
export function moveWords(move) {
  return `${NAMES[move.piece]} ${move.captured ? "takes on" : "to"} ${move.to.toUpperCase()}${move.promotion ? ", promote to " + NAMES[move.promotion] : ""}`;
}

// Finite, original dialogue performed by the established Rook stock voice.
// Precise board feedback remains visible; dynamic text never falls back to device TTS.
export const VOICE={
 welcome:"You know the rules. Excellent. Now let's cause some very well-planned trouble.",
 progress:"Good. Now find the follow-up.",
 check:"Check. They have to answer. What comes next?",
 fork:"Two targets, one piece. A rather excellent bargain.",
 capture:"There it is. You found the loose piece.",
 promotion:"A promotion! That little pawn had big plans.",
 mate:"Checkmate. No escape, not even a tiny one.",
 solved:"Well played. You did the thinking. I supplied the moustache.",
 assisted:"We found it together. Next time, see if you can spot it on your own.",
 mistakes:["Not quite. Let's put that back and look again.","A legal move, but our plan needs something stronger.","My moustache is still thinking. Try checks, captures, and threats."],
 hintMove:"Follow the arrow. Then find their strongest reply.",
 gameHint:"Try the marked move. But first, tell me why it works.",
 alternative:"Here is one strong reply. Look at what it changes.",
 restart:"Back to the start. Let's see the whole plan again.",
 checkpoint:"No labels this time. Work out which idea the position needs."
};
export const pieceHint=(type,square)=>`Have a look at your ${NAMES[type]} on ${square.toUpperCase()}.`;
