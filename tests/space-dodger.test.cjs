const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const engineModule = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../components/arcade/engine.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('exports', 'module', code)(engineModule.exports, engineModule);
const { newGame, step } = engineModule.exports;
const playing = () => ({ ...newGame(), status: 'playing', spawn: 10 });
test('ready and paused games do not advance', () => {
  for (const status of ['ready', 'paused', 'over']) { const g = { ...newGame(), status }; const before = JSON.stringify(g); step(g, 1, new Set(['right'])); assert.equal(JSON.stringify(g), before); }
});
test('movement is clamped to the screen', () => {
  const g = playing(); g.x = 310; g.y = 230; step(g, .05, new Set(['right', 'down'])); assert.equal(g.x, 311); assert.equal(g.y, 230);
});
test('a signal awards points and is removed', () => {
  const g = playing(); g.objects = [{ x:g.x, y:g.y, r:5, speed:0, signal:true }]; step(g,.01,new Set()); assert.equal(g.score,100); assert.equal(g.objects.length,0); assert.equal(g.lives,3);
});
test('asteroids damage once during the invulnerability window', () => {
  const g = playing(); g.objects = Array.from({length:2},()=>({x:g.x,y:g.y,r:10,speed:0,signal:false})); step(g,.01,new Set()); assert.equal(g.lives,2); step(g,.01,new Set()); assert.equal(g.lives,2);
});
test('the final collision ends the run', () => {
  const g = playing(); g.lives=1; g.objects=[{x:g.x,y:g.y,r:10,speed:0,signal:false}]; step(g,.01,new Set()); assert.equal(g.status,'over'); assert.equal(g.lives,0);
});
test('spawns objects and removes off-screen objects', () => {
  const g = playing(); g.spawn=0; g.objects=[{x:20,y:280,r:10,speed:0,signal:false}]; step(g,.01,new Set(),()=>.5); assert.equal(g.objects.length,1); assert.ok(g.objects[0].y<0);
});
