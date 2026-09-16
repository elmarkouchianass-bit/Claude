#!/usr/bin/env python3
"""Controles die `shopify theme check` niet doet.

    python3 bin/vrn-validate.py

Kijkt of alle JSON parseert, of elk block- en sectietype waar een template naar
verwijst bestaat, of elke setting-id in de templates ook echt in het schema van
die sectie of dat block staat, of alle Vorreni-blocks een preset hebben, en of
elke locale-sleutel die de Vorreni-bestanden gebruiken bestaat in alle talen.

Exit 1 bij een afwijking, dus bruikbaar in CI.
"""
import json, re, glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

STRING_OR_COMMENT = re.compile(r'"(?:[^"\\]|\\.)*"|/\*[\s\S]*?\*/|//[^\n]*')
SCHEMA = re.compile(r'\{%\s*schema\s*%\}(.*?)\{%\s*endschema\s*%\}', re.S)

def loose(path):
    """JSON lezen die Shopify-commentaar mag bevatten."""
    text = open(path).read()
    text = STRING_OR_COMMENT.sub(lambda m: m.group(0) if m.group(0)[0] == '"' else '', text)
    return json.loads(text)

def schema_of(kind, name):
    path = f'{kind}/{name}.liquid'
    if not os.path.exists(path):
        return None
    match = SCHEMA.search(open(path).read())
    return json.loads(match.group(1)) if match else None

problems = []

# Padding wordt door snippets/spacing-style.liquid gelezen en staat niet in elk schema.
IMPLICIT = {'padding-block-start', 'padding-block-end',
            'padding-inline-start', 'padding-inline-end'}

# 1. Alle JSON parseert -----------------------------------------------------
for path in glob.glob('**/*.json', recursive=True):
    if 'node_modules' in path:
        continue
    try:
        loose(path)
    except Exception as error:
        problems.append(f'JSON kapot: {path}: {error}')

# 2. Vorreni-blocks verschijnen in de block picker --------------------------
for path in sorted(glob.glob('blocks/vrn-*.liquid') + glob.glob('sections/vrn-*.liquid')):
    data = json.loads(SCHEMA.search(open(path).read()).group(1))
    if path.startswith('blocks/') and not data.get('presets'):
        problems.append(f'geen preset, dus niet in de block picker: {path}')
    if len(data.get('name', '')) > 25:
        problems.append(f'schema-naam langer dan 25 tekens: {path}')

# 3. Templates verwijzen alleen naar bestaande types en settings ------------
sections = {os.path.basename(f)[:-7] for f in glob.glob('sections/*.liquid')}
blocks = {os.path.basename(f)[:-7] for f in glob.glob('blocks/*.liquid')}

def check_settings(kind, type_name, settings, where):
    data = schema_of(kind, type_name)
    if data is None:
        return
    known = {s['id'] for s in data.get('settings', []) if 'id' in s} | IMPLICIT
    for key in settings:
        if key not in known:
            problems.append(f'{where}: {kind}/{type_name} kent setting "{key}" niet')

def walk(node, where):
    for child in (node.get('blocks') or {}).values():
        kind = child.get('type')
        if kind and not kind.startswith('@'):
            if kind not in blocks:
                problems.append(f'{where}: onbekend block "{kind}"')
            else:
                check_settings('blocks', kind, child.get('settings') or {}, where)
        walk(child, where)

for path in glob.glob('templates/*.json') + glob.glob('sections/*-group.json'):
    for section_id, section in loose(path).get('sections', {}).items():
        where = f'{path}#{section_id}'
        if section['type'] not in sections:
            problems.append(f'{where}: onbekende sectie "{section["type"]}"')
        else:
            check_settings('sections', section['type'], section.get('settings') or {}, where)
        walk(section, where)

# 4. Locale-pariteit en gebruikte sleutels ----------------------------------
def flatten(node, prefix=''):
    found = set()
    for key, value in node.items():
        found |= flatten(value, f'{prefix}.{key}') if isinstance(value, dict) else {f'{prefix}.{key}'}
    return found

reference = flatten(loose('locales/nl.default.json')['vrn'])

for path in glob.glob('locales/*.json'):
    if path.endswith('.schema.json'):
        continue
    found = loose(path).get('vrn')
    if found is None:
        problems.append(f'vrn ontbreekt in {path}')
    elif flatten(found) != reference:
        problems.append(f'vrn-sleutels wijken af in {path}')

used = set()
for path in (glob.glob('blocks/vrn-*.liquid') + glob.glob('sections/vrn-*.liquid')
             + glob.glob('snippets/vrn-*.liquid')):
    used |= set(re.findall(r"'(vrn\.[a-z_.0-9]+)'\s*\|\s*t", open(path).read()))

for key in sorted(used):
    if '.' + key.split('.', 1)[1] not in reference:
        problems.append(f'locale-sleutel bestaat niet: {key}')

# --------------------------------------------------------------------------
for problem in problems:
    print(' -', problem)

print(f'{len(problems)} afwijking(en); {len(used)} locale-sleutels gecontroleerd')
sys.exit(1 if problems else 0)
