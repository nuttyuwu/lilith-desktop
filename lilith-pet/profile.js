// First-run profile (name / age / gender): validation shared by main and the persona prompt. Stored only in settings.json.
const GENDERS = { male: { label: 'Boy', pron: 'he/him' }, female: { label: 'Girl', pron: 'she/her' }, nonbinary: { label: 'Non-binary', pron: 'they/them' }, unsaid: { label: 'Rather not say', pron: 'they/them' } };

// Game rule (PlayerNameRule): width 1..16, CJK/full-width characters count 2.
const nameWidth = (s) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);

function clean(p) {
  if (!p || typeof p !== 'object') return null;
  const name = String(p.name || '').replace(/[\u0000-\u001f\u007f{}<>]/g, '').trim();
  if (!name || nameWidth(name) > 16) return null;
  const age = Number.isInteger(p.age) && p.age >= 1 && p.age <= 120 ? p.age : null;
  const gender = GENDERS[p.gender] ? p.gender : 'unsaid';
  const m = /^(\d{2})-(\d{2})$/.exec(p.birthday || ''), birthday = m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31 ? p.birthday : null;   // 'MM-DD'
  return { name, age, gender, birthday };
}

function personaLines(p) {
  if (!p) return '';
  const g = GENDERS[p.gender];
  const out = [`Their name is ${p.name}; call them ${p.name}. Pronouns: ${g.pron}.`];
  if (p.age != null && p.age < 18) out.push(`They are ${p.age}, a minor: be a warm, wholesome older-friend figure. Never flirt, never romantic, nothing suggestive.`);
  else if (p.age != null) out.push(`They are ${p.age}.`);
  return out.join(' ');
}

module.exports = { GENDERS, nameWidth, clean, personaLines };
