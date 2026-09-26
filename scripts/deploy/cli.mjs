#!/usr/bin/env node
// Release / staging / idle-gated promotion tooling for a local family-games install.
// Private settings (paths, ports, service labels) live in
//   $FAMILY_DEPLOY_ROOT/deploy.json   (default ~/.local/share/family-games/deploy.json)
// Nothing here writes into a game's source tree. See DEPLOY.md.
import {spawnSync, spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, lstatSync, readlinkSync,
  symlinkSync, copyFileSync, rmSync, appendFileSync, realpathSync, constants as fsc} from 'node:fs';
import {join, dirname, resolve, basename} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import http from 'node:http';

const HOME = homedir();
const ROOT = resolve(process.env.FAMILY_DEPLOY_ROOT || join(HOME, '.local/share/family-games'));
const here = dirname(fileURLToPath(import.meta.url));
const exp = p => (typeof p === 'string' && p.startsWith('~/')) ? join(HOME, p.slice(2)) : p;
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy.json'), 'utf8'));
for (const g of Object.values(cfg.games)) {g.repo = exp(g.repo); g.data = exp(g.data);}
const NODE = exp(cfg.node), NODE_BIN = exp(cfg.nodeBin), PYTHON = exp(cfg.python), BACKUPS = exp(cfg.backups);
const UID = process.getuid();
const PATH_ENV = `${NODE_BIN}:${join(HOME, '.local/bin')}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`;
const LOG = join(ROOT, 'promotions.log');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

