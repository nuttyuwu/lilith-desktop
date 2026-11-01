/* global spine, api, state, data, skeleton, OUTFITS, T_BODY, T_FACE, T_MOUTH, BLINK, show, say, idle, applyOutfit,
   sayStart, sayToken, sayEnd, onClaudeEvent, closeChat, bubble */
// Demo / showcase mode for recording: "Feature tour" walks through everything she does,
// "Animation reel" plays every animation in the rig with a caption. Click her or "Stop demo" to end.
let demoToken = 0, demoPrev = 'casual';
class Stop extends Error {}
const alive = (tok) => { if (tok !== demoToken) throw new Stop(); };
const wait = (ms, tok) => new Promise((res) => setTimeout(res, ms)).then(() => alive(tok));

// prettify "stand_casual_shy_giggle" -> "Shy giggle"
function title(n) {
  const s = n.replace(/^(stand|sit|lie|sleep|left|right)_/, '').replace(/^(casual|pajamas)_/, '').replace(/_/g, ' ');
  return s[0].toUpperCase() + s.slice(1);
}

function skinsFor(n) {
  const paj = /pajamas|^sleep_|^lie_/.test(n);
  const s = [paj ? 'default/pajamas' : 'default/casual', 'default/glasses_none', 'default/hat_none', ...(paj && data.findSkin('lilith/pajamas_arms') ? ['lilith/pajamas_arms'] : [])];
  if (/sofa/.test(n)) s.push('default/sofa');
  if (/^sleep_|blanket/.test(n)) s.push('default/bedding');
  if (/cake|dessert/.test(n)) s.push('default/cake');
  if (/^show_|confetti/.test(n)) s.push('default/birthday');
  return s;
}
function useSkins(names) {
  const skin = new spine.Skin('demo');
  for (const k of names) { const s = data.findSkin(k); if (s) skin.addSkin(s); }
  skeleton.setSkin(skin); skeleton.setSlotsToSetupPose();
}

