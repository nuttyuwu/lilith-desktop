/* global spine, i18n, lifeCfg */
// Renderer: Spine 4.2 Lilith rig with the game's skin composition, track layout and anim names
// (names from LilithAnimName in the IL2CPP dump). Base URL overridable for testing: ?base=...
const BASE = new URLSearchParams(location.search).get('base') || 'rip/';
const noop = () => {};
const T = (k, v) => i18n.t(lifeCfg.lang, k, v);   // what she says in a bubble: her text language (i18n.js; lifeCfg lives in life.js)
const UI = (k, v) => i18n.t('en', k, v);   // buttons, fields, tooltips: always English
// Missing bridge functions (older preload, test pages) become no-ops instead of crashing the renderer.
const api = new Proxy(window.pet || {}, { get: (t, k) => t[k] || (k === 'fatal' ? (m) => console.error(m) : noop) });

const OUTFITS = {
  casual: {
    skins: ['default/casual', 'default/glasses_none', 'default/hat_none'],
    idle: 'stand_casual_idle', falling: 'stand_casual_falling', falled: 'stand_casual_falled', greet: 'stand_casual_greet',
    actions: ['stand_casual_lazy_wave', 'stand_casual_shy_giggle', 'stand_casual_pout', 'stand_casual_think',
      'stand_casual_look_around', 'stand_casual_stretch', 'stand_casual_small_yawn', 'stand_casual_blush',
      'stand_casual_squint', 'stand_casual_confuse', 'stand_casual_clap', 'stand_casual_happy_sigh',
      'stand_casual_flirt', 'stand_casual_rub_head', 'stand_casual_pucker', 'stand_casual_spread',
      'stand_casual_tense', 'stand_casual_look_down', 'stand_casual_fake_angry', 'stand_casual_fake_wronged', 'stand_casual_fake_cry',
      'stand_casual_stern_smile', 'stand_casual_sneeze_tiny', 'stand_casual_empty_hands', 'stand_casual_arrange', 'stand_casual_intro',
      'stand_casual_magic_cast', 'stand_casual_rub_face'],
  },
  pajamas: {
    skins: ['default/pajamas', 'default/glasses_none', 'default/hat_none'],
    idle: 'stand_pajamas_idle', falling: 'stand_pajamas_falling', falled: 'stand_pajamas_falled', greet: 'stand_pajamas_stretch',
    actions: ['stand_pajamas_stretch', 'stand_pajamas_yawn', 'stand_pajamas_tsundere', 'stand_pajamas_rub_head',
      'stand_pajamas_drowsy_slump', 'stand_pajamas_music'],
  },
};
// Claude Code event -> [casual anim, pajamas anim]
const CLAUDE_ANIM = {
  SessionStart: ['stand_casual_greet', 'stand_pajamas_stretch'],
  UserPromptSubmit: ['stand_casual_think', 'stand_pajamas_rub_head'],
  Edit: ['stand_casual_arrange', 'stand_pajamas_music'],
  Read: ['stand_casual_look_around', 'stand_pajamas_rub_head'],
  Bash: ['stand_casual_magic_cast', 'stand_pajamas_magic_cast'],
  Notification: ['stand_casual_screen_peek', 'stand_pajamas_tsundere'],
  Stop: ['stand_casual_clap', 'stand_pajamas_stretch'],
};
const T_BODY = 0, T_FACE = 1, T_MOUTH = 2;
const HEAD = 1.3;   // window is 30% taller than her (settings.js HEAD): the bubble lives above her head
// notice mood -> [casual, pajamas] animation
const MOOD = { magic: ['stand_casual_magic_cast', 'stand_pajamas_magic_cast'], sad: ['stand_casual_fake_wronged', 'stand_pajamas_tsundere'],
  confuse: ['stand_casual_confuse', 'stand_pajamas_rub_head'], happy: ['stand_casual_clap', 'stand_pajamas_stretch'] };
