// Spotify: now playing + play/pause/next/prev through spotify.ps1 (Windows media session).
// One PowerShell run per call (~1 s). Resolves null when Spotify has no session or nothing has a title.
const { execFile, spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const ACTIONS = ['info', 'toggle', 'next', 'prev'];
function run(action) {
  if (process.platform !== 'win32' || !ACTIONS.includes(action)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'spotify.ps1'), action];
    execFile('powershell.exe', args, { windowsHide: true, timeout: 8000, encoding: 'utf8' }, (err, out) => {
      if (err) return resolve(null);
      try { const info = JSON.parse(out.trim() || '{}'); resolve(info.title ? info : null); }
      catch { resolve(null); }
    });
  });
}

// Long-running watcher: onChange({ playing, title, artist }) whenever Spotify's track or play state changes.
// Restarts itself a minute after PowerShell dies. Returns stop().
function watch(onChange, log = () => {}) {
  if (process.platform !== 'win32') return () => {};
  let ps = null, stopped = false, timer = null;
  const start = () => {
    ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'spotify.ps1'), 'watch', String(process.pid)], { windowsHide: true });
    ps.stdout.setEncoding('utf8');
    ps.on('error', (e) => log('spotify watch', e.message));
    ps.on('exit', () => { if (!stopped) timer = setTimeout(start, 60000); });
    readline.createInterface({ input: ps.stdout }).on('line', (line) => {
      let j; try { j = JSON.parse(line); } catch { return; }
      onChange({ playing: !!(j.playing && j.title), title: j.title || '', artist: j.artist || '' });
    });
  };
  start();
  return () => { stopped = true; clearTimeout(timer); ps?.kill(); };
}

module.exports = { nowPlaying: () => run('info'), control: (action) => run(action), watch };