// Union of an animation's bounds (sampled); null when it fits the normal standing frame.
function boundsOf(names, skins) {
  const sk = new spine.Skeleton(data), skin = new spine.Skin('b');
  for (const k of skins) { const s = data.findSkin(k); if (s) skin.addSkin(s); }
  sk.setSkin(skin);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const o = new spine.Vector2(), z = new spine.Vector2();
  for (const n of names) {
    const a = data.findAnimation(n); if (!a) continue;
    for (let i = 0; i <= 8; i++) {
      sk.setToSetupPose(); sk.setSlotsToSetupPose();
      a.apply(sk, 0, a.duration * i / 8, false, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
      sk.updateWorldTransform(spine.Physics.update); sk.getBounds(o, z, []);
      if (!isFinite(o.x)) continue;
      x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + z.x); y1 = Math.max(y1, o.y + z.y);
    }
  }
  const pad = 1.15;   // fits the standing frame (with a little slack) -> no reframing
  if (x0 >= data.x - data.width * (pad - 1) && x1 <= data.x + data.width * pad && y0 >= data.y - 50 && y1 <= data.y + data.height * pad) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
let unitsPerDip = 0;   // measured at the normal window size, reused while framed
async function setFrame(f, tok) {
  if (!f) { if (frame) { frame = null; api.demoFrame(null); await wait(250, tok); } return; }
  if (!frame) unitsPerDip = Math.max(data.width / innerWidth, data.height * HEAD / innerHeight);
  const u = unitsPerDip;
  api.demoFrame({ width: Math.round(f.width / u), height: Math.round(f.height * HEAD / u) });
  frame = f;
  await wait(250, tok);
}

function playOnce(n, tok, track = T_BODY, mix) {
  const a = data.findAnimation(n);
  if (!a) return Promise.resolve();
  return new Promise((res) => {
    const e = state.setAnimation(track, n, false);
    if (mix != null) e.mixDuration = mix;
    e.listener = { complete: () => res(), interrupt: () => res() };
  }).then(() => alive(tok));
}
async function loopFor(n, ms, tok, track = T_BODY, mix) {
  if (!data.findAnimation(n)) return;
  const e = state.setAnimation(track, n, true);
  if (mix != null) e.mixDuration = mix;
  await wait(ms, tok);
}
async function caption(text, tok, ms = 2600) { show(text, ms, 'demo'); await wait(Math.min(ms, 1800), tok); }

async function fakeStream(text, tok) {
  sayStart();
  for (const w of text.match(/\S+\s*/g)) { sayToken(w); await wait(90 + Math.random() * 80, tok); }
  sayEnd();
}

// ~1 minute: the short preview (Tray -> Demo, or the Demo button under her)
async function tour(tok) {
  const casual = OUTFITS.casual;
  outfit = casual; useSkins(casual.skins); state.setEmptyAnimation(T_FACE, 0);   // outfit too: Claude reactions pick casual/pajama anims by it (pajama anims on casual skins = no clothes)
  await caption('Lilith — a little companion for your desktop', tok, 3000);
  say(); await playOnce(casual.greet, tok);

  await caption('Click her — she reacts, in her own voice', tok, 2200);
  for (const a of ['stand_casual_shy_giggle', 'stand_casual_lazy_wave']) { say(); await playOnce(a, tok); }

  await caption('Lots of moods', tok, 1500);
  state.setAnimation(T_BODY, casual.idle, true);
  for (const e of ['emoji_smile_2', 'emoji_surprise_1', 'emoji_angry_1', 'emoji_sad_1']) { state.setAnimation(T_FACE, e, true); await wait(700, tok); }
  state.setEmptyAnimation(T_FACE, 0.2);

  await caption('Talk to her — runs locally with Ollama', tok, 2000);
  state.setAnimation(T_BODY, 'stand_casual_think', false); state.addAnimation(T_BODY, casual.idle, true, 0);
  await fakeStream('Hmm~ keep you company while you work? Fine. Only because you asked nicely.', tok);
  await wait(1500, tok);

  await caption('Keeps an eye on Claude Code', tok, 2000);
  busy = false;   // let the Claude reactions play their own animations
  const ev = (o) => onClaudeEvent({ ...o, demo: true });
  ev({ hook_event_name: 'UserPromptSubmit', prompt: 'add a dark mode toggle' }); await wait(2000, tok);
  ev({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/theme.ts' } }); await wait(1800, tok);
  ev({ hook_event_name: 'Notification', message: 'Claude needs your permission to use Bash' }); await wait(2200, tok);
  ev({ hook_event_name: 'Stop', last_assistant_message: 'x' });
  await fakeStream('Claude added dark mode and the tests pass~', tok);
  await wait(1500, tok);

  await caption('Drop her — gravity, and she lands on windows', tok, 2000);
  state.setEmptyAnimation(T_FACE, 0.1); state.setAnimation(T_BODY, casual.falling, true);
  const landed = new Promise((res) => { landedHook = res; });
  api.demoDrop();
  await Promise.race([landed, wait(3500, tok)]); landedHook = null; alive(tok);
  await playOnce(casual.falled, tok);

  await caption('Outfits', tok, 1200);
  outfit = OUTFITS.pajamas; useSkins(outfit.skins); await playOnce('stand_pajamas_tsundere', tok);
  outfit = casual; useSkins(casual.skins);

  await caption('Ctrl+Alt+C — she hides and peeks from the corner', tok, 2200);
  api.demoTuck(true); await wait(3500, tok);
  api.demoTuck(false); await wait(1800, tok);

  await caption('Free fan project', tok, 3000);
  await playOnce('stand_casual_lazy_wave', tok);
}

async function reel(tok) {
  const body = data.animations.map((a) => a.name).filter((n) => !/^(emoji|talk)_/.test(n));
  // casual first, then pajamas, then props; walking last (it slides the rig sideways)
  const rank = (n) => (/walk/.test(n) ? 4 : /sofa|cake|dessert|^show_/.test(n) ? 2 : /pajamas|^sleep_|^lie_/.test(n) ? 1 : 0);
  body.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  let i = 0;
  for (const n of body) {
    i++;
    const skins = skinsFor(n);
    state.clearTracks(); skeleton.setToSetupPose();   // each pose exactly as authored: no blend from the last one (stray hands) and no leftover root offset
    useSkins(skins);
    await setFrame(boundsOf([n], skins), tok);
    show(`${title(n)}   ${i}/${body.length}`, 0, 'demo');
    const a = data.findAnimation(n);
    if (a.duration < 1.5) await loopFor(n, 2000, tok, T_BODY, 0); else await playOnce(n, tok, T_BODY, 0);
  }
  await setFrame(null, tok);
  state.clearTracks(); skeleton.setToSetupPose();
  outfit = OUTFITS.casual; useSkins(outfit.skins);
  state.setAnimation(T_BODY, OUTFITS.casual.idle, true);
  const faces = data.animations.map((a) => a.name).filter((n) => /^emoji_/.test(n));
  for (const [k, n] of faces.entries()) { show(`Expression: ${title(n.replace('emoji_', ''))}   ${k + 1}/${faces.length}`, 0, 'demo'); await loopFor(n, 1300, tok, T_FACE); }
  for (const n of data.animations.map((a) => a.name).filter((n) => /^talk_/.test(n))) { show(`Talking: ${title(n.replace('talk_', ''))}`, 0, 'demo'); await loopFor(n, 2500, tok, T_MOUTH); }
  state.setEmptyAnimation(T_MOUTH, 0.2);
}

async function startDemo(kind) {
  if (!data) return;
  const tok = ++demoToken;
  showBar(false); endActivity(false); demoing = true; busy = true; closeChat(); api.hover(false);
  const prevOutfit = demoPrev = outfit === OUTFITS.pajamas ? 'pajamas' : 'casual';
  try { await (kind === 'reel' ? reel(tok) : tour(tok)); } catch (e) { if (!(e instanceof Stop)) console.error('demo', e); }
  if (tok !== demoToken) return;   // a newer demo or stopDemo took over
  endDemo(prevOutfit);
}
function endDemo(prevOutfit = 'casual') {
  demoing = false; landedHook = null;
  if (frame) { frame = null; api.demoFrame(null); }
  if (tucked) api.demoTuck(false);
  bubble.className = '';
  state.clearTrack(T_MOUTH);
  if (!tucked) { state.clearTracks(); skeleton.setToSetupPose(); }   // nothing from the reel's last pose carries over
  applyOutfit(prevOutfit);
  api.demoDone();
}
function stopDemo() { demoToken++; endDemo(demoPrev); }   // clicked mid-demo: back in what she wore before
api.onDemo((kind) => (kind === 'stop' ? stopDemo() : startDemo(kind)));
