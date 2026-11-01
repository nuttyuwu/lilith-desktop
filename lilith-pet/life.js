/* global spine, api, T, bubble, timefit, fire, poof, dragging, setupOn, state, data, skeleton, OUTFITS, T_BODY, T_FACE, HEAD, BLINK, BASE, show, idle, play, applyOutfit, rnd, noop,
   lines, outfit, busy, dragging, talking, tucked, demoing, frame, unitsPerDip, boundsOf, skinsFor, useSkins, headUp */
// Her own life: game voices, a day/night cycle from the PC clock, and things she decides to do by herself
// (actions, walking, pulling out her chair/sofa, sleeping at night). Loaded after pet.js and demo.js.

// ---------- voices (from the game: dialogue lines + the action clips the rig's audio events point at) ----------
let assets = { voice: {}, sfx: {} };
let lifeCfg = { voice: null, dayCycle: true, lang: 'en', chatter: 'normal', clockClothes: true };
// Tray -> How often she talks: scales the lines she starts on her own (idle chatter, app comments, the hourly chime).
// Quiet keeps only what you start (clicks, pats, the talk menu, Claude) and the important ones (good night, welcome back).
const talkRate = () => (({ chatty: 1.8, quiet: 0.15 })[lifeCfg.chatter] ?? 1) * (typeof moodRate === 'function' ? moodRate() : 1);   // alive.js: happy she talks more, hurt less   // voice null = no config yet: stay silent rather than guess a language

