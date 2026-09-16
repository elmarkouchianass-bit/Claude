import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// The asset imports bare specifiers that only exist in the browser's importmap, so rewrite them
// to local stubs before loading it.
const source = readFileSync(new URL('../assets/vor-volume-discount.js', import.meta.url), 'utf8')
  .replace("'@shopify/events'", "'./stubs/events.js'")
  .replace("'@theme/section-renderer'", "'./stubs/noop.js'")
  .replace("'@theme/utilities'", "'./stubs/utilities.js'")
  .replace("'@theme/money-formatting'", "'./stubs/noop.js'");
writeFileSync(new URL('./module-under-test.mjs', import.meta.url), source);

// The module reads the config on load; without it, start() never runs.
globalThis.document = { getElementById: () => null, querySelector: () => null, addEventListener: () => {} };

const { resolveTierState, resolveDesiredCodes } = await import('./module-under-test.mjs');

const tiers = [
  { qty: 2, percent: 10, code: 'BUNDEL10' },
  { qty: 3, percent: 15, code: 'BUNDEL15' },
  { qty: 4, percent: 20, code: 'BUNDEL20' },
  { qty: 5, percent: 25, code: 'BUNDEL25' },
];
const managed = new Set(tiers.map((t) => t.code));

let passed = 0;
function check(label, fn) {
  try { fn(); console.log('ok    ' + label); passed++; }
  catch (error) { console.log('FAIL  ' + label + ': ' + error.message); process.exitCode = 1; }
}

check('1 item has no tier yet, the first one is next', () => {
  const { active, next } = resolveTierState(tiers, 1);
  assert.equal(active, null);
  assert.equal(next.qty, 2);
});

for (const [count, code] of [[2, 'BUNDEL10'], [3, 'BUNDEL15'], [4, 'BUNDEL20'], [5, 'BUNDEL25'], [9, 'BUNDEL25']]) {
  check(`${count} items resolve to ${code}`, () => {
    assert.equal(resolveTierState(tiers, count).active.code, code);
  });
}

check('the top tier has nothing after it', () => {
  assert.equal(resolveTierState(tiers, 5).next, null);
});

check('empty cart gets no code', () => {
  assert.deepEqual(resolveDesiredCodes([{ code: 'BUNDEL10' }], null, managed), []);
});

check('going up a tier swaps the code', () => {
  assert.deepEqual(resolveDesiredCodes([{ code: 'BUNDEL10' }], 'BUNDEL15', managed), ['BUNDEL15']);
});

check('going down a tier swaps back', () => {
  assert.deepEqual(resolveDesiredCodes([{ code: 'BUNDEL25' }], 'BUNDEL10', managed), ['BUNDEL10']);
});

check('the right code already applied is left alone', () => {
  assert.equal(resolveDesiredCodes([{ code: 'BUNDEL15' }], 'BUNDEL15', managed), null);
});

check("a shopper's own code survives a tier change", () => {
  assert.deepEqual(resolveDesiredCodes([{ code: 'WELKOM10' }, { code: 'BUNDEL10' }], 'BUNDEL20', managed),
    ['WELKOM10', 'BUNDEL20']);
});

check("a shopper's own code survives dropping out of the ladder", () => {
  assert.deepEqual(resolveDesiredCodes([{ code: 'WELKOM10' }, { code: 'BUNDEL10' }], null, managed), ['WELKOM10']);
});

check('nothing to do when only a shopper code is present and no tier applies', () => {
  assert.equal(resolveDesiredCodes([{ code: 'WELKOM10' }], null, managed), null);
});

check('a manually entered ladder code is corrected to the right tier', () => {
  assert.deepEqual(resolveDesiredCodes([{ code: 'BUNDEL25' }], 'BUNDEL10', managed), ['BUNDEL10']);
});

console.log(`\n${passed} checks passed`);
