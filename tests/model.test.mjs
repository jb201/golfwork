import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlan, isExploratory, parseCSV, progressSeries, summarizeShots, validateSession} from '../assets/model.js';
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
test('progress retains exploratory results without treating them as normal-block trend points', () => {
  const records = [
    {id:'2026-11-06-experiment',date:'2026-11-06',result:{sevenTotal:99,comparability:'exploratory-not-standardized'}},
    {id:'2026-11-01-normal',date:'2026-11-01',result:{sevenTotal:120}},
    {id:'2026-11-04-carry-only',date:'2026-11-04',result:{sevenTotal:null,sevenCarry:110}},
    {id:'2026-11-02-plan',date:'2026-11-02',result:null}
  ];
  const series = progressSeries(records);
  assert.deepEqual(series.list.map(s => s.id), ['2026-11-01-normal','2026-11-04-carry-only','2026-11-06-experiment']);
  assert.deepEqual(series.measured.map(s => s.id), ['2026-11-01-normal','2026-11-06-experiment']);
  assert.deepEqual(series.standardized.map(s => s.id), ['2026-11-01-normal']);
  assert.deepEqual(series.exploratory.map(s => s.id), ['2026-11-06-experiment']);
  assert.equal(isExploratory(records[0]), true);
  assert.equal(isExploratory(records[3]), false);
});
test('November 6 archived review preserves the intended plan and all-shot exploratory sample', () => {
  const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
  const session = read('../sessions/2026-11-06-session-03/session.json');
  const intended = read('../sessions/2026-11-02-session-02/session.json');
  validateSession(session);
  assert.equal(session.title, 'Session 2 -- revamped, did not follow plan');
  assert.equal(session.intendedPlanSessionId, intended.id);
  assert.deepEqual(session.plan, intended.plan);
  assert.equal(intended.result, null);
  assert.equal(session.result.shotCount, 161);
  assert.equal(session.review.clubSummaries.I9.n, 33);
  assert.equal(session.review.selectedShots.I7.longestCarry[0].carryYd, 141.8);
  assert.equal(session.review.selectedShots.I7.fastestBallSpeed[0].ballSpeedMph, 104.3);
  assert.equal(session.review.coachingAnalysis.length, 5);
  assert.equal(progressSeries([session]).standardized.length, 0);
  assert.equal(progressSeries([session]).exploratory.length, 1);
});