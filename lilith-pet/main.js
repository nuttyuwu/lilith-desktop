// Desktop-pet shell modelled on the game's TransparentWindowNew: transparent, topmost,
// click-through everywhere except over Lilith's opaque pixels.
// + Claude Code hook receiver (like Capri) on 127.0.0.1:47824, + Ollama chat.
const { app, BrowserWindow, ipcMain, screen, protocol, net, Tray, Menu, nativeImage, dialog, globalShortcut, shell, clipboard, powerMonitor } = require('electron');
const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { pathToFileURL } = require('url');
const claude = require('./claude');
const ollama = require('./ollama');
const settings = require('./settings');
const profile = require('./profile');
const spotify = require('./spotify');
const { appKind, isPrivate, appName } = require('./apps');
const { makeDay } = require('./day');
const { slim } = require('./slim');   // was missing: every media button threw 'spotify is not defined'
const i18n = require('./i18n');

const RIP = process.env.LILITH_RIP || path.join(os.homedir(), 'LilithRip');
const firstrun = require('./firstrun');
let GAME = null;   // the player's copy of the game (firstrun.findGame: LILITH_GAME, a folder they picked, any Steam library)
const PORT = Number(process.env.LILITH_PORT) || 47824;
const LOG = path.join(RIP, 'lilith-pet.log');
try { fs.mkdirSync(RIP, { recursive: true }); } catch {}   // first run: the log lives there before anything is extracted
const stab = require('./stability');
const log = stab.makeLogger(LOG);   // capped at 1 MB (one .old copy); log.once() writes a repeating message once a minute
// A desktop pet must not die (or pop Electron's crash dialog) over one bad event: log it and carry on.
process.on('uncaughtException', (e) => log('uncaught', e?.stack || e));
process.on('unhandledRejection', (e) => log('unhandled rejection', e?.stack || e));
const SETTINGS = path.join(app.getPath('userData'), 'settings.json');
let cfg = settings.load(SETTINGS);
if (!cfg.since) { try { cfg.since = Math.round(fs.statSync(SETTINGS).birthtimeMs) || Date.now(); } catch { cfg.since = Date.now(); } }   // her days together count from here
const T = (k, v) => i18n.t('en', k, v);   // menus, dialogs and notices are always English; only her lines and voice follow the language
const langName = (t) => (settings.LANGS.find((l) => l[0] === t) || settings.LANGS[0])[1];
const saveCfg = () => { try { settings.save(SETTINGS, cfg); } catch (e) { log('settings save', e.message); } };
const fatal = (msg) => { log('FATAL', msg); dialog.showErrorBox('Lilith', msg); };
// Tests only (LILITH_E2E=1, tests/e2e_stab.js): click tray items by label from the inspector, and record the error box
// instead of showing it (a modal box would block a headless run).
if (process.env.LILITH_E2E) {
  dialog.showErrorBox = (_t, m) => log('E2E error box:', m);
  dialog.showMessageBox = async (a, b) => { log('E2E message box:', (b || a).message, '->', (b || a).buttons?.[0]); return { response: 0 }; };   // first button
  const find = (items, label) => { for (const i of items || []) { if (i.label === label) return i; const s = find(i.submenu?.items, label); if (s) return s; } return null; };
  global.__e2e = { tray: (label) => { const i = find(trayMenu?.items, label); if (!i) return false; i.click(); return true; }, clipboard: () => clipboard.readText(),
    fg: (v) => onForeground(v), power: (ev) => powerMonitor.emit(ev), untuck: () => setTucked(false), state: () => ({ tucked, autoTucked, fullDismissed }) };
}

// One origin (lilith://app) for page + assets: WebGL refuses cross-origin textures, which kept her invisible.
protocol.registerSchemesAsPrivileged([{ scheme: 'lilith', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

let hookOnState = false, outfit = 'casual', tucked = false, fallTimer = null, demoOn = false, demoNormal = null;
let win, tray, dragTimer = null, model = null, history = [], persona = '', chatAbort = null;
let tuckMoveTimer = null;
let floorDrop = 0, tuckCx = Infinity;   // tuckCx: her centre x when she tucked (which edge); floorDrop: px the window hangs below the floor while she lies there ('sit' with floor=true)
let wins = [], perch = null, ollamaUp = null, lastReply = '', lastCwd = '';
let size = { w: 0, h: 0 };   // the size we asked for; moves re-assert it (Windows grows windows moved with setPosition at 125%/150% scaling)

const isAppOrigin = (url) => url.protocol === 'lilith:' && url.host === 'app' && !url.username && !url.password;
function isPetPage(value) {
  try { const url = new URL(value); return isAppOrigin(url) && url.pathname === '/index.html'; }
  catch { return false; }
}
function isPetSender(event) {
  if (!win || win.isDestroyed() || event.sender !== win.webContents || event.sender.isDestroyed()) return false;
  const frame = event.senderFrame;
  return !!frame && frame === win.webContents.mainFrame && isPetPage(frame.url);
}
// Every bridge message is limited to the current pet page's main frame. Other
// windows, subframes and a renderer that has navigated away get no native powers.
function onPet(channel, listener) {
  ipcMain.on(channel, (event, ...args) => { if (isPetSender(event)) return listener(event, ...args); });
}
function handlePet(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isPetSender(event)) throw new Error('Untrusted IPC sender');
    return listener(event, ...args);
  });
}
function isWithin(root, file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function serve(req) {
  let url, rel;
  try { url = new URL(req.url); rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); }
  catch { return new Response('bad request', { status: 400 }); }
  if (!isAppOrigin(url) || /[\\:\x00-\x1f]/.test(rel)) return new Response('forbidden', { status: 403 });
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
  const [base, sub] = rel.startsWith('rip/') ? [RIP, rel.slice(4)] : [__dirname, rel];
  const root = path.resolve(base), full = path.resolve(root, sub);
  if (!isWithin(root, full)) return new Response('forbidden', { status: 403 });
  // Resolve symlinks/junctions too: a file beneath an allowed directory must not
  // turn into a read outside it, including a sibling with the same name prefix.
  try {
    const realRoot = fs.realpathSync(root), realFile = fs.realpathSync(full);
    if (!isWithin(realRoot, realFile)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(realFile).toString());
  } catch { return new Response('not found', { status: 404 }); }
}

function currentLayout() { return settings.layout(screen.getAllDisplays(), screen.getPrimaryDisplay().id, cfg); }

function horizontalBounds(b) {
  const wa = screen.getDisplayMatching(b).workArea, width = Math.min(b.width, wa.width);
  return { ...b, width, x: settings.clampX(b.x, width, wa) };
}

// Re-apply screen/size. setBounds twice: Windows mis-sizes the first move across monitors with different DPI.
function setBounds(bounds) {
  const b = tucked || tuckMoveTimer ? bounds : horizontalBounds(bounds);
  size = { w: b.width, h: b.height }; win.setResizable(true); win.setBounds(b); win.setBounds(b); win.setResizable(false);
}
// Every move goes through here with the stored size: setPosition() on fractional-DPI screens makes the window creep bigger.
function moveTo(x, y, h = size.h) {
  let b = { x: Math.round(x), y: Math.round(y), width: size.w, height: h };
  if (!tucked && !dragTimer) b = horizontalBounds(b);   // drag may cross monitors; the drop is clamped by fall()
  size.w = b.width;
  win.setBounds(b);
}
function place() {
  if (!win || dragTimer || fallTimer || demoNormal || tuckMoveTimer) return;   // don't yank her mid-drag/fall/demo frame when a DPI change fires
  if (perch || floorDrop) win.webContents.send('perch-gone');   // back on the floor: the renderer must stop sitting/lying on a window
  perch = null; floorDrop = 0;
  const { bounds, display } = currentLayout();
  setBounds(tucked ? settings.tuckBounds(screen.getAllDisplays(), display, bounds.width, bounds.height, tuckCx) : bounds);
}

