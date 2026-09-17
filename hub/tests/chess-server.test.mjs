import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { CATALOG, FAMILIES } from "../public/catalog.mjs";
test("Chess API isolates players, serializes writes, recovers duplicate saves and keeps solutions private", async () => {
  const data = await mkdtemp(join(tmpdir(), "chess-api-test-"));
  const child = spawn(
    process.execPath,
    [new URL("../server.mjs", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        FAMILY_CONFIG: "",
        FAMILY_DATA: data,
        PORT: "0",
        HOST: "127.0.0.1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    const output = await Promise.race([
      once(child.stdout, "data").then((x) => String(x[0])),
      once(child, "exit").then(() => {
        throw Error("Server stopped");
      }),
    ]);
    const base = "http://127.0.0.1:" + output.match(/localhost:(\d+)/)[1],
      url = base + "/api/chess?player=admin";
    const post = (input) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    assert.equal(
      (await fetch(url, { headers: { Origin: "https://foreign.example" } }))
        .status,
      403,
    );
    assert.equal((await fetch(base + "/api/chess?player=missing")).status, 400);
    assert.equal((await fetch(base + "/chess/audio.mjs")).status, 200);
    for (const path of [
      "/chess-puzzles.json",
      "/chess-guided.json",
      "/chess-state.mjs",
      "/chess/admin.json",
    ])
      assert.equal((await fetch(base + path)).status, 404);
    for (const name of new Set([
      ...CATALOG.map((x) => x.id),
      ...Object.values(FAMILIES)
        .flat()
        .map((x) => x.preview),
    ])) {
      const image = await fetch(base + "/previews/" + name + ".jpg");
      assert.equal(image.status, 200, name + " gameplay preview exists");
      assert.equal(image.headers.get("content-type"), "image/jpeg");
      const bytes = new Uint8Array(await image.arrayBuffer());
      assert.equal(bytes[0], 255);
      assert.equal(bytes[1], 216);
    }
    const beginner = (await (await fetch(base + "/api/chess?player=beginner")).json()).profile;
    const explorer = (await (await fetch(base + "/api/chess?player=explorer")).json()).profile;
    assert.equal(beginner.settings.band, "guided");
    assert.equal(beginner.settings.strength, "friendly");
    assert.equal(explorer.settings.band, "stretch");
    assert.equal(explorer.settings.strength, "club");
    const request = {
      type: "start",
      lesson: "forcing-1",
      requestId: "initial-lesson-123",
      revision: 0,
    };
    const responses = await Promise.all([post(request), post(request)]);
    for (const r of responses) {
      assert.equal(r.status, 200);
      assert.equal((await r.json()).profile.revision, 1);
    }
    const concurrent = await Promise.all(
      ["request-first", "request-second"].map((requestId) =>
        post({ type: "begin", revision: 1, requestId }),
      ),
    );
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    const reloaded = (await (await fetch(url)).json()).profile;
    assert.equal(reloaded.session.phase, "puzzle");
    assert.equal(reloaded.session.puzzle.line, undefined);
    const other = (
      await (await fetch(base + "/api/chess?player=explorer")).json()
    ).profile;
    assert.equal(other.revision, 0);
    assert.equal(other.session, null);
    assert.deepEqual(await readdir(join(data, "chess")), ["admin.json"]);
    assert.equal(
      JSON.parse(await readFile(join(data, "chess/admin.json"), "utf8"))
        .revision,
      2,
    );
  } finally {
    const ended = once(child, "exit");
    child.kill("SIGTERM");
    await ended;
  }
});
