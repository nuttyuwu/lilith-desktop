'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { speechText } = require('./speech-engine');
const VOICES = { en: [{ id: 0, name: 'Approved soft English voice' }], zh: [{ id: 43, name: 'Approved soft Chinese voice' }] };
const EXAMPLE = { en: "You're back. Stay with me for a little while?", zh: '你回来啦。再陪我一会儿，好不好？' };
function createSpeech(root, log = () => {}) {
  const directory = path.join(root, 'Qwen3-TTS-12Hz-0.6B-Base');
  const runtimePython = path.join(root, '..', 'qwen-runtime', 'Scripts', 'python.exe');
  const devRuntime = path.join(__dirname, '..', '.cache', 'qwen-venv');
  const python = process.env.LILITH_QWEN_PYTHON || (!fs.existsSync(runtimePython) && fs.existsSync(path.join(devRuntime, '.qwen-ready')) ? path.join(devRuntime, 'Scripts', 'python.exe') : runtimePython);
  let worker = null, pending = null, nextId = 0, idle = null, setup = null, installing = null, activeDevice = null;
  function terminate(child) {
    if (!child?.pid || child.exitCode !== null) return;
    // Windows venv python.exe is a launcher: also stop its actual Python child.
    if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => child.kill());
    else child.kill();
  }
  function stop() { clearTimeout(idle); const old = worker; worker = null; terminate(old); }
  function fail(error) {
    const job = pending; pending = null;
    if (job) { clearTimeout(job.timer); job.reject(error); }
    stop();
  }
  function cancel() { if (pending) fail(Object.assign(new Error('Speech cancelled'), { name: 'AbortError' })); }
  function start() {
    if (worker) return worker;
    const child = worker = spawn(python, ['-u', path.join(__dirname, 'qwen-worker.py'), directory], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    let buffer = '';
    child.stdout.on('data', chunk => {
      if (child !== worker) return;
      buffer += chunk.toString('utf8');
      if (buffer.length > 16000000) return fail(new Error('Speech output exceeded its limit'));
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const result = JSON.parse(line);
          if (!pending || result.id !== pending.id) continue;
          if (result.error) return fail(new Error(result.error));
          if (result.done) {
            const job = pending;
            if (!job.total) throw new Error('No speech audio received');
            const samples = new Float32Array(job.total);
            let offset = 0;
            for (const chunk of job.chunks) { samples.set(chunk, offset); offset += chunk.length; }
            pending = null; clearTimeout(job.timer);
            idle = setTimeout(stop, 300000);
            job.resolve({ samples, sampleRate: 24000, elapsedMs: result.elapsedMs, firstAudioMs: job.firstAudioMs, backend: result.backend });
            continue;
          }
          const bytes = Buffer.from(result.audio, 'base64');
          if (result.sampleRate !== 24000 || !bytes.length || bytes.length % 4 || bytes.length > 24000 * 120 * 4) throw new Error('Invalid speech audio');
          const samples = new Float32Array(bytes.length / 4);
          for (let i = 0; i < samples.length; i++) { samples[i] = bytes.readFloatLE(i * 4); if (!Number.isFinite(samples[i])) throw new Error('Invalid audio sample'); }
          const job = pending;
          job.total += samples.length;
          if (job.total > 24000 * 120) throw new Error('Speech output exceeded its limit');
          job.chunks.push(samples);
          if (job.firstAudioMs === null) job.firstAudioMs = result.elapsedMs;
          job.onChunk?.({ samples, sampleRate: result.sampleRate, backend: result.backend });
        } catch (error) { fail(error); }
      }
    });
    child.on('error', error => { if (child === worker) fail(error); });
    child.stdin.on('error', error => { if (child === worker) fail(error); });
    child.on('exit', code => { if (child === worker) fail(new Error(`Qwen speech engine exited (${code})`)); });
    // Avoid writing speech text or model debug output to the app log.
    child.stderr.on('data', () => {});
    return child;
  }
  const ready = () => {
    if (installing) return false;
    try {
      const required = ['config.json', 'generation_config.json', 'tokenizer_config.json', 'preprocessor_config.json', 'vocab.json', 'merges.txt', 'model.safetensors', 'speech_tokenizer/config.json', 'speech_tokenizer/preprocessor_config.json', 'speech_tokenizer/model.safetensors'];
      return fs.existsSync(python) && fs.existsSync(path.resolve(python, '..', '..', '.qwen-ready')) && required.every(file => fs.statSync(path.join(directory, file)).size > 0);
    } catch { return false; }
  };
  return {
    ready,
    install(_progress, device = 'auto') {
      if (!['auto', 'gpu', 'cpu'].includes(device)) return Promise.reject(new Error('Invalid setup device'));
      cancel(); stop();
      if (installing) return installing;
      installing = new Promise((resolve, reject) => {
        setup = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'qwen-setup.ps1'), '-ModelRoot', root, '-Device', device, '-RuntimePython', python], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const child = setup;
        let setupTail = '';
        const collect = data => { setupTail = (setupTail + data.toString()).slice(-2000); };
        child.stdout.on('data', collect); child.stderr.on('data', collect);
        child.on('error', reject);
        child.on('exit', code => {
          if (code === 0) resolve();
          else { log('Qwen setup', setupTail); reject(new Error('Local Qwen setup failed. See Copy log; Python 3.12 is required')); }
        });
      }).finally(() => { installing = null; setup = null; });
      return installing;
    },
    generate(text, sid, _speed = 1, device = 'auto', onChunk) {
      const clean = speechText(text);
      if (installing) return Promise.reject(new Error('Qwen setup is still running. Your text reply is available.'));
      if (!['auto', 'gpu', 'cpu'].includes(device)) return Promise.reject(new Error('Invalid speech device'));
      if (sid !== 0 && sid !== 43) return Promise.reject(new Error('Invalid Qwen voice'));
      if (!ready()) return Promise.reject(new Error('Local Qwen setup is incomplete. Run scripts/setup-qwen.ps1'));
      if (!clean) return Promise.reject(new Error('No speakable text'));
      if (activeDevice !== device) { cancel(); stop(); activeDevice = device; }
      cancel(); clearTimeout(idle);
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { if (pending?.id === id) fail(new Error('Local Qwen speech timed out; try a shorter reply')); }, 600000);
        pending = { id, resolve, reject, timer, onChunk, chunks: [], total: 0, firstAudioMs: null };
        try { start().stdin.write(JSON.stringify({ id, text: clean, language: sid === 0 ? 'English' : 'Chinese', device }) + '\n'); }
        catch (error) { fail(error); }
      });
    },
    cancel,
    unload() { cancel(); stop(); },
    dispose() { cancel(); stop(); terminate(setup); },
  };
}
module.exports = { createSpeech, VOICES, EXAMPLE };
