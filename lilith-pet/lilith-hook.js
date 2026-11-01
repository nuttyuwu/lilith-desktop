#!/usr/bin/env node
'use strict';
// Claude Code hook -> Lilith (same pattern as Capri's hook): forward a trimmed event to the pet.
// Never block Claude: no output, always exit 0, give up within 1.5 s.
const http = require('node:http');
const bail = () => process.exit(0);
setTimeout(bail, 1500).unref();
// The registered command carries the app's port explicitly. Environment/default
// fallback also supports hook commands created by older Lilith versions.
const rawPort = process.argv[2] ?? (process.env.LILITH_PORT || '47824');
const PORT = Number(rawPort);
if (!/^\d+$/.test(rawPort) || !Number.isInteger(PORT) || PORT < 1 || PORT > 65535) bail();
let slim;
try { ({ slim } = require('./slim')); } catch { bail(); }
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; if (raw.length > 8e6) bail(); });
process.stdin.on('error', bail);
process.stdin.on('end', () => {
  let body;
  try { body = JSON.stringify(slim(JSON.parse(raw))); } catch { return bail(); }
  let req;
  try {
    req = http.request({ host: '127.0.0.1', port: PORT, path: '/event', method: 'POST', timeout: 800,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } },
    (res) => { res.on('error', bail); res.resume(); res.on('end', bail); });
  } catch { return bail(); }
  req.on('timeout', () => { req.destroy(); bail(); });
  req.on('error', bail);
  req.end(body);
});