const BLINK = 'emoji_front_blink';
// Body poses that draw their own eyes (greet, yawns, peeking, lying...): an emoji face on top of them drew a second
// pair of eyes. Filled from the rig at load: any pose with attachment keys on the eye slots.
let ownEyes = new Set();
// Arm sprites differ between poses (hands behind her back, on her chest, holding the skirt). Blending the bones of two
// such poses for 0.4 s while the sprites swap halfway drew a missing arm and a floating cuff, so when the next pose
// starts with other arm sprites than she has now, the blend is short.
const ARM_MIX = 0.08;
let armSlots = [];
const armStart = {}, armProbe = { sk: null };
function armSwap(anim) {
  if (!anim || !armSlots.length) return false;
  let start = armStart[anim.name];
  if (!start) {
    const sk = armProbe.sk ||= new spine.Skeleton(data);
    sk.setSkin(skeleton.skin); sk.setToSetupPose(); sk.setSlotsToSetupPose();
    anim.apply(sk, 0, 0, false, [], 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
    start = armStart[anim.name] = armSlots.map((i) => sk.slots[i].attachment?.name || '');
  }
  return armSlots.some((i, k) => (skeleton.slots[i].attachment?.name || '') !== start[k]);
}
// stand_pajamas_yawn raises the casual arm sprites (front_Rarm_c / c2), which the pajamas skin lacks: her arm vanished
// mid-yawn. A small extra skin lends them to the pajamas.
function borrowArms() {
  const cas = data.findSkin('default/casual'), lend = new spine.Skin('lilith/pajamas_arms');
  for (const n of ['front_Rarm_c', 'front_Rarm_c2']) { const sl = data.findSlot(n), at = sl && cas?.getAttachment(sl.index, n); if (at) lend.setAttachment(sl.index, n, at); }
  data.skins.push(lend); OUTFITS.pajamas.skins.push(lend.name);
}
const faceFree = () => !ownEyes.has(state?.tracks[T_BODY]?.animation?.name);

let skeleton, state, data, outfit = OUTFITS.casual, busy = false, dragging = false, talking = false, tucked = false;
let demoing = false, frame = null, landedHook = null;   // demo.js drives these
let setupOn = false;   // first-run profile questions (setup.js)
let headUp = 0;       // CSS px of extra window height above her while sitting on a window (life.js / main 'sit-moved')
let lines = [], idleTimer = 0;
const canvas = document.getElementById('c'), bubble = document.getElementById('bubble');
const chatBox = document.getElementById('chat'), input = document.getElementById('msg');
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const base = (p) => String(p || '').split(/[\\/]/).pop();

// Dragged out of bed she keeps her pillow for a while (the bedding skin: the cushion she hugs standing, a blanket lying).
let pillowUntil = 0;
const PILLOW_MS = 30 * 60000;
const wornSkins = () => (outfit === OUTFITS.pajamas && Date.now() < pillowUntil ? [...outfit.skins, 'default/bedding'] : outfit.skins);
function applyOutfit(name, quiet) {   // quiet: skin only (mid-drag), no greet
  outfit = OUTFITS[name] || OUTFITS.casual;
  const skin = new spine.Skin('combined');
  for (const n of wornSkins()) { const s = data.findSkin(n); if (s) skin.addSkin(s); else console.warn('missing skin', n); }
  skeleton.setSkin(skin); skeleton.setSlotsToSetupPose();
  if (tucked) tuckPose(); else if (!quiet) play(outfit.greet);
}

function idle() {
  busy = false;
  state.setAnimation(T_BODY, outfit.idle, true);
  state.setAnimation(T_FACE, BLINK, true);
  idleTimer = music.playing ? 1.5 + Math.random() * 2 : 20 + Math.random() * 25;   // back to swaying soon while Spotify plays (life.js)
}

function play(anim, then) {
  if (!data || !data.findAnimation(anim)) return console.warn('missing anim', anim);
  if ((activity === 'sit' || activity === 'lie') && /^stand_/.test(anim)) return seatedReact();   // a standing action here pulled her out of the pose half-broken
  busy = true;
  state.setEmptyAnimation(T_FACE, 0.2);          // action anims key their own expressions
  const e = state.setAnimation(T_BODY, anim, false);
  e.listener = { complete: () => (then ? then() : idle()) };
}

// --- poof: the window jumps when her frame changes (sofa/bed, sitting on a window, tuck). She vanishes for a moment
// in a sparkle burst and fades back in once main has moved the window, so the jump is never seen.
const fx = document.getElementById('fx');
let poofT = 0;
function poof(quiet) {   // quiet: only extend the hidden moment, no new sparkles
  if (!app || !skeleton || demoing) return;
  if (quiet) { canvas.classList.add('poof'); clearTimeout(poofT); poofT = setTimeout(() => canvas.classList.remove('poof'), 160); return; }
  skeleton.getBounds(_bo, _bs, []);
  const cam = app.renderer.camera, dpr = window.devicePixelRatio || 1;
  const X = (x) => (canvas.width / 2 + (x - cam.position.x) / cam.zoom) / dpr, Y = (y) => (canvas.height / 2 - (y - cam.position.y) / cam.zoom) / dpr;
  const x0 = X(_bo.x), x1 = X(_bo.x + _bs.x), y0 = Y(_bo.y + _bs.y), y1 = Y(_bo.y);
  for (let i = 0; i < 34; i++) {
    const e = document.createElement('div'), r = () => (Math.random() + Math.random()) / 2;   // biased to her middle
    e.className = Math.random() < 0.35 ? 'spk dot' : 'spk';
    e.style.cssText = `left:${x0 + (x1 - x0) * r()}px;top:${y0 + (y1 - y0) * r()}px;--z:${9 + Math.random() * 16}px;--d:${Math.random() * 0.18}s;` +
      `--dx:${(Math.random() - 0.5) * 30}px;--dy:${-8 - Math.random() * 22}px`;
    fx.appendChild(e); setTimeout(() => e.remove(), 1100);
  }
  canvas.classList.add('poof');
  clearTimeout(poofT); poofT = setTimeout(() => canvas.classList.remove('poof'), 260);   // window move + reframe land within this
}

// --- speech bubble ---
function show(text, ms = Math.max(3000, text.length * 80), cls = '') {
  bubble.textContent = text; bubble.className = 'show ' + cls; bubble.dataset.action = '';
  layoutUi();
  clearTimeout(show.t); if (ms) show.t = setTimeout(() => { bubble.className = ''; }, ms);
}
// Mouth track: lying she talks with the rig's own talk_lie (the front-face talk loops don't fit that pose).
const talkAnim = (long) => (activity === 'lie' && data?.findAnimation('talk_lie') ? 'talk_lie' : long ? 'talk_happy_long' : 'talk_happy_short');
function mouth(on) {
  talking = on;
  if (!state || !data.findAnimation('talk_happy_long')) return;
  if (on) state.setAnimation(T_MOUTH, talkAnim(true), true); else state.setEmptyAnimation(T_MOUTH, 0.2);
}
// main-process notices (Ollama state, Claude replies...): click the bubble to act on them
api.onNotice(({ text, ms, action, anim }) => {
  if (demoing) return;
  show(text, ms, action ? 'notice action' : 'notice');
  if (action) bubble.dataset.action = action;
  const a = anim && MOOD[anim]?.[outfit === OUTFITS.pajamas ? 1 : 0];
  if (activity === 'sit') sitFidget('sit_casual_shake_leg');   // on a window's edge she reacts seated/lying, never stands up
  else if (activity === 'lie') lieFidget();
  else if (a && !busy && !tucked && !dragging) play(a);
});
api.onBubbleAction((action) => {
  if (!bubble.classList.contains('show')) return;
  bubble.dataset.action = action; bubble.classList.add('action');
  if (action === 'reply') { bubble.textContent += '\n' + T('claude.clickReply'); layoutUi(); clearTimeout(show.t); show.t = setTimeout(() => { bubble.className = ''; }, 15000); }
});
bubble.addEventListener('click', () => {
  if (bubble.querySelector('.chips')) return;   // reply / topic chips: only a chip click counts
  const a = bubble.dataset.action; bubble.className = ''; bubble.dataset.action = '';
  if (a) api.bubbleClick(a);
});

// A reaction line: the game's dialogue node for this trigger (dialogue.js), else a random voiced line (life.js).
function say(trig = 'TouchBody') { return fire(trig) || sayLine(); }

// --- Ollama streaming (main process does the HTTP) ---
let streamed = '';
function sayStart() { streamed = ''; show('…', 0); mouth(true); if (Math.random() < 0.6) talkGesture(); }
function sayToken(t) { streamed += t; show(streamed.trimStart(), 0); bubble.scrollTop = bubble.scrollHeight; }
function sayEnd() { mouth(false); show(streamed.trim() || '…', Math.max(5000, streamed.length * 70)); }
api.onSayStart(sayStart); api.onSayToken(sayToken); api.onSayEnd(sayEnd);
api.onSayError((m) => { mouth(false); show(m, 8000); });

// --- chat input ---
// The chat box closes itself after 10 s without typing (Ctrl+Alt+L or the right-click menu brings it back any time).
const CHAT_IDLE_MS = 10000;
let chatTimer = 0;
const chatIdle = () => { clearTimeout(chatTimer); chatTimer = setTimeout(closeChat, CHAT_IDLE_MS); };
function openChat() {
  showBar(false);
  chatBox.classList.add('show'); api.hover(true); lastOver = true; setTimeout(() => input.focus(), 30); chatIdle();
  // the game's "Lilith~?" (CallLilith) and its talk menu as chips; typing still goes to Ollama
  if (fire('CallLilith')) setTimeout(() => { if (chatBox.classList.contains('show') && !chainOn) talkMenu(); }, 3000); else talkMenu();
}
function closeChat() { clearTimeout(chatTimer); chatBox.classList.remove('show'); input.blur(); lastOver = null; }
input.addEventListener('input', chatIdle);
input.addEventListener('keydown', (e) => {
  chatIdle();
  if (e.key === 'Escape') closeChat();
  if (e.key === 'Enter' && input.value.trim()) { api.chat(input.value.trim()); input.value = ''; if (activity === 'sit' || activity === 'lie') seatedReact(); else play(rnd(outfit.actions.slice(0, 4))); }   // lying/sitting: she answers from there
});
api.onOpenChat(openChat);

// --- Claude Code events (via lilith-hook.js -> main -> here) ---
const animFor = (k) => CLAUDE_ANIM[k]?.[outfit === OUTFITS.pajamas ? 1 : 0];
let lastToolBubble = 0;
const claudeTalk = { over: '', late: '' };
function onClaudeEvent(evt) {
  const ev = evt.hook_event_name, t = evt.tool_input || {};
  if (dragging || tucked || setupOn || (demoing && !evt.demo)) return;
  const seated = activity === 'sit' || activity === 'lie' || activity === 'sleep' || activity === 'waking';   // on a window's edge she keeps sitting (lying) and talks from there; asleep she sleeps on
  if (activity && !seated && ev !== 'PreToolUse') endActivity(false);   // Claude needs her: get up / stop walking
  const reactTo = (k) => { if (!seated) play(animFor(k)); };
  noteLateWork();
  // the game noticing you code: late (21-24 h) = Overtime, after midnight = stay-up talk, once a day each
  const h = new Date().getHours(), day = new Date().toDateString();
  if (ev === 'UserPromptSubmit' && h >= 21 && claudeTalk.over !== day && Math.random() < 0.5) { claudeTalk.over = day; return void fire('Overtime'); }
  if (ev === 'UserPromptSubmit' && h < 5 && claudeTalk.late !== day) { claudeTalk.late = day; return void fire('SleepStayUpTalk'); }
  if (ev === 'SessionStart' && Math.random() < 0.3 && fire('AppAwareCoding')) return;
  if (ev === 'SessionStart') { reactTo(ev); show(T('claude.start'), 4000, 'claude'); }
  else if (ev === 'UserPromptSubmit') { reactTo(ev); show(T('claude.task', { p: (evt.prompt || '').slice(0, 90) }), 4000, 'claude'); }
  else if (ev === 'PreToolUse') {
    const tool = evt.tool_name || '';
    const kind = /Edit|Write|Notebook/.test(tool) ? 'Edit' : /Read|Grep|Glob|LS/.test(tool) ? 'Read' : /Bash|PowerShell/.test(tool) ? 'Bash' : null;
    if (!kind) return;
    if (!busy) play(animFor(kind));
    if (performance.now() - lastToolBubble < 1500) return;   // tool calls come in bursts
    lastToolBubble = performance.now();
    const what = kind === 'Bash' ? (t.description || t.command || '').slice(0, 80) : base(t.file_path) || t.pattern || '';
    const file = kind !== 'Bash' && t.file_path;
    show(T(kind === 'Edit' ? 'claude.edit' : kind === 'Read' ? 'claude.read' : 'claude.run', { w: what }), file ? 4000 : 2500, file ? 'claude action' : 'claude');
    if (file) bubble.dataset.action = `show:${file}`;   // click: Explorer opens at the file and she points at it
  }
  else if (ev === 'Notification') {   // stays until clicked, with a voice line to get your attention
    reactTo(ev); show(evt.message || T('claude.needs'), 0, 'claude action'); bubble.dataset.action = 'dismiss';
    const v = lines.filter((l) => lineVoice(l) && timefit.fitsNow(l.when) && !unresolved(l.text)); if (v.length && !evt.demo) playClip(lineVoice(rnd(v)));
  }
  else if (ev === 'Stop') { reactTo(ev); if (!evt.last_assistant_message) show(T('claude.done'), 4000, 'claude'); }
  // Stop with a reply: main asks Ollama for an in-character summary and streams it in.
}
api.onClaude(onClaudeEvent);
// What you're using (main: foreground app kind, 8 s there, 30 min per kind): she comments now and then.
const APP_LINES = { browsing: 2051297, design: 2051298, chat: 2051299 };
api.onApp((k) => {
  if (talking || chainOn || dragging || tucked || demoing || setupOn || changeTo || busyPose() || Math.random() > 0.6 * talkRate()) return;
  const h = new Date().getHours();
  if (k === 'coding') return void ((h >= 23 || h < 5) ? sayId(2051300) : fire('AppAwareCoding'));   // late: "Still coding this late...?"
  if (k === 'video') return void fire('AppAwareVideo');
  if (APP_LINES[k]) sayId(APP_LINES[k]);
});
// Pointing at a file main just opened in Explorer: her hand-out gesture (stand_casual_up_left), mirrored toward
// the screen centre where Explorer opens. Seated/lying she just tells you from there.
let pointDir = 1;
api.onPoint(({ file, dir }) => {
  if (!data || demoing) return;
  show(T('point.here', { f: file }), 5000);
  if (activity === 'sit') return sitFidget('sit_casual_shake_leg');
  if (activity === 'lie') return lieFidget();
  endActivity(false); pointDir = dir < 0 ? -1 : 1;
  play(outfit === OUTFITS.casual ? 'stand_casual_up_left' : 'stand_pajamas_magic_cast');
});

// --- hit test: alpha of the pixel under the cursor (window is click-through elsewhere) ---
let lastOver = null;
function alphaAt(cx, cy) {
  if (!app) return 0;
  const gl = app.gl, r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
  const px = new Uint8Array(4);
  gl.readPixels(Math.floor(cx * k), Math.floor(canvas.height - cy * k), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px[3];
}
let lastProbe = 0;
function updateHover(e) {
  if (chatBox.classList.contains('show') || setupOn) return;   // window stays interactive while typing
  const now = performance.now();
  if (now - lastProbe < 40 && !dragging) return;   // readPixels stalls the GPU; ~25 Hz is plenty
  lastProbe = now;
  const onBar = bar.classList.contains('show') && !!e.target.closest?.('#bar');
  const onHer = alphaAt(e.clientX, e.clientY) > 20;
  const over = bar.classList.contains('show') || dragging || onHer || onBar || (bubble.classList.contains('show') && !!e.target.closest?.('#bubble'));   // reply chips live inside the bubble
  if (over !== lastOver) { lastOver = over; api.hover(over); }
}
let down = null;
window.addEventListener('mousemove', (e) => {
  updateHover(e);
  if (down?.head && !dragging && Math.hypot(e.screenX - down.x, e.screenY - down.y) < down.head * 2.5) { if (Math.hypot(e.screenX - down.x, e.screenY - down.y) > 4) startPat(); return; }   // rubbing her head isn't a drag
  if (down && !dragging && !tucked && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 6) {
    stopPat();
    if (activity === 'sleep' || activity === 'waking') pillowUntil = Date.now() + PILLOW_MS;   // pulled out of bed: she takes her pillow along
    if (typeof moodDrag === 'function') moodDrag(activity === 'sleep' || activity === 'waking');
    endActivity(false); perched = false;   // sofa/bed frame must go before the window moves
    dragging = true; api.dragStart(); stopChain(); fire('DragStart', { force: true });
    state.setEmptyAnimation(T_FACE, 0.1); state.setAnimation(T_BODY, outfit.falling, true); busy = true;
  }
});
window.addEventListener('mousedown', (e) => {
  if (bar.classList.contains('show') && !e.target.closest?.('#bar')) { showBar(false); return; }
  if (e.target.closest?.('#bubble, #chat, #bar, #setup')) return;   // talk-menu chips, chat, toolbar: not a poke
  if (e.button === 0 && lastOver) down = { x: e.screenX, y: e.screenY, head: !tucked && !demoing ? headHit(e.clientX, e.clientY) : 0 };
});
window.addEventListener('mouseup', (e) => {
  const patted = down?.patted;
  if (down && e.button === 0 && !dragging && !tucked) lookAtYou(2500);   // after reacting to your click she looks at you for a moment
  if (patting) stopPat();
  if (dragging) { dragging = false; api.dragEnd(); }   // keeps the falling loop until main says 'landed'
  else if (patted) { /* rubbed her head: done */ }
  else if (down && e.button === 0 && (activity === 'sulk' || activity === 'doze')) aliveClick(!!down.head || e.clientY < innerHeight * 0.35);   // alive.js: making up / waking her
  else if (down?.head && e.button === 0 && (!activity || activity === 'sit')) { startPat(); stopPat(); }   // a click on her head: one pat
  else if (down && e.button === 0 && demoing) stopDemo();
  else if (down && e.button === 0 && tucked) api.untuck();
  else if (down && e.button === 0 && activity === 'walk') stopWalk();
  else if (down && e.button === 0 && activity === 'sit') { sitFidget('sit_casual_shake_leg'); say(); }   // (turnhead only ever looks left; she already looks at the cursor)
  else if (down && e.button === 0 && activity === 'lie') { lieFidget(); say(); }
  else if (down && e.button === 0 && activity === 'chair') { state.setAnimation(T_BODY, 'sit_casual_sofa_doubt', false); state.addAnimation(T_BODY, 'sit_casual_sofa_idle', true, 0); say(); }
  else if (down && e.button === 0 && activity === 'music') { if (!sayLine(MUSIC_CLICK)) say(); }   // keeps swaying, talks about the song
  else if (down && e.button === 0 && activity) { /* waking up (life.js) */ }
  else if (down && e.button === 0) {
    const area = hitArea(e.clientX, e.clientY), dbl = performance.now() - lastClick < 380; lastClick = performance.now();
    if (typeof notePoke === 'function' && notePoke()) { /* poke spam: she's had enough (alive.js) */ }
    else if (dbl && fire('DoubleClick', { force: true })) { /* the game's double-click lines */ }
    else if (area !== 'TouchBody' && fire(area)) { /* face / chest / hand / skirt / leg: the game's own reactions */ }
    else if (flirty() && Math.random() < 0.35) { play(rnd(FLIRT_ACTS[outfit === OUTFITS.pajamas ? 1 : 0])); sayLine(FLIRT_LINES) || say(); }
    else { play(rnd(outfit.actions)); say(); }
  }
  down = null;
});
// Where she was clicked (the game's CharacterHitArea): head (head pats, above), face, chest, hand, skirt, leg, body.
let lastClick = 0;
function hitArea(x, y) {
  if (!app || !skeleton || (activity && activity !== 'sit')) return 'TouchBody';
  const cam = app.renderer.camera, dpr = window.devicePixelRatio || 1;
  const P = (n) => { const b = skeleton.findBone(n); return b && { x: (canvas.width / 2 + (b.worldX - cam.position.x) / cam.zoom) / dpr, y: (canvas.height / 2 - (b.worldY - cam.position.y) / cam.zoom) / dpr }; };
  const face = P('front_face'), neck = P('front_neck'), waist = P('front_body_b'), knee = P('front_Lleg_1'), lh = P('front_Lhand'), rh = P('front_Rhand');
  if (!face || !neck || !waist || !knee) return 'TouchBody';
  const r = Math.abs(waist.y - neck.y) * 0.45;   // ~ a hand's size at her current scale
  if ([lh, rh].some((h) => h && Math.hypot(x - h.x, y - h.y) < r)) return 'TouchHand';
  if (y < neck.y + r * 0.2 && Math.hypot(x - face.x, y - face.y) < r * 1.4) return 'TouchFace';
  if (activity === 'sit') return 'TouchBody';
  const teasing = flirty();   // the game's chest/skirt reactions are teasing: never for minors
  if (y < waist.y && Math.abs(x - neck.x) < r * 1.6) return teasing ? 'TouchChest' : 'TouchBody';
  if (y < waist.y + (knee.y - waist.y) * 0.75) return teasing ? 'TouchSkirt' : 'TouchBody';
  return 'TouchLeg';
}

// --- head pats (the game's TouchHead): press/rub on her head. stand_*_rub_head loops 0.77-1.97 s while you keep
// patting (the game's LilithSkeletonRubHeadLoopPatch), then finishes. Seated she smiles and leans into it.
const PAT_START = 0.7667, PAT_END = 1.9667;
const HEADPAT_LINES = [1000320, 1000321, 1000325, 1000332, 2100164];   // "...Hmhm, just this once, 'kay~?"
let patting = false, patEntry = null;
// CSS px radius of the head when (x, y) is on it, else 0. Head = between the head bone and the top of her headdress.
function headHit(x, y) {
  if (!app || !skeleton || activity === 'lie' || activity === 'sleep' || activity === 'chair') return 0;
  const h = skeleton.findBone('front_head'), t = skeleton.findBone('front_headdress_0'); if (!h || !t) return 0;
  const cam = app.renderer.camera, dpr = window.devicePixelRatio || 1;
  const X = (wx) => (canvas.width / 2 + (wx - cam.position.x) / cam.zoom) / dpr, Y = (wy) => (canvas.height / 2 - (wy - cam.position.y) / cam.zoom) / dpr;
  const cx = (X(h.worldX) + X(t.worldX)) / 2, cy = (Y(h.worldY) + Y(t.worldY)) / 2, r = Math.hypot(X(t.worldX) - X(h.worldX), Y(t.worldY) - Y(h.worldY)) * 0.9;
  return Math.hypot(x - cx, y - cy) < r ? r : 0;
}
function startPat() {
  if (patting) return;
  if (activity === 'sulk') { if (down && !down.patted && typeof sulkPat === 'function') { down.patted = true; sulkPat(); } return; }   // sulking: one rub counts once toward making up
  if (typeof moodPat === 'function') moodPat();
  patting = true; lastInteraction = Date.now(); if (down) down.patted = true;
  fire('TouchHead', { force: true }) || sayLine(HEADPAT_LINES) || sayLine();
  if (activity === 'sit') return sitFidget('sit_casual_shake_leg');   // seated: happy leg swing (an expression anim on the turned face looked broken)
  endActivity(false);
  play(outfit === OUTFITS.pajamas ? 'stand_pajamas_rub_head' : 'stand_casual_rub_head');
  patEntry = state.tracks[T_BODY];
}
function stopPat() {
  if (!patting) return;
  patting = false; patEntry = null;   // the loop lets go: rub_head plays its ending, then idle
  lookAtYou(3000);   // then she looks at you for a moment, after her line
  if (flirty() && Math.random() < 0.3) setTimeout(() => sayLine(FLIRT_LINES), 2500);
}
function patTick() { if (patting && patEntry && state.tracks[T_BODY] === patEntry && patEntry.trackTime > PAT_END) { patEntry.trackTime = PAT_START; patEntry.animationLast = PAT_START; } }

// --- a little more flirty with adults (never with minors: same rule as the persona and the flirt animation)
const FLIRT_LINES = [1000341, 1000343, 1000344, 1000345, 1000346, 1000347, 1000348, 1000349, 1000127, 200234, 2051237, 2051238, 2051243];
const FLIRT_ACTS = [['stand_casual_flirt', 'stand_casual_blush', 'stand_casual_shy_giggle'], ['stand_pajamas_tsundere', 'stand_pajamas_rub_head']];
const flirty = () => !(lifeCfg.profile?.age != null && lifeCfg.profile.age < 18);
// Sitting/lying: every reaction happens in the pose (a standing action would tear her out of it).
function seatedReact() { if (activity === 'sit') sitFidget('sit_casual_shake_leg'); else if (activity === 'lie') lieFidget(); }

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (lastOver && !tucked && !setupOn) { closeChat(); showBar(!bar.classList.contains('show')); }
});
// Original pet-style right-click controls; added integrations live on a secondary page.
const bar = document.getElementById('bar');
function controlPage(name) {
  for (const page of bar.querySelectorAll('[data-page]')) page.hidden = page.dataset.page !== name;
  bar.scrollTop = 0;
  bar.querySelector('[data-page]:not([hidden]) button')?.focus({ preventScroll: true });
}
// Toolbar just above her head, speech bubble above the toolbar, both following her head (standing, sitting on a
// window, mid-animation). The bubble is as big as what she says: up to the window top, then over her a little, then scroll.
const _bo = new spine.Vector2(), _bs = new spine.Vector2();
let uiAt = 0;
function layoutUi() {
  if (!app || !skeleton) return;
  uiAt = performance.now();
  skeleton.getBounds(_bo, _bs, []);
  const cam = app.renderer.camera, dpr = window.devicePixelRatio || 1;
  const head = (canvas.height / 2 - (_bo.y + _bs.y - cam.position.y) / cam.zoom) / dpr;   // CSS y of her hair top
  const barTop = Math.max(8, Math.min(Math.round(head), innerHeight - bar.offsetHeight - 8));
  bar.style.top = `${barTop}px`;
  if (!bubble.classList.contains('show')) return;
  const border = bubble.offsetHeight - bubble.clientHeight;
  const bottom = barTop - 3, h = Math.min(bubble.scrollHeight + border + 2, Math.max(bottom - 4, innerHeight * 0.45));
  const top = Math.round(Math.max(4, bottom - h));
  bubble.style.maxHeight = `${Math.round(h)}px`;
  bubble.style.top = `${top}px`;

}
function showBar(on) {
  const visible = !!(on && !tucked && !demoing && !dragging && !setupOn);
  bar.classList.toggle('show', visible);
  bar.inert = !visible;
  if (visible) {
    if (activity === 'walk') stopWalk();
    lastInteraction = Date.now();
    api.hover(true); api.focus(); lastOver = true;
    controlPage('main'); layoutUi();
  } else { bar.querySelector(':focus')?.blur(); api.hover(false); lastOver = null; }
}
bar.addEventListener('click', (e) => {
  const button = e.target.closest?.('button');
  if (!button) return;
  if (button.dataset.pageTarget) { controlPage(button.dataset.pageTarget); layoutUi(); return; }
  const a = button.dataset.a;
  if (!a) return;
  if (!a.startsWith('music-')) showBar(false);
  if (a === 'talk') return openChat();
  if (a !== 'close') api.toolbar(a);
});
window.addEventListener('blur', () => { if (bar.classList.contains('show')) showBar(false); });
api.onControlsBlur(() => { if (bar.classList.contains('show')) showBar(false); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && bar.classList.contains('show')) { e.preventDefault(); showBar(false); }
});
api.onPerchLost(() => { perched = false; endActivity(false); if (!dragging && !tucked && !demoing) { busy = true; state.setEmptyAnimation(T_FACE, 0.1); state.setAnimation(T_BODY, outfit.falling, true); } });
api.onPerchGone(() => { perched = false; if (activity === 'sit' || activity === 'lie') endActivity(true); });   // re-placed on the floor (screen/size change)
api.onLanded((v) => {
  lastInteraction = Date.now(); perched = !!v?.perched;
  if (data && !demoing) play(outfit.falled, v?.perched ? (outfit === OUTFITS.casual ? sitDown : lieDown) : undefined);   // dropped on a window: sit (pajamas: lie) on its edge
  if (landedHook) landedHook();
  else if (data && !demoing) setTimeout(() => fire('DragEnd'), 900);   // "...you put me down~"
});

