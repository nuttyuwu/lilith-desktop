// Minimal Ollama client: model pick + streaming /api/chat (NDJSON).
const BASE = (process.env.LILITH_OLLAMA || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const RECOMMENDED_MODEL = 'llama3.2:latest';
const MODEL_COMMAND = `ollama pull ${RECOMMENDED_MODEL}`;

async function pickModel() {
  const r = await fetch(`${BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`Ollama /api/tags ${r.status}`);
  const names = (await r.json()).models.map((m) => m.name);
  if (process.env.LILITH_MODEL) {
    const requested = process.env.LILITH_MODEL;
    const normalized = requested.includes(':') ? requested : `${requested}:latest`;
    if (!names.some((n) => n === requested || n === normalized)) throw new Error(`Configured model not found: ${requested}`);
    return requested;
  }
  const chatNames = names.filter((n) => !/embed/i.test(n));
  if (!chatNames.length) throw new Error(`Ollama has no models for chat. Run: ${MODEL_COMMAND}`);
  return chatNames.find((n) => /lilith/i.test(n)) || chatNames.find((n) => n === RECOMMENDED_MODEL) || chatNames[0];
}

// onToken(text) per chunk; resolves with the full reply.
async function chat(model, messages, onToken, signal) {
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, keep_alive: '30m', options: { temperature: 0.8, num_predict: 200 } }),
  });
  if (!r.ok) throw new Error(`Ollama /api/chat ${r.status}: ${await r.text()}`);
  const dec = new TextDecoder();
  let buf = '', full = '';
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      const j = JSON.parse(line);
      if (j.error) throw new Error(j.error);
      const t = j.message?.content || '';
      if (t) { full += t; onToken(t); }
    }
  }
  return full;
}

async function ping() {
  try { return (await fetch(`${BASE}/api/tags`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}

// Start `ollama serve` in the background. Rejects with code ENOENT when Ollama isn't installed.
function launch() {
  const { spawn } = require('child_process');
  const fs = require('fs'), path = require('path');
  const local = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
  const exe = local && fs.existsSync(local) ? local : 'ollama';
  return new Promise((resolve, reject) => {
    const p = spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
    p.once('error', reject);
    p.once('spawn', () => { p.unref(); resolve(); });
  });
}

module.exports = { pickModel, chat, ping, launch, BASE, RECOMMENDED_MODEL, MODEL_COMMAND };
