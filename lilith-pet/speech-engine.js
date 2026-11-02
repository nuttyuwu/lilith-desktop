'use strict';
const path = require('node:path');

// A fixed CPU backend keeps speech independent of CUDA/ROCm and leaves VRAM for Ollama.
function createEngine(directory) {
  const { OfflineTts } = require('sherpa-onnx-node');
  return new OfflineTts({
    model: {
      kokoro: {
        model: path.join(directory, 'model.onnx'), voices: path.join(directory, 'voices.bin'),
        tokens: path.join(directory, 'tokens.txt'),
        lexicon: ['lexicon-us-en.txt', 'lexicon-zh.txt'].map(f => path.join(directory, f)).join(','),
      },
      numThreads: 2, provider: 'cpu', debug: false,
    },
    maxNumSentences: 1,
  });
}

function speechText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
}

module.exports = { createEngine, speechText };