// --- she looks at the mouse: the rig turns her face by moving its face_front control bone (the game's own
// sit_casual_turnhead keys it to x = -119, i.e. only to the left); we offset it toward the cursor, both ways,
// on top of whatever animation is playing, and ease back to the animation's own face when the mouse rests.
const LOOK_X = 85, LOOK_Y = 15;   // skeleton units of face_front offset at full turn (110+ bent her bangs at large sizes)
const NO_LOOK = /turnhead|look_around|screen_peek|_walk|peek|hide|sleep_|lie_|falling|falled|_snap|to_sofa|get_off|sit_down|music|_back|^left_|^right_|^show_|stand_up/;
let cursor = null, cursorAt = 0, lookX = 0, lookY = 0, looked = null;
// Not all the time: a 6 s glance now and then (only if you're moving the mouse), and after you click / pat her.
const LOOK_MS = 6000;
let lookFrom = 0, lookUntil = 0, nextGlance = performance.now() + 20000;
function lookAtYou(delay = 0) { const now = performance.now(); lookFrom = now + delay; lookUntil = lookFrom + LOOK_MS; }
api.onCursor((c) => { if (!cursor || c.x !== cursor.x || c.y !== cursor.y) cursorAt = performance.now(); cursor = c; });
function unlook() {   // take last frame's offset back out before the animation is applied (bones it doesn't key keep values)
  if (!looked) return;
  looked.bone.x -= looked.x; looked.bone.y -= looked.y; looked = null;
}
function look(dt) {
  const f = skeleton.findBone('face_front'); if (!f) return;
  let tx = 0, ty = 0;
  const anim = state.tracks[T_BODY]?.animation?.name || '';
  const now = performance.now(), face = state.tracks[T_FACE]?.animation?.name || '';
  if (now > nextGlance && now - cursorAt < 2000) { lookAtYou(); nextGlance = now + 45000 + Math.random() * 60000; }   // a glance every ~45-105 s
  // no turn on top of an expression anim (it keys the front face for a straight-on view: turned, it tore the face)
  if (cursor && now >= lookFrom && now < lookUntil && !tucked && !demoing && !dragging && !patting && !NO_LOOK.test(anim) && (!face || /blink|none/.test(face))) {
    const cam = app.renderer.camera, dpr = window.devicePixelRatio || 1;
    const hx = (canvas.width / 2 + (f.worldX - cam.position.x) / cam.zoom) / dpr, hy = (canvas.height / 2 - (f.worldY - cam.position.y) / cam.zoom) / dpr;
    tx = Math.max(-1, Math.min(1, (cursor.x - hx) / 260)); ty = Math.max(-1, Math.min(1, (hy - cursor.y) / 320));
  }
  const k = Math.min(1, dt * 5);
  lookX += (tx - lookX) * k; lookY += (ty - lookY) * k;
  if (Math.abs(lookX) < 0.002 && Math.abs(lookY) < 0.002) return;
  const x = lookX * LOOK_X * skeleton.scaleX, y = lookY * LOOK_Y;   // mirrored skeleton: local +x is screen-left
  f.x += x; f.y += y; looked = { bone: f, x, y };
}

