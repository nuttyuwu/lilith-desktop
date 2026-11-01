"""Extract The NOexistenceN of Lilith assets for personal use.
Usage (Windows, Python 3.12 venv):  pip install UnityPy==1.25.4
    python extract_lilith.py ["C:/Program Files (x86)/Steam/steamapps/common/The NOexistenceN of Lilith"] [out_dir]
Output: spine/ (skel+atlas+31 pages), dialogue/ (all languages + corpus.jsonl + nodes/player_lines/opening.json), strings/, voice/, sprites/
"""
import json, os, sys, struct, warnings, re
# Keep progress visible when launched through the bundled Windows runtime.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True, encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(line_buffering=True, encoding='utf-8', errors='replace')
warnings.filterwarnings('ignore')
import UnityPy
from UnityPy.helpers import TypeTreeHelper
# Unity 2021.3.45f2c1 (China build) appends 24 bytes to Texture2D/Sprite; standard fields parse fine.
_rt = TypeTreeHelper.read_typetree
def _lenient(*a, **k):
    k['check_read'] = False; return _rt(*a, **k)
TypeTreeHelper.read_typetree = _lenient
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lilith_text import mono_header, read_dialogue_lines, read_string_table, read_dialogue_db, read_player_lines, read_opening

GAME = sys.argv[1] if len(sys.argv) > 1 else r'C:\Program Files (x86)\Steam\steamapps\common\The NOexistenceN of Lilith'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.expanduser('~'), 'LilithRip')
D = os.path.join(GAME, 'Lilith_Data')
SKIP_VOICE = '--no-voice' in sys.argv

def mk(*p):
    path = os.path.join(OUT, *p); os.makedirs(path, exist_ok=True); return path
def safe(n): return re.sub(r'[<>:"/\\|?*]', '_', n)

# Language tagging by distinctive tokens of line 100003 (fallback keeps everything as unknown_<id>).
LANG_RULES = [(r'[\uac00-\ud7af]', 'ko'), (r'[\u3040-\u30ff]', 'ja'), (r'[\u0e00-\u0e7f]', 'th'),
              ('呢度|噉樣', 'zh-HK'), ('莉莉絲', 'zh-Hant'), ('莉莉丝', 'zh-CN'), ('Лилит', 'ru'), ('[ієї]', 'uk'),
              ('dich', 'de'), ('call you', 'en'), ('Entonces', 'es-419'), ("t'appeler", 'fr'), ('memanggil', 'id'),
              ('chiamarti', 'it'), ('nazywa', 'pl'), ('Então', 'pt-BR'), ('Demek', 'tr'), ('Vậy', 'vi')]
def tag(lines, pid):
    sample = ' '.join(l['text'] for l in lines[:3])
    for pat, lang in LANG_RULES:
        if re.search(pat, sample): return lang
    return f'unknown_{pid}'

print('loading', D)
env = UnityPy.load(*[os.path.join(D, f) for f in
                     ('sharedassets0.assets', 'resources.assets', 'globalgamemanagers.assets')])
files = {os.path.basename(k): v for k, v in env.files.items()}
scripts = {(n, o.path_id): o.read().m_ClassName
           for n, f in files.items() for o in f.objects.values() if o.type.name == 'MonoScript'}
stats = {}
def bump(k): stats[k] = stats.get(k, 0) + 1