// Gravity: after a drop she falls onto the nearest window title bar under her feet (like Capri), else the floor.
function fall() {
  clearInterval(fallTimer); perch = null;
  const wa = screen.getDisplayMatching(win.getBounds()).workArea, w = Math.min(size.w, wa.width), h = size.h;
  size.w = w;
  let { x, y } = win.getBounds();
  let v = 0, last = Date.now();
  x = settings.clampX(x, w, wa);
  const target = settings.landing(wins, x + w / 2, y + h, wa.y + wa.height);
  const floor = target.top - h, g = wa.height * 2.5;   // ~0.9 s for a full-screen drop
  const land = () => {
    clearInterval(fallTimer); fallTimer = null; moveTo(x, floor);
    if (target.id) { const r = wins.find((o) => o.id === target.id); if (r) perch = { id: r.id, dx: x - r.x }; }
    const d = screen.getDisplayMatching(win.getBounds());
    cfg.pos = { display: d.id, x, y: floor };
    if (currentLayout().display.id !== d.id) cfg.display = d.id;   // dropped onto another screen = her screen now
    saveCfg(); buildMenu(); win.webContents.send('landed', { perched: !!perch });
  };
  if (y >= floor - 2 && y <= floor + 2) return land();
  if (y > floor) { moveTo(x, floor); return land(); }
  fallTimer = setInterval(() => {
    const now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    v += g * dt; y += v * dt;
    if (y >= floor) return land();
    moveTo(x, y);
  }, 1000 / 60);
}

// Window watcher (Windows only): visible windows so she can stand on title bars and ride along when they move.
let quitting = false;
app.on('before-quit', () => { quitting = true; });
function startWindowWatcher() {
  if (process.platform !== 'win32') return;
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0).toString();
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(__dirname, 'windows-watch.ps1'), hwnd, String(process.pid)], { windowsHide: true });
  ps.on('error', (e) => log('window watcher', e.message));
  ps.on('exit', (code) => { if (!quitting) { log('window watcher exited', code, '- restarting in 30 s'); setTimeout(startWindowWatcher, 30000); } });   // e.g. PowerShell blocked/killed: she just can't see windows meanwhile
  ps.stderr.on('data', (d) => log('window watcher', String(d).slice(0, 300)));
  readline.createInterface({ input: ps.stdout }).on('line', (line) => {
    let raw; try { raw = JSON.parse(line); } catch { return; }
    if (!Array.isArray(raw)) return raw && typeof raw.fg === 'string' && onForeground(raw);
    wins = raw.map((r) => { const d = screen.screenToDipRect(null, { x: r.x, y: r.y, width: r.w, height: r.h }); return { id: r.id, x: d.x, y: d.y, w: d.width, h: d.height, max: r.max }; });
    followPerch();
  });
  app.once('will-quit', () => ps.kill());
}
// App awareness: the kind of app in front (apps.js), after 8 s there (no alt-tab flicker), at most every 30 min per kind.
let fgKind = null, fgTimer = 0;
const fgSaid = {};
let fgPrivate = false;
let fgApp = null, fgAppKind = null;   // the app in front, for her memory of your day (day.js): name + kind only
// Fullscreen (a game, a film, F11): she hides at the screen edge by herself and comes back when it ends. A tuck you
// undo during it holds until that fullscreen ends; a tuck you made yourself is never undone here.
let autoTucked = false, fullDismissed = false;
function onFullscreen(full) {
  if (!full) { fullDismissed = false; if (autoTucked) { autoTucked = false; if (tucked) setTucked(false); } return; }
  if (cfg.hideFullscreen === false || tucked || fullDismissed || demoOn || !win) return;
  setTucked(true); autoTucked = tucked;
}
function onForeground({ fg, title, full }) {
  onFullscreen(!!full && !!fg);
  fgApp = cfg.appAware ? appName(fg, title) : null; fgAppKind = cfg.appAware ? appKind(fg, title) : null;
  if (!cfg.appAware) { if (fgPrivate) { fgPrivate = false; win?.webContents.send('private', false); } return; }   // switched off: she doesn't look
  const p = isPrivate(fg, title);
  if (p !== fgPrivate && win) { fgPrivate = p; win.webContents.send('private', p); }   // right away: she turns her back
  const k = appKind(fg, title);
  if (k === fgKind) return;
  fgKind = k; clearTimeout(fgTimer);
  if (!k || Date.now() - (fgSaid[k] || 0) < 30 * 60000) return;
  fgTimer = setTimeout(() => { if (fgKind === k && win && !tucked) { fgSaid[k] = Date.now(); win.webContents.send('app', k); } }, 8000);
}
function followPerch() {
  if (!perch || dragTimer || fallTimer || tucked || demoNormal) return;
  const r = wins.find((o) => o.id === perch.id);
  if (!r || r.max) { perch = null; win.webContents.send('perch-lost'); return fall(); }   // window closed/minimised/maximised
  const { up, h } = sitBox(perch);
  const nx = Math.round(r.x + perch.dx), ny = Math.round(r.y - size.h + (perch.sitPx || 0) - up);   // sitting: window hangs below the ledge
  const b = win.getBounds();
  if (b.x !== nx || b.y !== ny || b.height !== h) moveTo(nx, ny, h);
}
// Sitting: the window drops by the leg length, which clips her head at the top edge. So it also grows upward by
// that drop plus a margin, putting the top edge back where it is when she stands, with room to spare.
const SIT_HEADROOM = 0.2;   // extra headroom while sitting, as a fraction of her height (size.h)
function sitBox(p) { const up = p.sitPx ? p.sitPx + Math.round(size.h * SIT_HEADROOM) : 0; return { up, h: size.h + up }; }

// Tuck away (Ctrl+Alt+C): peeks from a screen corner, ignores Claude/idle; app + Ollama keep running.
function setTucked(on) {
  if (!win || dragTimer || fallTimer || tucked === on) return;
  if (!on && autoTucked) { autoTucked = false; fullDismissed = true; }
  const from = win.getBounds();
  if (on) tuckCx = from.x + from.width / 2;
  clearInterval(tuckMoveTimer);
  tucked = on; perch = null; floorDrop = 0; buildMenu();
  const { bounds, display } = currentLayout(), wa = display.workArea;
  const peek = settings.tuckBounds(screen.getAllDisplays(), display, bounds.width, bounds.height, tuckCx);
  const target = on ? peek : bounds;
  const side = peek.x + peek.width / 2 < wa.x + wa.width / 2 ? 'left' : 'right';
  win.webContents.send('tuck', { on, side });
  // Move the window continuously. The game's peek_end moves its drawing out of
  // view; waiting for it and then teleporting the window made returning disappear.
  const started = Date.now();
  win.setResizable(true);
  tuckMoveTimer = setInterval(() => {
    if (!win || win.isDestroyed()) { clearInterval(tuckMoveTimer); tuckMoveTimer = null; return; }
    const t = Math.min(1, (Date.now() - started) / 480), eased = t * t * (3 - 2 * t);
    const next = {};
    for (const key of ['x', 'y', 'width', 'height']) next[key] = Math.round(from[key] + (target[key] - from[key]) * eased);
    size = { w: next.width, h: next.height }; win.setBounds(next);
    if (t === 1) {
      clearInterval(tuckMoveTimer); tuckMoveTimer = null;
      place(); win.webContents.send('tuck-complete', { on });
    }
  }, 1000 / 60);
}

