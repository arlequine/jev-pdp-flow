#!/usr/bin/env python3
"""
npm run slides  [-- --template ruta.pptx] [--out docs/slides/charla-jev.pptx] [--no-render]

Genera el deck de la charla a partir de la plantilla de AIforDevelopers:

1. Abre la plantilla y usa SOLO su branding: master, layouts, tema, logos y las formas de sus
   diapositivas de ejemplo (que se clonan tal cual; no se dibujan formas a mano para imitarlas).
2. Lee el contenido de los bloques ```slide de docs/charla.md (única fuente del deck).
3. Reemplaza los marcadores {{…}} con cifras de metrics/ (npm run cost -- --json y before-after.json).
4. Borra todas las diapositivas originales de la plantilla.
5. Verifica: ningún texto de la plantilla queda en el deck, ningún texto desborda su caja,
   solo colores y fuentes del tema; y renderiza a PNG con LibreOffice para revisión visual.

Qué forma de qué diapositiva de ejemplo recibe qué campo está en docs/brand/patterns.json
(se escribe una vez, después de revisar el resumen de `npm run slides:brand`).
"""
import argparse, copy, hashlib, json, re, shutil, subprocess, sys
from pathlib import Path
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--template', default=str(ROOT / 'docs/brand/AIforDevelopers_E1_Introduccion_Demostracion.pptx'))
ap.add_argument('--patterns', default=str(ROOT / 'docs/brand/patterns.json'))
ap.add_argument('--brand', default=str(ROOT / 'docs/brand/brand.json'))
ap.add_argument('--charla', default=str(ROOT / 'docs/charla.md'))
ap.add_argument('--out', default=str(ROOT / 'docs/slides/charla-jev.pptx'))
ap.add_argument('--metrics', default=str(ROOT / 'metrics'))
ap.add_argument('--no-render', action='store_true')
args = ap.parse_args()

A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
NS = {'a': A, 'r': R, 'p': P}

for f in (args.template, args.patterns, args.brand):
    if not Path(f).exists():
        sys.exit(f'Falta {f}. Orden: copiar la plantilla → npm run slides:brand → escribir patterns.json → npm run slides.')

brand = json.loads(Path(args.brand).read_text())
ACCENT = brand.get('palette', {}).get('roles', {}).get('accent', '#C8E64D').lstrip('#').upper()
patterns = json.loads(Path(args.patterns).read_text())

# ───────────────────────── 1. Contenido desde docs/charla.md ─────────────────────────

def parse_slides(md: str):
    out = []
    for block in re.findall(r'```slide\n(.*?)```', md, re.S):
        spec, key = {}, None
        for line in block.splitlines():
            if not line.strip():
                continue
            m = re.match(r'^([a-záéíóúñ0-9-]+):\s*(.*)$', line)
            if m and not line.startswith('- '):
                key, val = m.group(1), m.group(2).strip()
                spec[key] = val if val else []
            elif line.startswith('- ') and key:
                if not isinstance(spec.get(key), list):
                    spec[key] = []
                spec[key].append(line[2:].rstrip())  # se conserva la sangría (bloques de código)
        for k, v in list(spec.items()):
            if isinstance(v, list) and v and all('|' in x for x in v):
                spec[k] = [[f.strip() for f in x.split('|')] for x in v]
        out.append(spec)
    return out

slides_spec = parse_slides(Path(args.charla).read_text())
if not slides_spec:
    sys.exit('No encontré bloques ```slide en docs/charla.md')

# ───────────────────────── 2. Cifras desde metrics/ ─────────────────────────

