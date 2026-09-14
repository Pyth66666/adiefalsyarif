const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const mod={exports:{}};
new Function('exports','module',ts.transpileModule(read('lib/planet-journey.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports,mod);
const {planetFrame,planetStops}=mod.exports;
test('only the section at the viewport centre shows a planet',()=>{
  const rects=[[-1000,0],[0,800],[800,1600]];
  assert.equal(rects.filter(([top,bottom])=>planetFrame(top,bottom,800)).length,1);
  assert.equal(planetFrame(500,1500,800),null);
});
test('planet movement reverses with scroll and respects reduced motion',()=>{
  assert.ok(planetFrame(-200,800,800).y<planetFrame(0,1000,800).y);
  assert.equal(planetFrame(-200,800,800,true).y,.5);
  assert.equal(planetFrame(-200,800,800,true).scale,1);
});
test('planet backgrounds are enabled in both Mars and space atmospheres',()=>{
  const source=read('components/experience/AmbientSpace.tsx');
  assert.equal((source.match(/<PlanetJourney/g)||[]).length,2);
  assert.ok(!source.includes('NebulaJourney'));
});
test('Mars remains static real photography',()=>{
  const source=read('components/experience/MarsScene.tsx');
  assert.ok(source.includes('/space/mars-curiosity.jpg'));
  assert.ok(!/onClick|onPointer|requestAnimationFrame|mars-rover.png/.test(source));
});
test('all planet stops correspond to existing sections',()=>{
  const files=['build/BuildWorld','build/Telemetry','build/ProjectExplorer','build/CyberMap','build/HackDev','build/EventTimeline','create/CreateWorld','create/PhotoGallery','collection/Collection','experience/Lab','about/About','contact/ContactFooter'];
  const source=files.map(f=>read('components/'+f+'.tsx')).join('\n');
  for(const stop of planetStops)assert.ok(source.includes('id="'+stop.selector.match(/^#([\w-]+)/)[1]+'"'));
});