// q = render quality (pet.js textureScale): textures are sized for the window when the page loads
// ev = a dialogue trigger to fire once the reloaded page is up (Grow / Shrink / MaxSize after a size change)
let qualityOverride = null, startFails = 0;   // low textures for this run after two starts that never drew
const pageUrl = (ev = '') => `lilith://app/index.html?q=${encodeURIComponent(qualityOverride || cfg.quality || 'auto')}${ev ? `&ev=${ev}` : ''}`;
function createWindow() {
  const { bounds } = currentLayout();
  size = { w: bounds.width, h: bounds.height };
  win = new BrowserWindow({
    ...bounds,
    icon: path.join(__dirname, 'icon.png'),
    transparent: true, frame: false, resizable: false, hasShadow: false,
    skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false },   // tucked mostly off-screen, Windows can treat her as hidden and throttle her to ~1 fps: choppy loop, late sparkles
  });
  setBounds(bounds);   // normalise Windows' initial frame rounding before the first walk
  win.on('blur', () => win?.webContents.send('controls-blur'));
  win.setAlwaysOnTop(cfg.alwaysOnTop, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!isPetPage(event.url || url)) event.preventDefault(); });
  win.webContents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame || !isPetPage(event.url)) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event, url) => { if (!isPetPage(event.url || url)) event.preventDefault(); });
  win.loadURL(pageUrl());
  win.webContents.on('console-message', (e) => {
    if (e.level === 'warning' || e.level === 'error') log.once(`${e.level}:${String(e.message).slice(0, 300)}`, 'renderer', e.level, e.message);
  });
  // A crashed, failed or frozen renderer comes back by itself, 3 times per 10 min at most: then an error, not a loop.
  const mayRevive = stab.budget(3, 600000);
  let gaveUp = false;
  const revive = (why) => {
    if (gaveUp) return;
    if (!mayRevive()) { gaveUp = true; return fatal(T('err.keepsFailing', { why })); }
    log('reloading renderer:', why); alive = Date.now() + 30000; setTimeout(() => win?.webContents.reload(), 500);
  };
  // Heartbeat: the page says "alive" every 5 s. 30 s of silence (a GPU driver hang, a stuck script) -> restart it.
  let alive = Date.now() + 30000;   // grace for the first load
  ipcMain.removeAllListeners('alive');
  onPet('alive', (_e, drew) => { alive = Date.now(); if (drew) startFails = 0; });
  // Sleep / hibernate stops every process: the silence after waking is the laptop's, not a frozen page.
  let lastWatch = Date.now();
  powerMonitor.on('suspend', () => { alive = Infinity; });
  powerMonitor.on('resume', () => { alive = Date.now() + 30000; });
  setInterval(() => {
    const gap = Date.now() - lastWatch; lastWatch = Date.now();
    if (gap > 25000) { alive = Date.now() + 30000; return; }   // this timer itself was stopped (sleep): start counting again
    if (!win || gaveUp || Date.now() - alive < 30000) return;
    alive = Date.now() + 30000; log('renderer froze (no heartbeat for 30 s)');
    try { win.webContents.forcefullyCrashRenderer(); } catch { revive('frozen'); }   // -> render-process-gone -> revive
  }, 10000);
  // A start that never draws: again, then at low texture quality, then an error (stability.startupStep).
  ipcMain.removeAllListeners('no-frame');
  onPet('no-frame', () => {
    const step = stab.startupStep(++startFails);
    log('no frame after 25 s, start attempt', startFails, '->', step);
    if (step === 'fatal') { gaveUp = true; return fatal(T('err.noFrame')); }
    if (step === 'low') qualityOverride = 'low';
    alive = Date.now() + 30000; win.loadURL(pageUrl());
  });
  win.webContents.on('render-process-gone', (_e, d) => revive(`renderer ${d.reason}`));
  win.webContents.on('did-fail-load', (_e, code, desc) => revive(`load failed ${code} ${desc}`));
  win.webContents.on('did-finish-load', () => { sendConfig(); win.webContents.send('music', nowMusic); });   // also after a reload
}

