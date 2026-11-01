/* global api, data, state, outfit, OUTFITS, activity, busy, tucked, demoing, setupOn, dragging, talking, chainOn, perched, lifeCfg,
   fire, sayLine, show, T, play, idle, endActivity, goSleep, wake, sleepMove, sleepBare, lookAtYou, faceFree, T_FACE, T_BODY, remember,
   mem, saveMem, absence, dlg, pick, sayable, runNode, dateKey, DAY, propShow, period, clockOutfit, lineById, lineVoice, resolveText, playClip, stopChain, smoothLoop,
   lieDown, talkGesture, rnd */
// What makes her feel alive between your clicks. Her own poses and the game's voiced lines wherever it has one.
//  presence    main's feed (system idle every 15 s, lock / unlock / sleep / wake): she notices you leave and come back,
//              and dozes off when you've been gone an hour
//  night       after midnight and still at the PC: a yawn, then hmph, then pouting, then she turns her back
//              (in pajamas she goes to bed without you). Going idle for 5 minutes (you went to bed) ends it.
//  mood        saved, settles back toward neutral over hours. Head pats raise it; poke spam, being dragged out of bed,
//              being dragged around, days away lower it. Poke spam: she sulks 10 min with her back to you; three head
//              pats make up. Her mood picks her idle poses and how much she talks.
//  your day    main's day.js: hours in one app, no break, sat through lunch. Each said once, at a good moment.
//  music       skipping song after song
//  milestones  days together: 7, 30, 50, 100, 200, 300, 500, 730, 1000 and every year
const free = () => data && !tucked && !demoing && !setupOn && !dragging && !chainOn && !talking;
const casualNow = () => outfit === OUTFITS.casual;
function act(anim) { if (!busy && !activity && data?.findAnimation(anim)) play(anim); }

// ---------- mood ----------
const moodKey = 'lilith.mood', MOOD_HALF_LIFE = 6 * 3600000;
let moodS = { v: 0, t: Date.now(), sulkUntil: 0, absAt: 0 };
try { const o = JSON.parse(localStorage.getItem(moodKey) || '{}'); if (o && Number.isFinite(o.v) && Number.isFinite(o.t)) moodS = { ...moodS, v: o.v, t: o.t, absAt: Number.isFinite(o.absAt) ? o.absAt : 0 }; } catch {}
const saveMood = () => { try { localStorage.setItem(moodKey, JSON.stringify(moodS)); } catch {} };
function mood(now = Date.now()) { return moodS.v * 0.5 ** (Math.max(0, now - moodS.t) / MOOD_HALF_LIFE); }
function moodAdd(d) { const now = Date.now(); moodS.v = Math.max(-100, Math.min(100, mood(now) + d)); moodS.t = now; saveMood(); }
const moodRate = () => { const m = mood(); return m > 40 ? 1.3 : m < -30 ? 0.6 : 1; };   // life.js talkRate
// Days away hurt (dialogue.js decided how long at launch; a reload in the same sitting doesn't count it twice)
const ABSENCE_HURT = { absence_1d: 5, absence_1w: 20, absence_1m: 35, absence_3m: 45, absence_1y: 50 };
if (absence && Date.now() - moodS.absAt > 6 * 3600000) { moodS.absAt = Date.now(); moodAdd(-ABSENCE_HURT[absence]); }
// Idle poses by mood (life.js nextBehavior): happy -> blushing / giggling, low -> pouting / wronged.
function moodPool() {
  const m = mood(), c = casualNow();
  if (m > 40 && Math.random() < 0.3) return c ? ['stand_casual_blush', 'stand_casual_shy_giggle', 'stand_casual_happy_sigh'] : ['stand_pajamas_rub_head', 'stand_pajamas_stretch'];
  if (m < -30 && Math.random() < 0.35) return c ? ['stand_casual_pout', 'stand_casual_fake_wronged', 'stand_casual_look_down'] : ['stand_pajamas_tsundere', 'stand_pajamas_drowsy_slump'];
  return null;
}
let patMoodAt = 0;
function moodPat() { if (Date.now() - patMoodAt > 20000) { patMoodAt = Date.now(); moodAdd(5); } }   // pet.js startPat
const drags = [];
function moodDrag(fromBed) {   // pet.js: a drag starts
  const now = Date.now();
  if (fromBed) { moodAdd(-10); remember('woken'); }
  drags.push(now); while (drags.length && now - drags[0] > 60000) drags.shift();
  if (drags.length >= 3) { drags.length = 0; moodAdd(-5); }
}

