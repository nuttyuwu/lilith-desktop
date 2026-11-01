/* global api, T, BASE, loadLines, show, play, playClip, assets, lines, lineById, lineVoice, resolveText, lifeCfg, data, state, closeChat, bubble,
   endActivity, idle, setupOn, demoing, tucked, busy, T_BODY, T_FACE, HELLO, talkMouth, assetsReady */
// First run: the game's opening performance (OpeningPerformanceManager + its OpeningLineDB, dialogue/opening.json):
// she drops in ("Ta-dah!"), comments on your desktop, asks your name and birthday, answers your questions, all with the
// opening's own gestures (show_01..show_014; show_03_idle while she waits for you). We also ask age and gender
// (age gates the teasing reactions). Re-run any time from Tray -> Settings -> About you.
const setupBox = document.getElementById('setup'), setupBody = document.getElementById('setup-body'), setupErr = document.getElementById('setup-err');
const GENDERS = ['male', 'female', 'nonbinary', 'unsaid'];
const nameWidth = (s) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let draft = {}, run = 0;
class Cancel extends Error {}
const live = (r) => { if (r !== run || !setupOn) throw new Cancel(); };

// ---------- the opening's lines ----------
let opening = null;   // key -> {animation, soundId, en, zh-CN, ja, ...}
async function loadOpening() {
  if (opening) return;
  try { opening = Object.fromEntries((await (await fetch(BASE + 'dialogue/opening.json')).json()).map((e) => [e.key, e])); }
  catch { opening = {}; }   // an older rip without it: the T() fallbacks below
}
const OP_LANG = { 'zh-Hant': 'zh-HK' };   // the opening has one Traditional Chinese column
const opText = (key) => { const e = opening?.[key]; return e && (/^(opt|q)_/.test(key) ? e.en : e[OP_LANG[lifeCfg.lang] || lifeCfg.lang] || e.en); };   // your choices (opt_ / q_): English like every menu
// The same lines in the dialogue table, which has both voice takes: used when the opening's own clip is in the other
// language, with that line's text, so what she says and what the bubble shows always match.
const OP_LINE = { intro_2: 100002, name_confirm: 100003, name_reenter: 100014, post_1: 100004, post_2: 100005, post_3: 100006,
  q_prompt_first: 100007, ans_who_1: 100008, ans_who_2: 100009, ans_whyhere: 100010, ans_whycansee: 100011, ending: 100012, q_prompt_more: 100013 };
// hello takes the greeting never uses, language checked the same way (speech language ID): 3 Chinese, 6 / 14 Japanese
const OP_TAKES = { cn: [3], jp: [6, 14] };
const lineOfId = (id) => lineById[id] || lines.find((l) => l.id === id);
function cueOf(key, vars = {}) {
  const e = opening?.[key];
  let text = opText(key), clip = null;
  const m = /^LillthSayHello_(\d+)$/.exec(e?.soundId || ''), takes = [...(HELLO[lifeCfg.voice] || []), ...(OP_TAKES[lifeCfg.voice] || [])];
  const l = OP_LINE[key] && lineOfId(OP_LINE[key]);
  if (m && takes.includes(Number(m[1]))) clip = assets.sfx[e.soundId];   // the opening's take is in her voice language
  else if (l && lineVoice(l)) { clip = lineVoice(l); text = resolveText(l.text); }
  else if (!text && l) text = resolveText(l.text);
  if (!text) return null;
  return { anim: e?.animation || '', text: text.replace('{system_user}', vars.user || ''), clip };
}
// One cue: her gesture, the line at the gesture's show_text / show_voice event, then the next cue once both are done.
function cue(key, r, vars) {
  live(r);
  const c = cueOf(key, vars);
  if (!c) return Promise.resolve();
  return new Promise((res) => {
    const t0 = Date.now(), minMs = Math.max(2200, c.text.length * 75);
    let said = false;
    const say = () => { if (said) return; said = true; show(c.text, 0); if (c.clip) playClip(c.clip); talkMouth(); };
    const done = () => { say(); setTimeout(res, Math.max(0, minMs - (Date.now() - t0))); };
    const a = c.anim && data.findAnimation(c.anim);
    if (!a) return done();
    busy = true; state.setEmptyAnimation(T_FACE, 0.2);
    const ent = state.setAnimation(T_BODY, c.anim, false);
    let over = false;
    ent.listener = { event: (_, ev) => { if (/^show_(text|voice)$/.test(ev.data.name)) say(); },
      complete: () => { if (!over) { over = true; done(); } }, interrupt: () => { if (!over) { over = true; done(); } } };
    if (!a.timelines.some((t) => t.events?.some((ev) => /^show_/.test(ev.data.name)))) say();   // hide / flirt: no cue events
  }).then(() => live(r));
}
const waitPose = () => { if (data.findAnimation('show_03_idle')) state.setAnimation(T_BODY, 'show_03_idle', true); };