function buildPersona() {
  let ex = [];
  try {
    let rows = fs.readFileSync(path.join(RIP, 'dialogue', 'corpus.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const tr = path.join(RIP, 'dialogue', `lines_${cfg.lang}.json`);   // examples in the language she will answer in
    if (cfg.lang && cfg.lang !== 'en' && fs.existsSync(tr)) rows = JSON.parse(fs.readFileSync(tr, 'utf8')).map((l) => ({ en: l.text }));
    const nm = cfg.profile?.name || 'you';
    ex = rows.filter((r) => r.en && r.en.length > 15 && r.en.length < 110 && !/\{(?!player_name\}|player\})/.test(r.en))
      .sort(() => Math.random() - 0.5).slice(0, 30).map((r) => `- ${r.en.replace(/\{player(_name)?\}/g, nm)}`);
  } catch (e) { log('persona corpus', e.message); }
  const user = cfg.profile?.name || os.userInfo().username;
  return `You are Lilith from "The NOexistenceN of you AND me", living on ${user}'s desktop as a small companion next to their work.
Speak exactly like her: playful, teasing, warm, a little lonely; often calls herself "Lilith" in third person; may end lines with "~".
Always reply in ${langName(cfg.lang)}, never mix languages. Reply in 1-3 short sentences. No emojis, no *actions*, no lists, never mention being an AI or a model.
You can also see what Claude (the coding assistant ${user} uses) is doing, and you comment on it in character.
${profile.personaLines(cfg.profile)}
Lines Lilith has said (match this voice):
${ex.join('\n')}`;
}

// Short in-character message in her bubble. action: what a click on the bubble does (see 'bubble-click').
// ---------- first run: find the player's game and prepare its animation, dialogue and audio ----------
const ask = async (o) => (await dialog.showMessageBox({ type: 'info', title: 'Lilith', noLink: true, ...o })).response;
async function prepareRip() {
  while (!GAME) {
    const r = await ask({ message: 'Lilith needs The NOexistenceN of Lilith (Steam)',
      detail: 'Lilith needs the animation, dialogue and audio from your own installed copy of the game.\n\nInstall the game on Steam, or show Lilith where it is.',
      buttons: ['Find the game on Steam', 'Choose the game folder...', 'Quit'], cancelId: 2 });
    if (r === 0) {
      await shell.openExternal('https://store.steampowered.com/search/?term=The%20NOexistenceN%20of%20Lilith');
      if (await ask({ message: 'Install the game, then continue',
        detail: 'Once Steam finishes installing the game, click Check again. Lilith will find it automatically in your Steam libraries.',
        buttons: ['Check again', 'Quit'], cancelId: 1 }) !== 0) return false;
      GAME = firstrun.findGame({ picked: cfg.gameDir });
      continue;
    }
    if (r !== 1) return false;
    const pick = await dialog.showOpenDialog({ title: 'The NOexistenceN of Lilith folder (with Lilith_Data in it)', properties: ['openDirectory'] });
    const dir = pick.filePaths?.[0];
    if (!firstrun.isGame(dir)) { if (dir) await ask({ message: 'Please choose the installed game folder', detail: `This folder does not contain Lilith_Data\\resources.assets:\n${dir}`, buttons: ['Try again'] }); continue; }
    GAME = cfg.gameDir = dir; saveCfg();
  }
  const executable = path.join(process.resourcesPath || '', 'extractor', 'lilith-extractor.exe');
  const bundled = fs.existsSync(executable);
  if (app.isPackaged && !bundled) { fatal('The asset preparation tool is missing. Please reinstall Lilith.'); return false; }
  const py = bundled ? null : firstrun.findPython();
  if (!bundled && !py) {
    const r = await ask({ message: 'One-time setup needs Python 3',
      detail: 'Lilith reads her model, voices and lines from your game with a small Python script, once.\n\nInstall Python 3.12 from python.org (tick "Add python.exe to PATH"), then start Lilith again.',
      buttons: ['Open python.org', 'Quit'], cancelId: 1 });
    if (r === 0) shell.openExternal('https://www.python.org/downloads/');
    return false;
  }
  if (await ask({ message: 'Prepare Lilith from your game files?', buttons: ['Start', 'Quit'], cancelId: 1,
    detail: `Reads her model, voices and lines from\n${GAME}\ninto\n${RIP}\n\nOnly once. It takes a few minutes and about 1-2 GB.` }) !== 0) return false;
  const script = [path.join(process.resourcesPath || '', 'extract', 'extract_lilith.py'), path.join(__dirname, '..', 'extract_lilith.py')].find((f) => fs.existsSync(f));
  if (!bundled && !script) { fatal('extract_lilith.py is missing from this install. Reinstall Lilith.'); return false; }
  const bar = new BrowserWindow({ width: 520, height: 170, resizable: false, minimizable: false, maximizable: false, title: 'Lilith - preparing', autoHideMenuBar: true, icon: path.join(__dirname, 'icon.png') });
  bar.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body style="font:13px Segoe UI,sans-serif;background:#1d1b22;color:#eee;margin:16px">'
    + '<b>Preparing Lilith from your game files...</b><p style="color:#aaa">This takes a few minutes, only once.</p><pre id="l" style="white-space:pre-wrap;color:#9ad"></pre></body>'));
  const last = [];
  const why = await firstrun.extract({ py, script, executable: bundled ? executable : null, game: GAME, rip: RIP, extraArgs: (process.env.LILITH_EXTRACT_ARGS || '').split(' ').filter(Boolean), onLine: (line) => {
    log('extract', line); last.push(line); if (last.length > 30) last.shift();
    if (!bar.isDestroyed()) bar.webContents.executeJavaScript(`document.getElementById('l').textContent=${JSON.stringify(line.slice(-300))}`).catch(() => {});
  } });
  if (!bar.isDestroyed()) bar.close();
  if (!why) return true;
  fatal(`Lilith couldn't be prepared from the game (${why === 'pip' ? 'installing UnityPy failed' : why === 'extract' ? 'the script failed' : 'files are missing afterwards'}).\n\n${last.slice(-8).join('\n')}\n\nTray -> Copy log has the details.`);
  return false;
}

// Tray -> Copy log: the end of lilith-pet.log plus versions, ready to paste into a bug report.
function copyLog() {
  const head = `Lilith pet ${app.getVersion()} | Electron ${process.versions.electron} | ${os.type()} ${os.release()} ${os.arch()} | lang ${cfg.lang} | quality ${qualityOverride || cfg.quality}\n`;
  clipboard.writeText(head + stab.logTail(LOG));
  notice(T('logCopied'), { ms: 4000 });
}
function notice(text, { ms = 6000, action = null, anim = null } = {}) { win?.webContents.send('notice', { text, ms, action, anim }); }
const MODEL_SETUP_URL = 'https://github.com/nuttyuwu/lilith-desktop#give-lilith-a-chat-model';
async function showModelSetupIfNeeded() {
  if (!(await refreshOllama())) {
    notice(T('ollama.setup'), { ms: 0, action: `open:${MODEL_SETUP_URL}`, anim: 'confuse' });
    return;
  }
  try { await ensureModel(); }
  catch (e) {
    log('ollama setup', e.message);
    if (/no models/i.test(e.message)) {
      notice(T('ollama.noModel', { cmd: ollama.MODEL_COMMAND }), { ms: 0, action: `copy:${ollama.MODEL_COMMAND}`, anim: 'confuse' });
    } else {
      notice(T(/not found/i.test(e.message) ? 'ollama.modelSetup' : 'ollama.checkFailed'), { ms: 0, action: `open:${MODEL_SETUP_URL}`, anim: 'confuse' });
    }
  }
}

async function refreshOllama() {
  const up = await ollama.ping();
  if (up !== ollamaUp) { ollamaUp = up; buildMenu(); }
  return up;
}
// interactive: allowed to start Ollama and talk about it. Returns true when chat can go ahead.
async function ollamaReady(interactive) {
  if (await refreshOllama()) return true;
  if (!interactive) return false;
  notice(T('ollama.waking'), { ms: 0, anim: 'magic' });
  try { await ollama.launch(); } catch (e) {
    log('ollama launch', e.code || e.message);
    notice(e.code === 'ENOENT' ? T('ollama.missing') : T('ollama.failed', { e: e.message }), { ms: 0, action: e.code === 'ENOENT' ? 'open:https://ollama.com/download' : 'dismiss', anim: 'sad' });
    return false;
  }
  for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 700)); if (await refreshOllama()) return true; }
  notice(T('ollama.noWake'), { ms: 0, action: 'dismiss', anim: 'sad' });
  return false;
}

async function ensureModel() {
  if (!model) { model = await ollama.pickModel(); log('ollama model', model); }
  return model;
}

// Stream a reply into the bubble. kind: 'chat' keeps history, 'aside' is a one-off comment (Claude events).
async function speak(userText, kind = 'chat') {
  if (!win) return false;
  if (!(await ollamaReady(kind === 'chat'))) return false;
  chatAbort?.abort(); chatAbort = new AbortController();
  const msgs = [{ role: 'system', content: persona }, ...(kind === 'chat' ? history : []), { role: 'user', content: userText }];
  win.webContents.send('say-start');
  try {
    const reply = await ollama.chat(await ensureModel(), msgs, (t) => win.webContents.send('say-token', t), chatAbort.signal);
    if (kind === 'chat') { history.push({ role: 'user', content: userText }, { role: 'assistant', content: reply }); history = history.slice(-20); }
    win.webContents.send('say-end');
    return true;
  } catch (e) {
    if (e.name === 'AbortError') return false;
    log('ollama', e.message);
    if (/no models/i.test(e.message)) {
      model = null;
      notice(T('ollama.noModel', { cmd: ollama.MODEL_COMMAND }), { ms: 0, action: `copy:${ollama.MODEL_COMMAND}`, anim: 'confuse' });
    } else if (/Configured model not found/i.test(e.message)) {
      notice(T('ollama.modelSetup'), { ms: 0, action: `open:${MODEL_SETUP_URL}`, anim: 'confuse' });
    } else if (/not found/i.test(e.message) && model) {
      notice(T('ollama.modelGone', { m: model }), { ms: 8000 }); model = null;
    } else win.webContents.send('say-error', T('ollama.lost', { e: e.message }));
    return false;
  }
}