function die(msg) {console.error('error: ' + msg); process.exit(1);}
function log(line) {mkdirSync(ROOT, {recursive: true}); appendFileSync(LOG, `${now()} ${line}\n`); console.log(line);}
function game(name) {const g = cfg.games[name]; if (!g) die(`unknown game "${name}" (known: ${Object.keys(cfg.games).join(', ')})`); return g;}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 26, ...opts});
  if (r.error) throw r.error;
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${(r.stderr || '').slice(-2000)}`);
  return r;
}
// Every heavy step (build, npm, voice synthesis) runs at the lowest CPU + background I/O priority.
function heavy(cmd, args, opts = {}) {return run('nice', ['-n', '19', 'taskpolicy', '-b', cmd, ...args], {stdio: 'inherit', ...opts});}
function readJSON(file, fallback) {try {return JSON.parse(readFileSync(file, 'utf8'));} catch {return fallback;}}
function writeJSON(file, obj) {mkdirSync(dirname(file), {recursive: true}); const t = `${file}.tmp-${process.pid}`; writeFileSync(t, JSON.stringify(obj, null, 2) + '\n'); renameSync(t, file);}
function atomicSymlink(target, link) {mkdirSync(dirname(link), {recursive: true}); const t = `${link}.tmp-${process.pid}`; try {rmSync(t, {force: true});} catch {} symlinkSync(target, t); renameSync(t, link);}
function linkTarget(link) {try {return readlinkSync(link);} catch {return null;}}
function lock(name) {
  const dir = join(ROOT, name + '.lock');
  for (let i = 0; i < 2; i++) {
    try {mkdirSync(dir); writeFileSync(join(dir, 'pid'), String(process.pid)); return () => rmSync(dir, {recursive: true, force: true});}
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(readFileSync(join(dir, 'pid'), 'utf8').trim() || 0);
      let alive = false; try {if (pid) {process.kill(pid, 0); alive = true;}} catch {}
      if (alive) return null;
      rmSync(dir, {recursive: true, force: true});
    }
  }
  return null;
}

// ---------- paths ----------
const releaseDir = (name, version) => join(ROOT, 'releases', name, version);
const channelLink = (channel, name) => join(ROOT, channel, name);
const currentFile = channel => join(ROOT, channel, 'current.json');
const activityFile = channel => join(ROOT, channel, 'activity.json');
function dataDir(name, channel) {
  const ch = cfg.channels[channel]; if (!ch) die(`unknown channel ${channel}`);
  return ch.dataRoot ? join(exp(ch.dataRoot), name) : game(name).data;
}
const portFor = (name, channel) => game(name).port + cfg.channels[channel].portOffset;
const uiPortFor = (name, channel) => game(name).uiPort && game(name).uiPort + cfg.channels[channel].portOffset;
const labelFor = (name, channel) => cfg.channels[channel].labelPrefix + game(name).label;
const plistPath = label => join(HOME, 'Library/LaunchAgents', label + '.plist');
function currentVersion(channel, name) {const t = linkTarget(channelLink(channel, name)); return t ? basename(t) : null;}

// ---------- git ----------
function resolveRef(name, ref) {
  const g = game(name);
  if (!ref) ref = 'HEAD';
  if (ref === 'staging') {const v = currentVersion('staging', name); if (!v) die(`${name} has nothing on staging`); return {version: v, existing: true};}
  if (existsSync(releaseDir(name, ref))) return {version: ref, existing: true};
  const sha = run('git', ['-C', g.repo, 'rev-parse', '--verify', ref + '^{commit}']).stdout.trim();
  const when = run('git', ['-C', g.repo, 'show', '-s', '--format=%cd', '--date=format-local:%Y%m%d-%H%M%S', sha], {env: {...process.env, TZ: 'UTC'}}).stdout.trim();
  return {version: `${when}-${sha.slice(0, 7)}`, sha, existing: existsSync(releaseDir(name, `${when}-${sha.slice(0, 7)}`))};
}

// ---------- saves ----------
function saveFiles(name, dir) {
  const pats = game(name).saves || ['*.json'], out = [];
  for (const p of pats) {
    if (p === '*.json') {for (const f of safeList(dir)) if (f.endsWith('.json') && statSync(join(dir, f)).isFile()) out.push(f);}
    else if (p.endsWith('/**')) {const base = p.slice(0, -3); walk(join(dir, base), base, out);}
  }
  return [...new Set(out)].sort();
}
function walk(abs, rel, out) {for (const f of safeList(abs)) {const a = join(abs, f), r = join(rel, f), s = statSync(a); if (s.isDirectory()) walk(a, r, out); else if (s.isFile()) out.push(r);}}
function safeList(d) {try {return readdirSync(d);} catch {return [];}}
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function hashSaves(name, dir) {return Object.fromEntries(saveFiles(name, dir).map(f => [f, sha256(join(dir, f))]));}
function backupSaves(name, dir, tag, base) {
  const dest = join(base || join(BACKUPS, `${stamp()}-${tag}`), name);
  mkdirSync(dest, {recursive: true, mode: 0o700});
  const hashes = {};
  for (const f of saveFiles(name, dir)) {mkdirSync(dirname(join(dest, f)), {recursive: true}); copyFileSync(join(dir, f), join(dest, f)); hashes[f] = sha256(join(dest, f));}
  writeJSON(join(dest, 'SHA256SUMS.json'), hashes);
  return {dest, hashes};
}
function compareSaves(before, after) {
  const changed = [];
  for (const [f, h] of Object.entries(before)) if (after[f] !== h) changed.push(f + (after[f] ? ' (changed)' : ' (missing)'));
  return changed;
}

// ---------- activity / idle ----------
function lastActivity() {
  const times = {};
  const act = readJSON(activityFile('live'), {});
  for (const [k, v] of Object.entries(act)) {const t = Date.parse(v); if (t) times['request:' + k] = t;}
  for (const name of Object.keys(cfg.games)) {
    const dir = game(name).data;
    for (const f of saveFiles(name, dir)) {try {const t = statSync(join(dir, f)).mtimeMs; if (!times['save:' + name] || t > times['save:' + name]) times['save:' + name] = t;} catch {}}
  }
  let latest = 0, source = null;
  for (const [k, t] of Object.entries(times)) if (t > latest) {latest = t; source = k;}
  return {latest, source, times};
}
function inNight(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes(), [sh, sm] = cfg.nightStart.split(':').map(Number), [eh, em] = cfg.nightEnd.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return s > e ? (m >= s || m < e) : (m >= s && m < e);
}
function idleState() {
  const {latest, source} = lastActivity();
  const idleMin = latest ? (Date.now() - latest) / 60000 : Infinity, night = inNight();
  const ok = idleMin >= cfg.idleMinutes || (night && idleMin >= cfg.nightQuietMinutes);
  return {ok, idleMin, night, source, latest: latest ? new Date(latest).toISOString() : null};
}

// ---------- build ----------
async function build(name, ref, {voice = true} = {}) {
  const g = game(name), r = resolveRef(name, ref);
  if (r.existing) {console.log(`${name}: release ${r.version} already built`); return r.version;}
  const final = releaseDir(name, r.version), tmp = join(ROOT, 'releases', name, `.tmp-${r.version}-${process.pid}`);
  mkdirSync(tmp, {recursive: true});
  try {
    console.log(`${name}: exporting ${r.sha.slice(0, 7)} -> ${tmp}`);
    const tar = spawnSync('/bin/sh', ['-c', `git -C "$1" archive --format=tar "$2" | tar -x -C "$3"`, 'sh', g.repo, r.sha, tmp], {stdio: 'inherit'});
    if (tar.status !== 0) throw new Error('git archive failed');
    if (g.deps) {
      const lockA = join(tmp, 'package-lock.json'), lockB = join(g.repo, 'package-lock.json');
      const same = existsSync(lockA) && existsSync(lockB) && sha256(lockA) === sha256(lockB) && existsSync(join(g.repo, 'node_modules'));
      if (same) {console.log(`${name}: cloning node_modules (APFS copy-on-write)`); heavy('cp', ['-cR', join(g.repo, 'node_modules'), join(tmp, 'node_modules')]);}
      else {console.log(`${name}: npm ci`); heavy(join(NODE_BIN, 'npm'), ['ci', '--no-audit', '--no-fund'], {cwd: tmp, env: {...process.env, PATH: PATH_ENV}});}
    }
    if (g.build) {console.log(`${name}: ${g.build.join(' ')}`); heavy(g.build[0] === 'npm' ? join(NODE_BIN, 'npm') : g.build[0], g.build.slice(1), {cwd: tmp, env: {...process.env, PATH: PATH_ENV, NODE_ENV: 'production'}});}
    const meta = {game: name, version: r.version, commit: r.sha, ref: ref || 'HEAD', repo: g.repo, builtAt: now(), voice: null};
    if (g.voice) meta.voice = voice ? buildVoice(name, tmp) : declareLiveVoice(name, tmp);
    writeJSON(join(tmp, '.release.json'), meta);
    if (existsSync(final)) {rmSync(tmp, {recursive: true, force: true}); return r.version;}
    renameSync(tmp, final);
    log(`BUILT ${name} ${r.version}`);
    return r.version;
  } catch (e) {rmSync(tmp, {recursive: true, force: true}); throw e;}
}
const clipNames = obj => [...new Set((JSON.stringify(obj).match(/[a-f0-9]{16}\.wav/g) || []))];
// Run the release's own voice script against a copy-on-write clone of the live clip store,
// so only missing clips are synthesized. New clips + manifest are stored IN the release.
function buildVoice(name, rel) {
  const g = game(name), work = join(ROOT, 'tmp', `voice-${name}-${process.pid}`);
  rmSync(work, {recursive: true, force: true}); mkdirSync(work, {recursive: true});
  try {
    for (const d of g.voice.dirs) {if (existsSync(join(g.data, d))) heavy('cp', ['-cR', join(g.data, d), join(work, d)]); else mkdirSync(join(work, d));}
    for (const l of g.voice.links || []) symlinkSync(join(g.data, l), join(work, l));
    console.log(`${name}: voice script (only missing clips are synthesized)`);
    heavy(PYTHON, [g.voice.script], {cwd: rel, env: {...process.env, PATH: PATH_ENV, [g.dataEnv]: work}});
    const out = {dirs: {}};
    for (const d of g.voice.dirs) {
      const store = join(rel, '.release', 'voice', d); mkdirSync(store, {recursive: true});
      const manifest = readJSON(join(work, d, 'manifest.json'), null);
      if (!manifest) throw new Error(`voice script produced no ${d}/manifest.json`);
      copyFileSync(join(work, d, 'manifest.json'), join(store, 'manifest.json'));
      const liveNames = new Set(safeList(join(g.data, d))), required = clipNames(manifest); let added = 0;
      for (const c of required) if (!liveNames.has(c)) {if (!existsSync(join(work, d, c))) throw new Error(`clip ${c} missing after voice build`); copyFileSync(join(work, d, c), join(store, c)); added++;}
      out.dirs[d] = {required: required.length, newClips: added};
      console.log(`${name}: ${d}: ${required.length} clips declared, ${added} new`);
    }
    return out;
  } finally {rmSync(work, {recursive: true, force: true});}
}
function declareLiveVoice(name, rel) {
  const g = game(name), out = {dirs: {}, declaredFromLive: true};
  for (const d of g.voice.dirs) {
    const store = join(rel, '.release', 'voice', d); mkdirSync(store, {recursive: true});
    if (existsSync(join(g.data, d, 'manifest.json'))) copyFileSync(join(g.data, d, 'manifest.json'), join(store, 'manifest.json'));
    out.dirs[d] = {required: clipNames(readJSON(join(store, 'manifest.json'), {})).length, newClips: 0};
  }
  return out;
}
// Additive: copies only clips that do not exist yet; never overwrites or deletes a clip.
function applyVoice(name, version, data, {dryRun = false} = {}) {
  const g = game(name), rel = releaseDir(name, version), res = [];
  if (!g.voice) return res;
  for (const d of g.voice.dirs) {
    const store = join(rel, '.release', 'voice', d), manifestFile = join(store, 'manifest.json');
    if (!existsSync(manifestFile)) continue;
    const target = join(data, d); if (!dryRun) mkdirSync(target, {recursive: true});
    const missing = [];
    for (const c of clipNames(readJSON(manifestFile, {}))) {
      if (existsSync(join(target, c))) continue;
      if (!existsSync(join(store, c))) {missing.push(c); continue;}
      if (!dryRun) copyFileSync(join(store, c), join(target, c), fsc.COPYFILE_EXCL);
    }
    if (missing.length) throw new Error(`${name}: ${missing.length} declared voice clips exist neither in ${target} nor in the release (e.g. ${missing[0]})`);
    let previous = null;
    if (!dryRun) {
      if (existsSync(join(target, 'manifest.json'))) previous = readFileSync(join(target, 'manifest.json'));
      const t = join(target, `manifest.json.tmp-${process.pid}`); copyFileSync(manifestFile, t); renameSync(t, join(target, 'manifest.json'));
    }
    res.push({dir: d, previous});
  }
  return res;
}
function restoreVoiceManifests(name, data, saved) {
  for (const s of saved) if (s.previous) {const t = join(data, s.dir, `manifest.json.tmp-${process.pid}`); writeFileSync(t, s.previous); renameSync(t, join(data, s.dir, 'manifest.json'));}
}

// ---------- processes ----------
function envFor(name, channel, {port, uiPort, data, deployDir} = {}) {
  const g = game(name);
  data ||= dataDir(name, channel);
  const env = {PATH: PATH_ENV, HOME, PORT: String(port || portFor(name, channel)), [g.dataEnv]: data,
    LETTER_QUEST_DATA: name === 'letter-quest' ? data : dataDir('letter-quest', channel === 'check' ? 'live' : channel),
    FAMILY_CHANNEL: channel, FAMILY_DEPLOY_DIR: deployDir || join(ROOT, channel)};
  if (g.uiPort) env.ARCADE_UI_PORT = String(uiPort || uiPortFor(name, channel));
  for (const [k, v] of Object.entries(g.env || {})) env[k] = String(v).replace('{data}', data);
  return env;
}
function programFor(name) {
  const g = game(name);
  if (g.supervisor === 'word-arcade') return [NODE, join(ROOT, 'bin', 'word-arcade-serve.mjs')];
  return [NODE, g.main];
}
function healthPaths(name) {const g = game(name); return g.health || ['/', ...(g.voice ? ['/voice/manifest.json'] : [])];}
function get(port, path, timeout = 4000) {
  return new Promise(res => {
    const req = http.get({host: '127.0.0.1', port, path, timeout, headers: {'user-agent': 'family-games-deploy-health'}}, r => {r.resume(); r.on('end', () => res(r.statusCode));});
    req.on('timeout', () => {req.destroy(); res(0);}); req.on('error', () => res(0));
  });
}
async function health(name, port, timeoutSec = 30) {
  const deadline = Date.now() + timeoutSec * 1000; let last = {};
  while (Date.now() < deadline) {
    last = {};
    for (const p of healthPaths(name)) last[p] = await get(port, p);
    if (Object.values(last).every(s => s === 200)) return {ok: true, statuses: last};
    await sleep(1000);
  }
  return {ok: false, statuses: last};
}
function listenerPid(port) {const r = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {allowFail: true}); return Number((r.stdout || '').trim().split('\n')[0]) || null;}
function pidCwd(pid) {const r = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {allowFail: true}); return (r.stdout.split('\n').find(l => l.startsWith('n')) || '').slice(1);}
async function waitPortFree(port, sec = 25) {const d = Date.now() + sec * 1000; while (Date.now() < d) {if (!listenerPid(port)) return true; await sleep(500);} return false;}

// Start a release on the check ports with a copy-on-write clone of the live data; then stop it.
async function check(name, version) {
  const g = game(name), rel = releaseDir(name, version), work = join(ROOT, 'tmp', `check-${name}-${process.pid}`);
  const port = g.port + cfg.checkPortOffset, uiPort = g.uiPort && g.uiPort + cfg.checkPortOffset;
  if (listenerPid(port) || (uiPort && listenerPid(uiPort))) throw new Error(`check port ${port} busy`);
  rmSync(work, {recursive: true, force: true}); mkdirSync(work, {recursive: true});
  const data = join(work, 'data');
  heavy('cp', ['-cR', g.data, data]);
  let child;
  try {
    applyVoice(name, version, data);
    let env = envFor(name, 'check', {port, uiPort, data, deployDir: join(work, 'deploy')});
    if (name === 'hub') {
      const conf = readJSON(join(g.data, 'config.json'), {});
      for (const k of Object.keys(conf.games || {})) conf.games[k] = cfg.games[k].port + cfg.channels.staging.portOffset;
      conf.gameData = Object.fromEntries(Object.keys(conf.games || {}).map(k => [k, dataDir(k, 'staging')]));
      writeJSON(join(data, 'config.json'), conf);
      env.FAMILY_CONFIG = join(data, 'config.json');
    }
    const [cmd, ...args] = programFor(name);
    child = spawn(cmd, args, {cwd: join(rel, g.cwd || ''), env, detached: true, stdio: ['ignore', 'ignore', 'pipe']});
    let err = ''; child.stderr.on('data', b => {err = (err + b).slice(-3000);});
    const h = await health(name, port, g.startTimeout || 40);
    if (!h.ok) throw new Error(`${name} ${version} failed its health check on :${port} ${JSON.stringify(h.statuses)}\n${err}`);
    console.log(`${name}: ${version} healthy on check port ${port} ${JSON.stringify(h.statuses)}`);
    return h;
  } finally {
    if (child?.pid) {try {process.kill(-child.pid, 'SIGTERM');} catch {} await sleep(1500); try {process.kill(-child.pid, 'SIGKILL');} catch {}}
    await waitPortFree(port, 10);
    rmSync(work, {recursive: true, force: true});
  }
}

// ---------- launchd ----------
function plistFor(name, channel) {
  const g = game(name), label = labelFor(name, channel), data = dataDir(name, channel);
  const obj = {Label: label, ProgramArguments: programFor(name), WorkingDirectory: join(channelLink(channel, name), g.cwd || ''),
    EnvironmentVariables: envFor(name, channel), RunAtLoad: true, KeepAlive: true,
    StandardOutPath: join(data, 'server.log'), StandardErrorPath: join(data, 'server-error.log')};
  if (g.throttle) obj.ThrottleInterval = g.throttle;
  if (channel === 'staging') {obj.ProcessType = 'Background'; obj.Nice = 10; obj.LowPriorityIO = true;}
  return {label, obj};
}
function writePlist(file, obj) {const t = `${file}.json-${process.pid}`; writeFileSync(t, JSON.stringify(obj)); run('plutil', ['-convert', 'xml1', '-o', file, t]); rmSync(t);}
const loaded = label => run('launchctl', ['print', `gui/${UID}/${label}`], {allowFail: true}).status === 0;
async function bootstrap(file, label) {
  for (let i = 0; i < 20; i++) {const r = run('launchctl', ['bootstrap', `gui/${UID}`, file], {allowFail: true}); if (r.status === 0 || loaded(label)) return; await sleep(500);}
  throw new Error(`launchctl bootstrap ${label} failed`);
}
function bootout(label) {if (loaded(label)) run('launchctl', ['bootout', `gui/${UID}/${label}`], {allowFail: true});}
const kickstart = label => run('launchctl', ['kickstart', '-k', `gui/${UID}/${label}`]);
async function verifyServing(name, channel, version) {
  const port = portFor(name, channel), h = await health(name, port, game(name).startTimeout || 40);
  if (!h.ok) return {ok: false, why: `health ${JSON.stringify(h.statuses)}`};
  const pid = listenerPid(port), cwd = pid && pidCwd(pid), want = realpathSync(join(releaseDir(name, version), game(name).cwd || ''));
  if (cwd !== want) return {ok: false, why: `listener pid ${pid} cwd ${cwd} is not ${want}`};
  return {ok: true, statuses: h.statuses};
}
function setCurrent(channel, name, version) {const c = readJSON(currentFile(channel), {}); c[name] = version; c.updatedAt = now(); writeJSON(currentFile(channel), c);}

// ---------- staging ----------
function stagingHubConfig() {
  const conf = readJSON(join(game('hub').data, 'config.json'), {});
  for (const k of Object.keys(conf.games || {})) conf.games[k] = portFor(k, 'staging');
  conf.gameData = Object.fromEntries(Object.keys(conf.games || {}).map(k => [k, dataDir(k, 'staging')]));
  writeJSON(join(dataDir('hub', 'staging'), 'config.json'), conf);
}
function refreshStagingData(name) {
  const g = game(name), src = g.data, dst = dataDir(name, 'staging');
  if (!existsSync(dst)) {
    mkdirSync(dirname(dst), {recursive: true});
    heavy('cp', ['-cR', src, dst]);
    for (const f of ['server.log', 'server-error.log']) rmSync(join(dst, f), {force: true});
  } else {
    for (const f of saveFiles(name, src)) {mkdirSync(dirname(join(dst, f)), {recursive: true}); copyFileSync(join(src, f), join(dst, f));}
    for (const d of g.voice?.dirs || []) for (const c of safeList(join(src, d))) if (/^[a-f0-9]{16}\.wav$/.test(c) && !existsSync(join(dst, d, c))) copyFileSync(join(src, d, c), join(dst, d, c));
  }
  if (name === 'hub') stagingHubConfig();
  console.log(`staging data for ${name} refreshed from live saves`);
}
async function stage(name, ref, opts) {
  const version = await build(name, ref, opts);
  const release = lock('staging'); if (!release) die('another staging deploy is running; retry in a minute');
  try {
    if (!existsSync(dataDir(name, 'staging'))) refreshStagingData(name);
    if (name === 'hub') stagingHubConfig();
    applyVoice(name, version, dataDir(name, 'staging'));
    const previous = currentVersion('staging', name);
    atomicSymlink(releaseDir(name, version), channelLink('staging', name));
    const {label, obj} = plistFor(name, 'staging'), file = plistPath(label);
    writePlist(file, obj);
    if (loaded(label)) kickstart(label); else await bootstrap(file, label);
    const v = await verifyServing(name, 'staging', version);
    if (!v.ok) {log(`STAGING-FAILED ${name} ${version} ${v.why} (previous ${previous})`); throw new Error(`staging ${name} ${version} unhealthy: ${v.why}`);}
    setCurrent('staging', name, version);
    log(`STAGED ${name} ${version}`);
    console.log(`\nStaging: http://${cfg.lanHost || 'localhost'}:${portFor('hub', 'staging')}  (${name} -> ${version})`);
  } finally {release();}
}

