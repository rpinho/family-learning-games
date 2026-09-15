import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
// One persistent local process; serialized UCI searches cannot interleave.
export class LocalEngine {
  constructor() {
    this.child = null;
    this.tail = Promise.resolve();
    this.waiter = null;
    this.lines = [];
  }
  start() {
    if (this.child) return;
    this.child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "./vendor/stockfish/stockfish-18-lite-single.js",
            import.meta.url,
          ),
        ),
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let partial = "";
    this.child.stdout.on("data", (chunk) => {
      partial += chunk;
      const rows = partial.split("\n");
      partial = rows.pop();
      for (const row of rows) {
        this.lines.push(row);
        if (this.waiter?.test(row)) {
          const w = this.waiter;
          this.waiter = null;
          clearTimeout(w.timer);
          w.resolve(this.lines);
        }
      }
    });
    this.child.stderr.on("data", () => {});
    this.child.on("error", (e) => this.fail(e));
    this.child.on("exit", () => {
      this.child = null;
      this.fail(Error("Chess coach is restarting. Try again."));
    });
  }
  fail(e) {
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter.reject(e);
      this.waiter = null;
    }
  }
  command(command, end) {
    return new Promise((resolve, reject) => {
      this.lines = [];
      const timer = setTimeout(() => {
        this.waiter = null;
        this.child?.kill();
        reject(Error("Chess analysis took too long. Try again."));
      }, 20000);
      this.waiter = {
        test: (line) => line.startsWith(end),
        resolve,
        reject,
        timer,
      };
      this.child.stdin.write(command + "\n");
    });
  }
  analyze(fen, { ms = 220, elo = null, multipv = 1 } = {}) {
    const run = async () => {
      this.start();
      await this.command("uci", "uciok");
      this.child.stdin.write(
        `setoption name Hash value 32\nsetoption name MultiPV value ${multipv}\nsetoption name UCI_LimitStrength value ${elo ? "true" : "false"}\n${elo ? `setoption name UCI_Elo value ${elo}\n` : ""}position fen ${fen}\n`,
      );
      await this.command("isready", "readyok");
      const rows = await this.command(`go movetime ${ms}`, "bestmove");
      const pvs = {};
      for (const row of rows) {
        const match = row.match(
          /depth (\d+).*?multipv (\d+).*?score (cp|mate) (-?\d+).*? pv (.+)$/,
        );
        if (match)
          pvs[match[2]] = {
            depth: +match[1],
            score:
              match[3] === "mate"
                ? Math.sign(+match[4]) * (100000 - Math.abs(+match[4]))
                : +match[4],
            mate: match[3] === "mate" ? +match[4] : null,
            line: match[5].trim().split(" "),
          };
      }
      const best = rows
        .findLast((r) => r.startsWith("bestmove"))
        ?.split(" ")[1];
      return { ...pvs[1], best, pvs: Object.values(pvs) };
    };
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => {});
    return result;
  }
  close() {
    this.child?.kill();
    this.child = null;
  }
}