// --- tucked away: shy peek from the screen corner, sleepy face, no idle/Claude reactions ---
// The peek loop's last frame doesn't match its first, so a plain loop snaps (the twitch): each pass is queued as a
// new entry that crossfades out of the previous one instead. Pajamas use the same peek (her hand on the screen edge);
// the rig draws it in whichever outfit's skin is on.
const LOOP_MIX = 0.8;
function smoothLoop(track, anim) {
  state.data.setMix(anim, anim, LOOP_MIX);
  const e = state.setAnimation(track, anim, false);
  const next = (prev) => { const n = state.addAnimation(track, anim, false, 0); n.listener = { start: () => next(n) }; };
  next(e);
  return e;
}
function tuckPose() {
  busy = true;
  smoothLoop(T_BODY, 'stand_casual_peek_idle');
  state.setEmptyAnimation(T_FACE, 0.2);   // peek_idle keys its own eyes + blink; a face anim on top drew a second pair of eyes
  state.setEmptyAnimation(T_MOUTH, 0.2);
}
// Tucked on the right edge = mirrored so she faces into the screen; lean toward the visible side so both eyes show.
const LEAN_DEG = 12, LEAN_SHIFT = 220;   // deg, skeleton units toward the hidden side
let tuckSide = 'right', lean = 0;
// Main slides the window while she holds a visible pose, then releases the greeting.
let tuckLeaving = false;
api.onTuck((v) => {
  const on = typeof v === 'object' ? v.on : v;
  if (typeof v === 'object' && v.side) tuckSide = v.side;
  tucked = on; perched = false; tuckLeaving = !on;
  if (!data) return;
  endActivity(false); stopChain(); closeChat();
  showBar(false); bubble.className = '';
  busy = true;
  state.setEmptyAnimation(T_FACE, 0.15);
  state.setEmptyAnimation(T_MOUTH, 0.15);
  if (on) tuckPose(); else state.setAnimation(T_BODY, outfit.idle, true);
});
api.onTuckComplete(({ on }) => {
  if (on !== tucked) return;
  tuckLeaving = false;
  if (!data) return;
  if (!on) {
    lean = 0; const root = skeleton.getRootBone(); root.rotation = 0; root.x = root.data.x;
    play(outfit.greet);
  }
});
// Private windows in front (password managers, private browsing, sign-in pages; main + apps.js): she turns her back
// (the game's SecretHide, stand_casual_back_prepare -> stand_casual_back) until you leave it.
api.onPrivate?.((on) => {
  if (on) {
    if (activity || busy || tucked || demoing || setupOn || dragging || talking || outfit !== OUTFITS.casual) return;
    activity = 'back'; busy = true; stopChain(); state.setEmptyAnimation(T_FACE, 0.2);
    state.setAnimation(T_BODY, 'stand_casual_back_prepare', false); state.addAnimation(T_BODY, 'stand_casual_back', true, 0);
  } else if (activity === 'back') { activity = null; idle(); }
});
// Talking with her hands: the game's opening gestures (show_*) under a long line she says standing in casual.
const SHOW_TALK = ['show_02', 'show_04', 'show_05', 'show_06', 'show_07', 'show_08', 'show_09', 'show_010', 'show_012', 'show_013'];
function talkGesture() {
  if (busy || activity || tucked || dragging || outfit !== OUTFITS.casual) return;
  const n = rnd(SHOW_TALK.filter((a) => data.findAnimation(a))); if (n) play(n);
}
// Changing clothes (tray, or the clock in life.js): "I'm off to go change~", she vanishes with the rig's snap and a
// sparkle, and fades back in wearing the other outfit (onPoseStart fades in the first pose after a snap).
let changeTo = null;
function changeOutfit(name) {
  if (!data || !OUTFITS[name]) return;
  api.outfitChanged(name);   // tray tick
  if (changeTo) { changeTo = name; return; }   // already changing: the last pick wins
  if (OUTFITS[name] === outfit) return;
  if (tucked || demoing) return applyOutfit(name);
  changeTo = name; endActivity(false); stopChain();
  busy = true; state.setEmptyAnimation(T_FACE, 0.2); state.setAnimation(T_BODY, outfit.idle, true);
  const said = fire('ChangeToPajamas', { force: true });   // node 845001 "I'm off to go change~" (the game uses it both ways)
  const done = (quiet) => {
    const n = changeTo; changeTo = null;
    if (OUTFITS[n] !== outfit) applyOutfit(n, quiet); else if (!quiet) idle();
    if (!quiet && state.tracks[T_BODY]) state.tracks[T_BODY].mixDuration = 0;   // she's invisible after the snap: no blend from it
  };
  setTimeout(() => {
    if (dragging || tucked || demoing) return done(true);
    const snap = state.setAnimation(T_BODY, outfit === OUTFITS.pajamas ? 'stand_pajamas_snap' : 'stand_casual_snap', false);
    snap.listener = { complete: () => { poof(); done(false); }, interrupt: () => changeTo && done(true) };   // dragged mid-snap: just swap the skin
  }, said ? 2200 : 0);
}
api.onOutfit(changeOutfit);