// Node trims hook events before sending them; never fall back to forwarding raw events.
function hookOpts() {
  const which = process.platform === 'win32' ? 'where.exe' : 'which';
  let node = false; try { node = require('child_process').spawnSync(which, ['node'], { windowsHide: true }).status === 0; } catch {}
  return { node, port: PORT };
}

function installHook() {
  const opts = hookOpts();
  if (!opts.node) throw new Error('Claude integration requires Node.js on PATH. Install Node.js, then enable Claude hook in Settings.');
  // Portable builds extract into a temporary directory that disappears on quit.
  const script = claude.prepareHook(__dirname, path.join(app.getPath('userData'), 'hooks'));
  return claude.install(script, undefined, opts);
}

// Files Claude worked on (newest first): Tray -> Claude's files, or click her bubble -> she shows it in Explorer.
let files = [];
function noteFile(evt) {
  const p = evt.hook_event_name === 'PreToolUse' && evt.tool_input?.file_path;
  if (!p || !/Edit|Write|Read|Notebook/.test(evt.tool_name || '')) return;
  const full = path.resolve(evt.cwd || lastCwd || os.homedir(), p);
  const edit = !/Read/.test(evt.tool_name);
  files = [{ path: full, edit: edit || !!files.find((f) => f.path === full)?.edit }, ...files.filter((f) => f.path !== full)].slice(0, 10);
  buildMenu();
}
// Opens Explorer with the file selected and has her point toward it (Explorer opens around the screen centre).
function showFile(p) {
  setTucked(false);
  const name = path.basename(p);
  if (!fs.existsSync(p)) return notice(T('point.gone', { f: name }), { ms: 5000, anim: 'confuse' });
  shell.showItemInFolder(p);
  const b = win.getBounds(), wa = screen.getDisplayMatching(b).workArea;
  win.webContents.send('point', { file: name, dir: b.x + b.width / 2 > wa.x + wa.width / 2 ? -1 : 1 });
}

function startHookServer() {
  http.createServer((req, res) => {
    if (req.method !== 'POST' || !/^\/event(\?|$)/.test(req.url)) { res.writeHead(404).end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      res.writeHead(204).end();
      if (!hookOnState) return;
      let evt; try { evt = slim(JSON.parse(body)); } catch { return; }   // validate and trim again at the receiver
      if (evt.cwd) lastCwd = evt.cwd;
      noteFile(evt);
      log('claude', evt.hook_event_name, evt.tool_name || '', tucked ? '(tucked, ignored)' : '');
      if (tucked || demoOn) return;
      win?.webContents.send('claude', evt);
      if (evt.hook_event_name === 'Stop' && evt.last_assistant_message) {
        lastReply = evt.last_assistant_message;   // click her bubble to read it in full (Capri-style)
        speak(`Claude just finished a task and said this:\n"""${lastReply.slice(0, 2500)}"""\nTell ${cfg.profile?.name || os.userInfo().username} in one short sentence, in your voice, what Claude did.`, 'aside')
          .then((ok) => (ok ? win.webContents.send('bubble-action', 'reply') : notice(T('claude.finished'), { ms: 15000, action: 'reply' })));
      }
    });
  }).on('error', (e) => { log('hook server', e.message); setTimeout(() => notice(T('hook.busy', { p: PORT }), { ms: 10000, anim: 'confuse' }), 6000); })   // another app owns the port: no Claude reactions, everything else works
    .listen(PORT, '127.0.0.1');
}

// One Lilith at a time: a second launch (double-click, autostart + manual) just brings the running one out.
if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', () => { if (!win) return; setTucked(false); win.show(); });

app.whenReady().then(async () => {
  if (!app.hasSingleInstanceLock()) return;
  GAME = firstrun.findGame({ picked: cfg.gameDir });
  if (firstrun.ripMissing(RIP).length && !(await prepareRip())) { app.quit(); return; }
  if (!cfg.lang) { cfg.lang = settings.langFromLocale(app.getLocale()); saveCfg(); }
  protocol.handle('lilith', serve);
  persona = buildPersona();
  createWindow();
  startHookServer();
  win.webContents.once('did-finish-load', () => {
    sendConfig();
    startWindowWatcher();
    setTimeout(async () => {
      await showModelSetupIfNeeded();
    }, 5000);
  });
  setInterval(refreshOllama, 20000);
  // Are you there? System idle time (keyboard/mouse anywhere) every 15 s, plus lock / unlock / sleep / wake: she
  // notices you leave and come back, dozes off when you're gone long, nags you to bed after midnight (alive.js).
  const sys = (v) => { if (win && !win.isDestroyed()) win.webContents.send('sys', v); };
  for (const ev of ['lock-screen', 'unlock-screen', 'suspend', 'resume']) powerMonitor.on(ev, () => sys({ ev: ev.replace('-screen', '') }));
  const day = makeDay(path.join(app.getPath('userData'), 'day.json'));
  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();
    sys({ idle });
    for (const e of day.tick({ app: fgApp, kind: fgAppKind, idle })) if (cfg.appAware) win?.webContents.send('day', e);
  }, 15000);
  setInterval(() => day.save(), 60000);
  app.on('will-quit', () => day.save());
  // Cursor feed for her eyes (pet.js look): window-relative DIP, only when it moved. 20 Hz is plenty for a head turn.
  let lastCur = '';
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint(), b = win.getBounds(), key = `${p.x - b.x},${p.y - b.y}`;
    if (key !== lastCur) { lastCur = key; win.webContents.send('cursor', { x: p.x - b.x, y: p.y - b.y }); }
  }, 50);

  let hookOn = false;
  if (cfg.claudeHook && !process.env.LILITH_NO_HOOK) {
    try { log('hook installed in', installHook()); hookOn = true; }
    catch (e) {
      log('hook install failed', e.message);
      // Retire older raw-curl or temporary-path registrations when an upgrade
      // cannot install the safe Node hook. The unchecked tray state must mean off.
      try { claude.uninstall(); } catch (cleanupError) { log('old hook cleanup failed', cleanupError.message); }
    }
  } else {
    try { claude.uninstall(); } catch (e) { log('disabled hook cleanup failed', e.message); }
  }

  globalShortcut.register('Control+Alt+L', () => { setTucked(false); win.show(); win.focus(); win.webContents.send('open-chat'); });
  if (!globalShortcut.register('Control+Alt+C', () => setTucked(!tucked))) log('Ctrl+Alt+C is taken by another app');

  const ico = GAME && path.join(GAME, 'Lilith_Data', 'StreamingAssets', 'Icons', 'lilith.ico');   // prefer the player's locally installed game icon
  tray = new Tray(nativeImage.createFromPath(ico && fs.existsSync(ico) ? ico : path.join(__dirname, 'icon.png')));   // no game icon: her own (an empty tray icon was invisible)
  tray.setToolTip('Lilith');
  hookOnState = hookOn;
  buildMenu();
  const stopMusic = spotify.watch((m) => { nowMusic = m; win?.webContents.send('music', m); }, log);
  app.on('will-quit', stopMusic);
  // Only re-place her when she's no longer on any screen, preserving a title-bar perch.
  // A work-area change can still cut off a window whose centre remains visible, so clamp its sides too.
  for (const ev of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(ev, () => {
    buildMenu(); if (!win) return;
    const b = win.getBounds(), cx = b.x + b.width / 2, feet = b.y + b.height - 2;
    if (tucked || !screen.getAllDisplays().some((d) => cx >= d.bounds.x && cx < d.bounds.x + d.bounds.width && feet >= d.bounds.y && feet < d.bounds.y + d.bounds.height)) place();
    if (!tucked && !tuckMoveTimer && !dragTimer && !fallTimer) {
      const now = win.getBounds(), safe = horizontalBounds(now);
      if (safe.x !== now.x || safe.width !== now.width) moveTo(safe.x, now.y, now.height);
    }
  });
});

