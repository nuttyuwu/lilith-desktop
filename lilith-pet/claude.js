// Registers lilith-hook.js in ~/.claude/settings.json (merge-only, backup first, idempotent).
const fs = require('fs');
const path = require('path');
const os = require('os');

const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Notification', 'Stop'];
const MARK = 'lilith-hook.js';

function settingsPath(home = os.homedir()) { return path.join(home, '.claude', 'settings.json'); }

function load(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));   // throws on bad JSON -> caller leaves the file alone
}

function strip(settings) {
  const hooks = settings.hooks || {};
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    hooks[ev] = hooks[ev]
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
      .filter((g) => g.hooks.length);
    if (!hooks[ev].length) delete hooks[ev];
  }
  return settings;
}

function write(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && !fs.existsSync(file + '.lilith-bak')) fs.copyFileSync(file, file + '.lilith-bak');
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
  fs.renameSync(tmp, file);
}

// Hook commands are interpreted by a shell. Quoting preserves spaces, but these
// characters can still expand inside double quotes in Windows or POSIX shells.
function quotedHookPath(hookScript) {
  if (typeof hookScript !== 'string' || !hookScript || /[\x00-\x1f\x7f"%$`!]/.test(hookScript)) {
    throw new Error('Claude hook path contains unsupported shell characters. Use a path without quotes, control characters, %, $, ` or !.');
  }
  if (!path.isAbsolute(hookScript)) throw new Error('Claude hook path must be absolute.');
  return `"${hookScript.replace(/\\/g, '/')}"`;
}

// Portable applications are extracted into a temporary directory. Keep both
// hook modules in userData so Claude can still run the hook after Lilith quits.
function prepareHook(sourceDir, destinationDir) {
  const dir = path.resolve(destinationDir), script = path.join(dir, MARK);
  quotedHookPath(script);   // reject an unusable path before changing files
  const files = ['slim.js', MARK].map((name) => ({ name, data: fs.readFileSync(path.join(sourceDir, name)) }));
  fs.mkdirSync(dir, { recursive: true });
  for (const { name, data } of files) {
    const tmp = path.join(dir, `${name}.${process.pid}.${require('crypto').randomBytes(8).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(tmp, data, { flag: 'wx' });
      fs.renameSync(tmp, path.join(dir, name));
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
  return script;
}

// Always trim before transmission. A raw curl fallback would send file contents
// and other unwanted fields before the receiver could discard them.
function hookCommand(hookScript, { node = true, port = 47824 } = {}) {
  if (!node) throw new Error('Claude integration requires Node.js on PATH.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Claude hook port must be an integer from 1 to 65535.');
  return `node ${quotedHookPath(hookScript)} ${port}`;
}

function install(hookScript, home, opts) {
  const file = settingsPath(home);
  const s = strip(load(file));
  const command = hookCommand(hookScript, opts);
  s.hooks = s.hooks || {};
  for (const ev of EVENTS) {
    const group = { hooks: [{ type: 'command', command, timeout: 5 }] };
    if (ev === 'PreToolUse') group.matcher = '*';
    s.hooks[ev] = [...(s.hooks[ev] || []), group];
  }
  write(file, s);
  return file;
}

function uninstall(home) {
  const file = settingsPath(home);
  if (!fs.existsSync(file)) return file;
  write(file, strip(load(file)));
  return file;
}

module.exports = { install, uninstall, prepareHook, settingsPath, hookCommand, EVENTS };
