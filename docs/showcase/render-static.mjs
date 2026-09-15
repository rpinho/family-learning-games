// Offline documentation renderer. Optional dependency: @resvg/resvg-js.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const { Resvg } = await import(process.env.RESVG_MODULE || "@resvg/resvg-js");
const root = fileURLToPath(new URL("../", import.meta.url));
const image = (id) =>
  "data:image/png;base64," +
  fs
    .readFileSync(root + "showcase/screenshots/" + id + ".png")
    .toString("base64");
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, size, value, weight = 400, color = "#122d36") =>
  `<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${color}">${escape(value)}</text>`;
function render(name, w, h, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
  fs.writeFileSync(
    root + "media/" + name + ".png",
    new Resvg(svg).render().asPng(),
  );
}
for (const [id, name, headline, sub, tint, tag] of [
  [
    "chess",
    "Rook Academy",
    "Your next good move.",
    "Short chess lessons, a speaking coach and room to think.",
    "#d7ebc6",
    "CHESS · CALCULATION · STRATEGY",
  ],
  [
    "letter-quest",
    "Letter Quest",
    "Words open worlds.",
    "Read words, build sentences and solve story missions.",
    "#b9ead4",
    "READING · STORIES · EXPLORATION",
  ],
]) {
  render(
    id,
    1440,
    1360,
    `<rect width="1440" height="1360" fill="${tint}"/>` +
      text(48, 76, 20, tag, 800) +
      text(1110, 83, 25, name, 700) +
      text(48, 167, 66, headline, 700) +
      text(48, 222, 28, sub) +
      `<rect x="48" y="265" width="1344" height="1010" rx="25" fill="#102631"/><image x="58" y="275" width="1324" height="990" preserveAspectRatio="xMidYMid meet" href="${image(id)}"/>` +
      text(48, 1320, 18, "FAMILY LEARNING GAMES") +
      text(1000, 1320, 18, "Actual gameplay · Generic Admin demo"),
  );
}
const games = [
  ["letter-quest", "Letter Quest"],
  ["word-arcade", "Word Arcade"],
  ["number-park", "Number Park"],
  ["maze-garden", "Maze Garden"],
  ["three-in-a-row", "Three in a Row"],
  ["target-trail", "Target Trail"],
  ["chess", "Rook Academy"],
  ["dribble-duel", "Soccer Club"],
];
let body =
  '<rect width="1280" height="640" fill="#102730"/>' +
  text(44, 66, 15, "EIGHT GAMES. ONE PLACE TO PLAY.", 700, "#bcefdc") +
  text(44, 150, 68, "Family", 800, "white") +
  text(44, 222, 68, "Learning", 800, "white") +
  text(44, 294, 68, "Games.", 800, "#c7f2b2") +
  text(44, 354, 23, "Read. Count. Trace. Think ahead.", 400, "#d3e2e3") +
  text(44, 390, 23, "Little games. Big adventures.", 400, "#d3e2e3");
for (const [i, label] of [
  "Touch-friendly",
  "Adjustable",
  "Run locally",
].entries())
  body +=
    `<rect x="${44 + i * 146}" y="420" width="136" height="42" rx="21" fill="none" stroke="#547174"/>` +
    text(57 + i * 146, 447, 15, label, 400, "white");
body +=
  '<rect x="44" y="492" width="235" height="54" rx="12" fill="#d4f59d"/>' +
  text(66, 526, 23, "npm run play", 700) +
  text(44, 583, 15, "github.com/rpinho/family-learning-games", 400, "#bed1d3");
games.forEach(([id, name], i) => {
  const x = 552 + (i % 2) * 344,
    y = 44 + Math.floor(i / 2) * 139;
  body +=
    `<defs><clipPath id="tile${i}"><rect x="${x}" y="${y}" width="326" height="126" rx="14"/></clipPath></defs><g clip-path="url(#tile${i})"><rect x="${x}" y="${y}" width="326" height="126" fill="#d8ebde"/><image x="${x}" y="${y}" width="326" height="98" preserveAspectRatio="xMidYMid slice" href="${image(id)}"/></g>` +
    text(x + 15, y + 119, 17, name, 700);
});
render("social-preview", 1280, 640, body);
