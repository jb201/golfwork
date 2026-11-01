import {DRAFT_KEY, completed, createPlan, numeric, parseCSV, summarizeShots, validateSession} from './model.js';
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
function badge(s) { return `<span class="badge ${s.localDraft ? 'draft' : ''}">${s.localDraft ? 'Local draft · not published' : 'Published'} · ${s.result ? 'Results recorded' : 'Planned'}</span>`; }
function metrics() {
  const last = completed(sessions).filter(s => s.result.sevenTotal !== null).at(-1);
  const total = last?.result.sevenTotal ?? null;
  return `<div class="grid">${[
    ['Starting benchmark', `${fmt(archive.baseline.totalYards)} yd`], ['Latest session total', total === null ? 'Awaiting data' : `${fmt(total)} yd`],
    ['Distance goal', `${archive.goal.totalYards} yd`], ['Gap to goal', total === null ? 'Awaiting data' : `${fmt(Math.max(0, archive.goal.totalYards - total))} yd`]
  ].map(([k,v]) => `<div class="card"><span class="label">${k}</span><span class="metric">${v}</span></div>`).join('')}</div>`;
}
function cards(list = sessions) {
  return list.map(s => `<article class="card"><div class="row"><div><span class="eyebrow">${esc(s.date)}</span><h3>${link(sessionLink(s), s.title)}</h3>${badge(s)}</div><strong>${s.result ? `${fmt(s.result.sevenTotal)} yd total` : 'Ready to practice'}</strong></div><p>${esc(s.plan.focus)}</p></article>`).join('') || '<p>No sessions yet.</p>';
}
function publishNotice() { return `<div class="notice"><strong>Saved here ≠ published everywhere.</strong> GitHub Pages is read-only. Save a draft, download its session bundle, then give it to the workspace for validation and commit. Once pushed, the archive is visible on your phone and computer. No GitHub tokens are stored in this site.</div>`; }
function home() {
  app.innerHTML = `<section class="hero"><span class="eyebrow">My swing journey · 7 iron first</span><h1>One session at a time.</h1><p>A saved plan, measured results, and a clear next step. Working toward a 145-yard average total—not one lucky shot.</p><div class="actions">${link('coach/plan.html','Plan next session','button')}${link('coach/progress.html','View progress','button secondary')}</div></section>${metrics()}<div class="row"><h2>Session journal</h2><label class="small">Filter by month<input id="month" type="month"></label></div><div id="journal">${cards()}</div>${publishNotice()}<footer>Only committed archive data travels across devices. The initial benchmark and sample CSV are not completed sessions.</footer>`;
  document.querySelector('#month').oninput = e => { document.querySelector('#journal').innerHTML = cards(sessions.filter(s => s.date.startsWith(e.target.value))); };
}
function drillHtml(d) {
  return `<article class="card"><h3>${esc(d.title)}</h3><p><strong>${esc(d.purpose)}</strong></p><p><strong>Setup:</strong> ${esc(d.setup)}</p><ol>${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p><strong>Feeling:</strong> ${esc(d.feel)}</p><p><strong>Single cue:</strong> ${esc(d.cue)}</p><p><strong>Repetitions:</strong> ${esc(d.reps)}</p><p><strong>If it goes wrong:</strong> ${esc(d.troubleshooting)}</p></article>`;
}
function selected() { return sessions.find(s => s.id === new URLSearchParams(location.search).get('id')); }
function renderSession() {
  const s = selected();
  if (!s) { app.innerHTML = '<h1>Session not found</h1>' + link('index.html', 'Back to journal'); return; }
  document.title = `Golfwork — ${s.title}`;
  app.innerHTML = `<span class="eyebrow">${esc(s.date)}</span><h1>${esc(s.title)}</h1>${badge(s)}<div class="actions" style="margin-top:18px">${link(`coach/import.html?id=${encodeURIComponent(s.id)}`,'Record / update results','button')}<button id="export" class="secondary">Download session bundle</button><button id="print" class="secondary">Print plan</button></div>
    <section class="card" style="margin-top:24px"><h2>The saved plan</h2><p><strong>Focus:</strong> ${esc(s.plan.focus)}</p><p><strong>Why this plan:</strong> ${esc(s.plan.rationale)}</p><p><strong>Based on:</strong> ${s.plan.basedOnSessionId ? link(`coach/session.html?id=${encodeURIComponent(s.plan.basedOnSessionId)}`,s.plan.basedOnSessionId) : 'Initial baseline; no earlier completed session'}</p><ol>${s.plan.schedule.map(v => `<li>${esc(v)}</li>`).join('')}</ol><p><strong>Optional play-through:</strong> ${esc(s.plan.playThrough)}</p></section>
    ${s.plan.drills.map(drillHtml).join('')}<section class="card"><h2>Results</h2>${s.result ? `<div class="grid"><p>Total: <strong>${fmt(s.result.sevenTotal)} yd</strong></p><p>Carry: <strong>${fmt(s.result.sevenCarry)} yd</strong></p><p>Normal 7i sample: <strong>${s.result.shotCount ?? 'not supplied'}</strong></p></div><p>Source: ${esc(s.result.source)}. Total observations: ${s.result.totalCount ?? 'unknown'}; carry observations: ${s.result.carryCount ?? 'unknown'}.</p><p>${esc(s.result.notes)}</p><p>Play-through: ${esc(s.result.playThrough?.holes ?? 0)} holes. ${esc(s.result.playThrough?.notes)}</p>` : '<p>Planned only. No actual session results have been uploaded.</p>'}</section><details class="card"><summary>Video reference status</summary><p>${esc(s.plan.videoNote)}</p><p><a href="https://www.youtube.com/results?search_query=golf+staggered+stance+lead+leg+drill" target="_blank" rel="noreferrer">Search for a staggered-stance demonstration</a> (search only, not a verified video).</p></details>${s.localDraft ? publishNotice() : ''}`;
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
  const list = completed(sessions), measured = list.filter(s => s.result.sevenTotal !== null);
  const points = measured.map((s,i) => `${60 + i * (700 / Math.max(1,measured.length - 1))},${210 - (s.result.sevenTotal / Math.max(160, ...measured.map(v => v.result.sevenTotal))) * 160}`).join(' ');
  app.innerHTML = `<h1>Progress, not best shots.</h1><p>Normal-block 7i averages in yards. Drill shots and optional play-through shots are excluded from the main trend. Sessions with unknown sample sizes remain visible but should be interpreted cautiously.</p>${metrics()}<section class="card"><h2>Session total trend</h2>${measured.length ? `<svg class="chart" viewBox="0 0 820 250" role="img" aria-label="7i average total distance trend; exact values appear in the table below"><line x1="50" y1="215" x2="790" y2="215" stroke="#bdcdbc"/><polyline points="${points}" fill="none" stroke="#17694b" stroke-width="4"/>${points.split(' ').map(p => { const [x,y] = p.split(','); return `<circle cx="${x}" cy="${y}" r="5" fill="#17694b"/>`; }).join('')}<text x="50" y="240">Oldest</text><text x="725" y="240">Latest</text></svg>` : '<p>No completed measured sessions yet. The initial benchmark is not plotted as a weekly result.</p>'}</section><section class="card table-wrap"><h2>All completed sessions</h2><table><thead><tr><th>Date / session</th><th>Carry</th><th>Total</th><th>Normal shots</th><th>Status</th></tr></thead><tbody>${list.map(s => `<tr><td>${link(sessionLink(s),s.date + ' · ' + s.title)}</td><td>${fmt(s.result.sevenCarry)}</td><td>${fmt(s.result.sevenTotal)}</td><td>${s.result.shotCount ?? 'unknown'}</td><td>${badge(s)}</td></tr>`).join('')}</tbody></table></section><p class="small">${list.length} completed session(s). A session average is not an age/handicap diagnosis. Launch-monitor settings, range balls and conditions can change total distance.</p>`;
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
      const result = {...distances, recordedAt: new Date().toISOString(), source: fromCSV ? 'shot-csv' : 'uploaded-summary', practiceMinutes: numeric(form.minutes.value), notes: form.notes.value.trim(), playThrough:{holes: numeric(form.holes.value), notes: form.playNotes.value.trim()}};
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
document.querySelector('#site-header').innerHTML = `<div class="header-inner">${link('index.html','golfwork / swing journal','brand')}<nav>${[['home','index.html','Journal'],['plan','coach/plan.html','Plan'],['progress','coach/progress.html','Progress'],['import','coach/import.html','Record results']].map(([key,path,text]) => `<a href="${url(path)}" ${view === key ? 'aria-current="page"' : ''}>${text}</a>`).join('')}</nav></div>`;
try {
  [archive, library] = await Promise.all([json('data/archive.json'), json('data/drills.json')]);
  published = await Promise.all(archive.sessions.map(async entry => validateSession(await json(entry.path))));
  drafts = readDrafts(); merge();
  ({home, plan:planPage, session:renderSession, progress, import:importPage}[view] || home)();
} catch(err) { app.innerHTML = `<h1>Archive unavailable</h1><p class="error">${esc(err.message)}</p><p>Serve this workspace over HTTP, or open its GitHub Pages URL. File URLs cannot load the archive. Existing drafts have not been deleted.</p>`; }