// ---------- promotion ----------
async function promote(name, ref, opts) {
  const version = await build(name, ref, opts);
  await check(name, version);
  applyVoice(name, version, game(name).data, {dryRun: true});
  const q = {game: name, version, queuedAt: now(), by: process.env.USER || 'agent'};
  writeJSON(join(ROOT, 'queue', name + '.json'), q);
  log(`QUEUED ${name} ${version}`);
  const s = idleState();
  console.log(`\nQueued ${name} ${version}. It goes live automatically when every game has been idle ${cfg.idleMinutes} min, or between ${cfg.nightStart} and ${cfg.nightEnd}.`);
  console.log(`Now: last activity ${s.latest || 'none'} (${s.source || '-'}), idle ${s.idleMin.toFixed(1)} min${s.night ? ', night window' : ''}.`);
}
async function applyLive(name, version, why = 'PROMOTED') {
  const g = game(name), label = labelFor(name, 'live'), link = channelLink('live', name), previous = currentVersion('live', name);
  if (!existsSync(releaseDir(name, version))) throw new Error(`release ${name}/${version} missing`);
  if (previous === version) {log(`SKIP ${name} ${version} already live`); return true;}
  const {dest, hashes} = backupSaves(name, g.data, `promote-${name}-${version}`);
  const voice = applyVoice(name, version, g.data);
  atomicSymlink(releaseDir(name, version), link);
  kickstart(label);
  const v = await verifyServing(name, 'live', version);
  if (!v.ok) {
    log(`FAILED ${name} ${version}: ${v.why}; rolling back to ${previous}`);
    if (previous) atomicSymlink(releaseDir(name, previous), link);
    restoreVoiceManifests(name, g.data, voice);
    kickstart(label);
    const back = previous ? await verifyServing(name, 'live', previous) : {ok: false, why: 'no previous release'};
    log(`ROLLBACK ${name} -> ${previous}: ${back.ok ? 'healthy' : 'UNHEALTHY ' + back.why}`);
    return false;
  }
  setCurrent('live', name, version);
  const changed = compareSaves(hashes, hashSaves(name, g.data));
  log(`${why} ${name} ${previous || '-'} -> ${version}; health ${JSON.stringify(v.statuses)}; saves ${changed.length ? 'CHANGED during promotion: ' + changed.join(', ') : 'byte-identical (' + Object.keys(hashes).length + ' files)'}; backup ${dest}`);
  return true;
}
async function tick() {
  const release = lock('live'); if (!release) return;
  try {
    const statusFile = join(ROOT, 'promoter-status.json');
    const cut = readJSON(join(ROOT, 'cutover.json'), null);
    const queued = safeList(join(ROOT, 'queue')).filter(f => f.endsWith('.json')).map(f => readJSON(join(ROOT, 'queue', f), null)).filter(Boolean);
    const pendingCut = cut && cut.state === 'pending';
    if (!pendingCut && !queued.length) {writeJSON(statusFile, {at: now(), queue: [], idle: null}); return;}
    const s = idleState();
    writeJSON(statusFile, {at: now(), cutover: pendingCut ? cut.versions : null, queue: queued.map(q => `${q.game}@${q.version}`), idle: s});
    if (!s.ok) return;
    if (pendingCut) {await cutover(cut); return;}
    if (!existsSync(join(ROOT, 'cutover.json')) || cut.state !== 'done') return;
    const order = cfg.order;
    queued.sort((a, b) => order.indexOf(a.game) - order.indexOf(b.game));
    for (const q of queued) {
      if (!idleState().ok) break;
      const qf = join(ROOT, 'queue', q.game + '.json');
      if (readJSON(qf, {}).version !== q.version) continue;
      let ok = false;
      try {ok = await applyLive(q.game, q.version);} catch (e) {log(`FAILED ${q.game} ${q.version}: ${e.message}`);}
      if (readJSON(qf, {}).version === q.version) {
        if (ok) rmSync(qf, {force: true});
        else {mkdirSync(join(ROOT, 'queue', 'failed'), {recursive: true}); renameSync(qf, join(ROOT, 'queue', 'failed', `${q.game}-${q.version}.json`));}
      }
    }
  } finally {release();}
}