// ---------- the card under her: inputs and choices ----------
let answer = null;   // resolves the question on screen
function ask(html, onReady, problem = '') {   // problem: why the last answer was sent back
  setupBody.innerHTML = html; setupErr.textContent = problem;
  setupBox.classList.add('show');
  waitPose(); onReady?.();
  return new Promise((res) => { answer = res; });
}
const focusEl = (id) => setTimeout(() => document.getElementById(id)?.focus(), 30);
const hideCard = () => { setupBox.classList.remove('show'); setupBody.innerHTML = ''; };

async function askName(r) {
  for (let problem = ''; ;) {
    const v = await ask(`<input id="su-name" maxlength="32" placeholder="${esc(UI('namePh'))}" value="${esc(draft.name)}">
      <div class="row"><button class="primary" data-go="name">${esc(UI('ok'))}</button></div>`, () => focusEl('su-name'), problem);
    live(r);
    const n = v.name.replace(/[\u0000-\u001f\u007f{}<>]/g, '').trim();
    problem = !n ? UI('errName') : nameWidth(n) > 16 ? UI('errLong') : '';
    if (problem) continue;
    draft.name = n; hideCard();
    await cue('name_confirm', r);   // "Shall Lilith call you that from now on?"
    const c = await ask(`<div class="row"><button class="primary" data-go="yes">${esc(opText('opt_confirm') || UI('ok'))}</button>
      <button data-go="again">${esc(opText('opt_reenter') || UI('skip'))}</button></div>`);
    live(r); hideCard();
    if (c.go === 'yes') return;
    await cue('name_reenter', r);   // "Then what should Lilith call you?"
  }
}
async function askAge(r) {
  show(T('askAge', { name: draft.name }), 0);
  for (let problem = ''; ;) {
    const v = await ask(`<input id="su-age" type="number" min="1" max="120" placeholder="${esc(UI('agePh'))}" value="${esc(draft.age)}">
      <div class="row"><button class="primary" data-go="age">${esc(UI('ok'))}</button><button data-go="skip">${esc(UI('skip'))}</button></div>`, () => focusEl('su-age'), problem);
    live(r);
    if (v.go === 'skip') { draft.age = null; break; }
    const a = Number(v.age);
    problem = !Number.isInteger(a) || a < 1 || a > 120 ? UI('errAge') : '';
    if (!problem) { draft.age = a; break; }
  }
  show(T('askGender'), 0);
  const g = await ask(`<div class="row">${GENDERS.map((v) => `<button data-gender="${v}">${esc(UI(`g.${v}`))}</button>`).join('')}</div>`);
  live(r); draft.gender = g.gender; hideCard();
}
async function askBirthday(r) {
  const [m, d] = (draft.birthday || '-').split('-');
  const opts = (n, sel) => Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0')).map((x) => `<option${x === sel ? ' selected' : ''}>${x}</option>`).join('');
  const v = await ask(`<div class="row"><select id="su-bm">${opts(12, m)}</select><select id="su-bd">${opts(31, d)}</select></div>
    <div class="row"><button class="primary" data-go="bday">${esc(UI('ok'))}</button><button data-go="skip">${esc(UI('skip'))}</button></div>`);
  live(r); hideCard();
  draft.birthday = v.go === 'bday' ? `${v.bm}-${v.bd}` : null;
}
// "Is there anything you'd like to know about Lilith?" until you've asked all three (the game's question loop)
const QUESTIONS = [['q_whoareyou', ['ans_who_1', 'ans_who_2']], ['q_whyhere', ['ans_whyhere']], ['q_whycansee', ['ans_whycansee']]];
async function askQuestions(r) {
  const left = QUESTIONS.filter(([q]) => opText(q));
  for (let first = true; left.length; first = false) {
    await cue(first ? 'q_prompt_first' : 'q_prompt_more', r);
    const v = await ask(`<div class="row">${left.map(([q], i) => `<button data-q="${i}"${i ? '' : ' class="primary"'}>${esc(opText(q))}</button>`).join('')}</div>`);
    live(r); hideCard();
    const [, answers] = left.splice(Number(v.q), 1)[0];
    for (const a of answers) await cue(a, r);
  }
}