function set(key, value) {
  const order = Object.keys(settings.SIZES), was = order.indexOf(cfg.size);
  cfg[key] = value; if (key !== 'alwaysOnTop') cfg.pos = null; saveCfg(); place(); buildMenu();
  // re-size her textures for the new window size; she comments on growing / shrinking (the game's Grow/Shrink/MaxSize)
  if (key === 'size') { const now = order.indexOf(value); win.loadURL(pageUrl(now === was ? '' : now > was ? (now === order.length - 1 ? 'MaxSize' : 'Grow') : 'Shrink')); }
  if (key === 'display') win.webContents.reload();
}
// Quit: she says goodbye first (the game's Farewell lines), then the app closes.
let leaving = false;
function farewell() {
  if (!win || leaving || tucked) return app.quit();
  leaving = true; win.webContents.send('farewell');
  setTimeout(() => app.quit(), 4500);
}

let trayMenu = null;
function buildMenu() {
  const primaryId = screen.getPrimaryDisplay().id;
  const screens = screen.getAllDisplays().map((d, i) => ({
    label: settings.displayLabel(d, i, primaryId).replace(/^Screen (\d+)/, (_m, n) => T('m.screenN', { n })).replace(' (primary)', T('m.primaryTag')),
    type: 'radio', checked: String(cfg.display) === String(d.id), click: () => set('display', d.id),
  }));
  const sizes = Object.keys(settings.SIZES).map((k) => ({
    label: T('m.sizeItem', { s: T(`size.${k}`), pct: Math.round(settings.SIZES[k] * 100) }),
    type: 'radio', checked: cfg.size === k, click: () => set('size', k),
  }));
  // Chinese/Japanese text has exactly one matching voice (settings.effectiveVoice): offer only that one + Off
  const voice = settings.effectiveVoice(cfg), paired = settings.voiceFor(cfg.lang);
  const voices = ['jp', 'cn', 'off'].filter((v) => !paired || v === paired || v === 'off').map((v) => ({
    label: T(`v.${v}`), type: 'radio', checked: voice === v, click: () => { cfg.voice = v; saveCfg(); sendConfig(); buildMenu(); } }));
  tray.setContextMenu(trayMenu = Menu.buildFromTemplate([
    { label: ollamaUp ? T('m.ollamaRun', { m: model ? ` (${model})` : '' }) : ollamaUp === false ? T('m.ollamaOff') : T('m.ollamaCheck'),
      enabled: ollamaUp === false, click: () => ollamaReady(true).then((ok) => ok && notice(T('ollama.awake'), { anim: 'happy' })) },
    { type: 'separator' },
    { label: tucked ? T('m.wake') : T('m.tuck'), click: () => setTucked(!tucked) },
    { label: T('m.open'), submenu: [
      { label: T('m.claudeCli'), click: () => launch('claude') },
      { label: T('m.codexCli'), click: () => launch('chatgpt') },
      { type: 'separator' },
      { label: T('m.claudeWeb'), click: () => launch('claude-web') },
      { label: T('m.gptWeb'), click: () => launch('chatgpt-web') },
    ] },
    { label: T('m.files'), submenu: files.length ? files.map((f) => ({ label: `${f.edit ? '✎' : '·'}  ${path.basename(f.path)}   ${path.dirname(f.path)}`, click: () => showFile(f.path) }))
      : [{ label: T('m.filesNone'), enabled: false }] },
    { label: T('m.talk'), click: () => { setTucked(false); win.focus(); win.webContents.send('open-chat'); } },
    { label: T('m.listen'), type: 'checkbox', checked: !!cfg.listen, click: (m) => setListen(m.checked) },
    ...['casual', 'pajamas'].map((o) => ({ label: T(`m.${o}`), type: 'radio', checked: outfit === o,
      click: () => { outfit = o; win.webContents.send('outfit', o); } })),
    { type: 'separator' },
    { label: T('m.settings'), submenu: [
      { label: T('m.screen'), submenu: [
        { label: T('m.primary'), type: 'radio', checked: cfg.display === 'primary', click: () => set('display', 'primary') },
        { label: T('m.largest'), type: 'radio', checked: cfg.display === 'largest', click: () => set('display', 'largest') },
        { type: 'separator' }, ...screens] },
      { label: T('m.size'), submenu: sizes },
      { label: T('m.language', { l: langName(cfg.lang) }), submenu: availableLangs().map(([t, l]) => ({ label: l, type: 'radio', checked: cfg.lang === t, click: () => setLang(t) })) },
      { label: T('m.voice'), submenu: [...voices, { type: 'separator' },
        { label: 'Test voice', click: () => { setTucked(false); win.webContents.send('test-voice'); } }] },
      { label: T('m.quality'), submenu: ['auto', 'high', 'low'].map((q) => ({ label: T(`q.${q}`), type: 'radio', checked: (cfg.quality || 'auto') === q,
        click: () => { cfg.quality = q; saveCfg(); buildMenu(); win.loadURL(pageUrl()); } })) },
      { label: cfg.profile ? T('m.aboutName', { name: cfg.profile.name }) : T('m.about'), click: () => { setTucked(false); win.webContents.send('setup'); } },
      { label: T('m.day'), type: 'checkbox', checked: cfg.dayCycle, click: (m) => { cfg.dayCycle = m.checked; saveCfg(); sendConfig(); } },
      { label: T('m.clockClothes'), type: 'checkbox', checked: cfg.clockClothes, click: (m) => { cfg.clockClothes = m.checked; saveCfg(); sendConfig(); } },
      { label: T('m.appAware'), type: 'checkbox', checked: cfg.appAware, click: (m) => { cfg.appAware = m.checked; saveCfg(); sendConfig(); if (!m.checked) onForeground({ fg: '', title: '' }); } },
      { label: T('m.hideFull'), type: 'checkbox', checked: cfg.hideFullscreen !== false, click: (m) => { cfg.hideFullscreen = m.checked; saveCfg(); if (!m.checked) onFullscreen(false); } },
      { label: T('m.chatter'), submenu: ['chatty', 'normal', 'quiet'].map((c) => ({ label: T(`chatter.${c}`), type: 'radio', checked: cfg.chatter === c,
        click: () => { cfg.chatter = c; saveCfg(); sendConfig(); } })) },
      { label: T('m.top'), type: 'checkbox', checked: cfg.alwaysOnTop, click: (m) => { cfg.alwaysOnTop = m.checked; saveCfg(); win.setAlwaysOnTop(m.checked, 'screen-saver'); } },
      { label: T('m.hook'), type: 'checkbox', checked: hookOnState, click: (m) => {
        try {
          m.checked ? installHook() : claude.uninstall();
          hookOnState = cfg.claudeHook = m.checked;
          saveCfg();
        } catch (e) { fatal(`Claude hook not changed: ${e.message}`); m.checked = !m.checked; }
      } },
      { label: T('m.reset'), click: () => { cfg.pos = null; saveCfg(); place(); } },
      { label: T('m.file'), click: () => shell.openPath(SETTINGS) },
    ] },
    { label: T('m.demo'), submenu: [
      { label: T('m.demoTour'), click: () => startDemo('tour') },
      { label: T('m.demoReel'), click: () => startDemo('reel') },
      { label: T('m.demoStop'), enabled: demoOn, click: () => win.webContents.send('demo', 'stop') },
    ] },
    ...(process.env.LILITH_DEBUG ? [{ label: 'DevTools', click: () => win.webContents.openDevTools({ mode: 'detach' }) }] : []),
    { label: T('m.copyLog'), click: copyLog },
    { label: T('m.quit'), click: () => farewell() },
  ]));
}

