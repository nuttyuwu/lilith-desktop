'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

const NAME = 'kokoro-multi-lang-v1_1';
const URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/' + NAME + '.tar.bz2';
const SHA256 = 'b78e1ac42b852e839cceaafbe88f66806bf5860992d1d7b9a3f2ad1198427aed';
const BYTES = 364855331;
const REQUIRED = ['model.onnx', 'voices.bin', 'tokens.txt', 'lexicon-us-en.txt', 'lexicon-zh.txt'];
function ready(root) {
  try {
    const dir = path.join(root, NAME);
    return JSON.parse(fs.readFileSync(path.join(dir, '.lilith-ready.json'), 'utf8')).sha256 === SHA256 &&
      REQUIRED.every(f => fs.statSync(path.join(dir, f)).size > 0);
  } catch { return false; }
}

async function install(root, progress = () => {}, signal) {
  if (ready(root)) return path.join(root, NAME);
  fs.mkdirSync(root, { recursive: true });
  const stage = fs.mkdtempSync(path.join(root, '.speech-install-'));
  const archive = path.join(stage, 'model.tar.bz2');
  try {
    const response = await fetch(URL, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15 * 60000)]) : AbortSignal.timeout(15 * 60000) });
    if (!response.ok || !response.body) throw new Error(`Voice download: HTTP ${response.status}`);
    const hash = crypto.createHash('sha256');
    const out = await fs.promises.open(archive, 'wx');
    let received = 0, last = -1;
    try {
      for await (const chunk of response.body) {
        received += chunk.length;
        if (received > BYTES) throw new Error('Voice download exceeded expected size');
        hash.update(chunk); await out.writeFile(chunk);
        const pct = Math.floor(received * 100 / BYTES);
        if (pct >= last + 5) { last = pct; progress(pct); }
      }
    } finally { await out.close(); }
    if (received !== BYTES || hash.digest('hex') !== SHA256) throw new Error('Voice model checksum mismatch; please retry');
    progress(100);
    await unpack(archive, stage, signal);
    const extracted = path.join(stage, NAME), target = path.join(root, NAME);
    if (!REQUIRED.every(f => fs.statSync(path.join(extracted, f)).isFile())) throw new Error('Incomplete voice model');
    fs.writeFileSync(path.join(extracted, '.lilith-ready.json'), JSON.stringify({ sha256: SHA256, source: URL }));
    // Never remove an existing model directory; failed/partial manual installs remain recoverable.
    if (fs.existsSync(target)) throw new Error('A voice model folder already exists but is incomplete. Rename it, then retry setup.');
    fs.renameSync(extracted, target);
    return target;
  } finally {
    // stage is created directly beneath this explicit model root, never taken from user text.
    if (path.dirname(stage) === path.resolve(root)) fs.rmSync(stage, { recursive: true, force: true });
  }
}

async function unpack(archive, destination, signal) {
  const options = { windowsHide: true, maxBuffer: 8 * 1024 * 1024, signal };
  const { stdout } = await run('tar', ['-tf', archive], options);
  for (const entry of stdout.trim().split(/\r?\n/)) {
    const clean = entry.replace(/^\.\//, '');
    if (!clean.startsWith(NAME + '/') || /[\\:]/.test(clean) || clean.split('/').includes('..')) throw new Error('Unsafe voice archive entry');
  }
  const listing = await run('tar', ['-tvf', archive], options);
  if (listing.stdout.split(/\r?\n/).some(line => /^[lh]/.test(line))) throw new Error('Voice archive contains links');
  await run('tar', ['-xf', archive, '-C', destination], options);
}

module.exports = { NAME, URL, SHA256, BYTES, ready, install, unpack };
