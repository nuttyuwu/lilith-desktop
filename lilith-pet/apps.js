// What kind of app you're using, from the foreground window (windows-watch.ps1: process name without .exe + title).
// Only the kind ever leaves main (she comments on it); titles are never stored or logged.
const KINDS = [
  ['video', /^(vlc|mpc-hc(64)?|mpc-be(64)?|potplayer(mini)?(64)?|mpv|wmplayer|video\.ui|microsoft\.media\.player|plex)$/i],
  ['coding', /^(code|code - insiders|cursor|windsurf|zed|devenv|idea64|pycharm64|webstorm64|clion64|rider64|goland64|phpstorm64|rustrover64|studio64|sublime_text|notepad\+\+|windowsterminal|wt|powershell|pwsh|cmd|wezterm-gui|alacritty|nvim-qt|neovide|godot.*|unity)$/i],
  ['design', /^(photoshop|illustrator|krita|clipstudiopaint|sai2?|mspaint|gimp.*|inkscape|aseprite|paintdotnet|figma|medibangpaintpro)$/i],
  ['chat', /^(discord|telegram|wechat|weixin|qq|slack|teams|ms-teams|whatsapp|signal|line|kakaotalk|element)$/i],
];
const BROWSER = /^(chrome|msedge|firefox|brave|opera|opera_gx|vivaldi|arc|zen|librewolf|waterfox|floorp)$/i;
const VIDEO_SITE = /youtube|netflix|bilibili|哔哩哔哩|twitch|prime video|disney\+|crunchyroll|hulu|niconico|ニコニコ/i;
const CHAT_SITE = /discord|whatsapp|telegram|messenger|slack/i;

function appKind(exe = '', title = '') {
  if (BROWSER.test(exe)) return VIDEO_SITE.test(title) ? 'video' : CHAT_SITE.test(title) ? 'chat' : /figma/i.test(title) ? 'design' : 'browsing';
  const hit = KINDS.find(([, re]) => re.test(exe));
  return hit ? hit[0] : null;
}
// Windows she shouldn't look at: password managers, private browsing, sign-in / payment pages.
const PRIVATE_EXE = /^(1password|bitwarden|keepass(xc)?|dashlane|enpass|lastpass|nordpass|proton pass|credentialuibroker|consent)$/i;
const PRIVATE_TITLE = /inprivate|incognito|private browsing|password|passwort|密码|パスワード|sign[ -]?in|log[ -]?in\b|登录|ログイン|checkout|payment/i;
const isPrivate = (exe = '', title = '') => PRIVATE_EXE.test(exe) || PRIVATE_TITLE.test(title);
// A name she can say for the app in front ("VS Code", "YouTube"). Browsers: the site for the few she knows, else the browser.
const NAMES = { code: 'VS Code', 'code - insiders': 'VS Code', devenv: 'Visual Studio', windowsterminal: 'the terminal', wt: 'the terminal', powershell: 'the terminal',
  pwsh: 'the terminal', cmd: 'the terminal', idea64: 'IntelliJ', pycharm64: 'PyCharm', sublime_text: 'Sublime Text', 'notepad++': 'Notepad++', acad: 'AutoCAD',
  excel: 'Excel', winword: 'Word', powerpnt: 'PowerPoint', outlook: 'Outlook', msedge: 'Edge', chrome: 'Chrome', firefox: 'Firefox', brave: 'Brave',
  discord: 'Discord', telegram: 'Telegram', slack: 'Slack', teams: 'Teams', 'ms-teams': 'Teams', spotify: 'Spotify', steam: 'Steam', obsidian: 'Obsidian',
  claude: 'Claude', chatgpt: 'ChatGPT', kicad: 'KiCad' };
const SITES = [[/youtube/i, 'YouTube'], [/netflix/i, 'Netflix'], [/twitch/i, 'Twitch'], [/bilibili|哔哩哔哩/i, 'Bilibili'], [/github/i, 'GitHub'],
  [/reddit/i, 'Reddit'], [/chatgpt/i, 'ChatGPT'], [/claude/i, 'Claude'], [/gmail|outlook/i, 'your mail'], [/discord/i, 'Discord']];
function appName(exe = '', title = '') {
  if (!exe) return null;
  if (BROWSER.test(exe)) { const site = SITES.find(([re]) => re.test(title)); if (site) return site[1]; }
  return NAMES[exe.toLowerCase()] || (exe.length <= 24 ? exe : null);
}
module.exports = { appKind, isPrivate, appName };

if (require.main === module) {   // node apps.js: self-check
  const assert = require('assert');
  assert.strictEqual(appKind('Code', 'pet.js - lilith-pet'), 'coding');
  assert.strictEqual(appKind('chrome', 'Lofi girl - YouTube - Google Chrome'), 'video');
  assert.strictEqual(appKind('msedge', 'Inbox - Outlook'), 'browsing');
  assert.strictEqual(appKind('firefox', '#general | Discord'), 'chat');
  assert.strictEqual(appKind('CLIPStudioPaint', ''), 'design');
  assert.strictEqual(appKind('Discord', ''), 'chat');
  assert.strictEqual(appKind('vlc', 'movie.mkv'), 'video');
  assert.strictEqual(appKind('explorer', 'Downloads'), null);
  assert.strictEqual(appKind('lilith-pet', ''), null);
  assert.ok(isPrivate('msedge', 'New InPrivate tab - Microsoft Edge') && isPrivate('chrome', 'Sign in - Google Accounts - Google Chrome') && isPrivate('1Password', ''));
  assert.ok(!isPrivate('chrome', 'YouTube - Google Chrome'));
  assert.deepStrictEqual([appName('Code', 'x'), appName('brave', 'Lofi - YouTube - Brave'), appName('brave', 'Inbox'), appName('', '')], ['VS Code', 'YouTube', 'Brave', null]);
  console.log('apps ok');
}