dialogue = {}
nodes, player_lines, opening = [], [], []
for fname, f in files.items():
    for o in f.objects.values():
        t = o.type.name
        try:
            if t == 'TextAsset':
                d = o.read()
                if d.m_Name.endswith(('.skel', '.atlas')):
                    b = d.m_Script.encode('utf-8', 'surrogateescape') if isinstance(d.m_Script, str) else bytes(d.m_Script)
                    open(os.path.join(mk('spine'), d.m_Name), 'wb').write(b); bump('spine_text')
            elif t == 'Texture2D':
                d = o.read()
                if re.fullmatch(r'(Lilith|KeyRewardExchange|skeleton)(_\d+)?', d.m_Name):
                    d.image.save(os.path.join(mk('spine'), d.m_Name + '.png')); bump('spine_pages')
            elif t == 'Sprite':
                d = o.read(); d.image.save(os.path.join(mk('sprites'), safe(d.m_Name) + f'_{o.path_id}.png')); bump('sprites')
            elif t == 'AudioClip' and not SKIP_VOICE:
                d = o.read()
                sub = 'voice' if re.search(r'_(cn|jp)$', d.m_Name) else 'sfx'
                for n, wav in d.samples.items():
                    fn = safe(n) if n.lower().endswith('.wav') else safe(n) + '.wav'   # UnityPy keys already end in .wav
                    open(os.path.join(mk(sub), fn), 'wb').write(wav); bump(sub)
            elif t == 'MonoBehaviour':
                raw = o.get_raw_data()
                fid, pid, name, r = mono_header(raw)
                ext = fname if fid == 0 else os.path.basename(f.externals[fid - 1].path)
                cls = scripts.get((ext, pid))
                if cls == 'DialogueLineDatabase':
                    lines = read_dialogue_lines(r); dialogue[tag(lines, o.path_id)] = lines
                elif cls == 'DialogueDatabase':
                    db, ns = read_dialogue_db(r)
                    for n in ns: n['db'] = db
                    nodes.extend(ns); bump('dialogue_nodes')
                elif cls == 'PlayerLineDatabase':
                    player_lines = read_player_lines(r)
                elif cls == 'OpeningLineDatabase':   # first-run performance: cue key -> gesture, voice, text per language
                    opening = read_opening(r)
                elif cls == 'StringTable':
                    coll, rows = read_string_table(r)
                    json.dump(rows, open(os.path.join(mk('strings'), safe(name) + '.json'), 'w', encoding='utf8'),
                              ensure_ascii=False, indent=1); bump('string_tables')
        except Exception as e:
            bump(f'err_{t}')
            if stats[f'err_{t}'] <= 3: print(f'  ! {t} {o.path_id}: {e}')

json.dump(nodes, open(os.path.join(mk('dialogue'), 'nodes.json'), 'w', encoding='utf8'), ensure_ascii=False)
json.dump(player_lines, open(os.path.join(mk('dialogue'), 'player_lines.json'), 'w', encoding='utf8'), ensure_ascii=False)
json.dump(opening, open(os.path.join(mk('dialogue'), 'opening.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
stats['nodes'] = len(nodes); stats['player_lines'] = len(player_lines); stats['opening'] = len(opening)
for lang, lines in dialogue.items():
    json.dump(lines, open(os.path.join(mk('dialogue'), f'lines_{lang}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
# Aligned corpus: id -> text per language + voice files (voice ids are soundId + _cn / _jp)
ids = sorted({l['id'] for ls in dialogue.values() for l in ls})
by = {lang: {l['id']: l for l in ls} for lang, ls in dialogue.items()}
voice_dir = os.path.join(OUT, 'voice')
with open(os.path.join(mk('dialogue'), 'corpus.jsonl'), 'w', encoding='utf8') as fo:
    for i in ids:
        row = {'id': i}
        for lang in ('en', 'zh-CN', 'ja'):
            if i in by.get(lang, {}): row[lang] = by[lang][i]['text']; row['soundId'] = by[lang][i]['soundId']
        for v in ('cn', 'jp'):
            for p in (f"{row.get('soundId', i)}_{v}.wav", f"{row.get('soundId', i)}_{v}.wav.wav"):   # .wav.wav = older runs
                if os.path.exists(os.path.join(voice_dir, p)): row['voice_' + v] = 'voice/' + p; break
        fo.write(json.dumps(row, ensure_ascii=False) + '\n')
stats['dialogue_langs'] = len(dialogue); stats['dialogue_ids'] = len(ids)
print(json.dumps(stats, indent=1))
assert stats.get('spine_text', 0) >= 2, 'Lilith.skel/.atlas not exported'
print('done ->', OUT)
