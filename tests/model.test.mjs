import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlan, parseCSV, summarizeShots, validateSession} from '../assets/model.js';
const drills = JSON.parse(fs.readFileSync(new URL('../data/drills.json', import.meta.url)));
test('quoted CSV and normal-only averages retain mishits, exclude drill and play', () => {
  const rows = parseCSV('club,block,carry,total,notes\r\n7i,normal,100,110,"heavy, short"\r\n7i,normal,,130,"two ""quotes"""\r\n7i,drill,50,60,x\r\n7i,play,140,150,x\r\ndriver,normal,200,220,x');
  assert.equal(rows[0].notes, 'heavy, short'); assert.equal(rows[1].notes, 'two "quotes"');
  const r = summarizeShots(rows);
  assert.equal(r.sevenTotal, 120); assert.equal(r.sevenCarry, 100); assert.equal(r.shotCount, 2); assert.equal(r.totalCount, 2); assert.equal(r.carryCount, 1);
});
test('CSV errors are surfaced, not silently ignored', () => {
  assert.throws(() => parseCSV('club,total\n7i,"100'), /Unclosed/);
  assert.throws(() => parseCSV('club,total\n7i,100,extra'), /fields/);
  assert.throws(() => summarizeShots(parseCSV('club,total\n7i,-1')), /non-negative/);
  assert.throws(() => summarizeShots(parseCSV('club,total\ndriver,200')), /No measured/);
});
test('plan uses latest prior completed session, not future, planned, or missing scores', () => {
  const records = [
    {id:'2026-10-20-old',date:'2026-10-20',title:'Old',result:{sevenTotal:130}},
    {id:'2026-10-25-recent',date:'2026-10-25',title:'Recent',result:{sevenTotal:120}},
    {id:'2026-10-29-planned',date:'2026-10-29',title:'Planned',result:null},
    {id:'2026-12-01-future',date:'2026-12-01',title:'Future',result:{sevenTotal:150}}
  ];
  const s = createPlan(records,drills,'2026-11-01','Today','practice');
  assert.equal(s.plan.basedOnSessionId,'2026-10-25-recent');
  assert.match(s.plan.focus,/Smaller/);
  assert.deepEqual(s.plan.drills,drills);
  drills[0].cue = 'changed'; assert.notEqual(s.plan.drills[0].cue,'changed');
});
test('empty history is not fabricated and unsafe session IDs fail', () => {
  const s = createPlan([],drills,'2026-11-01','First','practice');
  assert.equal(s.result,null); assert.equal(s.plan.basedOnSessionId,null);
  assert.throws(() => createPlan([],drills,'2026-11-01','Bad','../escape'), /Invalid/);
  assert.throws(() => validateSession({...s,date:'2026-02-30'}), /Invalid/);
});
test('pending symptom follow-up blocks another active drill prescription', () => {
  assert.throws(() => createPlan([{date:'2026-11-01',id:'2026-11-01-session-01',result:{sevenTotal:96},review:{safety:{unresolved:true}}}],drills,'2026-11-08','Next','practice'), /follow-up/);
});