// ---------- poke spam and sulking ----------
const POKE_WARN = [1000319];   // "Kyaa! You startled me~ poke me like that again and Lilith's gonna pretend to be maaad!"
const HMPH = [200346];         // "...Hmph, that person! Lilith can hold a grudge, you know."
const MAKE_UP = [1000320, 1000321];   // "...Hmhm, just this once, 'kay~?"
const SULK_MS = 10 * 60000;
let pokes = [], warnedAt = 0, sulkPats = 0, sulkWhy = '';
// pet.js: a click on her standing (not a pat, not a drag). true: handled here, skip the usual reaction.
function notePoke() {
  const now = Date.now();
  pokes = pokes.filter((t) => now - t < 8000); pokes.push(now);
  if (pokes.length >= 7) { pokes = []; return sulk(SULK_MS, 'poke'); }
  if (pokes.length === 4 && now - warnedAt > 60000) {
    warnedAt = now; moodAdd(-3);
    if (!activity) play(casualNow() ? 'stand_casual_fake_angry' : 'stand_pajamas_tsundere');   // over whatever the last poke started
    return sayLine(POKE_WARN) || true;
  }
  moodAdd(pokes.length <= 2 ? 1 : -2);   // a poke now and then is attention; a stream of them isn't
  return false;
}
function sulk(ms, why) {
  if (!data || tucked || demoing || setupOn || dragging) return false;
  stopChain(); endActivity(false);
  activity = 'sulk'; busy = true; sulkPats = 0; sulkWhy = why;
  moodS.sulkUntil = Date.now() + ms; moodAdd(why === 'poke' ? -15 : -8); remember('sulk');   // 'mood:sulk' lines in the game's graph
  state.setEmptyAnimation(T_FACE, 0.2);
  if (casualNow()) { state.setAnimation(T_BODY, 'stand_casual_back_prepare', false); state.addAnimation(T_BODY, 'stand_casual_back', true, 0); }
  else { state.setAnimation(T_BODY, 'stand_pajamas_tsundere', false); state.addAnimation(T_BODY, outfit.idle, true, 0); if (faceFree()) state.addAnimation(T_FACE, 'emoji_wronged_1', true, 2.3); }
  if (why === 'night') show(T('night.turn'), 6000); else sayLine(HMPH) || show(T('mood.hmph'), 3000);
  return true;
}
function endSulk(forgiven) {
  if (activity !== 'sulk') return;
  activity = null; moodS.sulkUntil = 0; saveMood(); state.setEmptyAnimation(T_FACE, 0.2);
  if (!forgiven) return idle();
  moodAdd(12);
  play(casualNow() ? 'stand_casual_shy_giggle' : 'stand_pajamas_rub_head');
  sayLine(MAKE_UP) || show(T('mood.forgive'), 4000);
  lookAtYou(2500);
}
// pet.js mouseup while she sulks or dozes. head: on her head (a pat), else a poke.
function aliveClick(head) {
  if (activity === 'doze') return wakeDoze(0);
  if (activity !== 'sulk') return;
  if (head) { if (++sulkPats >= 3) return endSulk(true); show(T('mood.hmph'), 2000); return; }
  moodS.sulkUntil = Math.max(moodS.sulkUntil, Date.now()) + 60000; show(T('mood.hmph'), 2000);   // more poking: longer
}
// pet.js startPat while sulking: a pat counts toward making up, she doesn't lean into it yet. true: handled.
function sulkPat() { if (activity !== 'sulk') return false; aliveClick(true); return true; }
setInterval(() => { if (activity === 'sulk' && Date.now() > moodS.sulkUntil) endSulk(false); }, 5000);