// Start only after every <script> (demo.js, life.js, setup.js) has run: cached assets can finish loading
// before a later script is parsed, and initialize() then hit 'initVoices is not defined' -> blank Lilith.
// Texture size. The atlas is 31 pages of 4096² (~2.7 GB of GPU memory with mipmaps) drawn 4-13x smaller than that,
// and without mipmaps that minification is what made her edges pixely. Each page is shrunk on the GPU to about
// 2 texels per screen pixel at the current window size, then mipmapped. ?q=high|low (tray -> Render quality) shifts it one step.
const RIG_H = 4627;   // Lilith.skel height in units (= atlas pixels)
function textureScale() {
  const zoom = (RIG_H * HEAD * 1.04) / (innerHeight * (window.devicePixelRatio || 1));   // atlas px per screen px, as render() frames her
  const q = new URLSearchParams(location.search).get('q'), step = q === 'high' ? 1 : q === 'low' ? -1 : 0;
  return Math.min(1, Math.max(1 / 16, 2 ** (Math.ceil(Math.log2(2 / zoom)) + step)));
}
const MIP = 9987, LINEAR = 9729;   // spine.TextureFilter.MipMapLinearLinear / Linear
// Full-size upload -> GPU box-filtered mip level k (exact for premultiplied alpha) -> copied into a small texture.
function shrinkTexture(tex, scale) {
  const gl = tex.context.gl, img = tex.getImage(), k = Math.round(-Math.log2(scale));
  if (k <= 0 || !(gl instanceof WebGL2RenderingContext)) return tex;   // full size, still mipmapped (initialize)
  const w = Math.max(1, img.width >> k), h = Math.max(1, img.height >> k);
  tex.bind(); gl.generateMipmap(gl.TEXTURE_2D);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.texture, k);
  const small = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, small);
  gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
  gl.deleteTexture(tex.texture); tex.texture = small;
  const ph = document.createElement('canvas'); ph.width = w; ph.height = h; tex._image = ph;   // drop the full-size decoded image (~64 MB each)
  return tex;
}