const DESK = (n) => (n <= 6 ? 'desk_clean' : n <= 20 ? 'desk_ok' : n <= 40 ? 'desk_messy' : 'desk_chaos');   // shortcut: thresholds guessed (the game's aren't in the dump)
const pause = (ms) => new Promise((res) => setTimeout(res, ms));
async function playOpening(r) {
  await loadOpening(); await loadLines(lifeCfg.lang);
  for (let i = 0; i < 50 && !assetsReady; i++) await pause(100);   // her voice clips
  live(r);
  const desk = (await Promise.resolve(api.desk?.()).catch(() => null)) || {};
  live(r);
  await cue('intro_1', r);   // "Ta-dah!" (show_01: she drops in)
  await cue('intro_2', r);
  if (desk.count != null) { await cue(DESK(desk.count), r); try { localStorage.setItem('lilith.desk', String(desk.count)); } catch {} }
  if (desk.user) await cue('name_ask_sys', r, { user: desk.user });
  if (opText('name_ask')) await cue('name_ask', r); else show(T('askName'), 0);
  await askName(r);
  await askAge(r);
  const adult = !(draft.age != null && draft.age < 18);
  if (adult && desk.user && draft.name.toLowerCase() !== String(desk.user).toLowerCase()) await cue('name_flirt', r);   // "a nickname only Lilith gets to use?"
  await cue('post_1', r); await cue('post_2', r); await cue('post_3', r);   // "...so, your birthday is..."
  await askBirthday(r);
  await askQuestions(r);
  api.saveProfile(draft); lifeCfg.profile = { ...draft };   // saved before the last line: closing now keeps it
  await cue('ending', r);   // "Alright, we're companions from now on~"
  hideCard(); setupOn = false; idle();
}

setupBox.addEventListener('click', (e) => {
  const t = e.target.closest?.('button'); if (!t) return;
  const ds = t.dataset;
  if (ds.lang) {   // switch right away (main confirms with a config event): the performance is already in the new language
    const v = (lifeCfg.langs || []).find((x) => x[0] === ds.lang)?.[2];
    api.setLang(ds.lang); lifeCfg.lang = ds.lang; if (v) lifeCfg.voice = v;
    setupBody.innerHTML = '';
    const r = run;
    loadLines(ds.lang).then(() => { if (setupOn && r === run) playOpening(r).catch(onStop); });
    return;
  }
  if (!answer) return;
  const val = (id) => document.getElementById(id)?.value;
  const a = answer; answer = null;
  a({ ...ds, name: val('su-name') ?? '', age: val('su-age') ?? '', bm: val('su-bm'), bd: val('su-bd') });
});
setupBox.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lifeCfg.profile) { cancelSetup(); return; }   // a re-run can be cancelled
  if (e.key !== 'Enter') return;
  e.preventDefault();   // a focused button would otherwise click a second time
  const b = setupBox.querySelector('button.primary'); if (b) b.click();
});
function onStop(e) { if (!(e instanceof Cancel)) console.error('setup', e); }
function cancelSetup() { run++; answer = null; hideCard(); setupOn = false; bubble.className = ''; idle(); }

function startSetup() {
  if (!data || demoing) return;
  showBar(false); endActivity(false); closeChat(); setupOn = true; const r = ++run;
  api.hover(true); api.focus();   // the card needs clicks and typing
  draft = { ...(lifeCfg.profile || {}) };
  const langs = lifeCfg.langs || [['en', 'English']];
  if (langs.length < 2) return void playOpening(r).catch(onStop);
  show('Language? / 语言？ / 言語？', 0); waitPose();
  setupBody.innerHTML = `<div class="row">${langs.map(([t, l]) => `<button data-lang="${t}" class="${t === lifeCfg.lang ? 'primary' : ''}">${esc(l)}</button>`).join('')}</div>`;
  setupErr.textContent = ''; setupBox.classList.add('show');
  setTimeout(() => setupBox.querySelector('button.primary')?.focus(), 30);   // Enter keeps the current language
}
api.onSetup(startSetup);
// First launch: the opening instead of the usual hello. Later launches: she notices a changed desktop.
let setupChecked = false;
api.onConfig((c) => {
  if (setupChecked) return; setupChecked = true;
  if (!c.profile) return void setTimeout(() => { if (!lifeCfg.profile && !tucked) startSetup(); }, 800);
  setTimeout(deskChanged, 15000);
});
async function deskChanged() {
  const desk = await Promise.resolve(api.desk?.()).catch(() => null);
  if (!desk || desk.count == null) return;
  let was = null; try { was = localStorage.getItem('lilith.desk'); localStorage.setItem('lilith.desk', String(desk.count)); } catch {}
  if (was == null || busy || setupOn || tucked || demoing) return;
  const d = Math.abs(desk.count - Number(was));
  const key = d >= Math.max(15, Number(was)) ? 'desk_changed_major' : d >= 5 ? 'desk_changed' : null;   // shortcut: thresholds guessed
  if (!key) return;
  await loadOpening();
  const t = opText(key);
  if (t) show(t, Math.max(3500, t.length * 80));
}