onPet('hover', (_e, over) => win && win.setIgnoreMouseEvents(!over, { forward: true }));
onPet('chat', (_e, text) => { const a = musicWord(text); if (a) return music(a); speak(text, 'chat'); });
onPet('fatal', (_e, msg) => fatal(msg));
onPet('untuck', () => setTucked(false));
// The opening's desktop comment ("Your desktop is so tidy..."): how many things are on your desktop, and your Windows
// user name ("This machine calls you ..."). Read here only; nothing is stored but the count (renderer, to notice changes).
handlePet('desk', () => {
  const dirs = [app.getPath('desktop'), path.join(os.homedir(), 'Desktop'), process.env.PUBLIC && path.join(process.env.PUBLIC, 'Desktop')];
  const seen = new Set(); let count = 0, any = false;
  for (const d of dirs) {
    if (!d || seen.has(d.toLowerCase())) continue; seen.add(d.toLowerCase());
    try { count += fs.readdirSync(d).filter((n) => !/^desktop\.ini$|^\./i.test(n)).length; any = true; } catch {}
  }
  let user = ''; try { user = os.userInfo().username; } catch {}
  return { count: any ? count : null, user };
});
// Sitting on a window's title bar: the window drops by the leg length so her legs can dangle over the window.
onPet('sit', (_e, px, floor) => {
  const none = () => win.webContents.send('sit-moved', { ok: false, up: 0 });
  if (dragTimer || fallTimer || tucked) return none();
  if (!perch) {   // lying on the floor (floor=true): the window hangs over the taskbar edge by px so her hand and hair aren't cut
    if (!floor) return none();
    const wa = screen.getDisplayMatching(win.getBounds()).workArea, drop = floorDrop = Math.max(0, Math.round(px));
    moveTo(win.getBounds().x, wa.y + wa.height - size.h + drop);
    return win.webContents.send('sit-moved', { ok: drop > 0, up: 0 });
  }
  const r = wins.find((o) => o.id === perch.id); if (!r) return none();
  perch.sitPx = Math.max(0, Math.round(px));
  const { up, h } = sitBox(perch);
  moveTo(Math.round(r.x + perch.dx), Math.round(r.y - size.h + perch.sitPx - up), h);
  const top = Math.round(r.y - size.h + perch.sitPx - up), low = top < screen.getDisplayMatching(win.getBounds()).workArea.y;   // no room above the window: her head would be cut
  win.webContents.send('sit-moved', { ok: perch.sitPx > 0, up, low });   // up: CSS px of extra headroom, the renderer keeps its scale
});
// hover bar: Claude / ChatGPT, or Spotify transport (music-*). Hide + Demo live in the tray.
onPet('toolbar', (_e, a) => {
  if (a === 'test-voice') return win.webContents.send('test-voice');
  if (a === 'tuck') return setTucked(true);
  if (a === 'quit') return farewell();
  if (a === 'settings') return tray?.popUpContextMenu(trayMenu);
  if (a === 'outfit-casual' || a === 'outfit-pajamas') {
    outfit = a.slice(7); return win.webContents.send('outfit', outfit);
  }
  if (typeof a === 'string') return a.startsWith('music-') ? music(a.slice(6)) : launch(a);
});

// ---------- Spotify (spotify.js): transport controls, "now playing", and listen-along ----------
// action: toggle | next | prev | now. Her bubble shows what's playing afterwards.
async function music(action) {
  let info = null;
  try { info = action === 'now' ? await spotify.nowPlaying() : await spotify.control(action); } catch (e) { log('spotify', e.message); }
  if (!info) return notice(T('spotify.none'), { ms: 5000, anim: 'confuse' });
  notice(`♪ ${info.title}${info.artist ? ` — ${info.artist}` : ''}${info.playing ? '' : T('spotify.paused')}`, { ms: 6000, anim: 'happy' });
}
// chat shortcuts: a message that is only "next", "skip", "pause"... goes to Spotify instead of Ollama
const MUSIC_WORDS = { next: 'next', skip: 'next', previous: 'prev', prev: 'prev', back: 'prev', pause: 'toggle', play: 'toggle', resume: 'toggle' };
const musicWord = (text) => { const m = /^(\w+)( (song|track))?[.!]?$/i.exec(text.trim()); return m ? MUSIC_WORDS[m[1].toLowerCase()] : undefined; };
// Spotify watcher: she sways to the music only while Spotify itself is playing (life.js), and with
// "Listen along" on she comments on each new song in her own voiced lines.
let nowMusic = { playing: false, title: '', artist: '' };
function setListen(on) { cfg.listen = on; saveCfg(); sendConfig(); buildMenu(); }
onPet('outfit-changed', (_e, o) => { outfit = o; buildMenu(); });
handlePet('assets', () => assetIndex());
// [tag, label, voice that language plays with] for the setup card and the tray
const availableLangs = () => settings.LANGS.filter(([t]) => t === 'en' || fs.existsSync(path.join(RIP, 'dialogue', `lines_${t}.json`)))
  .map(([t, l]) => [t, l, settings.effectiveVoice({ ...cfg, lang: t })]);
function sendConfig() {
  win?.webContents.send('config', { voice: settings.effectiveVoice(cfg), dayCycle: cfg.dayCycle, listen: !!cfg.listen, profile: cfg.profile || null, lang: cfg.lang, langs: availableLangs(),
    chatter: cfg.chatter, clockClothes: cfg.clockClothes, appAware: cfg.appAware, since: cfg.since });
}
// Text language. The voice follows it for Chinese/Japanese (settings.effectiveVoice), so text and voice never mix.
function setLang(t) {
  if (!settings.LANGS.some((l) => l[0] === t)) return;
  cfg.lang = t; saveCfg(); persona = buildPersona(); history = []; sendConfig(); buildMenu();
}
onPet('set-lang', (_e, t) => setLang(t));
onPet('focus', () => { win?.show(); win?.focus(); });
onPet('save-profile', (_e, p) => {
  const clean = profile.clean(p);
  if (!clean) return log('profile rejected');
  cfg.profile = clean; saveCfg();
  persona = buildPersona(); history = [];   // she remembers who you are from the next message on
  sendConfig(); buildMenu();
});

