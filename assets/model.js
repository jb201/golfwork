export const DRAFT_KEY = 'golfwork.sessionDrafts.v1';
export function numeric(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('Distances and counts must be non-negative numbers.');
  return n;
}
export function mean(values) {
  const valid = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
export function completed(sessions) {
  return sessions.filter(s => s.result).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function validateSession(s) {
  if (!s || s.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(s.id || '')) throw new Error('Invalid session ID or schema.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '') || new Date(s.date).toISOString().slice(0, 10) !== s.date || !s.id.startsWith(s.date + '-')) throw new Error('Invalid session date.');
  if (typeof s.title !== 'string' || !s.title.trim() || !s.plan || typeof s.plan.focus !== 'string' || !Array.isArray(s.plan.schedule) || !Array.isArray(s.plan.drills)) throw new Error('A title and saved plan are required.');
  if (s.result) {
    ['sevenTotal', 'sevenCarry', 'shotCount', 'totalCount', 'carryCount', 'practiceMinutes'].forEach(k => numeric(s.result[k]));
    if (numeric(s.result.sevenTotal) === null && numeric(s.result.sevenCarry) === null) throw new Error('Results need at least one measured distance.');
    for (const k of ['shotCount', 'totalCount', 'carryCount']) {
      if (numeric(s.result[k]) !== null && !Number.isInteger(Number(s.result[k]))) throw new Error('Sample counts must be integers.');
    }
    const holes = s.result.playThrough?.holes ?? 0;
    if (!Number.isInteger(holes) || holes < 0 || holes > 18) throw new Error('Play-through holes must be 0–18.');
  }
  return s;
}
export function createPlan(sessions, drills, date, title, slug) {
  const prior = completed(sessions).filter(s => s.date < date);
  const last = prior.at(-1);
  const earlier = mean(prior.slice(-4, -1).map(s => s.result.sevenTotal));
  const recent = last?.result.sevenTotal ?? null;
  const regressed = recent !== null && earlier !== null && recent < earlier - 5;
  const rationale = !last ? 'No earlier completed session is available. Start with lead-support rehearsals and establish a normal-stance sample; do not diagnose sequencing from distance alone.' :
    `Based on ${last.title} (${last.date}): ${recent === null ? 'total distance unavailable' : recent.toFixed(1) + ' yd average total'}. ` +
    (regressed ? 'Total is over 5 yd below the preceding sessions’ mean. Repeat smaller swings before increasing effort; conditions and strike data still need review.' : 'Repeat the current drill-to-normal transfer before changing technique. Distance alone does not establish pressure timing or an over-the-top fault.');
  return validateSession({schemaVersion: 1, id: `${date}-${slug}`, date, title, result: null, plan: {
    createdAt: new Date().toISOString(), basedOnSessionId: last?.id ?? null, rationale,
    focus: regressed ? '7i only — Smaller swings and repeatable normal contact' : '7i only — Lead support and normal-stance transfer',
    cue: 'Lead foot supports me as I turn through.', drills: structuredClone(drills),
    schedule: ['5–8 minutes: warm up with 5 comfortable no-ball half-swings.', '12–15 minutes: 5 staggered rehearsals, 5 staggered shots, 5 normal half-shots; repeat the shot blocks once.', `${regressed ? 'Keep all shots at half-swing effort.' : 'Finish with 5 cue-free normal shots and 5–10 comfortable normal shots.'} Keep drill shots separate from normal shots.`, 'Optional: play 3–5 holes as a separate transfer check; driver remains outside this coaching phase.', 'Upload captured results and optional video afterward. No self-grading.'],
    playThrough: 'Optional 3–5 holes. Compare normal 7i opportunities separately from practice and drill shots.',
    videoNote: 'Individual video recommendations need verification; search links are not specific prescriptions.'
  }});
}
// RFC-style quoted CSV cells, including commas, escaped quotes, and newlines.
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('CSV needs headers and at least one shot.');
  const headers = rows.shift().map(v => v.trim().toLowerCase());
  if (!headers.includes('club') || (!headers.includes('total') && !headers.includes('carry'))) throw new Error('Use headers club, block, carry, total (yards).');
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${i + 2} has the wrong number of fields.`);
    return Object.fromEntries(headers.map((h, j) => [h, values[j].trim()]));
  });
}
export function summarizeShots(rows) {
  const shots = rows.map(r => {
    const block = (r.block || 'normal').toLowerCase();
    if (!['normal', 'drill', 'play'].includes(block)) throw new Error('Shot block must be normal, drill, or play.');
    return {club: String(r.club || '').toLowerCase().replace(/[^a-z0-9]/g, ''), block, carry: numeric(r.carry), total: numeric(r.total)};
  });
  const normal = shots.filter(s => ['7i', '7iron', 'iron7'].includes(s.club) && s.block === 'normal');
  const totals = normal.map(s => s.total).filter(v => v !== null), carries = normal.map(s => s.carry).filter(v => v !== null);
  if (!totals.length && !carries.length) throw new Error('No measured normal-block 7i shots found.');
  return {sevenTotal: mean(totals), sevenCarry: mean(carries), shotCount: normal.length, totalCount: totals.length, carryCount: carries.length, shots};
}