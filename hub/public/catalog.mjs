// Activity destinations are separate from storage ownership. Existing saves stay
// with their original backend even when a game moves to a better home.
export const CATALOG = [
  {
    id: "letter-quest",
    name: "Letter Quest",
    description: "Letters, reading missions and story adventures.",
    color: "#bce9d8",
    icon: "/letter-book.svg",
  },
  {
    id: "word-arcade",
    name: "Word Arcade",
    description: "Spaceships, spelling and rhyme hunts.",
    color: "#ced0ff",
  },
  {
    id: "number-park",
    name: "Number Park",
    description: "Count, move, trace numbers and find patterns.",
    color: "#b9eaf8",
  },
  {
    id: "drawing-studio",
    name: "Guess My Drawing",
    description: "Draw freely, ask for a guess and try a new idea.",
    color: "#ffd7a8",
    icon: "/drawing-studio.svg",
    preview: "number-park",
    game: "number-park",
    query: "studio=1",
  },
  {
    id: "maze-garden",
    name: "Maze Garden",
    description: "Trace, make and explore four kinds of mazes.",
    color: "#d5eca4",
  },
  {
    id: "chess",
    name: "Rook Academy",
    description: "Think ahead. Find the idea. Make your move.",
    color: "#d7ebc6",
    icon: "/chess/icon.svg",
  },
  {
    id: "three-in-a-row",
    name: "Three in a Row",
    description: "Choose X or O. Think one move ahead.",
    color: "#e1d4ff",
  },
  {
    id: "target-trail",
    name: "Target Trail",
    description: "Listen for letters. Aim and release.",
    color: "#ffd3b5",
  },
  {
    id: "dribble-duel",
    name: "Soccer Club",
    description: "Live dribbling, clever feints and word penalties.",
    color: "#ffe39d",
    symbol: "⚽",
    icon: "/soccer-logo.svg",
  },
];
export const FAMILIES = {
  "maze-garden": [
    {
      id: "trace",
      name: "Tracing mazes",
      description: "Trace winding paths. Choose the size and challenge.",
      game: "maze-garden",
      route: "",
      preview: "maze-garden",
    },
    {
      id: "maker",
      name: "Make a Maze",
      description: "Draw a trail, then trace the twists it creates.",
      game: "maze-garden",
      route: "maker",
      preview: "maze-maker",
    },
    {
      id: "letters",
      name: "Letter labyrinth",
      description: "Explore in 3D. Letters and words open the doors.",
      game: "letter-quest",
      route: "maze",
      preview: "maze-letters",
    },
    {
      id: "rescue",
      name: "Obstacle rescues",
      description: "Move blocks, open bridges and plan a rescue.",
      game: "letter-quest",
      route: "rescue",
      preview: "maze-rescue",
    },
  ],
  "dribble-duel": [
    {
      id: "live",
      name: "Live dribbling",
      description: "Draw a lunge, change direction, find the goal.",
      native: "live",
      preview: "dribble-duel",
    },
    {
      id: "classic",
      name: "Feint puzzles",
      description: "Take turns. Read the defender and choose a move.",
      native: "classic",
      preview: "soccer-classic",
    },
    {
      id: "penalties",
      name: "Word penalties",
      description: "Solve a letter or word puzzle to take your shot.",
      game: "letter-quest",
      route: "soccer",
      preview: "soccer-penalties",
    },
  ],
};
export function destination(hash) {
  const [family, activity] = String(hash).replace(/^#/, "").split("/");
  const item = CATALOG.find((g) => g.id === family);
  if (!item) return { type: "home" };
  if (family === "chess") return { type: "chess", item };
  if (FAMILIES[family]) {
    const mode = FAMILIES[family].find((a) => a.id === activity);
    return mode
      ? {
          type: mode.native ? "soccer" : "frame",
          item,
          mode,
          game: mode.game,
          route: mode.route || "",
        }
      : { type: "family", item, modes: FAMILIES[family] };
  }
  return { type: "frame", item, game: item.game || family, route: "", query: item.query || "" };
}
export function movedRoute(game, route) {
  if (game === "maze-garden" && route === "maze-menu") return "maze-garden";
  return game === "letter-quest"
    ? {
        "letter-home": "letter-quest",
        "maze-menu": "maze-garden",
        "soccer-menu": "dribble-duel",
        maze: "maze-garden/letters",
        rescue: "maze-garden/rescue",
        soccer: "dribble-duel/penalties",
      }[route]
    : undefined;
}
