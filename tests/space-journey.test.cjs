const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
const read=(file)=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const mod={exports:{}};
new Function('exports','module',ts.transpileModule(read('lib/ambient-journey.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports,mod);
const {atmosphereAt,atmosphereStops}=mod.exports;
const anchors=atmosphereStops.map((_,i)=>i*1000);
test('colour transitions are bounded and repeatable in either scroll direction',()=>{
  for(let p=-100;p<7000;p+=37) {const color=atmosphereAt(p,anchors);assert.ok(color.every(v=>v>=0&&v<=255));assert.deepEqual(color,atmosphereAt(p,anchors));}
});
test('last sections share one uninterrupted palette',()=>{
  assert.deepEqual(atmosphereAt(5000,anchors),atmosphereAt(12000,anchors));
});
test('no planet or asteroid rendering remains in active ambient backgrounds',()=>{
  const source=read('components/experience/AmbientSpace.tsx')+read('components/experience/NebulaJourney.tsx');
  assert.ok(!/PlanetJourney|drawImage|asteroids/.test(source));
  assert.ok(source.includes('NebulaJourney'));
});
test('Mars uses the real photograph without interactive rover or animation loop',()=>{
  const source=read('components/experience/MarsScene.tsx');
  assert.ok(source.includes('/space/mars-curiosity.jpg'));
  assert.ok(!/onClick|onPointer|requestAnimationFrame|setInterval|mars-rover.png/.test(source));
  assert.ok(fs.statSync(path.join(__dirname,'../public/space/mars-curiosity.jpg')).size>100000);
});
test('every atmosphere anchor exists in the site',()=>{
  const files=['build/BuildWorld','build/ProjectExplorer','build/HackDev','create/CreateWorld','collection/Collection','experience/Lab'];
  const source=files.map(f=>read('components/'+f+'.tsx')).join('\n');
  for(const stop of atmosphereStops)assert.ok(source.includes('id="'+stop.selector.slice(1)+'"'));
});
