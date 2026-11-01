// Persistent pet settings + pure window layout (unit-testable without Electron).
const fs = require('fs');
const path = require('path');

const SIZES = { mini: 0.25, small: 0.45, medium: 0.65, large: 0.85 };   // fraction of the screen's work-area height
const DEFAULTS = { display: 'primary', size: 'small', alwaysOnTop: true, pos: null, voice: 'jp', dayCycle: true, profile: null, lang: null, listen: false, quality: 'auto',
  appAware: true, chatter: 'normal', clockClothes: true, hideFullscreen: true, claudeHook: true, since: 0 };   // since: the day you met her (ms)   // appAware: comments on the app in front / turns her back on private windows
// Text languages the game ships (extract_lilith.py -> dialogue/lines_<tag>.json). voice: the game's matching voice track.
const LANGS = [['en', 'English'], ['zh-CN', '简体中文', 'cn'], ['zh-Hant', '繁體中文', 'cn'], ['zh-HK', '粵語 (香港)', 'cn'], ['ja', '日本語', 'jp'],
  ['ko', '한국어'], ['de', 'Deutsch'], ['fr', 'Français'], ['es-419', 'Español'], ['pt-BR', 'Português (Brasil)'], ['it', 'Italiano'],
  ['pl', 'Polski'], ['ru', 'Русский'], ['uk', 'Українська'], ['tr', 'Türkçe'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['id', 'Bahasa Indonesia']];
// OS locale ('en-US', 'zh-TW', 'pt-BR', 'mn'...) -> one of LANGS, English if the game has no match.
function langFromLocale(loc = 'en') {
  const l = loc.toLowerCase();
  if (l.startsWith('zh')) return /hk|mo/.test(l) ? 'zh-HK' : /tw|hant/.test(l) ? 'zh-Hant' : 'zh-CN';
  if (l.startsWith('es')) return 'es-419';
  if (l.startsWith('pt')) return 'pt-BR';
  const hit = LANGS.find(([t]) => t === l.slice(0, 2));
  return hit ? hit[0] : 'en';
}
// The voice she actually uses: Chinese/Japanese text always gets its own voice track (never Chinese text with Japanese
// audio); other languages use the voice you picked. 'off' always wins.
const voiceFor = (lang) => (LANGS.find((l) => l[0] === lang) || [])[2] || null;
const effectiveVoice = (s) => (s.voice === 'off' ? 'off' : voiceFor(s.lang) || (s.voice === 'cn' ? 'cn' : 'jp'));
const ASPECT = 0.6;  // her width / height, matches the rig's bounds
const SIDE = 1.4;    // window is 40% wider than her: hair swinging out in falls/landings/turns isn't cut at the window edge
const HEAD = 1.3;     // window is 30% taller than her: room for the speech bubble above her head (pet.js uses the same value)

// A missing file = first run. A broken one (cut off by a crash or power loss mid-write, hand-edited) is kept as
// settings.json.bad and she starts on defaults; values of the wrong type fall back one by one.
function load(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return { ...DEFAULTS }; }
  try {
    const s = JSON.parse(raw);
    if (s && typeof s === 'object' && !Array.isArray(s)) return clean({ ...DEFAULTS, ...s });
  } catch {}
  try { fs.renameSync(file, file + '.bad'); } catch {}
  return { ...DEFAULTS };
}
const CHOICES = { size: Object.keys(SIZES), quality: ['auto', 'high', 'low'], voice: ['jp', 'cn', 'off'], chatter: ['chatty', 'normal', 'quiet'] };
function clean(s) {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (k === 'display' || v === null) continue;   // display: 'primary' | 'largest' | a screen id
    if (typeof s[k] !== typeof v || (CHOICES[k] && !CHOICES[k].includes(s[k]))) s[k] = v;
  }
  if (s.pos && (typeof s.pos !== 'object' || !Number.isFinite(s.pos.x))) s.pos = null;
  if (s.profile && typeof s.profile !== 'object') s.profile = null;
  if (s.lang != null && !LANGS.some((l) => l[0] === s.lang)) s.lang = null;
  return s;
}
function save(file, s) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(s, null, 2));
  fs.renameSync(file + '.tmp', file);
}

// Electron Display: {id, bounds, workArea, scaleFactor, size}
const pixels = (d) => d.size.width * d.size.height * d.scaleFactor * d.scaleFactor;
function pickDisplay(displays, primaryId, choice) {
  const primary = displays.find((d) => d.id === primaryId) || displays[0];
  if (choice === 'largest') return displays.reduce((a, b) => (pixels(b) > pixels(a) ? b : a));
  if (choice === 'primary') return primary;
  return displays.find((d) => String(d.id) === String(choice)) || primary;
}

// The transparent margin also contains hair, speech bubbles and controls. Keep the
// whole ordinary window on-screen; tuckBounds is the intentional exception.
function clampX(x, width, workArea) {
  const left = workArea.x, right = Math.max(left, workArea.x + workArea.width - width);
  return Math.round(Math.min(Math.max(Number.isFinite(x) ? x : left, left), right));
}