// ---------- cutover from dev-tree services to release services ----------
async function prepareCutover(refs) {
  const versions = {};
  for (const name of cfg.order) {
    const v = await build(name, refs[name] || 'HEAD');
    await check(name, v);
    applyVoice(name, v, game(name).data, {dryRun: true});
    versions[name] = v;
  }
  writeJSON(join(ROOT, 'cutover.json'), {state: 'pending', preparedAt: now(), versions});
  log(`CUTOVER-QUEUED ${JSON.stringify(versions)}`);
}
async function cutover(cut) {
  const tag = `cutover-${stamp()}`, backupDir = join(BACKUPS, tag);
  mkdirSync(join(backupDir, 'plists'), {recursive: true, mode: 0o700});
  log(`CUTOVER-START backups in ${backupDir}`);
  const hashes = {};
  for (const name of cfg.order) {
    const label = labelFor(name, 'live');
    if (existsSync(plistPath(label))) copyFileSync(plistPath(label), join(backupDir, 'plists', label + '.plist'));
    const b = backupSaves(name, game(name).data, null, join(backupDir, 'saves')); hashes[name] = b.hashes;
  }
  writeJSON(join(backupDir, 'README.json'), {what: 'Pre-cutover launchd plists (services ran from ~/dev trees). To undo: node scripts/deploy/cli.mjs uncutover ' + backupDir, at: now()});
  cut.backup = backupDir; cut.results = {}; cut.state = 'running'; writeJSON(join(ROOT, 'cutover.json'), cut);
  for (const name of cfg.order) {
    if (!idleState().ok && !inNight()) {log(`CUTOVER-PAUSED before ${name}: activity resumed`); cut.state = 'pending'; writeJSON(join(ROOT, 'cutover.json'), cut); return;}
    const g = game(name), version = cut.versions[name], label = labelFor(name, 'live'), file = plistPath(label);
    if (currentVersion('live', name) === version && cut.results[name] === 'ok') continue;
    try {
      const voice = applyVoice(name, version, g.data);
      atomicSymlink(releaseDir(name, version), channelLink('live', name));
      const {obj} = plistFor(name, 'live');
      bootout(label); await waitPortFree(g.port, 25); if (g.uiPort) await waitPortFree(g.uiPort, 25);
      writePlist(file, obj); await bootstrap(file, label);
      const v = await verifyServing(name, 'live', version);
      if (!v.ok) {
        log(`CUTOVER-FAILED ${name}: ${v.why}; restoring the old plist`);
        restoreVoiceManifests(name, g.data, voice);
        bootout(label); await waitPortFree(g.port, 25);
        copyFileSync(join(backupDir, 'plists', label + '.plist'), file); await bootstrap(file, label);
        const back = await health(name, g.port, 60);
        log(`CUTOVER-REVERTED ${name}: old service ${back.ok ? 'healthy' : 'UNHEALTHY'}`);
        rmSync(channelLink('live', name), {force: true});
        cut.results[name] = 'reverted'; continue;
      }
      setCurrent('live', name, version);
      const changed = compareSaves(hashes[name], hashSaves(name, g.data));
      cut.results[name] = 'ok';
      log(`CUTOVER ${name} -> ${version}; health ${JSON.stringify(v.statuses)}; saves ${changed.length ? 'CHANGED: ' + changed.join(', ') : 'byte-identical'}`);
    } catch (e) {cut.results[name] = 'error: ' + e.message; log(`CUTOVER-ERROR ${name}: ${e.message}`);}
    writeJSON(join(ROOT, 'cutover.json'), cut);
  }
  cut.state = Object.values(cut.results).every(r => r === 'ok') ? 'done' : 'partial';
  cut.finishedAt = now(); writeJSON(join(ROOT, 'cutover.json'), cut);
  log(`CUTOVER-${cut.state.toUpperCase()} ${JSON.stringify(cut.results)}`);
  if (cut.state === 'done') {try {run('launchctl', ['bootout', `gui/${UID}/${cfg.cutoverLabel || 'local.family-games-cutover'}`], {allowFail: true});} catch {}}
}
async function uncutover(backupDir) {
  const release = lock('live'); if (!release) die('live lock busy');
  try {
    for (const f of safeList(join(backupDir, 'plists'))) {
      const label = f.replace(/\.plist$/, ''), name = Object.keys(cfg.games).find(n => labelFor(n, 'live') === label);
      bootout(label); if (name) await waitPortFree(game(name).port, 25);
      copyFileSync(join(backupDir, 'plists', f), plistPath(label)); await bootstrap(plistPath(label), label);
      log(`UNCUTOVER ${label} restored from ${backupDir}`);
    }
    const cut = readJSON(join(ROOT, 'cutover.json'), {}); cut.state = 'reverted'; writeJSON(join(ROOT, 'cutover.json'), cut);
  } finally {release();}
}

