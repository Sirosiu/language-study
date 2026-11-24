import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitiseProgress, mergeProgress, progressEnvelope } from '../web/progress.js';
test('legacy and versioned exports round-trip all identifier boundaries',()=>{
  const p={fr:{attempts:{'fr-Q0001':'correct','fr-Q0999':'review','fr-Q1000':'correct'},words:['fr-V0001','fr-V1000','fr-V0001']}};
  const expected={fr:{attempts:p.fr.attempts,words:['fr-V0001','fr-V1000']}};
  assert.deepEqual(sanitiseProgress(p),expected);
  assert.deepEqual(sanitiseProgress(progressEnvelope(p)),expected);
});
test('merge keeps existing words and unaffected attempts while incoming marks take priority',()=>{
  const a={fr:{attempts:{'fr-Q0001':'correct','fr-Q0002':'review'},words:['fr-V0001']}};
  const b={fr:{attempts:{'fr-Q0002':'correct'},words:['fr-V0002']},ja:{attempts:{},words:['ja-V0001']}};
  const merged=mergeProgress(a,b);
  assert.deepEqual(merged.fr,{attempts:{'fr-Q0001':'correct','fr-Q0002':'correct'},words:['fr-V0001','fr-V0002']});
  assert.deepEqual(merged.ja,b.ja);assert.equal(a.fr.attempts['fr-Q0002'],'review');
});
test('reject malformed, unsupported, cross-language and prototype keys',()=>{
  for(const bad of [null,[],{schemaVersion:2,progress:{}},{schemaVersion:1}, {xx:{attempts:{},words:[]}}, {fr:{attempts:[],words:[]}}, {fr:{attempts:{'fr-Q0000':'correct'},words:[]}}, {fr:{attempts:{'fr-Q1001':'correct'},words:[]}}, {fr:{attempts:{'ja-Q0001':'correct'},words:[]}}, {fr:{attempts:{'fr-Q0001':'yes'},words:[]}}, {fr:{attempts:{},words:['fr-V0000']}}, JSON.parse('{"__proto__":{"attempts":{},"words":[]}}'), JSON.parse('{"fr":{"attempts":{"__proto__":"correct"},"words":[]}}')])assert.throws(()=>sanitiseProgress(bad));
  assert.equal({}.polluted,undefined);
});