// Game voices on disk: { voice: {'1000206_jp': 'voice/1000206_jp.wav'}, sfx: {'ShyGiggle': 'sfx/ShyGiggle.wav'} }
// (tolerates the doubled '.wav.wav' names older extractor runs produced)
function assetIndex() {
  const idx = { voice: {}, sfx: {}, ui: {} };
  for (const k of ['voice', 'sfx']) {
    try { for (const f of fs.readdirSync(path.join(RIP, k))) idx[k][f.replace(/(\.wav)+$/i, '')] = `${k}/${f}`; }
    catch (e) { log('assets', k, e.message); }
  }
  try {
    const sprites = fs.readdirSync(path.join(RIP, 'sprites'));
    for (const [key, name] of Object.entries({ bubble: 'Choise_Bubble', panel: 'Settings_Bg_FixSize', music: 'music_panel_bg', control: 'btn_unhold', controlHover: 'btn_hold' })) {
      const file = sprites.find(f => new RegExp('^' + name + '_[0-9]+\\.png$').test(f));
      if (file) idx.ui[key] = `sprites/${file}`;
    }
  } catch (e) { log('UI assets', e.message); }
  log('voices', Object.keys(idx.voice).length, 'sfx', Object.keys(idx.sfx).length);
  return idx;
}

// Walking: getBounds/setBounds use the same outer-window coordinates. On Windows
// with fractional scaling getPosition can differ by frame pixels, accumulating drift.
// The renderer sends root-motion steps; she stops at the screen edge.
onPet('walk-step', (_e, dx) => {
  if (!win || dragTimer || fallTimer || tucked || tuckMoveTimer || demoNormal || perch) {
    log.once('walk-state', 'walk blocked by state', JSON.stringify({drag:!!dragTimer,fall:!!fallTimer,tucked,transition:!!tuckMoveTimer,framed:!!demoNormal,perched:!!perch}));
    return win?.webContents.send('walk-blocked');
  }
  if (!Number.isFinite(dx)) return win.webContents.send('walk-blocked');
  const bounds = win.getBounds(), { x, y } = bounds, wa = screen.getDisplayMatching(bounds).workArea;
  const nx = settings.clampX(x + dx, win.getBounds().width, wa);
  moveTo(nx, y);
  if (dx < 0 ? nx <= wa.x : nx >= wa.x + wa.width - bounds.width) { log.once('walk-edge', 'walk reached edge', JSON.stringify({x,dx,nx,width:win.getBounds().width,area:wa})); win.webContents.send('walk-blocked'); }
  cfg.pos = { display: screen.getDisplayMatching(win.getBounds()).id, x: nx, y }; clearTimeout(walkSave); walkSave = setTimeout(saveCfg, 1000);
});
let walkSave = 0;

// Open Claude / Claude Code / ChatGPT: desktop app when installed, else the website.
function firstExisting(paths) { return paths.find((p) => p && fs.existsSync(p)); }
// CLIs she opens in a terminal, in the folder Claude last worked in (from the hook), else your home folder.
const CLI = {
  claude: { cmd: 'claude', name: 'Claude Code', install: 'npm install -g @anthropic-ai/claude-code', line: 'cli.claude' },
  chatgpt: { cmd: 'codex', name: 'Codex (ChatGPT CLI)', install: 'npm install -g @openai/codex', line: 'cli.codex' },
};
function onPath(cmd) { try { return require('child_process').spawnSync('where.exe', [cmd], { windowsHide: true }).status === 0; } catch { return false; } }
function launch(what) {
  const la = process.env.LOCALAPPDATA || '';
  const detach = (cmd, args, cwd) => { const p = spawn(cmd, args, { cwd, detached: true, stdio: 'ignore', windowsHide: false }); p.on('error', (e) => log('launch', cmd, e.message)); p.unref(); };
  if (what === 'claude-web') return shell.openExternal('https://claude.ai/new');
  if (what === 'chatgpt-web') return shell.openExternal('https://chatgpt.com/');
  const c = CLI[what]; if (!c) return;
  if (!onPath(c.cmd)) return notice(T('cli.missing', { name: c.name, cmd: c.install }), { ms: 0, action: `copy:${c.install}`, anim: 'confuse' });
  const cwd = lastCwd && fs.existsSync(lastCwd) ? lastCwd : os.homedir();
  notice(T(c.line), { ms: 3000, anim: what === 'claude' ? 'magic' : 'sad' });
  const wt = firstExisting([path.join(la, 'Microsoft', 'WindowsApps', 'wt.exe')]);
  if (wt) detach(wt, ['new-tab', '-d', cwd, 'cmd', '/k', c.cmd], cwd);
  else detach('cmd.exe', ['/c', 'start', '', '/D', cwd, 'cmd', '/k', c.cmd], cwd);
}
onPet('bubble-click', (_e, action) => {
  if (typeof action !== 'string' || !action || action === 'dismiss') return;
  if (action === 'reply') return notice(lastReply || T('claude.nothing'), { ms: 0, action: 'dismiss' });
  if (action.startsWith('open:')) {
    let url;
    try { url = new URL(action.slice(5)); } catch { return log('blocked invalid external URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return log('blocked external URL scheme or credentials');
    return shell.openExternal(url.href).catch((e) => log('open external', e.message));
  }
  if (action.startsWith('show:')) return showFile(path.resolve(lastCwd || os.homedir(), action.slice(5)));
  if (action.startsWith('copy:')) { clipboard.writeText(action.slice(5)); notice(T('copied'), { ms: 5000 }); }
});

// --- demo mode: renderer runs the script, main moves/resizes the window for it ---
function startDemo(kind) { setTucked(false); perch = null; demoOn = true; buildMenu(); win.webContents.send('demo', kind); }
onPet('demo-done', () => { demoOn = false; buildMenu(); });
onPet('demo-tuck', (_e, on) => setTucked(on));
onPet('demo-frame', (_e, size) => {   // wide poses (sofa/lying) get a wider window, feet still on the floor
  if (!size) { if (demoNormal) { const b = demoNormal; demoNormal = null; setBounds(b); } return; }
  if (!demoNormal) demoNormal = win.getBounds();
  const wa = screen.getDisplayMatching(demoNormal).workArea;
  const w = Math.min(size.width, wa.width), h = Math.min(size.height, wa.height);
  const x = Math.min(Math.max(demoNormal.x + demoNormal.width - w, wa.x), wa.x + wa.width - w);
  setBounds({ x, y: wa.y + wa.height - h, width: w, height: h });
});
onPet('demo-drop', () => {   // lift her up, then let gravity do the rest
  if (tucked || demoNormal) return win.webContents.send('landed');
  const bounds = win.getBounds(), { x, y } = bounds, wa = screen.getDisplayMatching(bounds).workArea;
  moveTo(x, Math.max(wa.y, y - Math.round(wa.height * 0.35)));
  setTimeout(fall, 350);
});

// Drag follows the OS cursor so fast moves never "lose" the window.
onPet('drag-start', () => {
  if (tucked || tuckMoveTimer) return;
  perch = null; floorDrop = 0;
  clearInterval(fallTimer); fallTimer = null;   // catching her mid-fall
  if (demoNormal) { const b = demoNormal; demoNormal = null; setBounds(b); }   // leaving the sofa/bed frame
  const start = screen.getCursorScreenPoint(), { x: wx, y: wy } = win.getBounds();
  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    moveTo(wx + p.x - start.x, wy + p.y - start.y);
  }, 1000 / 60);
});
onPet('drag-end', () => { clearInterval(dragTimer); dragTimer = null; if (!tucked) fall(); });

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
