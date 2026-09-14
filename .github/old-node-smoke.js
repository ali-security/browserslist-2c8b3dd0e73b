// Smoke check for the Node versions that cannot run the uvu suite.
//
// `engines` still allows Node 6 and up, but the suite cannot be executed
// there: uvu 0.5.6's CLI runner touches `globalThis` before its own polyfill
// is loaded (uvu/run/index.js:2) so it throws on Node < 12, and four of the
// test files pull in fs-extra 11, which needs Node >= 14.14.
//
// These assertions cover the two code paths this sealed release patches,
// on the runtimes the package still claims to support.

var assert = require('assert')

var browserslist = require('..')

function check(name, fn) {
  fn()
  browserslist.clearCaches()
  console.log('ok - ' + name)
}

check('resolves a query', function () {
  assert.strictEqual(browserslist('last 2 Chrome versions').length, 2)
})

// CVE-2026-73089: the query cache is a bounded Map, so a caller feeding
// unique queries can no longer grow it without limit.
check('bounds the in-memory query cache', function () {
  var first = browserslist('since 1990-01-01')
  assert.strictEqual(browserslist('since 1990-01-01'), first)

  for (var day = 2; day <= 600; day++) {
    browserslist('since 1990-01-' + day)
  }

  var recomputed = browserslist('since 1990-01-01')
  assert.ok(recomputed !== first, 'oldest entry should have been evicted')
  assert.deepEqual(recomputed, first)

  var recent = browserslist('since 1990-01-600')
  assert.strictEqual(browserslist('since 1990-01-600'), recent)
})

// CVE-2026-73088: custom stats are normalized without reading or writing
// through Object.prototype.
check('does not read or write through Object.prototype', function () {
  var known = JSON.parse('{"ie":{"11":10.4},"constructor":{"1":100}}')
  assert.deepEqual(browserslist('> 10% in my stats', { stats: known }), [
    'constructor 1',
    'ie 11'
  ])

  var proto = JSON.parse('{"ie":{"10":5.3,"11":10.4},"__proto__":{"11":60}}')
  assert.deepEqual(browserslist('> 10% in my stats', { stats: proto }), [
    '__proto__ 11',
    'ie 11'
  ])
})
