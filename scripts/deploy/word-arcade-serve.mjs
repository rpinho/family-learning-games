// Word Arcade production supervisor with configurable ports (mirrors word-arcade/scripts/serve.mjs,
// which hard-codes 4319/4320). Run with cwd = a Word Arcade release directory.
import {spawn} from 'node:child_process';
const root = process.cwd(), node = process.execPath, ui = process.env.ARCADE_UI_PORT || '4320', port = process.env.PORT || '4319';
const {PORT, ...uiEnv} = process.env;
let closing = false;
const children = [
  spawn(node, ['node_modules/vinext/dist/cli.js', 'start', '-p', ui, '-H', '127.0.0.1'], {cwd: root, stdio: 'inherit', env: uiEnv}),
  spawn(node, ['server.mjs'], {cwd: root, stdio: 'inherit', env: {...process.env, PORT: port, ARCADE_UI_PORT: ui}}),
];
function stop(code = 0) {if (closing) return; closing = true; for (const c of children) c.kill('SIGTERM'); setTimeout(() => process.exit(code), 1500);}
for (const c of children) {c.on('error', e => {console.error(e.message); stop(1);}); c.on('exit', () => stop(1));}
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => stop());
