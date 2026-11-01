# Raw MonoBehaviour readers for the game's dialogue tables (IL2CPP build strips typetrees).
# Schemas come from the IL2CPP dump: DialogueLineDatabase{List<DialogueLineEntry{int id,string text,string soundId}>}
import struct

class R:
    def __init__(s, b, o=0): s.b, s.o = b, o
    def i32(s):
        v = struct.unpack_from('<i', s.b, s.o)[0]; s.o += 4; return v
    def i64(s):
        v = struct.unpack_from('<q', s.b, s.o)[0]; s.o += 8; return v
    def align(s): s.o = (s.o + 3) & ~3
    def str(s):
        n = s.i32()
        if n < 0 or n > len(s.b) - s.o: raise ValueError(f'bad string len {n} @ {s.o}')
        v = s.b[s.o:s.o + n].decode('utf8', 'replace'); s.o += n; s.align(); return v

def mono_header(raw):
    """-> (script_file_id, script_path_id, m_Name, reader positioned at first user field)"""
    r = R(raw, 12)          # m_GameObject PPtr
    r.o += 4                # m_Enabled + align
    fid = r.i32(); pid = r.i64()
    name = r.str()
    return fid, pid, name, r

def read_dialogue_lines(r):
    out = []
    for _ in range(r.i32()):
        out.append({'id': r.i32(), 'text': r.str(), 'soundId': r.str()})
    return out

def read_string_table(r):
    # UnityEngine.Localization StringTable: m_TableCollectionName(GUID string), m_SharedData PPtr,
    # m_Metadata{m_Items list(SerializeReference ids)}, m_TableData list<{m_Id long, m_Localized string, m_Metadata{list}}>
    # shortcut: layout assumed for Localization 1.x; verify against output if the package version differs.
    coll = r.str()
    r.o += 12                         # m_SharedData PPtr
    n_meta = r.i32(); r.o += 8 * n_meta if n_meta < 10000 else 0  # metadata items (rid refs)
    rows = []
    for _ in range(r.i32()):
        rid = r.i64(); txt = r.str()
        m = r.i32(); r.o += 8 * m
        rows.append({'id': rid, 'text': txt})
    return coll, rows


# DialogueDatabase{string databaseName, List<DialogueNode>}: the game's dialogue graph (who says which line when).
# DialogueNode layout from the dump (this build has no textIsFinal field).
def _f32(r): v = struct.unpack_from('<f', r.b, r.o)[0]; r.o += 4; return v
def _list(r, f): return [f() for _ in range(r.i32())]
def read_dialogue_db(r):
    name = r.str()
    def node():
        n = {'id': r.i32(), 'speaker': r.str(), 'w': r.i32(), 't': _list(r, r.i32), 'line': r.i32(), 'src': r.str(),
             'emo': r.str(), 'dur': round(_f32(r), 2), 'act': r.i32(), 'nextState': r.i32(), 'nextStateDur': round(_f32(r), 2), 'snd': r.str()}
        n['cond'] = {'s': r.str(), 'e': r.str(), 'd': r.str()}
        n['opts'] = _list(r, lambda: {'text': r.str(), 'next': r.i32()})
        n['next'] = r.i32()
        n['ps'] = _list(r, r.str)
        n['pli'] = r.str()
        n['plo'] = _list(r, lambda: {'pl': r.i32(), 'next': r.i32(), 'nexts': _list(r, r.i32)})
        return n
    return name, _list(r, node)

# PlayerLineDatabase{List<PlayerLineEntry{int id, int LineID, int groupId, List<string> playerStates, string text, int viewLimit}>}
def read_player_lines(r):
    return _list(r, lambda: {'id': r.i32(), 'line': r.i32(), 'group': r.i32(), 'ps': _list(r, r.str), 'src': r.str(), 'limit': r.i32()})


# OpeningLineDatabase{List<OpeningEntry{key, animation, soundId, zhCN, en, ja, zhHK, ko, ru, th, vi, ptBR, id, tr, es419}>}:
# the game's first-run performance (she falls in, comments on your desktop, asks your name / birthday).
OPENING_FIELDS = ('key', 'animation', 'soundId', 'zh-CN', 'en', 'ja', 'zh-HK', 'ko', 'ru', 'th', 'vi', 'pt-BR', 'id', 'tr', 'es-419')
def read_opening(r):
    return [{k: r.str() for k in OPENING_FIELDS} for _ in range(r.i32())]
