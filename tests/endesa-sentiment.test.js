const assert = require('node:assert/strict');
const test = require('node:test');

const {
  analyzeSentiment,
  isExplicitlyEnabled
} = require('../scripts/endesa-sentiment');

test('detects the same Portuguese complaint on repeated calls', () => {
  const text = 'Problema grave com cobrança indevida.';

  const first = analyzeSentiment(text);
  const second = analyzeSentiment(text);
  const third = analyzeSentiment(text);

  assert.equal(first.hasComplaint, true);
  assert.equal(second.hasComplaint, true);
  assert.equal(third.hasComplaint, true);
  assert.equal(first.isNegative, true);
  assert.equal(second.isNegative, true);
  assert.equal(third.isNegative, true);
});

test('does not label empty content as a complaint', () => {
  const result = analyzeSentiment('');

  assert.deepEqual(result, {
    score: 0,
    comparative: 0,
    isNegative: false,
    hasComplaint: false
  });
});

test('keeps result pushes disabled without an explicit true value', () => {
  assert.equal(isExplicitlyEnabled(undefined), false);
  assert.equal(isExplicitlyEnabled('false'), false);
  assert.equal(isExplicitlyEnabled('TRUE'), false);
  assert.equal(isExplicitlyEnabled('true'), true);
});