def load_numbers():
    nums, missing = {}, []
    try:
        cost = json.loads(subprocess.run(['npx', 'tsx', 'packages/jev-flow/src/cost/cli.ts', '--json'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1])
    except Exception as e:  # noqa: BLE001
        print(f'aviso: no pude leer costos ({e})')
        cost = {}
    def usd(v):
        if v is None: return None
        return '$0' if v == 0 else (f'${v:.6f}'.rstrip('0') if v < 0.01 else f'${v:.4f}'.rstrip('0').rstrip('.'))
    for p in cost.get('prioritize', []):
        key = {'jev': 'jev', 'pedirle-a-sonnet': 'sonnet', 'pedirle-a-opus': 'opus'}.get(p['method'])
        if key:
            nums[f'prioritize.{key}.cost'] = usd(p.get('costUsd'))
            nums[f'prioritize.{key}.passed'] = None if p.get('passed') is None else str(p['passed'])
    ref = cost.get('refactor') or {}
    if ref.get('rows'):
        nums['refactor.cost'] = usd(ref.get('totalUsd'))
        nums['refactor.opus'] = usd(ref.get('opusUsd'))
    for r in cost.get('review', []):
        key = {'jev': 'jev', 'opus': 'opus', 'baseline': 'baseline'}.get(r['method'])
        if key:
            nums[f'review.{key}.cost'] = usd(r.get('costUsd'))
            nums[f'review.{key}.exact'] = f"{r['exact']}/{r['total']}"
    for k, v in (cost.get('prices') or {}).items():
        if k.startswith('jev'):
            nums['prices.jev.input'] = f"{v['input']:g}"
    ba_f = Path(args.metrics) / 'before-after.json'
    if ba_f.exists():
        ba = json.loads(ba_f.read_text())
        b, a = ba['before'], ba['after']
        nums['ba.requests'] = f"{b['apiRequests']} → {a['apiRequests']}"
        nums['ba.complete'] = f"{b['timeToCompleteMs']:,} ms → {a['timeToCompleteMs']:,} ms"
        nums['ba.price'] = f"{b['timeToPriceMs']:,} ms → {a['timeToPriceMs']:,} ms"
        nums['ba.a11y'] = f"{b['a11yScore']} → {a['a11yScore']}"
        nums['ba.lines'] = f"{b['componentLines']} → {a['componentLines']}"
        nums['ba.bundle'] = f"{b['bundleGzipKb']} KB → {a['bundleGzipKb']} KB"
    return nums

NUMBERS = load_numbers()
MISSING = set()
def fill(text: str) -> str:
    def rep(m):
        v = NUMBERS.get(m.group(1))
        if v is None:
            MISSING.add(m.group(1))
            return 's/d'
        return v
    return re.sub(r'\{\{\s*([\w.]+)\s*\}\}', rep, text)

def deep_fill(v):
    if isinstance(v, str): return fill(v)
    if isinstance(v, list): return [deep_fill(x) for x in v]
    if isinstance(v, dict): return {k: deep_fill(x) for k, x in v.items()}
    return v

slides_spec = [deep_fill(s) for s in slides_spec]

# ───────────────────────── 3. Construcción ─────────────────────────

prs = Presentation(args.template)
originals = list(prs.slides)
n_original = len(originals)

def _color_of(r):
    c = r.find('.//a:solidFill/a:srgbClr', NS)
    return c.get('val') if c is not None else None

def set_text(shape, value, bullets=False):
    """Reemplaza el texto conservando el formato de la plantilla.
    **texto** usa el formato del run resaltado de la plantilla (en esta, lima y negritas)."""
    tf = shape.text_frame
    lines = value if isinstance(value, list) else [value]
    lines = [' · '.join(x) if isinstance(x, list) else x for x in lines]
    runs_all = [r for p in tf.paragraphs for r in p._p.findall('a:r', NS)]
    # El resaltado es el run con el color de acento de la marca; la base, el primer run que no lo tenga.
    hi = next((r for r in runs_all if (_color_of(r) or '').upper() == ACCENT), None)
    base = next((r for r in runs_all if (_color_of(r) or '').upper() != ACCENT), None)
    if base is None and runs_all:
        base, hi = runs_all[0], None
    base_rpr = base.find('a:rPr', NS) if base is not None else None
    hi_rpr = hi.find('a:rPr', NS) if hi is not None else None
    proto_p = copy.deepcopy(tf.paragraphs[0]._p)
    for p in tf.paragraphs[1:]:
        p._p.getparent().remove(p._p)

    def write(p_el, text):
        for child in list(p_el):
            if etree.QName(child).localname in ('r', 'br', 'fld'):
                p_el.remove(child)
        end = p_el.find('a:endParaRPr', NS)
        parts = re.split(r'\*\*(.+?)\*\*', text)
        for i, part in enumerate(parts):
            if not part:
                continue
            r = etree.Element(f'{{{A}}}r')
            rpr = hi_rpr if (i % 2 == 1 and hi_rpr is not None) else base_rpr
            if rpr is not None:
                r.append(copy.deepcopy(rpr))
            if i % 2 == 1 and hi_rpr is None:
                (r.find('a:rPr', NS) if r.find('a:rPr', NS) is not None else etree.SubElement(r, f'{{{A}}}rPr')).set('b', '1')
            t = etree.SubElement(r, f'{{{A}}}t')
            t.text = part
            if end is not None:
                end.addprevious(r)
            else:
                p_el.append(r)

    write(tf.paragraphs[0]._p, lines[0] if lines else '')
    anchor = tf.paragraphs[0]._p
    for text in lines[1:]:
        p_new = copy.deepcopy(proto_p)
        write(p_new, text)
        anchor.addnext(p_new)
        anchor = p_new

def clone_slide(src_index: int):
    """Nueva diapositiva con el layout de la de ejemplo y copias exactas de sus formas (incluidas imágenes)."""
    src = originals[src_index - 1]
    dst = prs.slides.add_slide(src.slide_layout)
    for ph in list(dst.placeholders):
        ph._element.getparent().remove(ph._element)
    rid_map = {}
    for rel in src.part.rels.values():
        if rel.reltype in (RT.IMAGE, RT.MEDIA, RT.VIDEO) or rel.reltype.endswith('/hdphoto'):
            rid_map[rel.rId] = dst.part.relate_to(rel.target_part, rel.reltype)
        elif rel.reltype == RT.HYPERLINK:
            rid_map[rel.rId] = dst.part.relate_to(rel.target_ref, rel.reltype, is_external=True)
    for el in src.shapes._spTree.iterchildren():
        tag = etree.QName(el).localname
        if tag in ('nvGrpSpPr', 'grpSpPr'):
            continue
        new = copy.deepcopy(el)
        for node in new.iter():
            for attr in (f'{{{R}}}embed', f'{{{R}}}link', f'{{{R}}}id'):
                if node.get(attr) in rid_map:
                    node.set(attr, rid_map[node.get(attr)])
        dst.shapes._spTree.append(new)
    # Fondo propio de la diapositiva, si lo tiene.
    bg = src._element.find('p:cSld/p:bg', NS)
    if bg is not None:
        dst._element.find('p:cSld', NS).insert(0, copy.deepcopy(bg))
    return dst

def all_shapes(container):
    for sh in container:
        yield sh
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from all_shapes(sh.shapes)

def by_name(slide, name):
    return next((s for s in all_shapes(slide.shapes) if s.name == name), None)

def remove(shape):
    shape._element.getparent().remove(shape._element)

def add_picture_in(slide, box, path: Path):
    """Inserta una imagen ajustada (sin deformar) dentro de la caja `box` de la plantilla."""
    from PIL import Image
    w, h = Image.open(path).size
    bw, bh = box.width, box.height
    scale = min(bw / w, bh / h)
    pw, ph = int(w * scale), int(h * scale)
    pic = slide.shapes.add_picture(str(path), box.left + (bw - pw) // 2, box.top + (bh - ph) // 2, pw, ph)
    pic.name = f'Imagen {path.stem}'
    return pic

def from_layout(cfg, spec):
    layout = prs.slide_layouts[cfg['layout']]
    s = prs.slides.add_slide(layout)
    for ph in s.placeholders:
        field = cfg.get('placeholders', {}).get(str(ph.placeholder_format.idx))
        if field and spec.get(field):
            set_text(ph, spec[field])
        elif ph.has_text_frame:
            remove(ph)
    return s

SOURCES = []

def build(spec, number):
    pat = spec.get('patrón')
    cfg = patterns.get(pat)
    if not cfg:
        sys.exit(f'patrón "{pat}" no está en patterns.json')
    s = from_layout(cfg, spec) if 'layout' in cfg else clone_slide(cfg['clone'])
    SOURCES.append(cfg.get('clone'))
    used = set()
    # Campos simples → formas por nombre.
    for shape_name, field in cfg.get('fill', {}).items():
        sh = by_name(s, shape_name)
        if sh is None:
            sys.exit(f'patterns.json: no existe la forma "{shape_name}" en el patrón {pat}')
        val = spec.get(field)
        if val in (None, [], ''):
            remove(sh)
            for other in cfg.get('drop_with', {}).get(shape_name, []):
                o = by_name(s, other)
                if o is not None:
                    remove(o)
        else:
            set_text(sh, val)
            used.add(shape_name)
    # Tarjetas: conjuntos de formas que se repiten; cada tarjeta es una lista de campos "a | b | c".
    groups = cfg.get('cards', [])
    for g in groups if isinstance(groups, list) else [groups]:
        items = spec.get(g.get('field', 'tarjetas'), []) or []
        slots = g['slots']
        if len(items) > len(slots):
            sys.exit(f'El patrón {pat} tiene {len(slots)} lugares para "{g.get("field", "tarjetas")}" y la diapositiva pide {len(items)}')
        for i, slot in enumerate(slots):
            if i >= len(items):
                for name in list(slot) + g.get('decor', [[]] * len(slots))[i]:
                    sh = by_name(s, name)
                    if sh is not None:
                        remove(sh)
                continue
            for shape_name, idx in slot.items():
                sh = by_name(s, shape_name)
                if sh is None:
                    continue
                val = items[i][idx] if idx < len(items[i]) else ''
                if val:
                    set_text(sh, val)
                else:
                    remove(sh)
        for name in g.get('drop_if_fewer', {}).get(str(len(items)), []):
            sh = by_name(s, name)
            if sh is not None:
                remove(sh)
    # Línea de tiempo: segmentos proporcionales a los minutos, reusando las formas de la plantilla.
    if 'timeline' in cfg and spec.get(cfg['timeline']['field']):
        tl, segs = cfg['timeline'], spec[cfg['timeline']['field']]
        x0, x1, gap = Emu(int(tl['x0'] * 914400)), Emu(int(tl['x1'] * 914400)), int(tl['gap'] * 914400)
        total = sum(float(m) for _, m in segs)
        usable = (x1 - x0) - gap * (len(segs) - 1)
        x, acc = x0, 0.0
        ticks = [by_name(s, n) for n in tl['ticks']]
        for i, pair in enumerate(tl['segments']):
            shapes = [by_name(s, n) for n in pair]
            if i >= len(segs):
                for sh in shapes:
                    if sh is not None:
                        remove(sh)
                continue
            label, minutes = segs[i]
            w = int(usable * float(minutes) / total)
            for sh in shapes:
                sh.left, sh.width = x, w
            set_text(shapes[1], label)
            if ticks[i] is not None:
                ticks[i].left = x
                set_text(ticks[i], f"{acc:g}'")
            acc += float(minutes)
            x += w + gap
        if ticks[len(segs)] is not None:
            ticks[len(segs)].left = x1 - ticks[len(segs)].width
            set_text(ticks[len(segs)], f"{acc:g}'")
        for t in ticks[len(segs) + 1:]:
            if t is not None:
                remove(t)
    # Imágenes dentro de cajas de la plantilla.
    for box_name, icfg in cfg.get('images', {}).items():
        icfg = icfg if isinstance(icfg, dict) else {'field': icfg}
        box = by_name(s, box_name)
        img = spec.get(icfg['field'])
        if box is None:
            continue
        for name in (icfg.get('replace', []) if img else []):
            sh = by_name(s, name)
            if sh is not None:
                remove(sh)
        if img and (ROOT / img).exists():
            pad, top = int(icfg.get('pad', 0.1) * 914400), int(icfg.get('top', 0) * 914400)
            area = type('Area', (), {'left': box.left + pad, 'top': box.top + top + pad, 'width': box.width - 2 * pad, 'height': box.height - top - 2 * pad})
            add_picture_in(s, area, ROOT / img)
            if not icfg.get('keep_box', False):
                remove(box)
        elif img:
            MISSING.add(f'imagen:{img}')
        elif not icfg.get('keep_box', False):
            remove(box)
    # Número de diapositiva del pie (texto fijo en la plantilla).
    if cfg.get('page_number') and by_name(s, cfg['page_number']) is not None:
        set_text(by_name(s, cfg['page_number']), str(number))
        used.add(cfg['page_number'])
    for name in cfg.get('drop', []):
        sh = by_name(s, name)
        if sh is not None:
            remove(sh)
    if spec.get('notas'):
        s.notes_slide.notes_text_frame.text = spec['notas'] if isinstance(spec['notas'], str) else '\n'.join(spec['notas'])
    return s

for i, spec in enumerate(slides_spec, start=1):
    build(spec, i)

# Borra las diapositivas originales de la plantilla (y sus partes).
sldIdLst = prs.slides._sldIdLst
for sldId in list(sldIdLst)[:n_original]:
    prs.part.drop_rel(sldId.rId)
    sldIdLst.remove(sldId)

out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
prs.save(out)
print(f'{out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {len(slides_spec)} diapositivas')

# ───────────────────────── 4. Verificación ─────────────────────────

problems = []
deck = Presentation(str(out))
FORBIDDEN = [r'\bGrano\b', r'\bPVB\b', r'Product Vision Board', r'Andr[eé]s Bilbao', r'\bEstaci[oó]n\b', r'\bE(?:[1-9]|1[01])\b', r'\bCOT\b', r'Huila', r'Chiapas', r'\$837', r'BIENVENIDA10', r'\bRender\b', r'\bVercel\b', r'\bISB\b']
# "?" y "Preguntas" son parte del patrón de cierre que se pide conservar; no cuentan como contenido de la plantilla.
# Textos que la estructura pedida para la charla usa por nombre (títulos y archivos del repo), no contenido de la plantilla.
ALLOWED = {'?', 'Preguntas', 'Demo en vivo', 'Lo que van a ver', 'Las reglas del juego', 'CLAUDE.md', '.claude/settings.json'}
template_hashes = set(brand.get('template_texts_sha256', [])) - {hashlib.sha256(t.encode()).hexdigest() for t in ALLOWED}
theme_colors = {c.upper().lstrip('#') for c in list(brand['theme']['colors'].values()) + list(brand.get('palette', {}).get('colors', {}).keys())}
theme_fonts = {brand['theme']['fonts']['major'], brand['theme']['fonts']['minor'], *brand.get('palette', {}).get('fonts', {}).keys()}

FONT_FILES = {
    # Fuentes métricamente compatibles (las mismas que usa LibreOffice al renderizar).
    ('Arial', False): 'LiberationSans-Regular.ttf', ('Arial', True): 'LiberationSans-Bold.ttf',
    ('Courier New', False): 'LiberationMono-Regular.ttf', ('Courier New', True): 'LiberationMono-Bold.ttf',
    ('Calibri', False): 'Carlito-Regular.ttf', ('Calibri', True): 'Carlito-Bold.ttf',
}
_font_cache = {}
def _font(name, bold, size):
    from PIL import ImageFont
    key = (name if (name, bold) in FONT_FILES else 'Arial', bool(bold), size)
    if key not in _font_cache:
        fname = FONT_FILES[(key[0], key[1])]
        path = next((str(p) for p in Path('/usr/share/fonts').rglob(fname)), None)
        _font_cache[key] = ImageFont.truetype(path, int(round(size * 10))) if path else None  # 10 px por pt
    return _font_cache[key]

def est_lines(sh):
    """Líneas que necesita el texto (envolviendo por palabras con la métrica real de la fuente) y líneas que caben."""
    tf = sh.text_frame
    bodyPr = tf._txBody.find('a:bodyPr', NS)
    ins = lambda k, d: int(bodyPr.get(k)) if bodyPr is not None and bodyPr.get(k) else d
    width_pt = (sh.width - ins('lIns', 91440) - ins('rIns', 91440)) / 12700
    height_pt = (sh.height - ins('tIns', 45720) - ins('bIns', 45720)) / 12700
    nowrap = bodyPr is not None and bodyPr.get('wrap') == 'none'
    need_pt, size = 0.0, 12
    for p in tf.paragraphs:
        size = next((r.font.size.pt for r in p.runs if r.font.size), None) or size
        bold = any(r.font.bold for r in p.runs)
        name = next((r.font.name for r in p.runs if r.font.name), 'Arial')
        f = _font(name, bold, size)
        measure = (lambda t: f.getlength(t) / 10) if f else (lambda t: len(t) * size * 0.5)
        lines, cur = 1, ''
        for word in p.text.split(' '):
            trial = f'{cur} {word}' if cur else word
            if not nowrap and measure(trial) > width_pt and cur:
                lines, cur = lines + 1, word
            else:
                cur = trial
        if nowrap and measure(p.text) > width_pt * 1.02:
            lines += 1
        need_pt += lines * size * 1.2
    return round(need_pt / (size * 1.2)), max(1, int(height_pt / (size * 1.2) + 0.15))

# Líneas que usaba el texto original de cada forma de la plantilla: la referencia de "cabe".
TEMPLATE_LINES = {}
for n, ts in enumerate(Presentation(args.template).slides, start=1):
    for sh in all_shapes(ts.shapes):
        if sh.has_text_frame and sh.text_frame.text.strip() and sh.width and sh.height:
            TEMPLATE_LINES[(n, sh.name)] = est_lines(sh)[0]

def est_overflow(sh, src):
    if not sh.has_text_frame or not sh.text_frame.text.strip() or not sh.width or not sh.height:
        return False
    need, fits = est_lines(sh)
    return need > max(fits, TEMPLATE_LINES.get((src, sh.name), 1))

for n, s in enumerate(deck.slides, start=1):
    for sh in all_shapes(s.shapes):
        if sh.has_text_frame:
            t = sh.text_frame.text.strip()
            if len(t) > 3 and hashlib.sha256(t.encode()).hexdigest() in template_hashes:
                problems.append(f'D{n}: quedó texto de la plantilla en "{sh.name}"')
            for pat in FORBIDDEN:
                if re.search(pat, t):
                    problems.append(f'D{n}: texto prohibido ({pat}) en "{sh.name}": {t[:50]!r}')
            if est_overflow(sh, SOURCES[n - 1] if n - 1 < len(SOURCES) else None):
                problems.append(f'D{n}: posible desborde en "{sh.name}" ({len(t)} caracteres)')
            for el in sh._element.iter(f'{{{A}}}srgbClr'):
                if el.get('val', '').upper() not in theme_colors:
                    problems.append(f'D{n}: color fuera del tema #{el.get("val")} en "{sh.name}"')
            for el in sh._element.iter(f'{{{A}}}latin'):
                face = el.get('typeface', '')
                if face and not face.startswith('+') and face not in theme_fonts:
                    problems.append(f'D{n}: fuente fuera del tema "{face}" en "{sh.name}"')

if MISSING:
    print('Sin dato (aparecen como "s/d"): ' + ', '.join(sorted(MISSING)))
if problems:
    print('\nProblemas:')
    for p in sorted(set(problems)):
        print('  - ' + p)
else:
    print('Verificación: sin texto de la plantilla, sin desbordes estimados, solo colores y fuentes del tema.')

# ───────────────────────── 5. Render a PNG ─────────────────────────

if not args.no_render:
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice:
        print('No encontré LibreOffice: omito el render a PNG.')
    else:
        png_dir = out.parent / 'png'
        if png_dir.exists():
            shutil.rmtree(png_dir)
        png_dir.mkdir(parents=True)
        subprocess.run([soffice, '--headless', '--convert-to', 'pdf', '--outdir', str(png_dir), str(out)], check=True, capture_output=True)
        pdf = png_dir / (out.stem + '.pdf')
        if shutil.which('pdftoppm'):
            subprocess.run(['pdftoppm', '-png', '-r', '60', str(pdf), str(png_dir / 'D')], check=True)
            print(f'PNG de revisión en {png_dir.relative_to(ROOT) if png_dir.is_relative_to(ROOT) else png_dir}/ (uno por diapositiva)')
        else:
            print(f'PDF de revisión en {pdf}')

sys.exit(1 if problems else 0)
