const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/arcade', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'module', code)(mod.exports, mod);
  return mod.exports;
}
const orbit = load('engine.ts');
const fw = load('firewall.ts');
const playing = () => ({ ...orbit.newGame(), status: 'playing', spawn: 10 });

test('a new wave starts every 30 seconds with a banner', () => {
  const g = playing(); g.time = 29.99; orbit.step(g, .02, new Set());
  assert.equal(g.wave, 2); assert.ok(g.banner > 1.9);
});
test('signals collected in a row raise the multiplier', () => {
  const g = playing();
  for (let i = 0; i < 4; i++) { g.objects = [{ x: g.x, y: g.y, r: 5, speed: 0, signal: true }]; orbit.step(g, .01, new Set()); }
  assert.equal(g.score, 100 + 100 + 100 + 200); assert.equal(g.combo, 4);
});
test('the shield absorbs hazards without losing a life', () => {
  const g = playing(); g.shield = 3; g.objects = [{ x: g.x, y: g.y, r: 10, speed: 0, signal: false, kind: 'comet' }];
  orbit.step(g, .01, new Set()); assert.equal(g.lives, 3); assert.equal(g.objects.length, 0);
});
test('picking up a power-up activates it', () => {
  const g = playing(); g.objects = [{ x: g.x, y: g.y, r: 6, speed: 0, signal: false, kind: 'magnet' }];
  orbit.step(g, .01, new Set()); assert.ok(g.magnet > 6);
});
test('a splitter breaks into two pieces mid-flight', () => {
  const g = playing(); g.objects = [{ x: 60, y: 100, r: 11, speed: 0, signal: false, kind: 'splitter' }];
  orbit.step(g, .01, new Set()); assert.equal(g.objects.length, 2);
});
test('getting hit resets the combo', () => {
  const g = playing(); g.combo = 5; g.comboTimer = 2; g.objects = [{ x: g.x, y: g.y, r: 10, speed: 0, signal: false }];
  orbit.step(g, .01, new Set()); assert.equal(g.combo, 0); assert.equal(g.lives, 2);
});

const fwPlaying = () => ({ ...fw.newFirewall(), status: 'playing', spawn: 10 });
test('firewall: blocking a malicious packet scores', () => {
  const g = fwPlaying(); g.packets = [{ lane: 1, x: fw.GATE_X - 1, speed: 100, label: '<script>', bad: true }];
  fw.stepFirewall(g, .02); assert.equal(g.score, 100); assert.equal(g.lives, 3); assert.equal(g.packets.length, 0);
});
test('firewall: blocking clean traffic is a false positive', () => {
  const g = fwPlaying(); g.packets = [{ lane: 1, x: fw.GATE_X - 1, speed: 100, label: 'DNS', bad: false }];
  fw.stepFirewall(g, .02); assert.equal(g.lives, 2);
});
test('firewall: a malicious packet reaching the server is a breach', () => {
  const g = fwPlaying(); g.lane = 0; g.packets = [{ lane: 2, x: fw.SERVER_X - 1, speed: 100, label: 'rm -rf /', bad: true }];
  fw.stepFirewall(g, .02); assert.equal(g.lives, 2);
});
test('firewall: the gate stays within the three lanes', () => {
  const g = fwPlaying(); fw.moveGate(g, -1); fw.moveGate(g, -1); assert.equal(g.lane, 0); fw.moveGate(g, 1); fw.moveGate(g, 1); fw.moveGate(g, 1); assert.equal(g.lane, 2);
});