let app = null, renderedOnce = false;
function startRenderer() {
  app = new spine.SpineCanvas(canvas, {
    pathPrefix: BASE + 'spine/',
    webglConfig: { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true },
    app: {
      loadAssets(c) {
        const scale = textureScale();
        console.info(`textures at ${scale * 100}% (~${Math.round(31 * 4096 * 4096 * 4 * 1.33 * scale * scale / 1048576)} MB GPU)`);
        c.assetManager.textureLoader = (img) => shrinkTexture(new spine.GLTexture(c.context, img, false), scale);
        c.assetManager.loadBinary('Lilith.skel'); c.assetManager.loadTextureAtlas('Lilith.atlas');
      },
      initialize(c) {
        const atlas = c.assetManager.require('Lilith.atlas');
        for (const pg of atlas.pages) { pg.minFilter = MIP; pg.magFilter = LINEAR; pg.texture.setFilters(MIP, LINEAR); }   // mipmaps: smooth edges at any size
        data = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(c.assetManager.require('Lilith.skel'));
        skeleton = new spine.Skeleton(data);
        const sd = new spine.AnimationStateData(data); sd.defaultMix = 0.4;   // softer blends between actions (was 0.25: visible snaps)
        state = new spine.AnimationState(sd);
        // Attachments (hand/arm sprites) swap halfway through a blend instead of at its first frame: a hand drawn for the
        // next pose at the old pose's position was the 'broken hand' (e.g. music sway -> yawn).
        state.addListener({ start: (e) => {
          e.mixAttachmentThreshold = 0.5; e.mixDrawOrderThreshold = 0.5;
          const f = state.tracks[T_FACE]?.animation;
          if (e.trackIndex === T_BODY && ownEyes.has(e.animation?.name) && f && f.name !== BLINK) state.setEmptyAnimation(T_FACE, 0.1);   // the pose's own eyes win
          if (e.trackIndex === T_BODY && e.mixingFrom && armSwap(e.animation)) e.mixDuration = Math.min(e.mixDuration, ARM_MIX);
        } });
        armSlots = data.slots.map((sl, i) => (/arm|hand/i.test(sl.name) ? i : -1)).filter((i) => i >= 0);
        borrowArms();
        ownEyes = new Set(data.animations.filter((a) => !/^(emoji|talk)_/.test(a.name) && a.timelines.some((t) => t.slotIndex != null && t instanceof spine.AttachmentTimeline && /^(L|R)eye_|eyelid/.test(data.slots[t.slotIndex].name))).map((a) => a.name));
        applyOutfit('casual');
        initVoices(); checkClock(true);
        loadLines(lifeCfg.lang);
        window.__lilith = { data, skeleton, state };   // debug handle
      },
      update(c, dt) { try { frameUpdate(dt); } catch (e) { frameError(e, 'update'); } },
      render(c) { try { frameRender(c); } catch (e) { frameError(e, 'render'); } },
      error(c, errs) {
        const msg = 'Lilith assets failed to load:\n' + Object.entries(errs).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join('\n');
        api.fatal(msg);
      },
    },
  });
}
function frameUpdate(dt) {
        dt = Math.min(dt, 1 / 20);   // a stalled frame (GPU busy, window move) must not make her jump ahead
        unlook(); state.update(dt); state.apply(skeleton);
        skeleton.scaleX = ((tucked || tuckLeaving) && tuckSide === 'right') || facing() < 0 ? -1 : 1;
        lean += ((tucked ? LEAN_DEG : 0) - lean) * Math.min(1, dt * 5);
        const root = skeleton.getRootBone();   // root isn't keyed by any peek/idle anim
        if (Math.abs(lean) > 0.05) { root.rotation = -lean; root.x = -LEAN_SHIFT * lean / LEAN_DEG; }
        else if (lean !== 0) { lean = 0; root.rotation = 0; root.x = 0; }
        lifeTick(dt);
        patTick();
        look(dt);
        skeleton.updateWorldTransform(spine.Physics.update);
        if (!busy && !dragging && !talking && !tucked && !demoing && !setupOn && !bar.classList.contains('show') && !activity && (idleTimer -= dt) <= 0) nextBehavior();
}
function frameRender(c) {
        const r = c.renderer;
        r.resize(spine.ResizeMode.Expand);
        const cam = r.camera, W = canvas.width, H = canvas.height;
        const f = frame || data;   // demo frames wide poses (sofa, lying, sleeping) in a resized window
        cam.zoom = Math.max(f.width / W, f.height * HEAD / (H - headUp * (window.devicePixelRatio || 1))) * 1.04;   // sitting headroom doesn't rescale her
        cam.position.x = skeleton.scaleX * (f.x + f.width / 2);
        cam.position.y = f.y + (H * cam.zoom) / 2 - seatShift;   // her lowest point (toes: data.y) exactly on the window bottom = floor/title bar; the old 1% margin made her hover
        c.clear(0, 0, 0, 0);
        r.begin(); r.drawSkeleton(skeleton, true); r.end(); renderedOnce = true;
        if (performance.now() - uiAt > 100 && (bar.classList.contains('show') || bubble.classList.contains('show'))) layoutUi();
}
// One bad frame must cost one frame: log it (main writes a repeating error once a minute) and put her back in a clean
// standing pose. Before, a single bug threw 60 errors a second for the rest of the session.
let lastRecover = 0;
const frameErrSeen = new Map();
function frameError(e, where) {
  const msg = `frame ${where}: ${e?.stack || e}`, t = performance.now();
  if (t - (frameErrSeen.get(msg) ?? -Infinity) > 60000) { frameErrSeen.set(msg, t); console.error(msg); }   // once a minute per error
  if (performance.now() - lastRecover < 1000) return;   // an error every frame: reset once a second, not 60 times
  lastRecover = performance.now();
  try {
    stopChain?.(); endActivity(false);
    state.clearTracks(); skeleton.setToSetupPose(); seatShift = 0; headUp = 0; frame = null; fadeIn = 1; skeleton.color.a = 1;
    useSkins(wornSkins()); idle();
  } catch (e2) { console.error(`frame recover: ${e2?.stack || e2}`); }
}
// Heartbeat for main's freeze watchdog (main.js: 30 s silent -> restart the page). drew: she has drawn at least once.
setInterval(() => api.alive?.(renderedOnce), 5000);
window.addEventListener('load', startRenderer);
// Recovery: GPU reset (driver update, sleep/resume, laptop GPU switch) or a start that never draws -> reload the page.
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.error('webgl context lost'); setTimeout(() => location.reload(), 1500); });
// Never drew: main retries, then at low texture quality, then shows an error (no endless reload loop).
setTimeout(() => { if (renderedOnce) return; console.error('no frame after 25 s'); if (window.pet?.noFrame) api.noFrame(); else location.reload(); }, 25000);
