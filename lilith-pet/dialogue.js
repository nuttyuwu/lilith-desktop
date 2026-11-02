/* global api, BASE, lines, lineById, lineVoice, playClip, resolveText, show, play, idle, state, data, outfit, OUTFITS, T_FACE,
   T_BODY, activity, tucked, demoing, dragging, setupOn, busy, bubble, timefit, skinsFor, useSkins, rnd, flirty, endActivity, unresolved, layoutUi, T, talkAnim */
// The game's own dialogue graph (DialogueDatabase: 1460 nodes, extracted to dialogue/nodes.json): which line she says
// on which trigger (touch head, greet, hourly chime, neglect, sleep, farewell...), inside which time window / date,
// with which expression and body action, what follows it (nextId chains) and which replies you can pick
// (playerLineOptions). Plus the game's "talk to Lilith" menu (PlayerLineDatabase, player_lines.json).
// fire('TouchHead') -> true when a node played. Missing files (older extraction) -> everything returns false and the
// old random-line behaviour stays.
const TRIG = { Idle: 0, TouchHead: 2, TouchBody: 3, DoubleClick: 4, DragStart: 5, DragEnd: 6, TimeMorning: 7, TimeNight: 8,
  TimeLateNight: 9, Event: 10, Greet: 12, PlayerInitiated: 13, Neglect: 14, Birthday: 15, Weekend: 16, TimeAware: 17,
  TouchFace: 18, TouchChest: 19, TouchHand: 20, TouchSkirt: 21, TouchLeg: 22, Sleep: 23, WakeUp: 24, SleepDisturb: 25,
  SleepDisturbFatiguedFirst: 26, SleepDisturbFatiguedSecond: 27, EnterGame: 28, Grow: 29, Shrink: 30, Changing: 31,
  MaxSize: 32, Overtime: 33, CallLilith: 34, WriteNote: 35, NeglectComeback: 36, GoodNight: 37, AppAwareCoding: 38,
  AppAwareVideo: 39, Farewell: 40, SitSpaceNotEnough: 41, Alarm: 42, BirthdayNote: 43, ChangeToPajamas: 44,
  PajamasIdleLie: 45, SleepNoisyDisturb: 46, SleepNoisyWake: 47, SleepStayUpTalk: 48, PlayerDisappearComeback: 49,
  FarewellPajamas: 50, FarewellLying: 55, SitOnWindowLowHeadroom: 56, FarewellPajamasDay: 57, AppAwareCodingLate: 61,
  AppAwareCodingMusic: 62, AppAwareMusicOnly: 63, EnterGameListeningMusic: 66 };
// LilithActionType -> animation suffix (stand_<outfit>_<suffix>), from the dump's enum
const ACT = ['idle', 'idle_side', 'idle_angle', 'blink', 'drag', 'falling', 'falled', 'greet', 'yawn', 'stretch', 'tsundere', 'walk',
  'walkend', 'shy_giggle', 'screen_peek', 'pout', 'half_awake', 'stern_smile', 'fake_cry', 'fake_angry', 'fake_wronged', 'pucker',
  'happy_hop', 'empty_hands', 'lazy_wave', 'blush', 'squint', 'sleepy_reach', 'drowsy', 'pillow_lie', 'beside_pat', 'rub_face',
  'rub_eyes', 'hug_ask', 'tilt_head', 'soft_wish', 'happy_sigh', 'lazy_reach', 'blanket_hold', 'blanket_blush', 'blanket_peek',
  'blanket_hug', 'perk_yawn', 'small_yawn', 'peek_idle', 'peek_end', 'sleep', 'shake_leg', 'turnhead', 'snap', 'arrange',
  'look_around', 'up_left', 'confuse', 'intro', 'spread', 'think', 'secret_hide', 'hide', 'cake_up', 'cake_idle', 'cake_end',
  'flirt', 'confetti', 'magic_cast', 'dessert_up', 'dessert_idle', 'music', 'mumble', 'rub_head', 'cover_blanket', 'tense',
  'sneeze_tiny', 'take_blanket', 'twitch_bare', 'drowsy_slump', 'stand_up', 'gift_give', 'clap', 'lie_stand_up', 'sofa_doubt',
  'sofa_stand_up'];