// ---------- misc ----------
function install() {
  mkdirSync(join(ROOT, 'bin'), {recursive: true});
  for (const f of ['cli.mjs', 'word-arcade-serve.mjs']) copyFileSync(join(here, f), join(ROOT, 'bin', f));
  const label = cfg.promoterLabel || 'local.family-games-promoter', file = plistPath(label);
  writePlist(file, {Label: label, ProgramArguments: [NODE, join(ROOT, 'bin', 'cli.mjs'), 'tick'], StartInterval: 60, RunAtLoad: true,
    ProcessType: 'Background', LowPriorityIO: true, EnvironmentVariables: {PATH: PATH_ENV, HOME},
    StandardOutPath: join(ROOT, 'logs', 'promoter.log'), StandardErrorPath: join(ROOT, 'logs', 'promoter-error.log')});
  console.log(`tooling installed in ${join(ROOT, 'bin')}; promoter plist ${file}`);
  return {label, file};
}
function status() {
  const s = idleState(), cut = readJSON(join(ROOT, 'cutover.json'), null);
  console.log(`idle: ${s.idleMin === Infinity ? 'no activity recorded' : s.idleMin.toFixed(1) + ' min'} (last ${s.latest || '-'} via ${s.source || '-'}); night window: ${s.night}; promotion allowed now: ${s.ok}`);
  console.log(`cutover: ${cut ? cut.state + (cut.finishedAt ? ' at ' + cut.finishedAt : '') : 'not prepared'}`);
  for (const name of cfg.order) {
    const q = readJSON(join(ROOT, 'queue', name + '.json'), null);
    console.log(`${name.padEnd(15)} live ${String(currentVersion('live', name) || '(dev tree)').padEnd(24)} staging ${String(currentVersion('staging', name) || '-').padEnd(24)}${q ? ' queued ' + q.version : ''}`);
  }
  console.log(`staging hub: http://${cfg.lanHost || 'localhost'}:${portFor('hub', 'staging')}`);
}

