'use strict';
// Electron utility process: native inference must never block the pet's UI/main process.
const { createEngine, speechText } = require('./speech-engine');
let engine;
process.parentPort.on('message', ({ data }) => {
  const { id, directory, text, sid, speed } = data;
  try {
    if (!Number.isInteger(sid) || sid < 0 || sid > 57) throw new Error('Invalid voice');
    const clean = speechText(text);
    if (!clean) throw new Error('No speakable text');
    const started = Date.now();
    engine ||= createEngine(directory);
    // Electron's V8 memory cage cannot wrap the native addon's external buffers.
    const audio = engine.generate({ text: clean, sid, speed: Math.min(1.2, Math.max(0.8, speed || 1)), enableExternalBuffer: false });
    if (!audio.samples?.length || audio.samples.length > audio.sampleRate * 120) throw new Error('Invalid speech length');
    process.parentPort.postMessage({ id, samples: audio.samples, sampleRate: audio.sampleRate, elapsedMs: Date.now() - started });
  } catch (error) {
    process.parentPort.postMessage({ id, error: error.message });
  }
});