// actions that would yank her out of the pose or need props/positions we don't stage
const ACT_SKIP = /^(idle|blink|drag|falling|falled|walk|walkend|peek_idle|peek_end|sleep|hide|secret_hide|screen_peek|.*blanket.*|pillow_lie|lie_stand_up|sofa_.*|stand_up|music|drowsy_slump)$/;
const FLIRTY = /^(flirt|blush|hug_ask|soft_wish)$/;
const PAJ_ACT = { pout: 'tsundere', fake_angry: 'tsundere', stern_smile: 'tsundere', squint: 'tsundere', fake_wronged: 'tsundere',
  small_yawn: 'yawn', perk_yawn: 'yawn', half_awake: 'yawn', rub_eyes: 'yawn', drowsy: 'drowsy_slump', lazy_reach: 'stretch', sleepy_reach: 'stretch',
  blush: 'rub_head', shy_giggle: 'rub_head', happy_sigh: 'rub_head', soft_wish: 'rub_head', spread: 'magic_cast', confetti: 'magic_cast' };

let dlg = { ok: false, nodes: [], byId: {}, byTrig: {}, players: [], kids: {} };
let chainTimer = 0, chainNode = null, chainOn = false;
const playedKey = 'lilith.played';
let played = {};
// Saved state can be anything after a crash or a hand edit: wrong shapes reset instead of throwing later.
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
try { played = obj(JSON.parse(localStorage.getItem(playedKey) || '{}')); } catch {}
const savePlayed = () => { try { localStorage.setItem(playedKey, JSON.stringify(played)); } catch {} };

async function loadDialogue() {
  try {
    const [nodes, players] = await Promise.all(['nodes', 'player_lines'].map(async (f) => (await fetch(BASE + `dialogue/${f}.json`)).json()));
    const byTrig = {}, byId = {}, kids = {};
    for (const n of nodes) { byId[n.id] = n; for (const t of n.t) (byTrig[t] ||= []).push(n); }
    for (const p of players) (kids[p.group] ||= []).push(p);
    dlg = { ok: true, nodes, byId, byTrig, players, kids };
  } catch (e) { console.warn('dialogue graph not extracted (re-run extract_lilith.py):', e.message); }
}