// ---------- presence: away, back, dozing ----------
let awaySince = 0, locked = false, dozing = false;
const AWAY_S = 600, DOZE_MS = 60 * 60000;
function onSys(v) {
  const now = Date.now();
  if (v.ev === 'lock' || v.ev === 'suspend') { locked = true; awaySince ||= now; return; }
  if (v.ev === 'unlock' || v.ev === 'resume') { locked = false; if (awaySince) back(now - awaySince); return; }
  const idle = Number(v.idle); if (!Number.isFinite(idle)) return;
  nightCheck(idle, now);
  if (idle >= AWAY_S && !awaySince) awaySince = now - idle * 1000;
  if (awaySince && !dozing && now - awaySince >= DOZE_MS) doze();
  if (awaySince && !locked && idle < 20) back(now - awaySince);
}
api.onSys?.((v) => { try { if (v && typeof v === 'object') onSys(v); } catch (e) { console.error('sys', e?.stack || e); } });
function doze() {
  if (!data || tucked || demoing || setupOn || dragging || activity === 'sleep' || activity === 'sulk' || activity === 'doze') return;
  dozing = true;
  if (!casualNow()) { endActivity(false); return perched ? lieDown() : goSleep(); }   // pajamas: to bed (on a title bar: lies down)
  if (activity) return;   // sitting on a window / swaying / in her chair: she dozes there
  activity = 'doze'; busy = true; state.setEmptyAnimation(T_FACE, 0.2);
  smoothLoop(T_BODY, 'stand_casual_drowsy');
}
function wakeDoze(min) {
  dozing = false;
  if (activity === 'doze') {
    activity = null; play('stand_casual_perk_yawn');
    const h = new Date().getHours();
    setTimeout(() => (h >= 12 && h < 17 && sayLine([1000228])) || comeback(min * 60000), 1500);   // "Lilith's just having an afternoon nap!"
  } else if (activity === 'sleep' && clockOutfit() === 'casual') wake();   // daytime nap: up she gets
  else if (activity === 'sleep') sleepMove(sleepBare ? 'sleep_pajamas_twitch_bare' : 'sleep_pajamas_mumble');   // night: she stirs and sleeps on
  if (min) flushDay(9000);
}
// The game's comeback lines, by how long you were gone ("You were gone a whole day~" only after a whole day).
function comeback(ms) {
  const ids = [820010, 820011, 820012, ...(ms >= 3600000 ? [820014] : []), ...(ms >= 12 * 3600000 ? [820013] : [])];
  const n = pick(ids.map((id) => dlg.byId[id]).filter((x) => x && sayable(x, new Date())));
  if (n && !chainOn && !tucked && !demoing && !setupOn) { runNode(n); return true; }
  return fire('Greet');
}
function back(ms) {
  awaySince = 0;
  if (dozing) return wakeDoze(ms / 60000);
  if (ms < AWAY_S * 1000 || !free()) return flushDay(4000);
  if (activity === 'sleep') return sleepMove(sleepBare ? 'sleep_pajamas_twitch_bare' : 'sleep_pajamas_mumble');
  lookAtYou(1200);
  setTimeout(() => comeback(ms), 800);   // "All finished up at last, hm~?"
  flushDay(9000);
}

// ---------- night: still up after midnight ----------
const NAG_MS = 10 * 60000, REST_S = 300;
let night = { active: 0, level: 0, last: 0 };
function nightCheck(idle, now) {
  const late = new Date(now).getHours() < 5, gap = night.last ? now - night.last : 15000; night.last = now;
  if (!late || idle >= REST_S) {   // morning, or you went to bed: all forgiven
    if (activity === 'sulk' && sulkWhy === 'night') endSulk(false);
    night.active = 0; night.level = 0; return;
  }
  if (idle < 60) night.active += Math.min(gap, 30000);
  if (!data || tucked || demoing || setupOn || dragging) return;
  const want = Math.min(4, Math.floor(night.active / NAG_MS));
  if (want > night.level) { night.level = want; nag(want); }
}
function nag(n) {
  const paj = !casualNow(), asleep = activity === 'sleep';
  if (n === 1) {
    if (asleep) { sleepMove(sleepBare ? 'sleep_pajamas_twitch_bare' : 'sleep_pajamas_mumble'); fire('SleepStayUpTalk', { force: true }); }   // "Aren't you gonna... go to sleep yet~..."
    else { act(paj ? 'stand_pajamas_yawn' : 'stand_casual_yawn'); fire('TimeLateNight', { force: true }) || fire('Overtime', { force: true }); }
  } else if (n === 2) {
    if (asleep) { sleepMove(sleepBare ? 'sleep_pajamas_rub_eyes_bare' : 'sleep_pajamas_rub_eyes'); fire('SleepStayUpTalk', { force: true }); }
    else { act(paj ? 'stand_pajamas_tsundere' : 'stand_casual_tense'); fire('Overtime', { force: true }) || show(T('mood.hmph'), 3000); }   // "Your eyes must be sore by now..." 
  } else if (n === 3) {
    moodAdd(-5);
    const pout = () => { act(paj ? 'stand_pajamas_tsundere' : 'stand_casual_pout'); if (faceFree()) state.setAnimation(T_FACE, 'emoji_wronged_1', false); fire('Overtime', { force: true }); };
    if (asleep) { wake(); setTimeout(pout, 8000); } else pout();   // she gets up to tell you
  } else {
    moodAdd(-5);
    if (paj && !perched && activity !== 'sleep') { endActivity(false); goSleep(false); setTimeout(() => show(T('night.snub'), 6000), 1500); }   // to bed without you, under the blanket
    else if (activity !== 'sleep') sulk(5 * 3600000, 'night');   // back turned until you go to bed
  }
}

