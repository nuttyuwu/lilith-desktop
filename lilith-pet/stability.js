// Stability helpers for main.js, kept pure so they're unit-tested (node stability.js).
const fs = require('fs');

// The log: capped at `max` bytes (then it becomes <file>.old and a new one starts), and log.once(key, ...) writes a
// repeating message once per `quiet` ms, with how many repeats it skipped. One bad frame used to write 60 lines a second.
function makeLogger(file, { max = 1 << 20, quiet = 60000, now = Date.now } = {}) {
  let size = 0;
  try { size = fs.statSync(file).size; } catch {}
  const seen = new Map();   // key -> { at, skipped }
  const write = (line) => {
    try {
      const n = Buffer.byteLength(line);
      if (size + n > max) { try { fs.renameSync(file, file + '.old'); } catch {} size = 0; }   // replaces the previous .old
      fs.appendFileSync(file, line); size += n;
    } catch {}   // a log that can't be written must never take her down
  };
  const log = (...a) => write(`[${new Date(now()).toISOString()}] ${a.join(' ')}\n`);
  log.once = (key, ...a) => {
    const t = now(), s = seen.get(key);
    if (s && t - s.at < quiet) { s.skipped++; return false; }
    if (s?.skipped) a.push(`(repeated ${s.skipped}x in the last ${Math.round((t - s.at) / 1000)} s)`);
    seen.delete(key); seen.set(key, { at: t, skipped: 0 });
    if (seen.size > 500) seen.delete(seen.keys().next().value);
    log(...a);
    return true;
  };
  return log;
}

// At most `limit` restarts per `windowMs`: past that, stop and show an error instead of looping.
function budget(limit, windowMs, now = Date.now) {
  let ts = [];
  return () => {
    const t = now();
    ts = ts.filter((x) => t - x < windowMs);
    if (ts.length >= limit) return false;
    ts.push(t);
    return true;
  };
}

// A start that never draws: 1st time try again, 2nd time at low texture quality, then give up with an error.
const startupStep = (fails) => (fails <= 1 ? 'reload' : fails === 2 ? 'low' : 'fatal');

// The last `bytes` of the log (and its .old part when the current one is short), for Tray -> Copy log.
function logTail(file, bytes = 200000) {
  const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  const cur = read(file), all = cur.length < bytes ? read(file + '.old') + cur : cur;
  const tail = all.slice(-bytes);
  return tail.slice(tail.indexOf('\n[') + 1 || 0);   // start at a whole line
}

module.exports = { makeLogger, budget, startupStep, logTail };

if (require.main === module) {   // node stability.js: self-check
  const assert = require('assert'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lilith-log-')), f = path.join(dir, 'x.log');
  let t = 0;
  const log = makeLogger(f, { max: 2000, quiet: 60000, now: () => t });
  for (let i = 0; i < 1000; i++) { log.once('frame:boom', 'renderer error boom'); t += 16; }   // 16 s of an error every frame
  assert.strictEqual(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length, 1, 'repeats suppressed');
  t += 60000; log.once('frame:boom', 'renderer error boom');
  assert.match(fs.readFileSync(f, 'utf8'), /repeated 999x/);
  for (let i = 0; i < 100; i++) log('line', i, 'x'.repeat(40));
  assert.ok(fs.statSync(f).size <= 2000 && fs.statSync(f + '.old').size <= 2000, 'capped with one backup');
  assert.match(logTail(f, 1500), /^\[/);
  assert.ok(logTail(f, 1e6).includes('line 99'));
  const b = budget(3, 600000, () => t);
  assert.deepStrictEqual([b(), b(), b(), b()], [true, true, true, false]);
  t += 600001; assert.ok(b());
  assert.deepStrictEqual([1, 2, 3, 9].map(startupStep), ['reload', 'low', 'fatal', 'fatal']);
  assert.strictEqual(logTail(path.join(dir, 'missing.log')), '');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('stability ok');
}
