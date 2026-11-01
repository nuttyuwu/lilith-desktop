// Whitelist bounded text fields; drop raw file-content, diff and transcript fields.
// Used by lilith-hook.js before sending and main.js again on arrival.
const LIMITS = { hook_event_name: 80, session_id: 128, cwd: 4096, tool_name: 80,
  prompt: 300, message: 2000, notification_type: 80, last_assistant_message: 4000, source: 80, reason: 500 };
const cut = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : s);
function slim(evt) {
  const out = {};
  if (!evt || typeof evt !== 'object' || Array.isArray(evt)) return out;
  for (const [key, limit] of Object.entries(LIMITS)) {
    if (typeof evt[key] === 'string') out[key] = cut(evt[key], limit);
  }
  if (evt.tool_input && typeof evt.tool_input === 'object' && !Array.isArray(evt.tool_input)) {
    const t = evt.tool_input, input = {};
    const file = [t.file_path, t.notebook_path, t.path].find((value) => typeof value === 'string');
    if (file !== undefined) input.file_path = cut(file, 4096);
    for (const [key, limit] of Object.entries({ command: 200, pattern: 120, description: 200 })) {
      if (typeof t[key] === 'string') input[key] = cut(t[key], limit);
    }
    out.tool_input = input;
  }
  return out;
}
module.exports = { slim, cut };
