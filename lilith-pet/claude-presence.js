'use strict';
const { spawn } = require('node:child_process');

// Query per reply rather than treating a foreground-window change as an app closing.
// Only a boolean leaves PowerShell; process command lines are never logged or sent to the model.
function isClaudeOpen() {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise(resolve => {
    const script = String.raw`
$ErrorActionPreference='Stop'
$desktop=Get-Process -Name Claude -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
$processes=Get-CimInstance Win32_Process -Filter "Name='claude.exe' OR Name='node.exe'"
$cli=$processes | Where-Object {
  ($_.Name -ieq 'node.exe' -and $_.CommandLine -match '@anthropic-ai[\\/]claude-code[\\/]') -or
  ($_.Name -ieq 'claude.exe' -and $_.ExecutablePath -match '[\\/]\.local[\\/](bin[\\/]claude\.exe|share[\\/]claude[\\/]versions[\\/])')
}
if($desktop -or $cli){'1'}else{'0'}
`;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '', settled = false;
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { child.kill(); finish(false); }, 3000);
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-32); });
    child.on('error', () => finish(false));
    child.on('exit', code => finish(code === 0 && output.trim() === '1'));
  });
}
module.exports = { isClaudeOpen };
