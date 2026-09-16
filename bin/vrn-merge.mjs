#!/usr/bin/env node
/**
 * Injecteert de Vorreni-teksten en theme settings opnieuw in de Horizon
 * core-bestanden. Draai dit na elke Horizon-update.
 *
 *   node bin/vrn-merge.mjs          controleer (exit 1 als er iets ontbreekt)
 *   node bin/vrn-merge.mjs --write  schrijf
 *
 * Shopify leest theme-teksten alleen uit locales/<iso>.json en theme settings
 * alleen uit config/settings_schema.json. Een apart Vorreni-bestand wordt
 * genegeerd, dus die twee core-bestanden moeten wel aangeraakt worden. Dit
 * script maakt dat herhaalbaar: docs/vrn-*.json is de bron van waarheid.
 *
 * De bewerking is tekstueel, niet parse-en-herschrijf: Horizon's locale-
 * bestanden staan vol vertalerscommentaar dat een JSON.stringify zou wissen.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

const raw = (p) => readFileSync(join(root, p), 'utf8');

/** JSON met `//` en `/* *\/` commentaar leesbaar maken. Alleen om te vergelijken. */
const parseLoose = (text) =>
  JSON.parse(
    text
      .replace(/"(?:[^"\\]|\\.)*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === '"' ? m : ''))
  );

/**
 * Zoekt vanaf `from` het eerste openings-haakje en geeft de index terug van het
 * bijbehorende sluit-haakje. String-bewust, zodat `{` in een tekst niet meetelt.
 */
function matchBracket(text, from) {
  const open = text.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return [open, i + 1];
  }
  throw new Error('Ongebalanceerde accolades');
}

/** Indenteert een JSON-fragment zodat het netjes in het doelbestand past. */
const block = (value, indent) =>
  JSON.stringify(value, null, 2).split('\n').join('\n' + ' '.repeat(indent));

let missing = 0;
const report = (what, ok) => {
  if (!ok) missing++;
  console.log(`  ${ok ? 'ok        ' : write ? 'geschreven' : 'ONTBREEKT '}  ${what}`);
};

const doc = (p) => parseLoose(raw(join('docs', p)));

// 1. Locales -------------------------------------------------------------
// Shopify valt voor een ontbrekende sleutel terug op de standaardtaal, maar
// theme-check wil dat elke locale dezelfde sleutels heeft. Nederlands krijgt
// de Nederlandse teksten, al het andere de Engelse als tussenstand.
const locales = doc('vrn-locales.json');

const localeFiles = readdirSync(join(root, 'locales'))
  .filter((name) => name.endsWith('.json') && !name.endsWith('.schema.json'))
  .sort();

for (const name of localeFiles) {
  const file = join('locales', name);
  const text = raw(file);
  const wanted = name.startsWith('nl') ? locales.nl : locales.en;
  const ok = JSON.stringify(parseLoose(text).vrn) === JSON.stringify(wanted);

  if (!ok && write) {
    const key = text.indexOf('"vrn"');
    let next;
    if (key !== -1) {
      const [, end] = matchBracket(text, key);
      next = text.slice(0, key) + `"vrn": ${block(wanted, 2)}` + text.slice(end);
    } else {
      const open = text.indexOf('{');
      next = `${text.slice(0, open + 1)}\n  "vrn": ${block(wanted, 2)},${text.slice(open + 1)}`;
    }
    writeFileSync(join(root, file), next);
  }
  if (!ok || process.argv.includes('--verbose')) report(`${file} -> vrn.*`, ok);
}

console.log(`  ${localeFiles.length} locale-bestanden gecontroleerd`);

// 2. Theme settings --------------------------------------------------------
const group = doc('vrn-settings-group.json');
const file = 'config/settings_schema.json';
const text = raw(file);
const ok = JSON.stringify(parseLoose(text).find((g) => g.name === group.name)) === JSON.stringify(group);

if (!ok && write) {
  const key = text.indexOf(`"name": ${JSON.stringify(group.name)}`);
  let next;
  if (key !== -1) {
    const [start, end] = matchBracket(text, text.lastIndexOf('{', key));
    next = text.slice(0, start) + block(group, 2) + text.slice(end);
  } else {
    const close = text.lastIndexOf(']');
    const body = text.slice(0, close).replace(/\s*$/, '');
    next = `${body},\n  ${block(group, 2)}\n]\n`;
  }
  writeFileSync(join(root, file), next);
}
report(`${file} -> "${group.name}"`, ok);

// 3. Te lange Nederlandse editor-labels ------------------------------------
const overrides = doc('vrn-schema-overrides.json');

for (const [file, entries] of Object.entries(overrides)) {
  if (file.startsWith('_')) continue;

  const data = parseLoose(raw(file));
  const pending = Object.entries(entries).filter(([path, value]) => {
    const current = path.split('.').reduce((node, key) => node?.[key], data);
    return current !== value;
  });

  if (pending.length > 0 && write) {
    for (const [path, value] of pending) {
      const keys = path.split('.');
      const leaf = keys.pop();
      keys.reduce((node, key) => (node[key] ??= {}), data)[leaf] = value;
    }
    writeFileSync(join(root, file), JSON.stringify(data, null, 2) + '\n');
  }
  report(`${file} -> ${Object.keys(entries).length} ingekorte labels`, pending.length === 0);
}

if (!write && missing > 0) {
  console.error(`\n${missing} item(s) ontbreken. Draai: node bin/vrn-merge.mjs --write`);
  process.exit(1);
}
console.log(write ? '\nKlaar.' : '\nAlles aanwezig.');