const [cmd, ...args] = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--'))), pos = args.filter(a => !a.startsWith('--'));
const opts = {voice: !flags.has('--no-voice')};
const usage = `usage: cli.mjs <command>
  build <game> [ref]            build an immutable release (no deploy)
  stage <game|all> [ref]        build + deploy to STAGING (safe any time)
  promote <game> [ref|staging]  build + health-check + QUEUE for live (idle-gated)
  status                        versions, queue, idle state
  staging-refresh <game|all>    copy live saves into staging data
  rollback <game> [--now]       queue (or with --now apply immediately) the previous live release
  tick                          promoter step (launchd, every minute)
  install                       install tooling copy + promoter plist
  prepare-cutover               build+check HEAD of every game and queue the one-time cutover
  uncutover <backupDir>         restore the pre-cutover plists`;
try {
  if (cmd === 'build') console.log(await build(pos[0] && game(pos[0]) && pos[0], pos[1], opts));
  else if (cmd === 'stage') {for (const n of pos[0] === 'all' ? cfg.order : [pos[0]]) {game(n); await stage(n, pos[0] === 'all' ? 'HEAD' : pos[1], opts);}}
  else if (cmd === 'promote') {if (!pos[0]) die(usage); game(pos[0]); await promote(pos[0], pos[1], opts);}
  else if (cmd === 'status') status();
  else if (cmd === 'staging-refresh') {for (const n of pos[0] === 'all' ? cfg.order : [pos[0]]) {game(n); refreshStagingData(n);}}
  else if (cmd === 'rollback') {
    const name = pos[0]; game(name);
    const hist = readFileSync(LOG, 'utf8').split('\n').map(l => l.match(new RegExp(`^\\S+ (?:PROMOTED|CUTOVER|ROLLED-BACK) ${name} (?:\\S+ -> )?(\\S+?);`))).filter(Boolean).map(m => m[1]);
    const cur = currentVersion('live', name), prev = [...hist].reverse().find(v => v !== cur);
    if (!prev) die(`no previous live release recorded for ${name}`);
    if (flags.has('--now')) {const r = lock('live'); if (!r) die('live lock busy'); try {await applyLive(name, prev, 'ROLLED-BACK');} finally {r();}}
    else {writeJSON(join(ROOT, 'queue', name + '.json'), {game: name, version: prev, queuedAt: now(), by: 'rollback'}); log(`QUEUED ${name} ${prev} (rollback)`);}
  }
  else if (cmd === 'tick') await tick();
  else if (cmd === 'install') install();
  else if (cmd === 'prepare-cutover') await prepareCutover(Object.fromEntries(pos.map(p => p.split('='))));
  else if (cmd === 'uncutover') await uncutover(pos[0]);
  else {console.log(usage); process.exit(cmd ? 1 : 0);}
} catch (e) {console.error('error: ' + e.message); process.exit(1);}
