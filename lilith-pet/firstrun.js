// First run for people who installed her (Lilith Setup.exe): find the game, and prepare her files from it.
// No game files ship with her: everything is read from the player's own copy (Steam), once, into ~/LilithRip.
const fs = require('fs'), path = require('path');
const { spawn, spawnSync } = require('child_process');

const GAME_DIR = 'The NOexistenceN of Lilith';
const isGame = (dir) => !!dir && fs.existsSync(path.join(dir, 'Lilith_Data', 'resources.assets'));

// Steam's libraryfolders.vdf: every library ("path" "D:\\SteamLibrary"), in any of its formats.
function libraryPaths(vdf) {
  return [...String(vdf).matchAll(/"path"\s+"([^"]+)"/g)].map((m) => m[1].replace(/\\\\/g, '\\'));
}
function steamRoots() {
  const roots = [];
  if (process.platform === 'win32') {
    for (const key of ['HKCU\\Software\\Valve\\Steam', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam']) {
      try {
        const out = spawnSync('reg', ['query', key], { encoding: 'utf8', windowsHide: true }).stdout || '';
        const m = /(?:SteamPath|InstallPath)\s+REG_SZ\s+(.+)/i.exec(out);
        if (m) roots.push(m[1].trim().replace(/\//g, '\\'));
      } catch {}
    }
    roots.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  } else roots.push(path.join(require('os').homedir(), '.steam', 'steam'), path.join(require('os').homedir(), '.local', 'share', 'Steam'));
  return [...new Set(roots)];
}
// The game's folder: LILITH_GAME, a folder you picked before, then every Steam library on this PC.
function findGame({ env = process.env, picked = null, roots = steamRoots() } = {}) {
  const tries = [env.LILITH_GAME, picked];
  for (const r of roots) {
    tries.push(path.join(r, 'steamapps', 'common', GAME_DIR));
    try { for (const lib of libraryPaths(fs.readFileSync(path.join(r, 'steamapps', 'libraryfolders.vdf'), 'utf8'))) tries.push(path.join(lib, 'steamapps', 'common', GAME_DIR)); } catch {}
  }
  return tries.find(isGame) || null;
}

const RIP_NEEDS = ['spine/Lilith.skel', 'spine/Lilith.atlas', 'spine/Lilith.png', 'spine/Lilith_31.png', 'dialogue/corpus.jsonl'];
const ripMissing = (rip) => RIP_NEEDS.filter((f) => !fs.existsSync(path.join(rip, f)));

// Python for the extractor: LILITH_PYTHON, the Windows launcher, then python / python3. -> [cmd, ...args] | null
function findPython(env = process.env) {
  const c = [env.LILITH_PYTHON && [env.LILITH_PYTHON], ['py', '-3'], ['python'], ['python3']].filter(Boolean);
  return c.find(([cmd, ...a]) => { try { return spawnSync(cmd, [...a, '--version'], { windowsHide: true }).status === 0; } catch { return false; } }) || null;
}
// Runs extract_lilith.py (installing UnityPy for this user if needed). onLine: its progress output.
function extract({ py, script, executable, game, rip, extraArgs = [], onLine = () => {} }) {
  const run = (args) => new Promise((resolve) => {
    const p = spawn(executable || py[0], [...(executable ? [] : py.slice(1)), ...args], { windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONUTF8: '1' } });
    const feed = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(onLine);
    p.stdout.on('data', feed); p.stderr.on('data', feed);
    p.on('error', (e) => { onLine(e.message); resolve(1); });
    p.on('close', (code) => resolve(code ?? 1));
  });
  return (async () => {
    if (!executable) {
      const has = spawnSync(py[0], [...py.slice(1), '-c', 'import UnityPy'], { windowsHide: true }).status === 0;
      if (!has && await run(['-m', 'pip', 'install', '--user', 'UnityPy==1.25.4']) !== 0) return 'pip';
    }
    if (await run([...(executable ? [] : ['-u', '-I', script]), game, rip, ...extraArgs]) !== 0) return 'extract';
    return ripMissing(rip).length ? 'incomplete' : null;
  })();
}

module.exports = { findGame, libraryPaths, ripMissing, findPython, extract, isGame, GAME_DIR };

if (require.main === module) {   // node firstrun.js: self-check
  const assert = require('assert'), os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lilith-steam-'));
  const steam = path.join(tmp, 'Steam'), lib = path.join(tmp, 'D', 'SteamLibrary');
  fs.mkdirSync(path.join(steam, 'steamapps'), { recursive: true });
  const game = path.join(lib, 'steamapps', 'common', GAME_DIR, 'Lilith_Data');
  fs.mkdirSync(game, { recursive: true }); fs.writeFileSync(path.join(game, 'resources.assets'), '');
  fs.writeFileSync(path.join(steam, 'steamapps', 'libraryfolders.vdf'),
    `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${steam.replace(/\\/g, '\\\\')}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${lib.replace(/\\/g, '\\\\')}"\n\t\t"apps" { "123" "1" }\n\t}\n}\n`);
  assert.deepStrictEqual(libraryPaths('"path"\t\t"D:\\\\SteamLibrary"'), ['D:\\SteamLibrary']);
  assert.strictEqual(findGame({ env: {}, roots: [steam] }), path.dirname(game), 'found in a second Steam library');
  assert.strictEqual(findGame({ env: {}, roots: [path.join(tmp, 'nope')] }), null);
  assert.strictEqual(findGame({ env: { LILITH_GAME: path.dirname(game) }, roots: [] }), path.dirname(game));
  assert.strictEqual(findGame({ env: {}, picked: path.dirname(game), roots: [] }), path.dirname(game));
  assert.deepStrictEqual(ripMissing(tmp), RIP_NEEDS);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('firstrun ok');
}
