// Your day at the PC, for her to remember (main.js feeds it every 15 s): active time per app today, how long you've
// gone without a break, whether you sat through lunch. Only app names and minutes are kept (never window titles),
// in day.json next to settings.json; it starts over each day.
// tick({ app, kind, idle }) -> events for her to mention, each once:
//   { type: 'hours', app, kind, h, since }  2 / 4 / 6 h in one app today (since: the hour you started, if it's one sitting)
//   { type: 'break', h }                    2 h at the PC without a 5-minute break (again every 2 h)
//   { type: 'lunch' }                       at the PC through 11:30-14:00 without a 20-minute gap
const fs = require('fs');
const ACTIVE_S = 120, BREAK_MS = 5 * 60000, LUNCH_GAP_MS = 20 * 60000, STREAK_GAP_MS = 15 * 60000;
const HOURS = [2, 4, 6], BREAK_H = 2;
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const fresh = (d) => ({ date: dayKey(d), apps: {}, stretchStart: 0, breakSaid: 0, lastActive: 0, lunch: { active: 0, maxGap: 0, said: false } });

function makeDay(file, now = () => Date.now()) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { s = null; }
  if (!s || typeof s !== 'object' || s.date !== dayKey(new Date(now())) || typeof s.apps !== 'object') s = fresh(new Date(now()));
  let last = now(), dirty = false;
  const save = () => { if (!dirty || !file) return; dirty = false; try { fs.writeFileSync(file, JSON.stringify(s)); } catch {} };
  function tick({ app = null, kind = null, idle = 0 } = {}) {
    const t = now(), d = new Date(t), dt = Math.min(60000, Math.max(0, t - last)); last = t;
    if (s.date !== dayKey(d)) s = fresh(d);
    const out = [], active = idle < ACTIVE_S, mins = d.getHours() * 60 + d.getMinutes();
    const lunchTime = mins >= 11 * 60 + 30 && mins < 14 * 60;
    if (lunchTime && s.lastActive) s.lunch.maxGap = Math.max(s.lunch.maxGap, t - s.lastActive);
    if (!active) {
      if (s.lastActive && t - s.lastActive >= BREAK_MS) { s.stretchStart = 0; s.breakSaid = 0; }   // you took a break
      dirty = true;
    } else {
      if (!s.stretchStart || (s.lastActive && t - s.lastActive >= BREAK_MS)) { s.stretchStart = t; s.breakSaid = 0; }
      if (lunchTime) s.lunch.active += dt;
      s.lastActive = t; dirty = true;
      const h = (t - s.stretchStart) / 3600000;
      if (h >= BREAK_H * (s.breakSaid + 1)) { s.breakSaid++; out.push({ type: 'break', h: Math.floor(h) }); }
      if (app) {
        const a = s.apps[app] ||= { ms: 0, kind, said: 0, streak: t, seen: t };
        if (t - a.seen > STREAK_GAP_MS) a.streak = t;   // away from this app a while: a new sitting
        a.ms += dt; a.seen = t; a.kind = kind;
        const next = HOURS[a.said];
        if (next && a.ms >= next * 3600000) {
          a.said++;
          const since = t - a.streak >= (next - 0.5) * 3600000 ? new Date(a.streak).getHours() : null;
          out.push({ type: 'hours', app, kind, h: next, since });
        }
      }
    }
    if (mins >= 14 * 60 && mins < 15 * 60 && !s.lunch.said) {
      s.lunch.said = true;
      if (s.lunch.active >= 90 * 60000 && s.lunch.maxGap < LUNCH_GAP_MS) out.push({ type: 'lunch' });
    }
    return out;
  }
  return { tick, save, state: () => s };
}
module.exports = { makeDay };

if (require.main === module) {   // node day.js: self-check on a fake clock
  const assert = require('assert'), os = require('os'), path = require('path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lilith-day-')), 'day.json');
  let t = new Date(2026, 9, 30, 10, 0, 0).getTime();
  const d = makeDay(file, () => t);
  const run = (min, ev) => { const out = []; for (let i = 0; i < min * 4; i++) { t += 15000; out.push(...d.tick(ev(t))); } return out; };
  const vs = { app: 'VS Code', kind: 'coding', idle: 3 };
  let ev = run(119, () => vs); assert.deepStrictEqual(ev, [], 'nothing before 2 h');
  ev = run(2, () => vs);
  assert.deepStrictEqual(ev.map((e) => e.type).sort(), ['break', 'hours']);
  assert.deepStrictEqual(ev.find((e) => e.type === 'hours'), { type: 'hours', app: 'VS Code', kind: 'coding', h: 2, since: 10 });
  // 12:01-14:00: a 10-minute break (resets the break clock), then on through lunch
  ev = run(10, () => ({ ...vs, idle: 400 })); assert.deepStrictEqual(ev, []);
  ev = run(121, () => vs);   // 12:11 -> 14:12
  assert.deepStrictEqual(ev.map((e) => e.type), ['lunch', 'hours', 'break'], JSON.stringify(ev));
  assert.deepStrictEqual(ev[1], { type: 'hours', app: 'VS Code', kind: 'coding', h: 4, since: 10 }, 'a 10-minute gap is still one sitting');
  d.save(); assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).apps['VS Code'].said, 2, 'saved: 4 h in VS Code mentioned');
  // a long gap at lunch: no lunch comment
  t = new Date(2026, 9, 31, 11, 0, 0).getTime();
  const d2 = makeDay(null, () => t), r2 = [];
  for (let i = 0; i < 4 * 60 * 3.5; i++) { t += 15000; const m = new Date(t).getHours() * 60 + new Date(t).getMinutes(); r2.push(...d2.tick({ app: 'Brave', kind: 'browsing', idle: m >= 12 * 60 && m < 12 * 60 + 40 ? 900 : 1 })); }
  assert.ok(!r2.some((e) => e.type === 'lunch'), 'went for lunch');
  console.log('day ok');
}