// "06:00" / "1899/12/31 6:00:00" -> minutes; ranges may wrap midnight; the end is inclusive (23:59).
const minutes = (s) => { const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
function condOk(n, now = new Date()) {
  const c = n.cond || {};
  const a = minutes(c.s), b = minutes(c.e), t = now.getHours() * 60 + now.getMinutes();
  if (a != null && b != null && !(a <= b ? t >= a && t <= b : t >= a || t <= b)) return false;
  if (c.d) { const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; if (!c.d.split(/[,;\s]+/).includes(md)) return false; }
  return true;
}
const lineOf = (n) => (n.line > 0 ? lineById[n.line] : null);

// --- her memory (the game keeps these in its save; ours lives in this browser profile) ---
// Node playerStates carry the game's memory rules: 'mood:absence_1w' (you were away a week), 'need:sick' (you told
// her you're sick), 'set:sick' (playing this remembers it), 'once_story:N' (a story told once), 'mood:woken',
// 'mood:sulk' (after she was ignored), 'mood:overtime_last_night' (you coded late last night).
const memKey = 'lilith.memory', DAY = 86400000;
let mem = { flags: {}, once: {}, lastSeen: 0, overtime: '' };
try { mem = { ...mem, ...obj(JSON.parse(localStorage.getItem(memKey) || '{}')) }; } catch {}
mem.flags = obj(mem.flags); mem.once = obj(mem.once);
if (!Number.isFinite(mem.lastSeen)) mem.lastSeen = 0;
if (typeof mem.overtime !== 'string') mem.overtime = '';
const saveMem = () => { try { localStorage.setItem(memKey, JSON.stringify(mem)); } catch {} };
// How long you were away, decided once at launch from the last time she saw you.
const absence = (() => {
  const gap = mem.lastSeen ? Date.now() - mem.lastSeen : 0;
  return gap >= 365 * DAY ? 'absence_1y' : gap >= 90 * DAY ? 'absence_3m' : gap >= 30 * DAY ? 'absence_1m' : gap >= 7 * DAY ? 'absence_1w' : gap >= DAY ? 'absence_1d' : null;
})();
setInterval(() => { mem.lastSeen = Date.now(); saveMem(); }, 60000);
mem.lastSeen = mem.lastSeen || Date.now();
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function remember(flag) { mem.flags[flag] = Date.now(); saveMem(); }
// Claude / typing late at night (23-05): "you stayed up coding last night..." the next day
function noteLateWork() { const d = new Date(); if (d.getHours() >= 23 || d.getHours() < 5) { if (d.getHours() < 5) d.setDate(d.getDate() - 1); mem.overtime = dateKey(d); saveMem(); } }
// special = the memory rules of a node; null when it has none. ok = all of them hold right now.
function memoryRule(n) {
  const rules = n.ps.filter((x) => /^(mood|need|once_story):/.test(x));
  if (!rules.length) return null;
  const yesterday = new Date(Date.now() - DAY);
  const ok = rules.every((r) => {
    const [kind, v] = r.split(':');
    if (kind === 'once_story') return !mem.once[v];
    if (kind === 'need') return mem.flags[v] && Date.now() - mem.flags[v] < 7 * DAY;
    if (v.startsWith('absence_')) return absence === v;
    if (v === 'woken') return mem.flags.woken && Date.now() - mem.flags.woken < 10 * 60000;
    if (v === 'sulk') return mem.flags.sulk && Date.now() - mem.flags.sulk < 30 * 60000;
    if (v === 'overtime_last_night') return mem.overtime === dateKey(yesterday);
    return false;
  });
  return { ok };
}
function afterPlay(n) {
  for (const s of n.ps) {
    const [kind, v] = s.split(':');
    if (kind === 'set') remember(v);
    if (kind === 'need') { delete mem.flags[v]; saveMem(); }   // followed up: don't ask about the doctor twice
    if (kind === 'once_story') { mem.once[v] = 1; saveMem(); }
  }
}
// Greet lines that follow up on something you told her, but carry no rule in the data ("What did the doctor say?").
const FOLLOW_UP = /doctor|feeling any better|feel any better|still feel awful/i;

// A node is sayable when its time window / date fits, its memory rules hold, its text exists in her language (or it's
// action-only), and for minors nothing flirty (same rule as everywhere else).
function sayable(n, now) {
  if (!condOk(n, now)) return false;
  const rule = memoryRule(n);
  if (rule && !rule.ok) return false;
  const l = lineOf(n);
  if (n.line > 0 && !l) return false;
  if (l) {
    if (unresolved(l.text)) return false;
    if (l.when === 'never' ? !rule : !timefit.fitsNow(l.when, now)) return false;   // "yesterday..."/birthday text only with its rule
    if (!rule && FOLLOW_UP.test(l.en || '') && !(mem.flags.sick && Date.now() - mem.flags.sick < 7 * DAY)) return false;
  }
  if (!flirty() && FLIRTY.test(ACT[n.act] || '')) return false;
  return true;
}
// The game's pick: weighted by baseWeight among the least recently played candidates; a node whose memory rule
// holds (she remembers something about you) beats the generic ones.
function pick(list) {
  if (!list.length) return null;
  const special = list.filter((n) => memoryRule(n));
  if (special.length) list = special;
  const oldest = [...list].sort((x, y) => (played[x.id] || 0) - (played[y.id] || 0)).slice(0, Math.max(1, Math.ceil(list.length / 2)));
  let r = Math.random() * oldest.reduce((s, n) => s + Math.max(1, n.w), 0);
  for (const n of oldest) if ((r -= Math.max(1, n.w)) <= 0) return n;
  return oldest[0];
}
// Non-menu triggers only take nodes without topic states; the talk menu (PlayerInitiated) matches its topic states.
const TOPIC = (s) => !/^(mood|need|set|once_story):/.test(s);
function candidates(trig, states) {
  const now = new Date();
  return (dlg.byTrig[TRIG[trig]] || []).filter((n) => sayable(n, now) && (states ? n.ps.some((s) => states.includes(s)) : !n.ps.some(TOPIC)));
}
// fire(trigger, { states, force }): plays one node chain; false when nothing fits (caller falls back).
function fire(trig, { states = null, force = false } = {}) {
  if (!dlg.ok || !data || (tucked && !force) || demoing || setupOn) return false;
  if (chainOn && !force) return /^Touch|^DoubleClick$/.test(trig);
  if (voice?.speech && !voice.ended && !voice.stopped) return /^Touch|^DoubleClick$/.test(trig);
  if (/^Touch/.test(trig) && morningTouch()) return true;
  const n = pick(candidates(trig, states));
  if (!n) return false;
  runNode(n);
  return true;
}
// Morning context persists across restarts. Keep the actual game lines and reply chains.
function morningGreeting() {
  const now = new Date();
  if (!data || busy || activity || dragging || setupOn || tucked || demoing) return false;
  if (now.getHours() < 6 || now.getHours() >= 9 || mem.morning === dateKey(now)) return false;
  if (fire('TimeMorning')) { mem.morning = dateKey(now); saveMem(); return true; }
  return false;
}
function morningTouch() {
  const now = new Date(), day = dateKey(now);
  if (now.getHours() < 6 || now.getHours() >= 9) return false;
  if (mem.morning !== day && morningGreeting()) return true;
  if (mem.morningOut === day) return false;
  const n = pick(candidates('PlayerInitiated', ['s26_out']));
  if (!n) return false;
  mem.morningOut = day; saveMem(); runNode(n); return true;
}
// One game line by id, outside the graph (app awareness lines 2051297-2051300 have no node, and no voice).
function sayId(id) {
  const l = lineById[id];
  if (!l || !data || tucked || demoing || setupOn) return false;
  show(resolveText(l.text)); playClip(lineVoice(l)); talkMouth();
  return true;
}
function stopChain() { clearTimeout(chainTimer); chainOn = false; chainNode = null; }
// One node: text + voice in her languages, expression, action; then its reply options or the next node.
function runNode(n) {
  clearTimeout(chainTimer); chainOn = true; chainNode = n;
  played[n.id] = Date.now(); savePlayed(); afterPlay(n);
  const l = lineOf(n);
  let playback;
  let ms = l ? Math.max(2500, (n.dur || 3) * 1000) : Math.max(400, (n.dur || 0) * 1000);   // action-only nodes lead straight into their line
  if (l) {
    const text = resolveText(l.text);
    ms = Math.max(ms, text.length * 70);
    show(text, n.plo.length ? 0 : ms + 1500);
    playback = playClip((n.snd && lineVoice({ soundId: n.snd })) || lineVoice(l));
    talkMouth();
  }
  // her expression only over a plain pose: an action still playing from the last line keys its own face (two faces)
  if (n.emo && data.findAnimation(n.emo) && !busy && activity !== 'lie' && activity !== 'sleep' && !tucked && faceFree()) {
    state.setAnimation(T_FACE, n.emo, false); state.addEmptyAnimation(T_FACE, 0.3, 0);
  }
  doAction(ACT[n.act]);
  if (l && !busy && resolveText(l.text).length > 45 && Math.random() < 0.4) talkGesture();   // long line, no action of its own: she talks with her hands
  const next = n.next > 0 && dlg.byId[n.next];
  Promise.resolve(playback).then((started) => {
    if (chainNode !== n) return;
    // The Chinese recording can be longer than the node's nominal duration.
    const delay = Math.max(ms, started === true ? (voice?.duration || 0) * 1000 + 150 : 0);
    if (l) show(resolveText(l.text), n.plo.length ? 0 : delay + 1500);
    chainTimer = setTimeout(() => {
      if (chainNode !== n) return;
      if (n.plo.length) offerReplies(n);
      else if (next) runNode(next);
      else stopChain();
    }, delay);
  });
}
function talkMouth() {
  if (!data.findAnimation('talk_happy_short')) return;
  state.setAnimation(2, typeof talkAnim === 'function' ? talkAnim(false) : 'talk_happy_short', false).listener = { complete: () => state.setEmptyAnimation(2, 0.2) };
}
function doAction(suffix) {
  if (!suffix || ACT_SKIP.test(suffix) || busyPose() || busy) return;   // only from idle: never cut a landing, sit-down or reaction short
  const paj = outfit === OUTFITS.pajamas;
  // In pajamas only pajama poses: a casual one on the pajama skins drew missing / wrong arms and a skirt she isn't
  // wearing (TouchSkirt's pout -> arrange chain). The rig has 8 pajama actions; the rest map to the closest or none.
  const name = paj ? [`stand_pajamas_${suffix}`, PAJ_ACT[suffix] && `stand_pajamas_${PAJ_ACT[suffix]}`].find((a) => a && data.findAnimation(a))
    : [`stand_casual_${suffix}`].find((a) => data.findAnimation(a));
  if (!name) return;
  const props = /cake|dessert|confetti|gift/.test(suffix);
  if (props) useSkins(skinsFor(name));
  play(name, () => { if (props) useSkins(wornSkins()); idle(); });
}
// she's doing something a standing action would break (sitting/lying are handled by play()'s seated guard)
const busyPose = () => ['walk', 'chair', 'sleep', 'waking', 'standing'].includes(activity) || dragging;

// --- replies (the game's playerLineOptions) and the talk menu (PlayerLineDatabase), as chips in her bubble ---
const playerText = (id) => { const p = dlg.players.find((x) => x.id === id); const l = p && lineById[p.line]; return l ? resolveText(l.en || l.text) : null; };   // your reply chips: English, like every menu
function chips(items, onPick) {
  const row = document.createElement('div'); row.className = 'chips';
  for (const [label, v] of items) {
    const b = document.createElement('button'); b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); row.remove(); onPick(v); });
    row.appendChild(b);
  }
  bubble.appendChild(row); bubble.classList.add('show'); layoutUi(); api.hover(true);
  return row;
}
function offerReplies(n) {
  const items = n.plo.map((o) => [playerText(o.pl), o]).filter(([t]) => t);
  if (!items.length) return stopChain();
  chips(items, (o) => {
    const ids = (o.nexts && o.nexts.length ? o.nexts : [o.next]).filter((id) => dlg.byId[id]);
    if (ids.length) runNode(dlg.byId[rnd(ids)]); else stopChain();
  });
  chainTimer = setTimeout(() => { if (chainNode === n) { stopChain(); bubble.className = ''; } }, 45000);   // no answer: she lets it go
}
// Talk menu: the game's topics ("Talk about my feelings" -> "I'm feeling good" -> "Something good happened today"...)
function talkMenu(group = 0) {
  if (!dlg.ok) return false;
  const now = new Date();
  const items = (dlg.kids[group] || []).filter((p) => lineById[p.line]).filter((p) => {
    if (dlg.kids[p.id]) return true;
    if (p.ps.includes('open_music')) return true;
    return (dlg.byTrig[TRIG.PlayerInitiated] || []).some((n) => n.ps.some((s) => p.ps.includes(s)) && sayable(n, now));
  }).map((p) => [resolveText(lineById[p.line].text), p]);
  if (!items.length) return false;
  stopChain();
  show(group ? '…' : (typeof T === 'function' ? T('talk.pick') : '…'), 0);
  chips(items, (p) => {
    if (dlg.kids[p.id]) return talkMenu(p.id);
    if (p.ps.includes('open_music')) { api.toolbar('music-toggle'); return; }
    bubble.className = '';
    fire('PlayerInitiated', { states: p.ps.filter((s) => s !== 'Menu'), force: true });
  });
  return true;
}
loadDialogue();

// Quit (tray): goodbye in the right pose/outfit/time (main quits ~4 s later).
api.onFarewell(() => {
  const h = new Date().getHours(), night = h >= 21 || h < 5, paj = outfit === OUTFITS.pajamas;
  stopChain();
  const order = activity === 'lie' ? ['FarewellLying'] : paj ? [night ? 'FarewellPajamas' : 'FarewellPajamasDay'] : night ? ['GoodNight', 'Farewell'] : ['Farewell'];
  for (const t of [...order, 'Farewell']) if (fire(t, { force: true })) return;
});
// Low headroom while sitting on a window (her head would hit the top of the screen).
api.onSitMoved(({ low }) => { if (low) setTimeout(() => fire('SitOnWindowLowHeadroom'), 3000); });
// A trigger handed over by main through the page URL (size changes reload the page): Grow / Shrink / MaxSize.
const urlEv = new URLSearchParams(location.search).get('ev');
if (urlEv && TRIG[urlEv] != null) { const t0 = Date.now(), wait = setInterval(() => { if (dlg.ok && data && loadedLang) { clearInterval(wait); setTimeout(() => fire(urlEv), 2500); } else if (Date.now() - t0 > 20000) clearInterval(wait); }, 300); }
