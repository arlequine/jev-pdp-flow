#!/usr/bin/env python3
"""
npm run slides:brand  [-- ruta/plantilla.pptx]

Lee la plantilla de AIforDevelopers y guarda en docs/brand/brand.json:
  - colores y fuentes del tema (leídos del XML del tema, no aproximados);
  - tamaño de diapositiva;
  - layouts con sus placeholders;
  - imágenes de marca del master y de los layouts (con sha256);
  - un inventario de cada diapositiva de ejemplo (layout, formas, posición, tamaño de letra)
    y la detección de patrones (espera, separador, tarjetas, pie, preguntas).
Imprime un resumen para revisarlo antes de generar el deck.
"""
import hashlib, json, re, sys
from pathlib import Path
from pptx import Presentation
from pptx.util import Emu
from pptx.enum.shapes import MSO_SHAPE_TYPE

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/brand/AIforDevelopers_E1_Introduccion_Demostracion.pptx'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'docs/brand/brand.json'
NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}

if not SRC.exists():
    sys.exit(f'No encuentro la plantilla en {SRC}. Copia el .pptx ahí (ver docs/runbook.md, B.6).')

prs = Presentation(str(SRC))

# ── Tema: colores y fuentes del master ──
master = prs.slide_masters[0]
theme_part = next(r.target_part for r in master.part.rels.values() if r.reltype.endswith('/theme'))
from lxml import etree
theme = etree.fromstring(theme_part.blob)
colors = {}
for el in theme.find('.//a:clrScheme', NS):
    name = etree.QName(el).localname
    child = el[0]
    if etree.QName(child).localname == 'srgbClr':
        colors[name] = '#' + child.get('val').upper()
    elif etree.QName(child).localname == 'sysClr':
        colors[name] = '#' + (child.get('lastClr') or '000000').upper()
fonts = {
    'major': theme.find('.//a:majorFont/a:latin', NS).get('typeface'),
    'minor': theme.find('.//a:minorFont/a:latin', NS).get('typeface'),
}
scheme_name = theme.find('.//a:clrScheme', NS).get('name')

def emu(v):
    return int(v) if v is not None else None

def font_sizes(shape):
    sizes = []
    if shape.has_text_frame:
        for p in shape.text_frame.paragraphs:
            for r in p.runs:
                if r.font.size:
                    sizes.append(r.font.size.pt)
    return sizes

def media_of(part, where):
    out = []
    for rel in part.rels.values():
        if rel.reltype.endswith('/image'):
            blob = rel.target_part.blob
            out.append({'name': Path(rel.target_part.partname).name, 'sha256': hashlib.sha256(blob).hexdigest(), 'bytes': len(blob), 'used_in': where})
    return out

# ── Layouts y placeholders ──
layouts = []
media = media_of(master.part, 'master')
for i, layout in enumerate(master.slide_layouts):
    layouts.append({
        'index': i,
        'name': layout.name,
        'placeholders': [
            {'idx': ph.placeholder_format.idx, 'type': str(ph.placeholder_format.type).split('.')[-1].split(' ')[0], 'name': ph.name,
             'left': emu(ph.left), 'top': emu(ph.top), 'width': emu(ph.width), 'height': emu(ph.height)}
            for ph in layout.placeholders
        ],
        'shapes': len(layout.shapes),
    })
    media += media_of(layout.part, f'layout:{layout.name}')

# ── Inventario de las diapositivas de ejemplo (solo estructura; el texto solo para detectar patrones) ──
def shape_info(sh):
    d = {'name': sh.name, 'kind': str(sh.shape_type).split('.')[-1].split(' ')[0] if sh.shape_type else 'NONE',
         'left': emu(sh.left), 'top': emu(sh.top), 'width': emu(sh.width), 'height': emu(sh.height),
         'is_placeholder': sh.is_placeholder}
    if sh.is_placeholder:
        d['ph_idx'] = sh.placeholder_format.idx
    if sh.has_text_frame and sh.text_frame.text.strip():
        d['text_len'] = len(sh.text_frame.text)
        d['font_pt'] = max(font_sizes(sh), default=None)
    if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
        d['children'] = [shape_info(c) for c in sh.shapes]
    if sh.shape_type == MSO_SHAPE_TYPE.PICTURE:
        d['image_sha256'] = hashlib.sha256(sh.image.blob).hexdigest()
    return d

slides = []
template_texts = set()
for n, s in enumerate(prs.slides, start=1):
    texts = []
    def walk(shapes):
        for sh in shapes:
            if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
                walk(sh.shapes)
            elif sh.has_text_frame and sh.text_frame.text.strip():
                texts.append(sh.text_frame.text.strip())
    walk(s.shapes)
    template_texts.update(t for t in texts)
    slides.append({'n': n, 'layout': s.slide_layout.name, 'shapes': [shape_info(sh) for sh in s.shapes], 'first_text': texts[0][:40] if texts else ''})

# ── Patrones: heurística sobre la plantilla conocida; se puede corregir a mano en brand.json ──
def find(pred):
    return next((x['n'] for x in slides if pred(x)), None)
