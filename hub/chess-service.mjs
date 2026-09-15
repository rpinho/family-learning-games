import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { freshChess, publicChess, actChess } from "./chess-state.mjs";
import { LocalEngine } from "./stockfish.mjs";
export function chessService({ data, players, log }) {
  const engine = new LocalEngine(),
    queues = new Map();
  const dir = join(data, "chess");
  const send = (res, status, obj) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  async function load(player) {
    try {
      return JSON.parse(await readFile(join(dir, player + ".json"), "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return freshChess();
      throw e;
    }
  }
  return {
    close: () => engine.close(),
    async handle(req, res, u) {
      const player = u.searchParams.get("player");
      if (!players.includes(player))
        return send(res, 400, { error: "Choose a player." });
      if (req.method === "GET") {
        await queues.get(player)?.catch(() => {});
        return send(res, 200, { profile: publicChess(await load(player)) });
      }
      if (req.method !== "POST")
        return send(res, 405, { error: "Unsupported chess action." });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "JSON required." });
      let raw = "";
      for await (const part of req) {
        raw += part;
        if (raw.length > 4096)
          return send(res, 413, { error: "Too much data." });
      }
      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: "Invalid JSON." });
      }
      const work = (queues.get(player) || Promise.resolve())
        .catch(() => {})
        .then(async () => {
          try {
            const profile = await load(player);
            const result = await actChess(profile, input, { engine });
            if (!result.duplicate) {
              await mkdir(dir, { recursive: true, mode: 0o700 });
              const file = join(dir, player + ".json");
              await writeFile(file + ".tmp", JSON.stringify(profile), {
                mode: 0o600,
              });
              await rename(file + ".tmp", file);
              await log({
                type: "chess",
                player,
                action: input.type,
                lesson: profile.session?.lesson,
                position: profile.session?.ids[profile.session.index],
                result,
                revision: profile.revision,
              });
            }
            send(res, 200, { profile: publicChess(profile), result });
          } catch (e) {
            await log({
              type: "chess-rejected",
              player,
              action: input?.type,
              error: e.message,
            });
            send(res, e.status || 503, {
              error: e.status
                ? e.message
                : "The chess move could not save. Please retry.",
            });
          }
        });
      queues.set(player, work);
      await work;
    },
  };
}
