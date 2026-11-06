import {DRAFT_KEY, completed, createPlan, isExploratory, numeric, parseCSV, progressSeries, summarizeShots, validateSession} from './model.js';
const root = new URL('../', import.meta.url);
const url = path => new URL(path, root).href;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n === null || n === undefined ? '—' : Number(n).toFixed(1);
const link = (path, text, cls = '') => `<a class="${cls}" href="${url(path)}">${esc(text)}</a>`;
const sessionLink = s => `coach/session.html?id=${encodeURIComponent(s.id)}`;
const app = document.querySelector('#app');
const view = document.body.dataset.view;
let archive, library, published, drafts, sessions;
function readDrafts() {
  const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
  if (!Array.isArray(stored)) throw new Error('Local draft storage is invalid.');
  return stored.map(validateSession);
}
function merge() {
  const records = new Map(published.map(s => [s.id, {...s, localDraft: false}]));
  for (const s of drafts) {
    const clean = ({localDraft, ...data}) => data;
    if (records.has(s.id) && JSON.stringify(clean(records.get(s.id))) === JSON.stringify(s)) continue;
    records.set(s.id, {...s, localDraft: true});
  }
  sessions = [...records.values()].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function saveDraft(s) {
  const {localDraft, ...clean} = s;
  validateSession(clean);
  const next = drafts.filter(d => d.id !== s.id).concat(clean);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  drafts = next; merge();
}
function download(s) {
  const {localDraft, ...clean} = s;
  const blob = new Blob([JSON.stringify({schemaVersion: 1, session: clean}, null, 2) + '\n'], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${s.id}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function json(path) {
  const response = await fetch(url(path), {cache: 'no-store'});
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.json();
}
function badge(s) { return `<span class="badge ${s.localDraft ? 'draft' : ''}">${s.localDraft ? 'Local draft · not published' : 'Published'} · ${s.result ? 'Results recorded' : 'Planned'}</span>${isExploratory(s) ? ' <span class="badge draft">Exploratory · not standardized</span>' : ''}`; }
function metrics() {
  const last = completed(sessions).filter(s => s.result.sevenTotal !== null).at(-1);
  const total = last?.result.sevenTotal ?? null;
  return `<div class="grid">${[
    ['Starting benchmark', `${fmt(archive.baseline.totalYards)} yd`], [last && isExploratory(last) ? 'Latest exploratory sample (not benchmark)' : 'Latest session total', total === null ? 'Awaiting data' : `${fmt(total)} yd`],
    ['Distance goal', `${archive.goal.totalYards} yd`], ['Gap to goal', total === null ? 'Awaiting data' : isExploratory(last) ? 'Not a comparable goal check' : `${fmt(Math.max(0, archive.goal.totalYards - total))} yd`]
  ].map(([k,v]) => `<div class="card"><span class="label">${k}</span><span class="metric">${v}</span></div>`).join('')}</div>`;
}
function cards(list = sessions) {
  return list.map(s => `<article class="card"><div class="row"><div><span class="eyebrow">${esc(s.date)}</span><h3>${link(sessionLink(s), s.title)}</h3>${badge(s)}</div><strong>${s.result ? `${fmt(s.result.sevenTotal)} yd total` : 'Ready to practice'}</strong></div><p>${esc(s.intendedPlanSessionId ? 'Original plan not followed; actual exploration and feedback are recorded in the review.' : s.plan.focus)}</p></article>`).join('') || '<p>No sessions yet.</p>';
}
function publishNotice() { return `<div class="notice"><strong>Saved here ≠ published everywhere.</strong> GitHub Pages is read-only. Save a draft, download its session bundle, then give it to the workspace for validation and commit. Once pushed, the archive is visible on your phone and computer. No GitHub tokens are stored in this site.</div>`; }
function home() {
  app.innerHTML = `<section class="hero"><span class="eyebrow">My swing journey · 7 iron first</span><h1>One session at a time.</h1><p>A saved plan, measured results, and a clear next step. Working toward a 145-yard average total—not one lucky shot.</p><div class="actions">${link('coach/plan.html','Plan next session','button')}${link('coach/progress.html','View progress','button secondary')}</div></section>${metrics()}<div class="row"><h2>Session journal</h2><label class="small">Filter by month<input id="month" type="month"></label></div><div id="journal">${cards()}</div>${publishNotice()}<footer>Only committed archive data travels across devices. The initial benchmark and sample CSV are not completed sessions.</footer>`;
  document.querySelector('#month').oninput = e => { document.querySelector('#journal').innerHTML = cards(sessions.filter(s => s.date.startsWith(e.target.value))); };
}
function drillHtml(d) {
  return `<article class="card"><h3>${esc(d.title)}</h3><p><strong>${esc(d.purpose)}</strong></p><p><strong>Setup:</strong> ${esc(d.setup)}</p><ol>${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p><strong>Feeling:</strong> ${esc(d.feel)}</p><p><strong>Single cue:</strong> ${esc(d.cue)}</p><p><strong>Repetitions:</strong> ${esc(d.reps)}</p><p><strong>If it goes wrong:</strong> ${esc(d.troubleshooting)}</p></article>`;
}
function libraryPage() {
  const repo = 'https://github.com/jb201/golfwork/blob/main/';
  const source = (path, title) => `<a href="${repo + path}" target="_blank" rel="noreferrer">${esc(title)} · GitHub</a>`;
  app.innerHTML = `<section class="hero"><span class="eyebrow">Research &amp; history</span><h1>The work behind the lessons.</h1><p>Original analyses, diagrams and prototypes have a home here—not mixed into your weekly journal.</p></section><div class="notice">Reference material is not a current lesson. For today's instructions and comfort guidance, open the dated session. Historical examples are never treated as actual results.</div><div class="grid"><article class="card"><span class="badge">Original analysis</span><h2>Distance benchmarks</h2><p>The original dashboard compares typical and longer shots to supplied distance ranges. These are baseline calculations, not the weekly progress trend.</p>${link('research/pages/golf_benchmark_comparison.html','Open benchmark dashboard','button')}</article><article class="card"><span class="badge">Historical diagram</span><h2>Headcover placement</h2><p>The original obstacle-by-the-ball diagram. Distinct from the withdrawn hip-placement instruction; obstacle avoidance does not prove sequencing.</p>${link('research/pages/headcover_drill_diagram.html','Open reference diagram','button secondary')}</article></div><section class="card"><h2>Original spreadsheets &amp; sources</h2><p>Kept in the repository, not served as raw downloads on this site. GitHub access follows repository visibility.</p><ul>${[['research/workbooks/golf_benchmark_comparison.xlsx','Benchmark workbook'],['research/workbooks/shot_distance_analysis.xlsx','Detailed shot analysis'],['research/workbooks/shots_good.xlsx','Original shots workbook'],['research/sources/theiffylie.WordPress.2026-11-01.xml','WordPress source export'],['research/videos/20261031140158_golffix_iron_side_01.mp4','Original swing video']].map(([p,t])=>`<li>${source(p,t)}</li>`).join('')}</ul></section><section class="card"><h2>Project history &amp; organization</h2><ul><li>${source('docs/workspace-organization.md','Folder guide and filing rules')}</li><li>${source('docs/session-workflow.md','Week-by-week workflow')}</li><li>${source('legacy/README.md','Superseded app prototypes')}</li><li>${source('templates/README.md','Historical templates and examples')}</li><li>${source('knowledge/instruction-source-priority.md','Instruction source priorities')}</li></ul><p>Session-specific CSVs, feedback and post-lesson reviews live together in each dated session—not in the general research library.</p></section>`;
}
function selected() { return sessions.find(s => s.id === new URLSearchParams(location.search).get('id')); }
function reviewHtml(s) {
  const r = s.review;
  const bulletList = values => `<ul>${values.map(v => `<li>${esc(v)}</li>`).join('')}</ul>`;
  const shotTable = rows => `<div class="table-wrap"><table><thead><tr><th>Time / row</th><th>Carry yd</th><th>Total yd</th><th>Ball mph</th><th>Peak yd</th><th>Offline</th><th>Path</th><th>Face to path</th></tr></thead><tbody>${rows.map(p => `<tr><td>${esc(p.shotTime)} / ${p.chronologicalOrdinal}</td><td>${fmt(p.carryYd)}</td><td>${fmt(p.totalYd)}</td><td>${fmt(p.ballSpeedMph)}</td><td>${fmt(p.peakHeightYd)}</td><td>${esc(p.offline)}</td><td>${esc(p.reportedPath)}</td><td>${esc(p.reportedFaceToPath)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<h2>${esc(r.title)}</h2><p>${esc(r.status)}</p>
    ${r.safety?.message ? `<div class="notice"><strong>Comfort before progression:</strong> ${esc(r.safety.message)}</div>` : ''}
    ${r.feedback ? `<h3>Your feedback</h3>${r.feedback.map(v => `<p>${esc(v)}</p>`).join('')}` : ''}
    ${r.observations?.reportedSequence ? `<h3>Your reported feels and discoveries</h3>${bulletList(r.observations.reportedSequence)}` : ''}
    ${r.blocks ? `<div class="table-wrap"><table><thead><tr><th>Practice task</th><th>Shots</th><th>Carry</th><th>Total</th><th>O-I / I-O</th></tr></thead><tbody>${r.blocks.map(b => `<tr><td>${esc(b.title)} (${b.start}–${b.end})</td><td>${b.n}</td><td>${fmt(b.carry)}</td><td>${fmt(b.total)}</td><td>${b.outsideInCount} / ${b.insideOutCount}</td></tr>`).join('')}</tbody></table></div><p class="small">The main result uses the freer experimental block, not a standardized full-swing test.</p>` : ''}
    ${r.sevenIronChronologicalWindows ? `<h3>How the 7i flight developed</h3><p>Four chronological windows of the originally I7-labeled shots, not confirmed experiment blocks. The initial corrected 7i is included in the overall 161-shot result, not these windows.</p><div class="table-wrap"><table><thead><tr><th>Exported I7 rows</th><th>Shots</th><th>Carry yd</th><th>Total yd</th><th>Ball mph</th><th>Peak yd</th><th>Mean absolute offline yd</th></tr></thead><tbody>${r.sevenIronChronologicalWindows.map(w => `<tr><td>${w.exportedSevenIronStart}–${w.exportedSevenIronEnd}</td><td>${w.n}</td><td>${fmt(w.metrics.carryYd.mean)}</td><td>${fmt(w.metrics.totalYd.mean)}</td><td>${fmt(w.metrics.ballSpeedMph.mean)}</td><td>${fmt(w.metrics.peakHeightYd.mean)}</td><td>${fmt(w.offline.meanAbsoluteYd)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${r.selectedShots ? `<h3>Long airborne strikes and speed examples</h3><p>Top five carries and separate speed rankings, not the progress average. Row numbers are reconstructed chronological positions; times are from the device. Peak height is ball flight, not backswing height.</p>${Object.entries(r.selectedShots).map(([club, picks]) => `<h3>${esc(club)} · longest carry</h3>${shotTable(picks.longestCarry)}<details><summary>${esc(club)} · fastest ball speeds (may include low runners)</summary>${shotTable(picks.fastestBallSpeed)}</details>`).join('')}` : ''}
    <h3>Evidence and interpretation</h3>${bulletList(r.findings)}
    ${r.coachingAnalysis ? r.coachingAnalysis.map(part => `<h3>${esc(part.title)}</h3>${part.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}`).join('') : ''}
    ${r.nextSteps ? `<h3>Refinement priorities</h3>${bulletList(r.nextSteps)}` : ''}
    <h3>Next discussion</h3>${bulletList(r.nextDiscussion)}
    ${r.limitations ? `<details><summary>Measurement and interpretation limits</summary>${bulletList(r.limitations)}</details>` : ''}
    ${r.references ? `<h3>Reference principles</h3><ul>${r.references.map(reference => {
      const target = new URL(reference.url);
      if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Review references must use HTTP or HTTPS URLs.');
      return `<li><a href="${esc(target.href)}" target="_blank" rel="noreferrer">${esc(reference.title)}</a> — ${esc(reference.context)}</li>`;
    }).join('')}</ul>` : ''}
    <p class="small">Original CSVs are preserved with SHA-256 hashes in the repository and excluded from the Pages artifact. This review reflects those exports; editing local result fields does not regenerate the review.</p>`;
}
function renderSession() {
  const s = selected();
  if (!s) { app.innerHTML = '<h1>Session not found</h1>' + link('index.html', 'Back to journal'); return; }
  document.title = `Golfwork — ${s.title}`;
  app.innerHTML = `<span class="eyebrow">${esc(s.date)}</span><h1>${esc(s.title)}</h1>${badge(s)}<div class="actions" style="margin-top:18px">${link(`coach/import.html?id=${encodeURIComponent(s.id)}`,'Record / update results','button')}<button id="export" class="secondary">Download session bundle</button><button id="print" class="secondary">Print plan</button></div>
    ${s.intendedPlanSessionId ? `<div class="notice"><strong>Original plan not followed.</strong> This session records the November 6 exploration. The ${link(`coach/session.html?id=${encodeURIComponent(s.intendedPlanSessionId)}`, 'original Session 02 plan')} remains unchanged; its snapshot below is intended work, not a claim about what you did or a new prescription.</div>` : ''}
    <section class="card" style="margin-top:24px"><h2>${s.intendedPlanSessionId ? 'The intended plan (not followed)' : 'The saved plan'}</h2><p><strong>Focus:</strong> ${esc(s.plan.focus)}</p><p><strong>Why this plan:</strong> ${esc(s.plan.rationale)}</p><p><strong>Based on:</strong> ${s.plan.basedOnSessionId ? link(`coach/session.html?id=${encodeURIComponent(s.plan.basedOnSessionId)}`,s.plan.basedOnSessionId) : 'Initial baseline; no earlier completed session'}</p><ol>${s.plan.schedule.map(v => `<li>${esc(v)}</li>`).join('')}</ol><p><strong>Optional play-through:</strong> ${esc(s.plan.playThrough)}</p></section>
    ${s.plan.drills.map(drillHtml).join('')}<section class="card"><h2>Results</h2>${s.result ? `<div class="grid"><p>Total: <strong>${fmt(s.result.sevenTotal)} yd</strong></p><p>Carry: <strong>${fmt(s.result.sevenCarry)} yd</strong></p><p>${esc(s.result.sampleLabel || 'Normal 7i sample')}: <strong>${s.result.shotCount ?? 'not supplied'}</strong></p></div><p>Source: ${esc(s.result.source)}. Total observations: ${s.result.totalCount ?? 'unknown'}; carry observations: ${s.result.carryCount ?? 'unknown'}.</p><p>${esc(s.result.notes)}</p><p>Play-through: ${esc(s.result.playThrough?.holes ?? 0)} holes. ${esc(s.result.playThrough?.notes)}</p>` : '<p>Planned only. No actual session results have been uploaded.</p>'}</section><details class="card"><summary>Video reference status</summary><p>${esc(s.plan.videoNote)}</p>${s.intendedPlanSessionId ? '' : '<p><a href="https://www.youtube.com/results?search_query=golf+staggered+stance+lead+leg+drill" target="_blank" rel="noreferrer">Search for a staggered-stance demonstration</a> (search only, not a verified video).</p>'}</details>${s.localDraft ? publishNotice() : ''}`;
  if (s.review) {
    const section = document.createElement('section'); section.className = 'card';
    section.innerHTML = reviewHtml(s);
    document.querySelector('#export').closest('.actions').after(section);
  }
  document.querySelector('#export').onclick = () => download(s);
  document.querySelector('#print').onclick = () => window.print();
}
function planPage() {
  app.innerHTML = `<h1>Plan the next session</h1><p>Use the latest completed session before the chosen date. The saved snapshot retains its rationale and drill instructions even as future plans change.</p>${publishNotice()}<form id="plan-form" class="card"><div class="form-grid"><label>Date<input name="date" type="date" required value="${new Date().toLocaleDateString('en-CA')}"></label><label>Session title<input name="title" required value="7i — Lead support and transfer"></label><label>Session slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value="7i-practice"><span class="small">Use a different slug for a second session on the same date.</span></label></div><button>Generate and save local plan</button><p id="status" class="status" role="status"></p></form>`;
  document.querySelector('#plan-form').onsubmit = e => {
    e.preventDefault();
    try {
      const f = e.target;
      const s = createPlan(sessions, library, f.elements.namedItem('date').value, f.elements.namedItem('title').value.trim(), f.elements.namedItem('slug').value);
      if (sessions.some(v => v.id === s.id)) throw new Error('That session ID already exists. Choose another slug; saved plans are not overwritten.');
      saveDraft(s); location.href = url(sessionLink(s));
    } catch(err) { document.querySelector('#status').textContent = err.message; }
  };
}
function progress() {
  const {list, measured, standardized, exploratory} = progressSeries(sessions);
  const scale = Math.max(160, ...measured.map(s => s.result.sevenTotal));
  const point = s => `${60 + measured.indexOf(s) * (700 / Math.max(1, measured.length - 1))},${210 - s.result.sevenTotal / scale * 160}`;
  const reviews = list.filter(s => s.review).reverse();
  app.innerHTML = `<h1>Progress, not best shots.</h1><p>7i session averages in yards, with sample context shown below. Exploratory sessions are separate amber markers, not joined into the normal-block trend. Drill/play samples are excluded from normal-block averages; mixed exploratory samples retain all their recorded 7i shots. Unknown sample sizes need caution.</p>${metrics()}<section class="card"><h2>Session total trend and exploratory context</h2>${measured.length ? `<svg class="chart" viewBox="0 0 820 250" role="img" aria-label="7i averages: green normal-block trend and separate amber exploratory markers; exact values and context appear in the table below"><line x1="50" y1="215" x2="790" y2="215" stroke="#bdcdbc"/>${standardized.length > 1 ? `<polyline points="${standardized.map(point).join(' ')}" fill="none" stroke="#17694b" stroke-width="4"/>` : ''}${measured.map(s => { const [x,y] = point(s).split(','); return `<circle cx="${x}" cy="${y}" r="${isExploratory(s) ? 7 : 5}" fill="${isExploratory(s) ? '#b58225' : '#17694b'}"><title>${esc(s.date + ' · ' + s.title)}: ${fmt(s.result.sevenTotal)} yd${isExploratory(s) ? ' · exploratory, not standardized' : ''}</title></circle>`; }).join('')}<text x="50" y="240">Oldest</text><text x="725" y="240">Latest</text></svg><p class="small">Green: normal-block trend. Amber: exploratory context only (${exploratory.length} session(s)). ${standardized.length ? '' : 'No standardized normal-block total is available yet.'}</p>` : '<p>No completed measured sessions yet. The initial benchmark is not plotted as a weekly result.</p>'}</section><section class="card table-wrap"><h2>All completed sessions</h2><table><thead><tr><th>Date / session</th><th>Carry yd</th><th>Total yd</th><th>7i sample</th><th>Context / status</th></tr></thead><tbody>${list.map(s => `<tr><td>${link(sessionLink(s),s.date + ' · ' + s.title)}</td><td>${fmt(s.result.sevenCarry)}</td><td>${fmt(s.result.sevenTotal)}</td><td>${s.result.shotCount ?? 'unknown'}<br><span class="small">${esc(s.result.sampleLabel || 'Normal-block shots')}</span></td><td>${badge(s)}</td></tr>`).join('')}</tbody></table></section><h2>Session reviews</h2>${reviews.map((s, i) => `<details class="card" ${i === 0 ? 'open' : ''}><summary>${esc(s.date + ' · ' + s.title)}</summary><p>${link(sessionLink(s), 'Open full session and intended plan')}</p>${reviewHtml(s)}</details>`).join('') || '<p>No session reviews recorded yet.</p>'}<p class="small">${list.length} completed session(s). A session average is not an age/handicap diagnosis. Launch-monitor settings, range balls and conditions can change total distance.</p>`;
}
function importPage() {
  const s = selected() || sessions[0];
  if (!s) { app.innerHTML = '<h1>Plan a session first</h1>' + link('coach/plan.html','Create a plan'); return; }
  app.innerHTML = `<h1>Record the session</h1><p>Attach actual results to a saved plan. No sequencing scores or self-grading.</p>${publishNotice()}<section class="card"><label>Restore a downloaded session bundle<input id="bundle" type="file" accept=".json,application/json"></label><p id="bundle-status" role="status"></p></section><form id="result-form" class="card"><label>Session<select name="session">${sessions.map(v => `<option value="${esc(v.id)}" ${v.id === s.id ? 'selected' : ''}>${esc(v.date + ' · ' + v.title)}</option>`).join('')}</select></label><label>Optional shot CSV (yards)<input name="csv" type="file" accept=".csv,text/csv"></label><p class="small">Headers: club, block, carry, total. Block = normal, drill, or play. Blank block means normal; label drill shots before importing. All normal 7i shots count, including mishits. Unsupported device exports need conversion first.</p><div class="form-grid"><label>Average 7i total (if no CSV)<input name="total" type="number" min="0" step="any"></label><label>Average 7i carry (if no CSV)<input name="carry" type="number" min="0" step="any"></label><label>Normal 7i sample size (optional)<input name="count" type="number" min="1" step="1"></label><label>Practice minutes<input name="minutes" type="number" min="0" step="1"></label><label>Optional play-through holes<input name="holes" type="number" min="0" max="18" step="1" value="0"></label></div><label>Session observations (optional)<textarea name="notes"></textarea></label><label>Play-through observations (optional)<textarea name="playNotes"></textarea></label><button>Save results as local draft</button><p id="status" class="status" role="status"></p></form>`;
  const form = document.querySelector('#result-form');
  function prefill() {
    const r = sessions.find(v => v.id === form.session.value)?.result;
    form.total.value = r?.sevenTotal ?? ''; form.carry.value = r?.sevenCarry ?? ''; form.count.value = r?.shotCount ?? '';
    form.minutes.value = r?.practiceMinutes ?? ''; form.holes.value = r?.playThrough?.holes ?? 0; form.notes.value = r?.notes ?? ''; form.playNotes.value = r?.playThrough?.notes ?? ''; form.csv.value = '';
  }
  prefill(); form.session.onchange = prefill;
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const target = sessions.find(v => v.id === form.session.value);
      const fromCSV = Boolean(form.csv.files[0]);
      const distances = fromCSV ? summarizeShots(parseCSV(await form.csv.files[0].text())) : {sevenTotal: numeric(form.total.value), sevenCarry: numeric(form.carry.value), shotCount: numeric(form.count.value), totalCount: form.total.value === '' ? 0 : numeric(form.count.value), carryCount: form.carry.value === '' ? 0 : numeric(form.count.value)};
      if (distances.sevenTotal === null && distances.sevenCarry === null) throw new Error('Supply measured carry or total, or a shot CSV.');
      const context = isExploratory(target) ? {comparability: target.result.comparability, sampleLabel: fromCSV ? 'Normal-block 7i shots within an exploratory session' : target.result.sampleLabel || 'Exploratory 7i sample'} : {};
      const result = {...context, ...distances, recordedAt: new Date().toISOString(), source: fromCSV ? 'shot-csv' : 'uploaded-summary', practiceMinutes: numeric(form.minutes.value), notes: form.notes.value.trim(), playThrough:{holes: numeric(form.holes.value), notes: form.playNotes.value.trim()}};
      saveDraft({...target, result}); location.href = url(sessionLink(target));
    } catch(err) { document.querySelector('#status').textContent = err.message; }
  };
  document.querySelector('#bundle').onchange = async e => {
    try {
      const bundle = JSON.parse(await e.target.files[0].text());
      if (bundle.schemaVersion !== 1) throw new Error('Unsupported bundle version.');
      const restored = validateSession(bundle.session);
      if (sessions.some(v => v.id === restored.id) && !confirm('Replace the local draft for this session? Published data will not change until committed.')) return;
      saveDraft(restored); location.href = url(sessionLink(restored));
    } catch(err) { document.querySelector('#bundle-status').textContent = err.message; }
  };
}
document.querySelector('#site-header').innerHTML = `<div class="header-inner">${link('index.html','golfwork / swing journal','brand')}<nav>${[['home','index.html','Journal'],['plan','coach/plan.html','Plan'],['progress','coach/progress.html','Progress'],['import','coach/import.html','Record results'],['library','coach/library.html','Research & History']].map(([key,path,text]) => `<a href="${url(path)}" ${view === key ? 'aria-current="page"' : ''}>${text}</a>`).join('')}</nav></div>`;
try {
  [archive, library] = await Promise.all([json('data/archive.json'), json('data/drills.json')]);
  published = await Promise.all(archive.sessions.map(async entry => validateSession(await json(entry.path))));
  drafts = readDrafts(); merge();
  ({home, plan:planPage, session:renderSession, progress, import:importPage, library:libraryPage}[view] || home)();
} catch(err) { app.innerHTML = `<h1>Archive unavailable</h1><p class="error">${esc(err.message)}</p><p>Serve this workspace over HTTP, or open its GitHub Pages URL. File URLs cannot load the archive. Existing drafts have not been deleted.</p>`; }