function layout(displays, primaryId, s) {
  const d = pickDisplay(displays, primaryId, s.display), wa = d.workArea;
  const her = Math.round(wa.height * (SIZES[s.size] || SIZES.small));
  const h = Math.min(Math.round(her * HEAD), wa.height), w = Math.min(Math.round(her * ASPECT * SIDE), wa.width);
  let x = wa.x + wa.width - w + (w - w / SIDE) / 2 - 20;   // preferred body inset, limited below to keep speech and hair visible
  const y = wa.y + wa.height - h;   // gravity: she always stands on the floor (taskbar edge)
  if (s.pos && String(s.pos.display) === String(d.id)) x = s.pos.x;
  return { display: d, bounds: { x: clampX(x, w, wa), y: Math.round(y), width: w, height: h } };
}

// Tuck: slide most of her off a screen edge that has no neighbouring monitor, feet on the floor.
const PEEK = 0.35;   // fraction of her width left visible when tucked
const TUCK_W = 1.6;   // tucked window is wider so the lean doesn't clip her hair at the window edge (height, so scale, unchanged)
// cx: her centre x before tucking -> the nearer edge, unless another monitor sits on that side.
function tuckBounds(displays, d, w, h, cx = Infinity) {
  w /= SIDE;   // her width; she's centred in the wider window
  const wa = d.workArea, midY = wa.y + wa.height / 2;
  const hasNeighbour = (x) => displays.some((o) => o.id !== d.id && x >= o.bounds.x && x < o.bounds.x + o.bounds.width && midY >= o.bounds.y && midY < o.bounds.y + o.bounds.height);
  // shortcut: if both sides have a monitor, she peeks out onto the right-hand one; fine for 2-screen setups
  const leftFree = !hasNeighbour(d.bounds.x - 1), rightFree = !hasNeighbour(d.bounds.x + d.bounds.width + 1);
  const left = leftFree && (cx < wa.x + wa.width / 2 || !rightFree);
  const W = Math.round(w * TUCK_W), centre = left ? wa.x - (0.5 - PEEK) * w : wa.x + wa.width + (0.5 - PEEK) * w;
  return { x: Math.round(centre - W / 2), y: wa.y + wa.height - h, width: W, height: h };
}

// Gravity target: the nearest visible window title bar under her feet, else the floor.
// wins: front-to-back, DIP rects {id,x,y,w,h,max}. Returns {top, id|null}.
function landing(wins, footX, feetY, floorY) {
  let best = { top: floorY, id: null };
  wins.forEach((r, i) => {
    if (r.max || footX < r.x + 24 || footX > r.x + r.w - 24) return;
    if (r.y < feetY - 4 || r.y >= best.top) return;                     // must be below her feet, and nearer than the best so far
    const covered = wins.slice(0, i).some((f) => footX >= f.x && footX <= f.x + f.w && r.y + 2 >= f.y && r.y + 2 <= f.y + f.h);
    if (!covered) best = { top: r.y, id: r.id };
  });
  return best;
}

function displayLabel(d, i, primaryId) {
  const px = `${Math.round(d.size.width * d.scaleFactor)}×${Math.round(d.size.height * d.scaleFactor)}`;
  return `Screen ${i + 1}: ${px}${d.scaleFactor !== 1 ? ` @${Math.round(d.scaleFactor * 100)}%` : ''}${d.id === primaryId ? ' (primary)' : ''}`;
}

module.exports = { SIDE, LANGS, langFromLocale, voiceFor, effectiveVoice,SIZES, DEFAULTS, PEEK, TUCK_W, HEAD, landing, load, save, pickDisplay, clampX, layout, tuckBounds, displayLabel };

if (require.main === module) {   // node settings.js: self-check of load()
  const assert = require('assert'), os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lilith-set-')), f = path.join(dir, 'settings.json');
  assert.deepStrictEqual(load(f), DEFAULTS, 'missing file: defaults');
  fs.writeFileSync(f, '{"size": "large", "voice": "cn", "dayC');   // cut off mid-write
  assert.deepStrictEqual(load(f), DEFAULTS); assert.ok(fs.existsSync(f + '.bad'), 'broken file kept aside');
  fs.writeFileSync(f, 'null'); assert.deepStrictEqual(load(f), DEFAULTS);
  fs.writeFileSync(f, JSON.stringify({ size: 'huge', voice: 7, dayCycle: 'yes', quality: 'low', lang: 'xx', pos: 5, display: 12345, profile: { name: 'K' } }));
  const s = load(f);
  assert.deepStrictEqual([s.size, s.voice, s.dayCycle, s.quality, s.lang, s.pos, s.display, s.profile.name], ['small', 'jp', true, 'low', null, null, 12345, 'K']);
  save(f, s); assert.deepStrictEqual(load(f), s, 'round trip');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('settings ok');
}