// Dialogue text in the chosen language (game's DialogueLineDB per language), keyed by line id.
// English stays alongside for the keyword filters (morning/night lines); voices are matched by soundId.
let lineById = {};   // every line in her language by id (dialogue.js); `lines` is the random pool
let linesLang = null, loadedLang = null, linesLoad = Promise.resolve();   // requested / actually in `lines` / in flight
function loadLines(lang = 'en') {
  if (lang === loadedLang) { flushGreet(); return Promise.resolve(); }
  if (lang === linesLang) return linesLoad;   // already loading
  linesLang = lang;
  return (linesLoad = (async () => {
    try {
      const base = (await (await fetch(BASE + 'dialogue/corpus.jsonl')).text()).split('\n').filter(Boolean).map((s) => JSON.parse(s)).filter((l) => l.en);
      const tr = {};
      if (lang !== 'en') {
        try { for (const l of await (await fetch(BASE + `dialogue/lines_${lang}.json`)).json()) tr[l.id] = l.text; }
        catch (e) { console.warn('no lines for', lang, e.message); }
      }
      if (lang !== linesLang) return;   // a newer language was picked while this one loaded: don't let it overwrite
      const all = base.map((l) => ({ ...l, text: lang === 'en' ? l.en : tr[l.id], when: timefit.whenOf(l.en) })).filter((l) => l.text);   // when: time-of-day window (timefit.js)
      lineById = Object.fromEntries(all.map((l) => [l.id, l]));
      lines = all.filter((l) => l.text.length < 160);
      loadedLang = lang;
    } catch (e) { console.warn('lines', e.message); if (lang === linesLang) linesLang = loadedLang; }   // let a retry happen
    flushGreet();
  })());
}
const clipUrl = (p) => BASE + p.split('/').map(encodeURIComponent).join('/');
// All her sounds go through one Web Audio graph instead of a new <audio> element per line: the output stream stays
// open (a speaker / amp that powers down between clips buzzes or pops every time a new stream opens), and each clip
// fades in and out over 12 ms, so neither a clip's first sample nor a line cut off by the next one clicks.
let actx = null, voice = null;
const FADE = 0.012;
const bufs = new Map();   // url -> Promise<AudioBuffer>, last 24 used (a decoded line is ~1 MB)
function audioCtx() {
  if (!actx) actx = new AudioContext({ latencyHint: 'playback' });
  if (actx.state === 'suspended') actx.resume().catch(noop);
  return actx;
}
function loadBuf(url) {
  let p = bufs.get(url);
  if (p) { bufs.delete(url); bufs.set(url, p); return p; }
  p = fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); }).then((b) => audioCtx().decodeAudioData(b));
  p.catch(() => bufs.delete(url));
  bufs.set(url, p);
  while (bufs.size > 24) bufs.delete(bufs.keys().next().value);
  return p;
}
function stopVoice() {
  const v = voice; voice = null;
  if (!v) return;
  v.stopped = true;
  const t = actx.currentTime, g = v.gain.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + FADE);   // fade, never a hard cut
  try { v.src?.stop(t + FADE + 0.005); } catch {}
}
// speech: a spoken line; an animation's sound effect (speech=false) never cuts one off mid-sentence.
function playClip(p, vol = 0.9, speech = true) {
  if (!p || !lifeCfg.voice || lifeCfg.voice === 'off') return;
  if (!speech && voice?.speech && !voice.ended) return;
  const url = clipUrl(p);
  window.__played?.push(decodeURIComponent(url));   // tests
  stopVoice();
  const ctx = audioCtx(), gain = ctx.createGain(), v = { gain, speech, ended: false, stopped: false, src: null };
  gain.gain.value = 0; gain.connect(ctx.destination); voice = v;
  loadBuf(url).then((buf) => {
    if (v.stopped) return gain.disconnect();
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(gain); v.src = src;
    const t = ctx.currentTime + 0.005, end = t + buf.duration, g = gain.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(vol, t + FADE);
    g.setValueAtTime(vol, Math.max(t + FADE, end - FADE)); g.linearRampToValueAtTime(0, end);
    src.onended = () => { v.ended = true; gain.disconnect(); };
    src.start(t);
  }).catch((e) => { v.ended = true; gain.disconnect(); console.warn('voice', p, e.message); });
}
function lineVoice(l) {
  const lang = lifeCfg.voice === 'cn' ? 'cn' : 'jp';
  return (l.soundId && assets.voice[`${l.soundId}_${lang}`]) || l[`voice_${lang}`] || null;
}
// The rig fires audio events named after the game's Chinese clip names; the extracted clips have English names.
const EVT_CLIP = {
  '2.低头偷笑': 'ShyGiggle', '4.嘟嘴': 'Pout', '5.还没完全醒': 'HalfAwake', '6.假装板着脸，马上笑了': 'SternSmile',
  '7.假装哭腔': 'FakeCry', '8.假装生气': 'FakeAngry', '9.假装委屈': 'FakeWronged', '10.撅嘴': 'Pucker',
  '12.看看空空的手': 'EmptyHands', '13.懒洋洋地挥手': 'LazyWave', '31.打哈欠，然后突然精神': 'PerkYawn',
  '32.打了个小哈欠': 'SmallYawn', '34.打哈气': 'Yawn', '35.伸懒腰': 'stand_casual_stretch', '35.伸懒腰（睡衣版）': 'stand_pajamas_stretch',
  '36.傲娇扭头': 'Tsundere', '37.晃腿（坐窗口）': 'ShakeLeg', '38.看向左右侧（坐窗口）': 'Turnhead', '41.四处张望': 'LookAround',
  '43.歪头疑惑': 'Confuse', '46.手点脸，思考': 'Think', 'Snap(响指)': 'Snap', 'Snap(消失)': 'Vanish',
};
const clipKey = (audioPath) => audioPath.replace(/^.*\//, '').replace(/\.mp3$/i, '');
let animsWithAudio = new Set();
// Clips the rig doesn't trigger itself: played when the animation starts.
const ANIM_CLIP = { stand_casual_falling: 'Falling', stand_pajamas_falling: 'Falling', stand_casual_falled: 'Falled', stand_pajamas_falled: 'Falled',
  stand_casual_sneeze_tiny: 'SneezeTiny', left_casual_walkend: 'WalkEnd', right_casual_walkend: 'WalkEnd' };

// The game's hello clips are a mix of Chinese and Japanese takes (checked with speech language ID), so each
// greeting uses only the takes in her current voice language.
const HELLO = { cn: [1, 2, 4, 5, 7, 10, 12], jp: [8, 9, 11, 13] };
// Greeting = a voiced game line (text + voice in your languages); the hello clip only when a bubble is already up.
const GREET_IDS = [1000039, 1000174, 1000202, 1000230, 1000323, 1000413, 1000440, 1000444, 1000513, 2101008, 2200012, 2200014];
let greetPending = 0;   // when a greeting is waiting for config/assets/lines (ms timestamp)
function greet() {
  if (!lifeCfg.voice || loadedLang !== lifeCfg.lang || !assetsReady) { greetPending ||= Date.now(); return; }   // config/assets/lines still loading
  greetPending = 0;
  if (bubble.classList.contains('show')) return helloClip();
  if (!lifeCfg.profile) return;   // first run: the opening performance says hello (setup.js)
  const first = !greetedOnce; greetedOnce = true;
  const today = new Date(), md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (first && lifeCfg.profile?.birthday === md) { birthdayParty(); if (fire('Birthday')) return; }   // cake, confetti and a gift
  if (first && [0, 6].includes(today.getDay()) && Math.random() < 0.4 && fire('Weekend')) return;
  if (fire(first ? (music.playing ? 'EnterGameListeningMusic' : 'EnterGame') : 'Greet') || (first && fire('EnterGame'))) return;
  if (!sayLine(GREET_IDS)) helloClip();
}
let greetedOnce = false;
function helloClip() { const n = HELLO[lifeCfg.voice]; if (n) playClip(assets.sfx[`LillthSayHello_${rnd(n)}`]); }
function flushGreet() { if (greetPending && Date.now() - greetPending < 10000) greet(); }   // a late hello is fine, a stale one isn't

let assetsReady = false;
function initVoices() {
  audioCtx();   // open the output once, up front: it stays open (no pop / buzz before each line)
  for (const a of data.animations) for (const t of a.timelines) if (t.events?.some((e) => e.data.audioPath)) animsWithAudio.add(a.name);
  state.addListener({
    start: (entry) => {
      onPoseStart(entry);
      if (entry.trackIndex !== T_BODY || !entry.animation || animsWithAudio.has(entry.animation.name)) return;
      const n = entry.animation.name;
      if (/_greet$/.test(n)) return greet();
      playClip(assets.sfx[ANIM_CLIP[n]] || assets.sfx[n], 0.9, false);
    },
    event: (entry, ev) => {
      const p = ev.data.audioPath; if (!p || entry.trackIndex !== T_BODY) return;
      const k = clipKey(p); playClip(assets.sfx[EVT_CLIP[k] || k], 0.85, false);
    },
  });
  if (/_greet$/.test(state.tracks[T_BODY]?.animation?.name || '')) greetPending = Date.now();   // the startup greeting began before this listener
  Promise.resolve(api.assets()).then((idx) => { if (idx) assets = idx; assetsReady = true; flushGreet(); }).catch(noop);
}
api.onConfig((c) => {
  lifeCfg = { ...lifeCfg, ...c };
  for (const el of document.querySelectorAll('[data-t]')) el.title = UI(el.dataset.t);
  if (data && c.lang) loadLines(c.lang); else flushGreet();
  if (c.profile?.age != null && c.profile.age < 18) OUTFITS.casual.actions = OUTFITS.casual.actions.filter((a) => a !== 'stand_casual_flirt');
  checkClock(true);
});

// The game's text variables (TextVariableResolver), filled from your profile and the PC clock.
// Date formats are built once per language: toLocale*String(loc) per call allocates a new ICU formatter, and the
// sayLine pool checks ~2000 lines per call (that alone grew the renderer by gigabytes when clicking quickly).
let fmtLang = null, fmt = null;
function formats() {
  const loc = lifeCfg.lang || 'en';
  if (fmtLang !== loc) {
    fmtLang = loc;
    try { fmt = [{ hour: '2-digit', minute: '2-digit' }, { month: 'long', day: 'numeric' }, { weekday: 'long' }].map((o) => new Intl.DateTimeFormat(loc, o)); }
    catch { fmt = [{ hour: '2-digit', minute: '2-digit' }, { month: 'long', day: 'numeric' }, { weekday: 'long' }].map((o) => new Intl.DateTimeFormat('en', o)); }
  }
  return fmt;
}
function resolveText(s) {
  if (!s.includes('{')) return s;
  const now = new Date(), name = lifeCfg.profile?.name || T('you'), [tm, dt, wd] = formats();   // dates in her text language
  return s.replace(/\{player(_name)?\}/g, () => name)
    .replace('{current_time}', () => tm.format(now))
    .replace('{current_date}', () => dt.format(now))
    .replace('{current_weekday}', () => wd.format(now))
    .replace(/\{song\}/g, () => songName || '{song}');   // the Spotify song; lines stay unresolved (skipped) without one
}
const KNOWN = /\{(player_name|player|current_time|current_date|current_weekday)\}/g;
const unresolved = (s) => /\{[a-z_]+\}/.test(s.replace(KNOWN, '').replace(/\{song\}/g, songName ? '' : '{song}'));   // {song} without Spotify, {years}...: skip

// A voiced game line in her bubble. filter: optional regex on the English text, or an array of line ids.
function sayLine(filter) {
  if (!lines.length || tucked) return false;
  const now = new Date(), ok = (l) => !unresolved(l.text) && timefit.fitsNow(l.when, now);   // checked right before she says it: no "8 AM~" at 7 PM
  let pool = lines.filter((l) => lineVoice(l) && ok(l));
  const match = Array.isArray(filter) ? (l) => filter.includes(l.id) : (l) => filter.test(l.en);
  if (filter) { const f = pool.filter(match); if (f.length) pool = f; else return false; }
  if (!pool.length) pool = lines.filter(ok);
  if (!pool.length) return false;
  const l = rnd(pool);
  show(resolveText(l.text));
  playClip(lineVoice(l));
  if (data.findAnimation('talk_happy_short')) state.setAnimation(2, talkAnim(false), activity === 'lie').listener =
    { complete: () => { if (!talking) state.setEmptyAnimation(2, 0.2); } };
  return true;
}

// ---------- day / night from the PC clock ----------
const period = (h = new Date().getHours()) => (h >= 5 && h < 11 ? 'morning' : h < 17 ? 'day' : h < 22 ? 'evening' : 'night');
const PERIOD_LINES = { morning: /\bmorning\b|woke|wake/i, day: null, evening: /evening|tonight|dinner|sunset/i, night: /night|sleep|bed|dream|late/i };
let currentPeriod = null, lastInteraction = Date.now();
// Clothes follow the clock: pajamas from 9 PM, casual from 8 AM. Only when that boundary is crossed (or at start),
// so a tray pick holds until the next one. Waits while she sleeps, is dragged or is mid-dialogue.
const clockOutfit = (h = new Date().getHours()) => (h >= 21 || h < 8 ? 'pajamas' : 'casual');
let wornByClock = null;
function followClockOutfit() {
  if (!data || !lifeCfg.dayCycle || lifeCfg.clockClothes === false || demoing || tucked || setupOn || dragging || chainOn || activity === 'sleep' || activity === 'waking') return;
  const want = clockOutfit();
  if (want === wornByClock) return;
  const first = wornByClock === null; wornByClock = want;
  if (OUTFITS[want] === outfit) return;
  if (first) { applyOutfit(want); api.outfitChanged(want); } else changeOutfit(want);   // at start: just wear it
}
function checkClock(force) {
  if (activity === 'sleep' && lifeCfg.dayCycle && clockOutfit() === 'casual' && !dragging && !demoing) wake();   // 8 AM: she gets up by herself (then changes)
  followClockOutfit();
  const p = period();
  if (p === currentPeriod && !force) return;
  const changed = currentPeriod !== null && p !== currentPeriod;
  currentPeriod = p;
  if (!data || demoing || tucked) return;
  if (changed && !busy) {
    const h = new Date().getHours(), trig = p === 'morning' ? 'TimeMorning' : p === 'night' ? (h < 5 ? 'TimeLateNight' : 'TimeNight') : null;
    (trig && fire(trig)) || sayLine(PERIOD_LINES[p]);
  }
}
// Her hourly chime (the game's TimeAware lines: "8 AM~ The new day officially begins!..."), and noticing you're gone.
let chimedHour = -1, neglected = false;
setInterval(() => {
  if (!data || tucked || demoing || setupOn) return;
  const now = new Date();
  if (now.getMinutes() <= 1 && chimedHour !== now.getHours() && activity !== 'sleep' && !busy) { chimedHour = now.getHours(); if (talkRate() >= 1) fire('TimeAware'); }   // quiet: no hourly chime
  if (!neglected && Date.now() - lastInteraction > 20 * 60000 && activity !== 'sleep' && !busy) { neglected = true; remember('sulk'); fire('Neglect'); }   // ignored for 20 min: she sulks a little
}, 20000);
setInterval(() => checkClock(false), 30000);
// ---------- unstick: anything a user would otherwise restart her for ----------
// Every 30 s: a state that hasn't changed for longer than it ever should (busy on a finished pose, an activity whose
// timer is gone, an outfit change or a tuck that never completed, a drag whose mouse-up was lost) -> back to idle.
// sleep: 30 min (SLEEP_MS) + 5 min
const STUCK_MS = { walk: 60000, chair: 180000, sit: 900000, lie: 900000, sleep: 35 * 60000, waking: 60000, standing: 60000, back: 900000, sulk: 5 * 3600000, doze: 24 * 3600000 };   // sulk: 10 min, or until you go to bed (alive.js)
const stuck = { key: '', since: 0 };
function unstick(now = Date.now()) {
  if (!data || demoing || setupOn || tucked) return null;   // tucked: peek_idle for as long as she's tucked is the point
  const body = state.tracks[T_BODY], anim = body?.animation?.name || '';
  const key = [activity, busy, anim, dragging, chainOn, !!changeTo, tuckLeaving].join('|');
  if (key !== stuck.key) { stuck.key = key; stuck.since = now; return null; }
  const age = now - stuck.since;
  let why = null;
  if (activity === 'music') return null;   // sways as long as the song plays
  if (activity && age > (STUCK_MS[activity] ?? 300000)) why = `activity ${activity}`;
  else if (!activity && busy && !talking && age > 120000) why = `busy on ${anim || 'nothing'}`;
  else if (changeTo && age > 120000) why = 'outfit change';
  else if (tuckLeaving && age > 120000) why = 'tuck';
  else if (dragging && age > 120000) why = 'drag';
  else if (chainOn && age > 300000) why = 'dialogue chain';
  if (!why) return null;
  console.warn(`unstick: ${why} for ${Math.round(age / 1000)} s`);
  if (dragging) { dragging = false; api.dragEnd(); }
  if (changeTo) { const n = changeTo; changeTo = null; applyOutfit(n, true); }
  tuckLeaving = false; stopChain();
  endActivity(false); idle();
  stuck.key = ''; return why;
}
setInterval(() => { try { unstick(); } catch (e) { console.error('unstick', e?.stack || e); } }, 30000);
setInterval(() => {   // the pillow goes away after 30 min (once she's standing free: a sparkle and plain pajamas)
  if (!pillowUntil || Date.now() < pillowUntil || busy || activity || dragging || tucked || demoing || !data) return;
  pillowUntil = 0; poof(); useSkins(wornSkins());
}, 15000);   // keeps following the clock (sleep/resume, clock changes)
let disturbs = 0, lastDisturb = 0;
for (const ev of ['mousedown', 'keydown']) window.addEventListener(ev, () => {
  lastInteraction = Date.now(); noteLateWork();
  if (neglected) { neglected = false; setTimeout(() => fire('NeglectComeback'), 300); }   // "...you came back~"
  if (activity === 'sleep' && Date.now() - lastDisturb > 4000) {   // poke her asleep: she mumbles, gets grumpier, pulls the blanket back; she sleeps on
    lastDisturb = Date.now(); disturbs++;
    remember('woken');
    if (sleepBare && disturbs >= 2) { sleepBare = false; sleepMove('sleep_pajamas_cover_blanket'); }   // "five more minutes": blanket back over her
    else if (/_idle(_bare)?$/.test(state.tracks[T_BODY]?.animation?.name || '')) sleepMove(sleepBare ? 'sleep_pajamas_twitch_bare' : 'sleep_pajamas_mumble');
    fire(disturbs === 1 ? 'SleepDisturb' : disturbs === 2 ? 'SleepDisturbFatiguedFirst' : 'SleepDisturbFatiguedSecond', { force: true });
  }
}, true);

// ---------- the rig's prop routines: birthday cake / confetti / gift, an afternoon dessert ----------
// Each pose gets its prop skin (demo.js skinsFor); the outfit's skins come back however the routine ends.
function propShow(list) {
  if (!data || activity || tucked || demoing || outfit !== OUTFITS.casual) return false;
  busy = true; state.setEmptyAnimation(T_FACE, 0.2);
  let cur = null;
  const step = (i) => {
    if (i >= list.length) { cur = null; useSkins(wornSkins()); return idle(); }
    useSkins(skinsFor(list[i]));
    const e = state.setAnimation(T_BODY, list[i], false); cur = e;
    e.listener = { complete: () => { if (cur === e) step(i + 1); }, interrupt: () => { if (cur === e) { cur = null; useSkins(wornSkins()); } } };
  };
  step(0);
  return true;
}
const birthdayParty = () => propShow(['stand_casual_cake_up', 'stand_casual_cake_idle', 'stand_casual_cake_idle', 'stand_casual_cake_end', 'stand_casual_confetti', 'stand_casual_gift_give']);
let snackDay = '';
function snack() {   // once a day around tea time
  snackDay = new Date().toDateString();
  return propShow(['stand_casual_dessert_up', 'stand_casual_dessert_idle', 'stand_casual_dessert_idle', 'stand_casual_dessert_idle']);
}

// ---------- things she decides to do ----------
let activity = null, walkDir = 0, walkLeft = 0, walkCarry = 0;
const IDLE_BIAS = {   // extra weight per period for some actions
  morning: ['stand_casual_stretch', 'stand_casual_small_yawn', 'stand_casual_perk_yawn', 'stand_casual_rub_eyes', 'stand_casual_half_awake'],
  evening: ['stand_casual_drowsy', 'stand_casual_yawn', 'stand_casual_rub_face'],
  night: ['stand_pajamas_yawn', 'stand_pajamas_drowsy_slump', 'stand_pajamas_stretch'],
};
function nextBehavior() {
  if (!data || demoing || tucked) return;
  const p = period(), casual = outfit === OUTFITS.casual;
  const idleMin = (Date.now() - lastInteraction) / 60000;
  if (p === 'night' && !casual && !perched && idleMin > 3 && Date.now() > pillowUntil && Math.random() < 0.5) return goSleep();   // the bed goes on the floor, never on a title bar
  if (perched && Math.random() < 0.6) return casual ? sitDown() : lieDown();   // standing on a window: often sits (pajamas: lies) on its edge
  if (!casual && !perched && p !== 'night' && Math.random() < 0.15) return lieDown();   // pajamas, daytime: flops down on the floor for a while
  if (music.playing) return sway();   // Spotify is playing: she listens instead of her usual routine
  const r = Math.random(), h = new Date().getHours();
  if (casual && !perched && h >= 14 && h < 17 && snackDay !== new Date().toDateString() && r < 0.25 && snack()) return;   // afternoon dessert
  if (casual && !perched && r < 0.12) return pullChair();   // no sofa or walks on a window's title bar
  if (casual && !perched && r < 0.30) return walk(Math.random() < 0.5 ? -1 : 1);
  const pool = [...outfit.actions, ...(IDLE_BIAS[p] || []).filter((a) => data.findAnimation(a) && (casual ? !/pajamas/.test(a) : /pajamas/.test(a)))];
  if (casual && flirty() && Math.random() < 0.15) { play(rnd(FLIRT_ACTS[0])); return void (Math.random() < 0.6 && sayLine(FLIRT_LINES)); }   // a bit more flirty (adults)
  const moody = typeof moodPool === 'function' && moodPool();   // alive.js: her mood picks the pose now and then
  play(rnd(moody || pool));
  if (Math.random() < 0.35 * talkRate()) fire('Idle') || sayLine(PERIOD_LINES[p]) || sayLine();   // the game's idle chatter first
}

// Walking: the rig's root motion moves the window (like the game's ParentRootMotionApplier).
const WALK_SPEED = 2550;   // skeleton units / s, measured from left_casual_walk root motion
function walk(dir) {
  activity = 'walk'; walkDir = dir; walkLeft = 2.5 + Math.random() * 4; busy = true;
  state.setEmptyAnimation(T_FACE, 0.2);
  state.setAnimation(T_BODY, dir < 0 ? 'left_casual_walk' : 'right_casual_walk', true);
}
function stopWalk() {
  if (activity !== 'walk') return;
  activity = null;
  const d = walkDir;
  play(d < 0 ? 'left_casual_walkend' : 'right_casual_walkend', () => play(d < 0 ? 'left_casual_idle' : 'right_casual_idle'));   // stays facing that way a moment
}
api.onWalkBlocked(stopWalk);

// Her chair: summons the sofa and sits for a while.
const SOFA = ['stand_casual_to_sofa', 'sit_casual_sofa_idle', 'sit_casual_sofa_doubt', 'sit_casual_get_off_sofa'];
// The bed poses rest at y~1887 (not the standing toe line -90): the frame is cut at the bed's bottom so it sits on the floor.
// stand_up climbs down ~2000 units to a floor the bed doesn't have, so she wakes with the rig's snap instead.
const SLEEP = ['sleep_pajamas_lie_down', 'sleep_pajamas_idle', 'sleep_pajamas_mumble', 'sleep_pajamas_rub_eyes', 'sleep_pajamas_snap',
  'sleep_pajamas_lie_down_bare', 'sleep_pajamas_idle_bare', 'sleep_pajamas_twitch_bare', 'sleep_pajamas_rub_eyes_bare', 'sleep_pajamas_take_blanket', 'sleep_pajamas_cover_blanket'];
// Getting up: the rig's stand_up poses start at the bed / lying height, so they play from the moment she's on her feet
// (after the snap-vanish), not from their first frame.
const footTime = {};
function onFeetAt(n) {
  if (n in footTime) return footTime[n];
  const a = data.findAnimation(n); if (!a) return 0;
  const sk = new spine.Skeleton(data), o = new spine.Vector2(), z = new spine.Vector2(), N = 40, low = [];
  sk.setSkin(skeleton.skin);
  for (let i = 0; i <= N; i++) {
    sk.setToSetupPose(); a.apply(sk, 0, a.duration * i / N, false, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
    sk.updateWorldTransform(spine.Physics.update); sk.getBounds(o, z, []); low.push(o.y);
  }
  let k = N; while (k > 0 && Math.abs(low[k - 1] - data.y) < 15) k--;   // from here on her lowest point (toes) stays on the toe line
  return (footTime[n] = Math.min(a.duration * k / N, a.duration * 0.9));
}
function standUpPlay(n) {   // after a snap-vanish: fades in standing, mid-way through the rig's stand-up
  if (!data.findAnimation(n)) return idle();
  busy = true;
  const e = state.setAnimation(T_BODY, n, false); e.mixDuration = 0; e.trackTime = onFeetAt(n);
  e.listener = { complete: () => idle() };
}
const frames = {};
function frameFor(key, anims, skins, rest) {   // rest: the pose whose lowest point is the floor (else the union's)
  if (!(key in frames)) {
    const f = boundsOf(anims, skins), g = rest && boundsOf([rest], skins);
    frames[key] = f && g && g.y > f.y ? { ...f, y: g.y, height: f.height - (g.y - f.y) } : f;
  }
  return frames[key];
}
function frameOn(f) {
  if (!f) return;
  poof();
  if (!frame) unitsPerDip = Math.max(data.width / innerWidth, data.height * HEAD / innerHeight);
  api.demoFrame({ width: Math.round(f.width / unitsPerDip), height: Math.round(f.height * HEAD / unitsPerDip) });
  frame = f;
}
function frameOff() { if (frame) { poof(); frame = null; api.demoFrame(null); } }

let actTimer = 0;
function pullChair() {
  const skins = skinsFor('sit_casual_sofa_idle');
  activity = 'chair'; busy = true;
  useSkins(skins); frameOn(frameFor('sofa', SOFA, skins));
  state.setEmptyAnimation(T_FACE, 0.2);
  state.setAnimation(T_BODY, 'stand_casual_to_sofa', false);
  state.addAnimation(T_BODY, 'sit_casual_sofa_idle', true, 0);
  actTimer = setTimeout(leaveChair, 20000 + Math.random() * 40000);
}
function leaveChair() {
  if (activity !== 'chair') return;
  clearTimeout(actTimer);
  state.setAnimation(T_BODY, 'sit_casual_get_off_sofa', false).listener = { complete: () => { if (activity === 'chair') endActivity(true); } };
}
function goSleep(bare) {   // bare: false = straight under the blanket (alive.js: to bed without you)
  const skins = skinsFor('sleep_pajamas_idle');
  activity = 'sleep'; busy = true;
  const f = frameFor('sleep', SLEEP, skins, 'sleep_pajamas_idle');
  useSkins(skins); frameOn(f);
  state.setEmptyAnimation(T_FACE, 0.2);
  sleepUntil = Date.now() + SLEEP_MS;
  // Two floors: under the blanket its edge is the floor (the frame's bottom); without it her hip and legs are, and her
  // hand and hair hang over the taskbar edge (the rig draws her on a bed). The window drops by the difference; the
  // camera eases between the two as she kicks the blanket off or pulls it back.
  sleepDrop = f ? Math.max(0, bareGround(skins) - f.y) : 0; sleepWin = false;
  setTimeout(() => { if (activity === 'sleep' && sleepDrop) api.sit(sleepDrop / (app.renderer.camera.zoom * (window.devicePixelRatio || 1)), true); }, 400);
  sleepBare = bare ?? Math.random() < 0.3;   // sometimes she flops down without the blanket and pulls it over later
  state.setAnimation(T_BODY, sleepBare ? 'sleep_pajamas_lie_down_bare' : 'sleep_pajamas_lie_down', false);
  state.addAnimation(T_BODY, sleepPose(), true, 0);
  actTimer = setInterval(() => {   // every 25 s: sleep talk, a twitch, kicking the blanket off or pulling it back
    if (activity !== 'sleep' || !/_idle(_bare)?$/.test(state.tracks[T_BODY]?.animation?.name || '')) return;
    if (Date.now() > sleepUntil) return wake();   // slept her 30 min: up by herself
    const r = Math.random();
    if (sleepBare && r < 0.25) { sleepBare = false; sleepMove('sleep_pajamas_cover_blanket'); }
    else if (sleepBare && r < 0.5) sleepMove('sleep_pajamas_twitch_bare');
    else if (!sleepBare && r < 0.08) { sleepBare = true; sleepMove('sleep_pajamas_take_blanket'); }
    else if (!sleepBare && r < 0.38) { sleepMove('sleep_pajamas_mumble'); if (Math.random() < 0.4) fire('Sleep', { force: true }); }
  }, 25000);
  disturbs = 0; setTimeout(() => activity === 'sleep' && fire('Sleep', { force: true }), 5000);
}
let sleepBare = false, sleepUntil = 0, sleepDrop = 0, sleepWin = false;
let bareFloor = null;
function bareGround(skins) {   // her lowest hip / leg point lying without the blanket (skeleton units)
  if (bareFloor != null) return bareFloor;
  const sk = new spine.Skeleton(data), s = new spine.Skin('bare');
  for (const k of skins) { const x = data.findSkin(k); if (x) s.addSkin(x); }
  sk.setSkin(s); sk.setToSetupPose(); sk.setSlotsToSetupPose();
  data.findAnimation('sleep_pajamas_idle_bare')?.apply(sk, 0, 0, false, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
  sk.updateWorldTransform(spine.Physics.update);
  let low = Infinity;
  for (const slot of sk.slots) {
    const at = slot.attachment;
    if (!at?.computeWorldVertices || !/skirt|leg/i.test(slot.data.name) || /arm|hand|hair/i.test(slot.data.name)) continue;
    const n = at.worldVerticesLength || 8, v = new Float32Array(n);
    if (at.region && at.computeWorldVertices.length === 4) at.computeWorldVertices(slot, v, 0, 2); else at.computeWorldVertices(slot, 0, n, v, 0, 2);
    for (let j = 1; j < n; j += 2) low = Math.min(low, v[j]);
  }
  return (bareFloor = Number.isFinite(low) ? low : 0);
}
const SLEEP_MS = 30 * 60000;   // left alone she sleeps 30 min; clicks don't wake her, a drag does (and she keeps her pillow)
const sleepPose = () => (sleepBare ? 'sleep_pajamas_idle_bare' : 'sleep_pajamas_idle');
function sleepMove(n) { state.setAnimation(T_BODY, n, false); state.addAnimation(T_BODY, sleepPose(), true, 0); }
function wake() {
  if (activity !== 'sleep') return;
  clearInterval(actTimer); activity = 'waking';
  state.setAnimation(T_BODY, sleepBare ? 'sleep_pajamas_rub_eyes_bare' : 'sleep_pajamas_rub_eyes', false);
  state.addAnimation(T_BODY, 'sleep_pajamas_snap', false, 0).listener = { complete: () => {   // vanishes from the bed...
    endActivity(false); standUpPlay('sleep_pajamas_stand_up'); fire('WakeUp');   // ...and fades in getting up on the floor
  } };
}
// Ends walk/chair/sleep right away (drag, tuck, Claude needs her, outfit change). graceful=true -> idle afterwards.
function endActivity(graceful) {
  if (!activity) return;
  clearTimeout(actTimer); clearInterval(actTimer);
  const floorWin = activity === 'lie' || activity === 'sleep' || activity === 'waking';
  if (seatShift || (floorWin && sleepWin)) { if (!dragging) poof(); seatShift = 0; headUp = 0; api.sit(0, floorWin); skeleton.getRootBone().y = 0; }
  sleepWin = false; sleepDrop = 0;
  if (activity === 'lie' || activity === 'standing') { skeleton.getRootBone().y = 0; fadeIn = 1; skeleton.color.a = 1; lieHold = lieRest(); lieDrop = 0; }
  activity = null; walkDir = 0;
  frameOff(); useSkins(wornSkins());
  if (graceful) idle();
}

// Sitting on a window's title bar (the game's 坐窗口 poses): legs dangle over the window.
// stand_casual_sit_down lowers the root by SIT_DROP so the seat lands on the old feet line; the sit_* loops are
// authored with root 0, so we hold the root at -SIT_DROP for them. The window moves down by SIT_DROP and the
// camera by the same amount, so the ledge stays exactly under her.
const SIT_DROP = 2157;   // skeleton units, root.y at the end of stand_casual_sit_down
let seatShift = 0, perched = false, sitUntil = 0;
function sitDown() {
  if (!data || activity || tucked || demoing || !perched || outfit !== OUTFITS.casual) return idle();
  activity = 'sit'; busy = true; sitUntil = Date.now() + (240 + Math.random() * 360) * 1000;   // sits 4-10 min, stretches her legs, sits back down
  poof(); api.sit(SIT_DROP / (app.renderer.camera.zoom * (window.devicePixelRatio || 1)));   // units -> CSS px; hidden while the window drops
}
api.onSitMoved(({ ok, up }) => {
  if (!ok) perched = false;   // main has no window under her (moved/re-placed since she landed): stop trying to sit, or every try sparkles
  if (activity === 'lie') { if (ok) { seatShift = lieDrop; headUp = up || 0; } else { lieHold = lieRest(); lieDrop = 0; } return; }   // lying on a title bar
  if (activity === 'sleep') { if (ok && !sleepWin) { sleepWin = true; seatShift = sleepDrop; poof(true); } return; }   // the bed's window dropped: same picture, then lifeTick eases
  if (activity !== 'sit') return;
  if (!ok) { activity = null; canvas.classList.remove('poof'); return idle(); }   // not on a window after all
  poof(true); seatShift = SIT_DROP; headUp = up || 0;   // keep her hidden until this frame is drawn with the new seat
  state.setEmptyAnimation(T_FACE, 0.2);
  state.setAnimation(T_BODY, 'stand_casual_sit_down', false);
  state.addAnimation(T_BODY, 'sit_casual_idle', true, 0);
  actTimer = setInterval(() => {
    if (activity !== 'sit') return;
    if (Date.now() > sitUntil) return standUp();
    if (music.playing) { if (Math.random() < 0.8) sitFidget('sit_casual_shake_leg'); }   // legs swinging to the music
    else if (Math.random() < 0.5) sitFidget(Math.random() < 0.85 || performance.now() < lookUntil ? 'sit_casual_shake_leg' : 'sit_casual_turnhead');   // the left-only head turn just once in a while (~every 2 min)
  }, 9000);
});
function sitFidget(anim) {
  if (activity !== 'sit' || /stand_casual_sit_down/.test(state.tracks[T_BODY]?.animation?.name || '')) return;
  state.setAnimation(T_BODY, anim, false); state.addAnimation(T_BODY, 'sit_casual_idle', true, 0);
}
function standUp() {   // the sit-down played backwards, then back to a normal window position
  if (activity !== 'sit') return;
  clearInterval(actTimer); activity = 'standing';
  const e = state.setAnimation(T_BODY, 'stand_casual_sit_down', false); e.reverse = true;
  e.listener = { complete: () => { poof(); seatShift = 0; headUp = 0; api.sit(0); activity = null; idle(); idleTimer = 8 + Math.random() * 10; } };
}

// Pajamas have no sit poses: like the game (PajamasIdleLie), she lies on her front instead, on a window's title bar
// or on the floor. The lie_* loops are authored ~2000 units above the root, so the root is held down (lifeTick).
// Contact points (measured, effect slots excluded): standing = toes at data.y (-90, the window bottom, pet.js),
// sitting = hands on the edge / tops of the thighs at the same line, lying = palm (lie_Lhand_0, 2074).
// On a window her palm rests on the title bar and the window extends a little below it for the hair tips (2032).
// In and out with the rig's own finger-snap + sparkle vanish (stand_pajamas_snap / lie_pajamas_snap), then a fade-in.
const LIE_THIGH = 2264, LIE_HAIR = 2032;   // measured: root hold that puts the thigh tops / hair tips on the ground line
const LIE_LOOPS = /^lie_pajamas_(idle|shake_leg|flirt|snap)$/;
const lieRest = () => LIE_THIGH - (data?.y ?? -90);   // root hold that puts her thighs on the ground line
let lieHold = 0, lieDrop = 0;   // root hold / window drop, skeleton units (lieHold 0 = not set yet)
let fadeIn = 1;
function lieDown() {
  if (!data || activity || tucked || demoing || outfit !== OUTFITS.pajamas || !data.findAnimation('lie_pajamas_idle')) return idle();
  activity = 'lie'; busy = true; sitUntil = Date.now() + (240 + Math.random() * 360) * 1000;
  state.setEmptyAnimation(T_FACE, 0.2);
  state.setAnimation(T_BODY, 'stand_pajamas_snap', false);
  state.addAnimation(T_BODY, 'lie_pajamas_idle', true, 0).mixDuration = 0;   // she has vanished by then: no blend between poses
  setTimeout(() => activity === 'lie' && fire('PajamasIdleLie'), 4500);
  actTimer = setInterval(() => {
    if (activity !== 'lie' || !/^lie_/.test(state.tracks[T_BODY]?.animation?.name || '')) return;
    if (Date.now() > sitUntil) return getUp();
    if (music.playing ? Math.random() < 0.8 : Math.random() < 0.4) lieFidget();
  }, 9000);
}
function lieFidget() {
  if (activity !== 'lie' || state.tracks[T_BODY]?.animation?.name !== 'lie_pajamas_idle') return;
  const adult = !(lifeCfg.profile?.age != null && lifeCfg.profile.age < 18);
  state.setAnimation(T_BODY, adult && !music.playing && Math.random() < 0.4 ? 'lie_pajamas_flirt' : 'lie_pajamas_shake_leg', false);
  state.addAnimation(T_BODY, 'lie_pajamas_idle', true, 0);
}
function getUp() {
  if (activity !== 'lie') return;
  clearInterval(actTimer); activity = 'standing';
  state.setAnimation(T_BODY, 'lie_pajamas_snap', false).listener = { complete: () => {   // vanishes from the edge...
    skeleton.getRootBone().y = 0; activity = null; standUpPlay('lie_pajamas_stand_up');   // ...fades in getting up
  } };
}
// The rig's appear after a snap-vanish: fade her in instead of popping.
let lastBody = '';
function onPoseStart(entry) {
  if (entry.trackIndex !== T_BODY || !entry.animation) return;
  const n = entry.animation.name, prev = lastBody; lastBody = n;
  if (/_snap$/.test(prev) && !/_snap$/.test(n)) fadeIn = 0;   // first pose after a snap-vanish
  if (n === 'lie_pajamas_idle' && prev === 'stand_pajamas_snap') {   // appearing on a title bar or the floor: sink in while still faded out
    const u = app.renderer.camera.zoom * (window.devicePixelRatio || 1);   // units per CSS px
    lieHold = lieRest(); lieDrop = LIE_THIGH - LIE_HAIR; api.sit(lieDrop / u, true);   // thighs on the line, window a bit lower so hand + hair hang over it
  }
  if (prev === 'lie_pajamas_snap' && lieDrop) { lieHold = lieRest(); lieDrop = 0; seatShift = 0; headUp = 0; api.sit(0, true); }   // got up: window back
}

// ---------- music: she sways along while Spotify plays (Spotify's own media session only, never other PC sound) ----------
// The game's stand_*_music (eyes closed, head swaying; the game's MusicListening behaviour). The casual one has an
// intro and outro around its loop/loop_end events: it loops the middle while the song plays, then finishes.
const MUSIC = { casual: ['stand_casual_music', 0.47], pajamas: ['stand_pajamas_music', 0] };
const SONG_LINES = [2051330, 2051331, 2051332];                    // "Now playing “{song}”~"
const MUSIC_START = [2051295, 2051296, 2051333, 2051294];          // "Oh my, you're listening to someone else's songs~"
const MUSIC_CLICK = [2051333, 2051334, 2051336, 2051323];          // "Lilith really likes this melody too~"
let music = { playing: false, title: '', artist: '' }, songName = '', musicTalkAt = 0;
api.onMusic((m) => {
  const was = music; music = m;
  if (m.title) songName = m.artist ? `${m.title} — ${m.artist}` : m.title;
  if (!data || tucked || demoing || setupOn) return;
  if (m.playing && lifeCfg.listen) {   // Listen along: she comments on your music in her own voiced lines
    if (!was.playing && Date.now() - musicTalkAt > 20 * 60000) { musicTalkAt = Date.now(); sayLine(MUSIC_START); }
    else if (m.title + m.artist !== was.title + was.artist) sayLine(SONG_LINES) || show(T('spotify.listen', { s: songName }), 7000);
  }
  if (m.playing && !was.playing) {
    if (activity === 'sleep') fire('SleepNoisyDisturb', { force: true });
    else if (activity === 'sit') sitFidget('sit_casual_shake_leg');
    else if (activity === 'lie') lieFidget();
    else if (!busy && !activity && !dragging && !talking) sway();
  }
});
function sway() {
  const [anim, loopAt] = MUSIC[outfit === OUTFITS.pajamas ? 'pajamas' : 'casual'];
  if (!data.findAnimation(anim)) return idle();
  activity = 'music'; busy = true;
  state.setEmptyAnimation(T_FACE, 0.2);
  state.setAnimation(T_BODY, anim, false).listener = {
    event: (e, ev) => { if (ev.data.name === 'loop_end' && music.playing && activity === 'music') { e.trackTime = loopAt; e.animationLast = loopAt; } },
    complete: () => { if (activity !== 'music') return; if (music.playing) return sway(); activity = null; idle(); },   // song stopped: outro, then back to normal
  };
}

// Called from pet.js update() every frame.
function lifeTick(dt) {
  const body = state.tracks[T_BODY]?.animation?.name || '';
  if (sleepWin && (activity === 'sleep' || activity === 'waking')) {   // blanket on: its edge on the floor; off: her hip and legs
    const bare = /_bare$/.test(body) || body === 'sleep_pajamas_take_blanket' ? 0 : sleepDrop;
    seatShift += (bare - seatShift) * Math.min(1, dt * 1.5);
  }
  if (demoing) { /* the reel shows each pose as authored (a held root sank every later pose off the screen) */ }
  else if (/^sit_casual_(idle|shake_leg|turnhead)$/.test(body)) skeleton.getRootBone().y = -SIT_DROP;
  else if (LIE_LOOPS.test(body)) skeleton.getRootBone().y = -(lieHold || lieRest());
  if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.35); skeleton.color.a = fadeIn; }
  if (/_walk/.test(state.tracks[T_BODY]?.animation?.name || '')) skeleton.getRootBone().x = 0;   // root motion goes to the window, not the drawing
  if (activity === 'walk') {
    const unitsPerCssPx = app.renderer.camera.zoom * (window.devicePixelRatio || 1);
    walkCarry += (WALK_SPEED * dt) / unitsPerCssPx * walkDir;
    const step = Math.trunc(walkCarry);
    if (step) { api.walkStep(step); walkCarry -= step; }
    if ((walkLeft -= dt) <= 0) stopWalk();
  }
}
const facing = () => {   // the rig only walks facing left (mirror for right); the pointing gesture faces pointDir (pet.js)
  const n = state.tracks[T_BODY]?.animation?.name || '';
  return /^right_casual_walk/.test(n) ? -1 : n === 'stand_casual_up_left' ? pointDir : 1;
};   // the rig only walks facing left; mirror for right