// ---------- your day (main: day.js) ----------
const BREAK_LINES = [1000109, 1000057, 2100091];   // "You've been busy for a while now... how about a little break?"
const LUNCH_LINES = [1000111, 1000055, 200395];    // "Don't forget to eat, okay~"
let dayQ = [], dayTalkAt = 0, dayTimer = 0;
api.onDay?.((e) => {
  if (!e || typeof e !== 'object') return;
  dayQ.push({ ...e, at: Date.now() });
  if (e.type === 'break' || e.type === 'lunch') flushDay(3000);   // these matter now
});
function flushDay(ms = 0) { clearTimeout(dayTimer); dayTimer = setTimeout(sayDay, ms); }
const hourText = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); try { return new Intl.DateTimeFormat(lifeCfg.lang || 'en', { hour: 'numeric' }).format(d); } catch { return `${h}:00`; } };
function sayDay() {
  dayQ = dayQ.filter((e) => Date.now() - e.at < 2 * 3600000);   // old news
  if (!dayQ.length || !free() || busy || awaySince || Date.now() - dayTalkAt < 10 * 60000) return false;
  if (activity === 'sleep' || activity === 'sulk' || activity === 'doze') return false;
  const e = dayQ.shift(); dayTalkAt = Date.now();
  if (e.type === 'break') return sayLine(BREAK_LINES);
  if (e.type === 'lunch') return sayLine(LUNCH_LINES);
  if (e.type === 'hours' && e.app) {
    show(e.since != null ? T('day.since', { app: e.app, t: hourText(e.since), h: e.h }) : T('day.hours', { app: e.app, h: e.h }), 7000);
    if (!activity) talkGesture();
    return true;
  }
  return false;
}
setInterval(sayDay, 60000);

// ---------- music: skipping song after song ----------
let track = { key: '', at: 0 }, skips = [], skipTalkAt = 0;
api.onMusic?.((m) => {
  if (!m || !m.playing || !m.title) return;
  const key = `${m.title}|${m.artist}`, now = Date.now();
  if (key === track.key) return;
  if (track.key && now - track.at < 35000) skips.push(now);
  track = { key, at: now };
  skips = skips.filter((t) => now - t < 4 * 60000);
  if (skips.length < 3 || now - skipTalkAt < 20 * 60000) return;
  skips = []; skipTalkAt = now;
  setTimeout(() => { if (!free()) return; show(T('music.skips'), 6000); act(casualNow() ? 'stand_casual_confuse' : 'stand_pajamas_tsundere'); }, 4000);   // after her "Now playing~"
});

// ---------- days together ----------
const MILESTONES = [7, 30, 50, 100, 200, 300, 500, 730, 1000];
let sinceAt = 0, milestoneTries = 0;
api.onConfig?.((c) => { if (c && Number.isFinite(c.since) && c.since > 0) { const first = !sinceAt; sinceAt = c.since; if (first) setTimeout(milestone, 20000); } });   // after her greeting
function daysTogether(now = new Date()) {
  const a = new Date(sinceAt), b = new Date(now); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / DAY);
}
function milestone() {
  if (!sinceAt || !data || !lifeCfg.profile) return;
  const n = daysTogether(), key = dateKey(new Date()), years = n > 0 && n % 365 === 0 ? n / 365 : 0;
  if (mem.milestone === key || (!years && !MILESTONES.includes(n))) return;
  if (!free() || busy || activity) { if (++milestoneTries < 20) setTimeout(milestone, 60000); return; }
  mem.milestone = key; saveMem(); moodAdd(10);
  if (casualNow()) propShow(['stand_casual_clap', 'stand_casual_confetti', 'stand_casual_gift_give']); else play('stand_pajamas_magic_cast');
  setTimeout(() => {
    const l = years && lineById[2051273];   // "Happy anniversary! Year {years} of just the two of us..."
    if (l) { show(resolveText(l.text).replace('{years}', years), 8000); playClip(lineVoice(l)); }
    else show(n === 7 ? T('milestone.week') : T('milestone.days', { n }), 8000);
  }, 1200);
}
setInterval(() => { milestoneTries = 0; milestone(); }, 30 * 60000);   // a new day while she's running