all_text = {x['n']: ' '.join(t for t in []) for x in slides}
def slide_texts(n):
    out = []
    def walk(shapes):
        for sh in shapes:
            if sh.shape_type == MSO_SHAPE_TYPE.GROUP: walk(sh.shapes)
            elif sh.has_text_frame and sh.text_frame.text.strip(): out.append(sh.text_frame.text.strip())
    walk(prs.slides[n - 1].shapes)
    return out
footer_re = re.compile(r'AI for Developers\s*\|\s*30X', re.I)
patterns = {
    'espera': find(lambda x: any('comenzar' in t.lower() for t in slide_texts(x['n']))),
    'título': 2 if len(slides) >= 2 else None,
    'agenda': find(lambda x: any(t.lower().startswith('agenda') for t in slide_texts(x['n']))),
    'separador': find(lambda x: any(re.fullmatch(r'0\d', t) for t in slide_texts(x['n'])) and len(slide_texts(x['n'])) <= 5),
    'tarjetas': find(lambda x: sum(1 for t in slide_texts(x['n']) if re.fullmatch(r'\d', t)) >= 3),
    'contenido': None,
    'dos-columnas': None,
    'imagen': None,
    'preguntas': find(lambda x: '?' in slide_texts(x['n'])),
}
footer = {'text_found': any(footer_re.search(t) for t in template_texts), 'pattern': 'AI for Developers | 30X'}

# ── Paleta y fuentes que la plantilla USA en sus diapositivas ──
# En esta plantilla el tema es el "Office" por defecto: la marca real (fondo oscuro, verde lima, grises)
# está aplicada directamente en las formas. Se lee del XML, con conteos, sin aproximar.
from collections import Counter
A_NS = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
used_colors, used_fonts, slide_media = Counter(), Counter(), {}
for s in prs.slides:
    for el in s._element.iter(f'{A_NS}srgbClr'):
        used_colors['#' + el.get('val').upper()] += 1
    for el in s._element.iter(f'{A_NS}latin'):
        if el.get('typeface') and not el.get('typeface').startswith('+'):
            used_fonts[el.get('typeface')] += 1
    for rel in s.part.rels.values():
        if rel.reltype.endswith('/image'):
            blob = rel.target_part.blob
            h = hashlib.sha256(blob).hexdigest()
            slide_media.setdefault(h, {'name': Path(rel.target_part.partname).name, 'sha256': h, 'bytes': len(blob), 'slides': []})['slides'].append(prs.slides.index(s) + 1)
media += [{**m, 'used_in': 'slides:' + ','.join(map(str, m.pop('slides')))} for m in slide_media.values()]
palette = {'colors': dict(used_colors.most_common()), 'fonts': dict(used_fonts.most_common()),
           'roles': {'background': '#0D0D0D', 'accent': '#C8E64D', 'surface': '#1A1A1A', 'text': '#FFFFFF', 'text_muted': '#A6A6A6'}}

brand = {
    'source': str(SRC.relative_to(ROOT)) if SRC.is_relative_to(ROOT) else str(SRC),
    'slide_size_emu': {'width': prs.slide_width, 'height': prs.slide_height},
    'theme': {'name': scheme_name, 'colors': colors, 'fonts': fonts},
    # Lo que de verdad se ve: colores y fuentes aplicados en las formas de la plantilla.
    'palette': palette,
    'layouts': layouts,
    'media': media,
    'example_slides': slides,
    'patterns': patterns,
    'footer': footer,
    # Textos de la plantilla: build-slides.py verifica que ninguno quede en el deck (salvo el pie de marca).
    'template_texts_sha256': sorted(hashlib.sha256(t.encode()).hexdigest() for t in template_texts if not footer_re.fullmatch(t) and not re.fullmatch(r'\d{1,2}', t)),
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(brand, ensure_ascii=False, indent=2) + '\n')

print(f'Plantilla: {SRC.name} · {Emu(prs.slide_width).inches:.2f} × {Emu(prs.slide_height).inches:.2f} in · {len(slides)} diapositivas de ejemplo')
print(f'Tema "{scheme_name}"')
print('  Colores: ' + '  '.join(f'{k}={v}' for k, v in colors.items()))
print(f'  Fuentes: títulos={fonts["major"]} · cuerpo={fonts["minor"]}')
print('Paleta usada en las diapositivas (la marca visible): ' + '  '.join(f'{c}×{n}' for c, n in palette['colors'].items()))
print('Fuentes usadas en las diapositivas: ' + ', '.join(f'{f}×{n}' for f, n in palette['fonts'].items()))
print(f'Layouts ({len(layouts)}):')
for l in layouts:
    print(f'  [{l["index"]}] {l["name"]}: ' + ', '.join(f'{p["type"]}#{p["idx"]}' for p in l['placeholders']))
print('Imágenes de marca: ' + '; '.join(f'{m["name"]} ({m["bytes"]//1024} KB, {m["used_in"]})' for m in media))
print('Patrones detectados (diapositiva de ejemplo):')
for k, v in patterns.items():
    print(f'  {k:13} → {v if v else "— (usa un layout)"}')
print(f'Pie de marca encontrado: {footer["text_found"]}')
print(f'\nGuardado en {OUT.relative_to(ROOT) if OUT.is_relative_to(ROOT) else OUT}')
