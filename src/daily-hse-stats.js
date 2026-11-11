/*
 * Daily HSE Stats — Site Diary section.
 * Number-entry capture of the daily HSE statistics, a dashboard, a generated
 * daily report and a rule-based Early Warning view.
 *
 *   DailyHseStats.mount(hostElement, data, cssText)
 *
 * Renders inside a shadow root on hostElement, so its styles and Site Diary's
 * do not affect each other. `data` is the statistics object
 * (src/daily-hse-stats.data.json today; a server endpoint later). Numbers
 * typed in are kept in this browser (localStorage) until that endpoint exists.
 */
(function (global) {
'use strict';
function mount(HOST, STATS, CSS) {
const ROOT = HOST.shadowRoot || HOST.attachShadow({ mode: 'open' });
ROOT.innerHTML = '<style>' + CSS + '</style><div id="app"></div>';
const APP = ROOT.getElementById('app');
const EDIT_KEY = 'dailyHseStats.edits';
function loadEdits() { try { return JSON.parse(localStorage.getItem(EDIT_KEY) || '{}') || {}; } catch (e) { return {}; } }
function saveEdits(e) { try { localStorage.setItem(EDIT_KEY, JSON.stringify(e)); } catch (err) { /* private mode etc. */ } }

const DEFAULT_CFG = {
  windowDays: 7, watchDropPct: 15, warnDropPct: 30, nearMissCount: 2, faiCount: 1,
  redsCount: 4, envCount: 2, damageCount: 2, inductionSpike: 8, riskElevated: 30, riskHigh: 60
};
const state = {
  data: STATS, view: null, edits: loadEdits(), search: '', capGroup: 'all',
  sel: { y: 2026, m: 6, d: 4 }, showCal: false, calY: 2026, calM: 6,
  trendMetric: 'take-5', report: false, config: { ...DEFAULT_CFG }, showConfig: false, basis: 'month'
};

// governing HSE targets — WASP HSEC Management Plan Rev 00
const HSMP = {
  rev: 'HSEC Management Plan Rev 00 (09 Mar 2026)', client: 'Rio Tinto Iron Ore — Robe Valley JV',
  rtioRef: 'RTIO ref I0041-0000-D-PLN-00027',
  targets: [
    { k: 'Fatalities', target: '0', kind: 'lag' },
    { k: 'Recordables (TRIFR)', target: '≤ 2.69 / M hrs', kind: 'lag' },
    { k: 'High Potential Incidents', target: '≤ 5 / M hrs', kind: 'lag' },
    { k: 'Fitness for Work — BAC', target: '100% shift-start, daily', kind: 'lead' },
    { k: 'Actions closed on time', target: '> 80%', kind: 'lead' },
    { k: 'Subcontractor inspections', target: '1 / month', kind: 'lead' },
    { k: 'Project audits', target: 'No major non-conformances', kind: 'lead' }
  ]
};

const PROACTIVE = {
  'take-5': 22, 'critical-control-checklists-cccs': 18, 'supervisor-daily-inspections': 10,
  'ccfv-inspections-hse-supervisor-ccv-app': 8, 'hse-inspections': 8, 'hazard': 8,
  'bbo-safety-observation': 6, 'pre-start-meetings': 6, 'take-5-reviewed': 5,
  'jha-s': 4, 'number-of-tests-alcohol': 4, 'jha-audit': 3, 'toolbox-meetings': 3,
  'ccvs-inspections-mananger-ccv-app': 3, 'hydration-testing': 2, 'fitness-for-work-drug': 2
};
const PRECURSORS = {
  'lost-time-injury-reports-lti': 40, 'restricted-work-injury-reports-rwc': 30,
  'medical-treatment-injury-reports-mti': 25, 'number-positive-tests-alcohol': 15,
  'no-non-negative-ffw-drug': 12, 'first-aid-injury-reports-fai': 10,
  'near-miss-reports': 6, 'property-damage-reports': 4, 'ccc-reds': 4,
  'environmental-reports': 3, 'ccfv-reds': 2, 'ccvs-reds': 2
};
const PRECURSOR_CAP = 45;
const DRIVER_INFO = {
  'take-5': { why: 'Take 5s are the frontline pre-task hazard check — fewer of them means hazards are going unspotted before work starts.', action: 'Reinforce Take 5 completion at every prestart; supervisors to spot-check in the field.' },
  'critical-control-checklists-cccs': { why: 'CCCs verify the critical controls on high-risk tasks. A drop means controls may be going unchecked.', action: 'Audit CCC completion on today’s high-risk activities.' },
  'supervisor-daily-inspections': { why: 'Supervisor inspections are the daily eyes-on for unsafe conditions.', action: 'Restore the daily inspection cadence; confirm every crew is covered.' },
  'ccfv-inspections-hse-supervisor-ccv-app': { why: 'Critical-control field verifications confirm controls hold up in practice.', action: 'Lift field-verification coverage on live high-risk work.' },
  'hse-inspections': { why: 'HSE inspections catch systemic issues before they bite.', action: 'Schedule the outstanding HSE inspections this shift.' },
  'hazard': { why: 'A fall in hazards reported usually signals reporting fatigue — not a safer site.', action: 'Actively encourage hazard reporting and recognise the reporters.' },
  'bbo-safety-observation': { why: 'Behavioural observations catch at-risk behaviour early.', action: 'Book in BBO conversations across the crews today.' },
  'pre-start-meetings': { why: 'Prestarts set the day’s hazards and controls. Missed ones mean crews start uninformed.', action: 'Confirm every crew ran a prestart and the talking points landed.' },
  'take-5-reviewed': { why: 'Reviewing Take 5s closes the loop and keeps quality up.', action: 'Supervisors to review and sign off Take 5s daily.' },
  'jha-s': { why: 'JHAs break high-risk tasks into controlled steps. Fewer JHAs means tasks proceeding without one.', action: 'Ensure a current JHA/SWMS is in place for every high-risk activity.' },
  'number-of-tests-alcohol': { why: 'Fitness-for-work testing coverage is dropping — impairment can go undetected.', action: 'Return to the HSEC MP target of 100% shift-start BAC screening, daily.' },
  'jha-audit': { why: 'JHA audits confirm the JHAs are actually being followed, not just filed.', action: 'Resume field JHA audits on active tasks.' },
  'toolbox-meetings': { why: 'Toolboxes are where lessons and changes get communicated to the crews.', action: 'Schedule the next toolbox and cover the current risk themes.' },
  'ccvs-inspections-mananger-ccv-app': { why: 'Manager critical-control verifications signal leadership presence in the field.', action: 'Managers to complete their CCV walks this week.' },
  'hydration-testing': { why: 'In heat, hydration monitoring is a control against heat illness.', action: 'Reinstate hydration testing if conditions warrant it.' },
  'fitness-for-work-drug': { why: 'Drug testing coverage is slipping — impairment risk can go unmonitored.', action: 'Restore the planned FFW drug-testing schedule.' }
};

// ---------------------------------------------------------------------------
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const pad = n => String(n).padStart(2, '0');
const iso = (y, m0, d) => y + '-' + pad(m0 + 1) + '-' + pad(d);
const isoD = dt => iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
const fmt = n => (n == null ? '–' : Number(Math.round(n)).toLocaleString('en-AU'));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cfg = () => state.config;
function setState(patch) { if (typeof patch === 'function') patch = patch(state); Object.assign(state, patch); if (patch && patch.edits) saveEdits(state.edits); render(); }
const M = {}; STATS.metrics.forEach(m => { M[m.key] = m; });

function baseAt(m, i) { return m.daily[i] || 0; }
function valAt(m, i) { const k = m.key + '|' + i; return (k in state.edits) ? state.edits[k] : baseAt(m, i); }
function selIso() { return iso(state.sel.y, state.sel.m, state.sel.d); }
function selDate() { return new Date(state.sel.y, state.sel.m, state.sel.d); }
function valToday(m) { return valAt(m, selIso()); }
function yesterdayVal(m) { const d = selDate(); d.setDate(d.getDate() - 1); return valAt(m, isoD(d)); }
function mtd(m) { let s = 0; const { y, m: mm, d } = state.sel; for (let dd = 1; dd <= d; dd++) s += valAt(m, iso(y, mm, dd)); return s; }
function lastDays(n) { const out = [], end = selDate(); for (let i = n - 1; i >= 0; i--) { const dt = new Date(end); dt.setDate(end.getDate() - i); out.push(dt); } return out; }
function sumLast(m, n) { return lastDays(n).reduce((a, dt) => a + valAt(m, isoD(dt)), 0); }
function sumWindow(m, endDt, len, back) { let s = 0; const e = new Date(endDt); e.setDate(e.getDate() - back); for (let i = 0; i < len; i++) { const d = new Date(e); d.setDate(e.getDate() - i); s += valAt(m, isoD(d)); } return s; }
function projectTotal(m) { let d = 0; for (const k in state.edits) { const i = k.indexOf('|'); if (k.slice(0, i) === m.key) d += state.edits[k] - baseAt(m, k.slice(i + 1)); } return (typeof m.total === 'number' ? m.total : 0) + d; }
function monthSpan(m, y, mo, dCap) { let s = 0; const dim = new Date(y, mo + 1, 0).getDate(), d = Math.min(dCap, dim); for (let dd = 1; dd <= d; dd++) s += valAt(m, iso(y, mo, dd)); return s; }
function compare(m, endDt) {
  if (state.basis === 'month') {
    const y = endDt.getFullYear(), mo = endDt.getMonth(), d = endDt.getDate();
    let pm = mo - 1, py = y; if (pm < 0) { pm = 11; py--; }
    return { cur: monthSpan(m, y, mo, d), prev: monthSpan(m, py, pm, d) };
  }
  const W = cfg().windowDays;
  return { cur: sumWindow(m, endDt, W, 0), prev: sumWindow(m, endDt, W, W) };
}
function wow(m, endDt) { const { cur, prev } = compare(m, endDt); return { cur, prev, pct: prev > 0 ? (cur - prev) / prev : (cur > 0 ? 1 : 0) }; }
function periodWords() { return state.basis === 'month' ? { adj: 'month-on-month', cur: 'this month', prev: 'last month', vs: 'This month' } : { adj: 'period-on-period', cur: 'the last ' + cfg().windowDays + ' days', prev: 'the period before', vs: 'Last ' + cfg().windowDays + ' days' }; }

const TOTAL_W = Object.values(PROACTIVE).reduce((a, b) => a + b, 0);
function riskFor(endDt) {
  let decline = 0;
  for (const key in PROACTIVE) { const { cur, prev } = wow(M[key], endDt); const pct = prev > 0 ? (cur - prev) / prev : (cur > 0 ? 1 : 0); if (pct < 0) decline += Math.min(1, -pct) * PROACTIVE[key]; }
  let precursor = 0; for (const key in PRECURSORS) precursor += compare(M[key], endDt).cur * PRECURSORS[key];
  // normalise the monthly precursor sum back to a per-week rate so the index stays comparable
  if (state.basis === 'month') precursor = precursor / Math.max(1, endDt.getDate() / 7);
  return clamp(Math.round(15 + (decline / TOTAL_W * 100) * 0.6 + Math.min(PRECURSOR_CAP, precursor)), 0, 100);
}
function riskLevel(v) { const c = cfg(); return v < c.riskElevated ? { label: 'Low', cls: 'lvl-low' } : v < c.riskHigh ? { label: 'Elevated', cls: 'lvl-elev' } : { label: 'High', cls: 'lvl-high' }; }

function buildAlerts() {
  const end = selDate(), c = cfg(), P = periodWords(), alerts = [];
  Object.keys(PROACTIVE).map(key => ({ key, ...wow(M[key], end) }))
    .filter(d => d.prev > 0 && d.pct <= -c.watchDropPct / 100).sort((a, b) => a.pct - b.pct).slice(0, 4)
    .forEach(d => { const info = DRIVER_INFO[d.key];
      alerts.push({ sev: d.pct <= -c.warnDropPct / 100 ? 'warn' : 'watch', title: M[d.key].label + ' down ' + Math.round(-d.pct * 100) + '% ' + P.adj, detail: P.vs + ' ' + fmt(d.cur) + ' vs ' + fmt(d.prev) + ' ' + P.prev + '. ' + info.why, action: info.action }); });
  const win = ks => ks.reduce((a, k) => a + compare(M[k], end).cur, 0);
  const winPrev = ks => ks.reduce((a, k) => a + compare(M[k], end).prev, 0);
  const push = (sev, title, detail, action) => alerts.push({ sev, title, detail, action });
  const rec = win(['medical-treatment-injury-reports-mti', 'lost-time-injury-reports-lti', 'restricted-work-injury-reports-rwc']);
  if (rec >= 1) push('warn', fmt(rec) + ' recordable injur' + (rec === 1 ? 'y' : 'ies') + ' ' + P.cur, 'An MTI/LTI/RWC has been recorded — the outcome the leading indicators exist to prevent. The HSEC MP target is 0 fatalities and TRIFR ≤ 2.69 per million hours.', 'Complete the ICAM/root-cause investigation and share the learnings across all crews.');
  const posA = win(['number-positive-tests-alcohol']);
  if (posA >= 1) push('warn', fmt(posA) + ' positive alcohol test' + (posA === 1 ? '' : 's') + ' ' + P.cur, 'A fitness-for-work breach removes a person’s ability to work safely. The HSEC MP mandates 100% shift-start BAC screening.', 'Follow the FFW procedure; review testing coverage and the toolbox message on impairment.');
  const posD = win(['no-non-negative-ffw-drug']);
  if (posD >= 1) push('warn', fmt(posD) + ' non-negative drug test' + (posD === 1 ? '' : 's') + ' ' + P.cur, 'Impairment risk is present on site.', 'Apply the FFW procedure and reinforce the drug & alcohol policy.');
  const nm = win(['near-miss-reports']), nmP = winPrev(['near-miss-reports']);
  if (nm >= c.nearMissCount && nm > nmP) push('warn', fmt(nm) + ' near-misses ' + P.cur, 'Up from ' + fmt(nmP) + ' ' + P.prev + '. Near-miss clusters are the strongest statistical precursor to a recordable injury.', 'Stand-up review of the near-miss tasks; verify corrective actions are closed before work resumes.');
  const fai = win(['first-aid-injury-reports-fai']), faiP = winPrev(['first-aid-injury-reports-fai']);
  if (fai >= c.faiCount && fai > faiP) push('watch', fmt(fai) + ' first-aid injur' + (fai === 1 ? 'y' : 'ies') + ' ' + P.cur, 'Minor injuries usually share root causes with more serious events (Heinrich’s pyramid) — treat them as free lessons.', 'Investigate the FAIs for a common factor (task, crew, time of day).');
  const reds = win(['ccfv-reds', 'ccc-reds', 'ccvs-reds']);
  if (reds >= c.redsCount) push('watch', fmt(reds) + ' critical-control "reds" ' + P.cur, 'Repeated red verifications mean critical controls are failing at the coalface.', 'Escalate the recurring red controls to the daily prestart and track to closure.');
  const env = win(['environmental-reports']), envP = winPrev(['environmental-reports']);
  if (env >= c.envCount && env > envP) push('watch', fmt(env) + ' environmental reports ' + P.cur, 'Environmental incidents often share causes with safety incidents (rushing, poor planning).', 'Review the environmental reports and confirm controls (spill kits, dust, sediment) are in place.');
  const dmg = win(['property-damage-reports']), dmgP = winPrev(['property-damage-reports']);
  if (dmg >= c.damageCount && dmg > dmgP) push('watch', fmt(dmg) + ' property-damage events ' + P.cur, 'Plant/property damage is a near-miss for a person — same energy, different target.', 'Investigate the damage events; reinforce spotters, exclusion zones and traffic management.');
  const ind = win(['site-inductions']), indP = winPrev(['site-inductions']);
  if (ind >= c.inductionSpike && ind > indP) push('watch', fmt(ind) + ' new inductions ' + P.cur, 'A jump in inductions means an influx of new starters — unfamiliarity with the site is a well-known risk multiplier.', 'Buddy new starters with experienced crew; verify hazard awareness in their first week.');
  return alerts;
}

// ---------------------------------------------------------------------------
function chrome() {
  const S = state, view = S.view || 'capture';
  const out = { view, showCapture: view === 'capture', showDashboard: view === 'dashboard', showWarning: view === 'warning' };
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], DOWL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const sel = S.sel, sd = new Date(sel.y, sel.m, sel.d);
  out.selPill = DOWS[sd.getDay()] + ' ' + sel.d + ' ' + MONS[sel.m] + ' ' + sel.y;
  out.selFull = DOWL[sd.getDay()] + ', ' + sel.d + ' ' + MON[sel.m] + ' ' + sel.y;
  out.monthLabel = MON[sel.m] + ' ' + sel.y;
  out.showCal = S.showCal; out.calTitle = MON[S.calM] + ' ' + S.calY;
  const first = new Date(S.calY, S.calM, 1).getDay(), lead = (first + 6) % 7;
  const dim = new Date(S.calY, S.calM + 1, 0).getDate(), dimP = new Date(S.calY, S.calM, 0).getDate();
  out.calCells = [];
  for (let i = 0; i < 42; i++) {
    let dn = i - lead + 1, y = S.calY, m = S.calM, d, faded = false;
    if (dn < 1) { d = dimP + dn; m = S.calM - 1; if (m < 0) { m = 11; y--; } faded = true; }
    else if (dn > dim) { d = dn - dim; m = S.calM + 1; if (m > 11) { m = 0; y++; } faded = true; }
    else d = dn;
    out.calCells.push({ d: String(d), y, m, dd: d, sel: (y === sel.y && m === sel.m && d === sel.d), today: (y === 2026 && m === 6 && d === 4), faded });
  }
  out.range = S.data.meta.range.start + ' → ' + S.data.meta.range.end;
  return out;
}

// ============================ components ============================
const ICON = 'fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round';
function banner(v) {
  const tab = (act, key, label) => `<button class="seg${v.view === key ? ' is-active' : ''}" data-action="${act}">${label}</button>`;
  const cal = v.showCal ? `<div class="cal">
      <div class="cal__head"><button class="cal__nav" data-action="calPrev">‹</button><div class="cal__title">${esc(v.calTitle)}</div><button class="cal__nav" data-action="calNext">›</button></div>
      <div class="cal__dow"><div>MO</div><div>TU</div><div>WE</div><div>TH</div><div>FR</div><div>SA</div><div>SU</div></div>
      <div class="cal__grid">${v.calCells.map(c => `<button class="cal__day${c.sel ? ' is-sel' : ''}${c.today ? ' is-today' : ''}${c.faded ? ' is-faded' : ''}" data-action="pick" data-y="${c.y}" data-m="${c.m}" data-d="${c.dd}">${esc(c.d)}</button>`).join('')}</div>
      <div class="cal__sel">${esc(v.selFull)}</div>
    </div>` : '';
  return `<div class="banner"><div class="banner__inner">
    <div class="banner__head"><span class="chip-live">LIVE OPS</span><h1 class="banner__title">Daily HSE Stats</h1><div class="banner__kicker">HSE STATISTICS SUMMARY</div></div>
    <div class="segmented">${tab('setCapture', 'capture', 'Daily Capture')}${tab('setDashboard', 'dashboard', 'Dashboard')}${tab('setWarning', 'warning', 'Early Warning')}</div>
    <button class="btn btn--report" data-action="openReport"><svg width="15" height="15" viewBox="0 0 24 24" style="${ICON};stroke:#fff"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>Generate daily report</button>
    <div class="date"><div class="date__label">REPORTING DATE</div>
      <button class="date__btn" data-action="toggleCal"><span class="date__ico"></span>${esc(v.selPill)}<span class="date__caret">▼</span></button>${cal}
    </div>
  </div></div>`;
}
function spark(m, n, color) {
  const vals = lastDays(n).map(dt => valAt(m, isoD(dt))), mx = Math.max(1, ...vals);
  return `<div class="spark">${vals.map(x => `<span class="spark__bar" style="height:${Math.max(3, Math.round(x / mx * 24))}px;--sc:${x ? (color || '#3f96b4') : '#E7EAEE'}"></span>`).join('')}</div>`;
}
function riskLineSVG(vals) {
  const w = 900, h = 150, p = 10, n = vals.length, c = cfg();
  const x = i => p + i * (w - 2 * p) / (n - 1), y = val => h - p - (val / 100) * (h - 2 * p);
  const line = vals.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
  const area = `${p},${(h - p).toFixed(1)} ${line} ${(w - p).toFixed(1)},${(h - p).toFixed(1)}`;
  const last = vals[n - 1], lc = { 'lvl-low': '#1F8A4C', 'lvl-elev': '#B26A00', 'lvl-high': '#C0392B' }[riskLevel(last).cls];
  const band = (val, label, col) => `<line x1="${p}" y1="${y(val).toFixed(1)}" x2="${w - p}" y2="${y(val).toFixed(1)}" stroke="${col}" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/><text x="${w - p}" y="${(y(val) - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="${col}" font-weight="700">${label}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:150px;display:block">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lc}" stop-opacity=".28"/><stop offset="1" stop-color="${lc}" stop-opacity="0"/></linearGradient></defs>
    ${band(c.riskHigh, 'High', '#C0392B')}${band(c.riskElevated, 'Elevated', '#B26A00')}
    <polygon points="${area}" fill="url(#rg)"/><polyline points="${line}" fill="none" stroke="${lc}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="4.5" fill="${lc}"/></svg>`;
}

// ============================ CAPTURE ============================
function captureView(v) {
  const q = state.search.trim().toLowerCase();
  const inScope = m => (state.capGroup === 'all' || m.group === state.capGroup) && (!q || m.label.toLowerCase().includes(q));
  const rows = state.data.metrics.filter(inScope);
  const entered = m => (m.key + '|' + selIso()) in state.edits;
  const acc = m => m.group === 'Incident Statistics' ? '#C0392B' : '#3f96b4';

  const row = m => { const t = valToday(m), yv = yesterdayVal(m), avg = sumLast(m, 7) / 7, has = entered(m) || t > 0;
    return `<div class="cap__row${has ? ' is-entered' : ''}" style="--accent:${acc(m)}">
      <div class="metric"><span class="metric__dot"></span><div style="min-width:0"><div class="metric__name">${esc(m.label)}</div>${spark(m, 10, acc(m))}</div></div>
      <button class="yest" data-action="useYest" data-key="${esc(m.key)}" title="Copy yesterday to today">${fmt(yv)}<span class="yest__ico">⤵</span></button>
      <div class="cell-avg">${avg ? avg.toFixed(1) : '0'}</div>
      <div class="cell-num"><input class="num" id="in_${esc(m.key)}" data-action="entry" data-key="${esc(m.key)}" type="number" min="0" inputmode="numeric" value="${t === 0 && !entered(m) ? '' : t}" placeholder="${yv || 0}"></div>
      <div class="cell-mtd tnum">${fmt(mtd(m))}</div>
    </div>`; };

  const get = k => valToday(M[k]) || 0;
  const kpis = [['Take 5s logged', get('take-5'), '#3f96b4'], ['Critical Control Checklists', get('critical-control-checklists-cccs'), '#1f396c'], ['Pre-start meetings', get('pre-start-meetings'), '#0054a6'], ['Alcohol tests', get('number-of-tests-alcohol'), '#E0A100'], ['Incidents (MTD)', mtd(M['total-number-of-incidents']), '#C0392B']];
  const loggedCount = state.data.metrics.filter(m => entered(m) || valToday(m) > 0).length, total = state.data.metrics.length;
  const seg = (key, label) => `<button class="seg seg--sm${state.capGroup === key ? ' is-active' : ''}" data-action="capGroup" data-g="${esc(key)}">${label}</button>`;

  return `<main class="page">
    <div class="pagehead">
      <div class="pagehead__l"><h1 class="pagehead__title">Daily stats — ${esc(v.selPill)}</h1>
        <p class="pagehead__desc">Type today’s number in each field. <strong>Yesterday</strong> and the <strong>7-day average</strong> are there for reference — tap a Yesterday figure to copy it across.</p></div>
      <div class="stat"><div class="stat__label">Entered today</div><div class="stat__row"><span class="stat__big">${loggedCount}</span><span class="stat__sub">of ${total} metrics</span></div><div class="progress"><div class="progress__bar" style="width:${Math.round(loggedCount / total * 100)}%"></div></div></div>
    </div>
    <div class="grid grid--kpi" style="margin-bottom:16px">
      ${kpis.map(([l, val, c]) => `<div class="kpi" style="--accent:${c}"><div class="kpi__label">${esc(l)}</div><div class="kpi__value tnum">${fmt(val)}</div></div>`).join('')}
    </div>
    <div class="toolbar">
      <div class="segmented segmented--sm">${seg('all', 'All')}${seg('HSE Leading Indicators', 'Leading indicators')}${seg('Incident Statistics', 'Incidents')}</div>
      <input class="input input--grow" id="search" data-action="onSearch" value="${esc(state.search)}" placeholder="Search metric…">
      <button class="btn btn--ghost" data-action="copyYest">Copy yesterday</button>
      <button class="btn btn--soft" data-action="clearDay">Clear day</button>
    </div>
    <div class="card"><div class="cap"><div class="cap__scroll">
      <div class="cap__head"><div class="c0">Metric</div><div class="u-right">Yesterday</div><div class="u-right">7-day avg</div><div class="u-center">Today</div><div class="cN u-right">MTD</div></div>
      ${rows.length ? rows.map(row).join('') : '<div style="padding:40px;text-align:center;color:#8A909C">No metrics match.</div>'}
    </div></div></div>
  </main>`;
}

// ============================ DASHBOARD ============================
function targetsCard() {
  const chip = t => `<div class="target ${t.kind === 'lag' ? 'is-lag' : 'is-lead'}"><div class="target__tag">${t.kind === 'lag' ? 'Lagging' : 'Leading'}</div><div class="target__k">${esc(t.k)}</div><div class="target__v">${esc(t.target)}</div></div>`;
  return `<div class="targets"><div class="targets__head"><div class="card__title">Governing HSE targets</div><span class="hint">${esc(HSMP.rev)} · ${esc(HSMP.client)}</span></div>
    <div class="grid grid--targets">${HSMP.targets.map(chip).join('')}</div>
    <div class="targets__note">TRIFR/HPI are rate targets (per million hours worked) — exposure hours aren’t captured here, so counts are shown, not the rate.</div></div>`;
}
function dashboardView(v) {
  const tm = M[state.trendMetric] || state.data.metrics[0];
  const td = lastDays(14).map(dt => ({ dt, val: valAt(tm, isoD(dt)) })), tmax = Math.max(1, ...td.map(t => t.val));
  const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const kpi = (label, key, sub) => { const m = M[key]; return `<div class="kpi kpi--big"><div class="kpi__label">${esc(label)}</div><div class="kpi__value tnum">${fmt(projectTotal(m))}</div><div class="kpi__sub">${esc(sub)}: <strong style="color:#5B6270">${fmt(mtd(m))}</strong></div></div>`; };
  const bars = td.map(t => `<div class="trend__col"><div class="trend__val tnum">${t.val ? fmt(t.val) : ''}</div><div class="trend__bar${t.val ? '' : ' is-zero'}" style="height:${Math.max(2, Math.round(t.val / tmax * 100))}%"></div><div class="trend__lbl">${t.dt.getDate()} ${MONS[t.dt.getMonth()]}</div></div>`).join('');
  const opts = state.data.metrics.map(m => `<option value="${esc(m.key)}"${m.key === state.trendMetric ? ' selected' : ''}>${esc(m.label)}</option>`).join('');
  const tgroup = g => { const inc = g === 'Incident Statistics';
    const rs = state.data.metrics.filter(m => m.group === g).map(m => { const tot = projectTotal(m), md = mtd(m), frac = tot ? Math.round(md / tot * 100) : 0;
      return `<div class="dtable__row"><div class="c0">${esc(m.label)}</div><div class="tnum" style="font-weight:700">${fmt(valToday(m))}</div><div class="tnum" style="color:#5B6270">${fmt(sumLast(m, 7))}</div><div class="tnum" style="font-weight:700;color:#1f396c">${fmt(md)}</div><div class="tnum" style="color:#5B6270">${fmt(tot)}</div><div class="cN"><div class="minibar"><div class="minibar__fill${inc ? ' is-inc' : ''}" style="width:${frac}%"></div></div></div></div>`; }).join('');
    return `<div class="dtable__group${inc ? ' is-inc' : ''}"><div>${esc(g)}</div><div></div><div></div><div></div><div></div><div></div></div>${rs}`; };
  return `<main class="page">
    <div style="margin-bottom:18px"><h1 class="pagehead__title">HSE statistics dashboard</h1><p class="pagehead__desc">Project totals with month-to-date rollups as at ${esc(v.selPill)}.</p></div>
    <div class="grid grid--kpi-lg" style="margin-bottom:20px">${kpi('Take 5s', 'take-5', 'Month to date')}${kpi('Critical Control Checklists', 'critical-control-checklists-cccs', 'MTD')}${kpi('Pre-start meetings', 'pre-start-meetings', 'MTD')}${kpi('Alcohol tests', 'number-of-tests-alcohol', 'MTD')}${kpi('Total incidents', 'total-number-of-incidents', 'MTD')}</div>
    ${targetsCard()}
    <div class="card card--pad" style="margin-bottom:16px">
      <div class="flexrow"><div style="flex:1;min-width:180px"><div class="card__title">Daily trend — last 14 days</div><div class="card__sub">Daily count ending ${esc(v.selPill)}.</div></div><select class="select" id="trendMetric" data-action="onTrend">${opts}</select></div>
      <div class="trend">${bars}</div>
    </div>
    <div class="card">
      <div class="card__head"><div><div class="card__title">Running totals — every metric</div><div class="card__sub">Today · 7-day · month-to-date · project total.</div></div></div>
      <div class="dtable"><div class="dtable__scroll">
        <div class="dtable__head"><div class="c0">Metric</div><div>Today</div><div>7-day</div><div>MTD</div><div>Project</div><div class="cN">MTD share</div></div>
        ${state.data.groups.map(tgroup).join('')}
      </div></div>
    </div>
  </main>`;
}

// ============================ EARLY WARNING ============================
function configPanel() {
  const c = cfg();
  const F = [['windowDays', 'Weekly window (days)', 'Used on the Weekly basis only'], ['watchDropPct', 'Watch — activity drop ≥ (%)', 'Proactive indicator falling'], ['warnDropPct', 'Warning — activity drop ≥ (%)', 'Larger fall = Warning'], ['nearMissCount', 'Near-miss Warning ≥', 'Near-misses per period'], ['faiCount', 'First-aid Watch ≥', 'FAIs per period'], ['redsCount', 'Critical-control reds Watch ≥', 'Reds per period'], ['envCount', 'Environmental Watch ≥', 'Env reports per period'], ['damageCount', 'Property-damage Watch ≥', 'Damage events per period'], ['inductionSpike', 'New-starter influx Watch ≥', 'Inductions per period'], ['riskElevated', 'Risk Index — Elevated ≥', 'Band boundary (0–100)'], ['riskHigh', 'Risk Index — High ≥', 'Band boundary (0–100)']];
  return `<div class="cfg">
    <div class="cfg__head"><div class="card__title">Rule settings</div><span class="hint">— tune the thresholds to your HSMP</span><button class="link" data-action="resetCfg">Reset to defaults</button></div>
    <div class="cfg__grid">${F.map(([f, label, hint]) => `<div><label class="cfg__label">${esc(label)}</label><input class="cfg__input" data-action="cfg" data-field="${f}" type="number" min="0" value="${c[f]}"><div class="cfg__hint">${esc(hint)}</div></div>`).join('')}</div>
    <div class="cfg__note">Rules recompute instantly. Every value is applied to the live data — nothing is AI-generated, so what you set is exactly what fires.</div>
  </div>`;
}
function warningView(v) {
  const end = selDate(), risk = riskFor(end), lvl = riskLevel(risk), trend = lastDays(14).map(dt => riskFor(dt)), alerts = buildAlerts(), c = cfg(), P = periodWords();
  const cards = Object.keys(PROACTIVE).map(key => { const m = M[key], w = wow(m, end), pct = w.pct;
    const cls = pct <= -c.warnDropPct / 100 ? 'is-warn' : pct <= -c.watchDropPct / 100 ? 'is-watch' : 'is-ok';
    const arrow = pct > 0.02 ? '▲' : pct < -0.02 ? '▼' : '→', pctTxt = (pct > 0 ? '+' : '') + Math.round(pct * 100) + '%';
    const scol = cls === 'is-ok' ? '#3f96b4' : cls === 'is-watch' ? '#E0A100' : '#C0392B';
    return `<div class="driver ${cls}"><div class="driver__top"><div class="driver__name">${esc(m.label)}</div><span class="badge"></span></div>
      <div class="driver__bot"><div><div class="driver__delta">${arrow} ${pctTxt}</div><div class="driver__meta">${state.basis === 'month' ? 'MTD' : c.windowDays + 'd'} ${fmt(w.cur)} vs ${fmt(w.prev)}${state.basis === 'month' ? ' LM' : ''}</div></div>${spark(m, 14, scol)}</div></div>`; }).join('');
  const list = alerts.length ? alerts.map(a => `<div class="alert is-${a.sev}"><span class="alert__ico">!</span><div class="alert__body"><div class="alert__title"><strong>${esc(a.title)}</strong><span class="badge"></span></div><div class="alert__detail">${esc(a.detail)}</div><div class="alert__action"><strong>Recommended:</strong> ${esc(a.action)}</div></div></div>`).join('')
    : `<div class="alerts__empty">✓ No warning signals at the current thresholds. Leading indicators are holding.</div>`;
  return `<main class="page">
    <div class="warn-top">
      <div style="flex:1;min-width:260px"><h1 class="pagehead__title">Early warning — leading indicators</h1><p class="pagehead__desc">A transparent rule engine: it reads proactive activity (Take 5s, CCCs, inspections, hazard reporting) and precursors (near-misses, first-aids, reds, recordables) to estimate incident risk before it becomes an injury.</p></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="segmented segmented--sm"><button class="seg seg--sm${state.basis === 'week' ? ' is-active' : ''}" data-action="basis" data-b="week">Weekly</button><button class="seg seg--sm${state.basis === 'month' ? ' is-active' : ''}" data-action="basis" data-b="month">Monthly</button></div><button class="btn btn--ghost${state.showConfig ? ' is-on' : ''}" data-action="toggleConfig">⚙ Rule settings</button></div>
    </div>
    ${state.showConfig ? configPanel() : ''}
    <div class="risk-grid">
      <div class="risk ${lvl.cls}">
        <div class="risk__kicker">Incident Risk Index</div>
        <div class="risk__num"><span class="risk__val tnum">${risk}</span><span class="risk__den">/ 100</span></div>
        <div class="risk__badge">${lvl.label} risk</div>
        <div class="risk__track"><div class="risk__fill" style="width:${risk}%"></div></div>
        <div class="risk__note">${alerts.length ? esc(alerts.length) + ' active signal' + (alerts.length > 1 ? 's' : '') + ' — see below.' : 'No active warning signals.'}</div>
      </div>
      <div class="card card--pad" style="display:flex;flex-direction:column">
        <div class="card__title">Risk index — last 14 days</div><div class="card__sub" style="margin-bottom:6px">Rising line = proactive activity slipping and/or precursors building.</div>
        <div class="riskchart">${riskLineSVG(trend)}</div>
      </div>
    </div>
    <div class="card alerts" style="margin-bottom:16px">
      <div class="card__head"><div class="card__title">Warning signals &amp; recommended actions</div><span class="card__badge${alerts.length ? ' is-alert' : ''}">${alerts.length}</span></div>
      ${list}
    </div>
    <div class="section-title">Leading indicators — ${P.adj} trend</div>
    <div class="grid grid--cards">${cards}</div>
  </main>`;
}

// ============================ REPORT ============================
// ---- report charts (inline SVG / CSS, no libs) ----
function gaugeSVG(val) {
  const c = cfg(), W = 240, H = 138, cx = 120, cy = 122, R = 94, sw = 17;
  const A = x => Math.PI * (180 - Math.max(0, Math.min(100, x)) * 1.8) / 180;
  const P = (x, r) => [(cx + r * Math.cos(A(x))).toFixed(1), (cy - r * Math.sin(A(x))).toFixed(1)];
  const arc = (a, b, col) => { const p1 = P(a, R), p2 = P(b, R); return `<path d="M ${p1[0]} ${p1[1]} A ${R} ${R} 0 0 1 ${p2[0]} ${p2[1]}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`; };
  const lc = { 'lvl-low': '#1F8A4C', 'lvl-elev': '#E0A100', 'lvl-high': '#C0392B' }[riskLevel(val).cls];
  const nd = P(val, R - 16);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:250px;height:auto;display:block;margin:2px auto 0">`
    + arc(0, c.riskElevated, '#CFEBD9') + arc(c.riskElevated, c.riskHigh, '#F6E3B0') + arc(c.riskHigh, 100, '#F0C7CC')
    + arc(0, Math.max(1, val), lc)
    + `<line x1="${cx}" y1="${cy}" x2="${nd[0]}" y2="${nd[1]}" stroke="${lc}" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5.5" fill="${lc}"/></svg>`;
}
function areaSVG(vals, color) {
  const w = 520, h = 116, p = 8, n = vals.length, mx = Math.max(1, ...vals);
  const x = i => p + i * (w - 2 * p) / (n - 1), y = val => h - p - (val / mx) * (h - 2 * p);
  const line = vals.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
  const area = `${p},${h - p} ${line} ${w - p},${h - p}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:112px;display:block"><defs><linearGradient id="ma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".26"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><polygon points="${area}" fill="url(#ma)"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(n - 1).toFixed(1)}" cy="${y(vals[n - 1]).toFixed(1)}" r="3.5" fill="${color}"/></svg>`;
}
function divBars(items) {
  const mx = Math.max(20, ...items.map(i => Math.abs(i.pct * 100)));
  return `<div class="divbars">` + items.map(i => { const p = i.pct * 100, pos = p >= 0, w = (Math.abs(p) / mx * 50).toFixed(0);
    return `<div class="divbar"><div class="divbar__l">${esc(i.label)}</div><div class="divbar__track"><div class="divbar__mid"></div><div class="divbar__fill ${pos ? 'is-pos' : 'is-neg'}" style="width:${w}%"></div></div><div class="divbar__v ${pos ? 'is-pos' : 'is-neg'}">${p > 0 ? '+' : ''}${Math.round(p)}%</div></div>`; }).join('') + `</div>`;
}
function hbars(items, color) {
  const mx = Math.max(1, ...items.map(i => i.val));
  return `<div class="hbars">` + items.map(i => `<div class="hbar"><div class="hbar__l">${esc(i.label)}</div><div class="hbar__track"><div class="hbar__fill" style="width:${Math.round(i.val / mx * 100)}%;background:${color}"></div></div><div class="hbar__v">${fmt(i.val)}</div></div>`).join('') + `</div>`;
}
function reportTargets() {
  return `<div class="tchips">` + HSMP.targets.map(t => `<div class="tchip ${t.kind === 'lag' ? 'is-lag' : 'is-lead'}"><div class="tchip__tag">${t.kind === 'lag' ? 'Lagging' : 'Leading'}</div><div class="tchip__k">${esc(t.k)}</div><div class="tchip__v">${esc(t.target)}</div></div>`).join('') + `</div>`;
}
function reportOverlay(v) {
  const end = selDate(), risk = riskFor(end), lvl = riskLevel(risk), alerts = buildAlerts();
  const lc = { 'lvl-low': '#1F8A4C', 'lvl-elev': '#E0A100', 'lvl-high': '#C0392B' }[lvl.cls];
  const lbg = { 'lvl-low': '#E6F3EC', 'lvl-elev': '#FBF0DC', 'lvl-high': '#FBE6E9' }[lvl.cls];
  const genTs = new Date().toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const KPI = [['Take 5s', 'take-5', '#3f96b4'], ['CCCs', 'critical-control-checklists-cccs', '#1f396c'], ['Pre-starts', 'pre-start-meetings', '#0054a6'], ['Alcohol tests', 'number-of-tests-alcohol', '#E0A100'], ['Incidents', 'total-number-of-incidents', '#C0392B']];
  const kpis = KPI.map(([l, k, c]) => { const m = M[k], val = k === 'total-number-of-incidents' ? mtd(m) : valToday(m);
    return `<div class="rk" style="--c:${c}"><div class="rk__l">${l}</div><div class="rk__v tnum">${fmt(val)}</div><div class="rk__mtd">MTD ${fmt(mtd(m))}</div><div style="margin-top:6px">${spark(m, 14, c)}</div></div>`; }).join('');
  const t5vals = lastDays(14).map(d => valAt(M['take-5'], isoD(d)));
  const movers = Object.keys(PROACTIVE).map(k => ({ label: M[k].label, pct: wow(M[k], end).pct })).sort((a, b) => a.pct - b.pct).slice(0, 8);
  const incs = state.data.metrics.filter(m => m.group === 'Incident Statistics' && m.key !== 'total-number-of-incidents').map(m => ({ label: m.label, val: mtd(m) }));
  const recMtd = mtd(M['medical-treatment-injury-reports-mti']) + mtd(M['lost-time-injury-reports-lti']) + mtd(M['restricted-work-injury-reports-rwc']);
  const trow = m => `<tr><td>${esc(m.label)}</td><td>${fmt(valToday(m))}</td><td>${fmt(sumLast(m, 7))}</td><td class="mtd">${fmt(mtd(m))}</td><td>${fmt(projectTotal(m))}</td></tr>`;
  const table = g => `<div class="rpt__sec"><div class="rpt__sectitle${g === 'Incident Statistics' ? ' is-inc' : ''}">${esc(g)}</div><table class="rtable2"><thead><tr><th>Metric</th><th>Today</th><th>7-day</th><th>MTD</th><th>Project</th></tr></thead><tbody>${state.data.metrics.filter(m => m.group === g).map(trow).join('')}</tbody></table></div>`;
  const alertCards = alerts.length ? alerts.map(a => `<div class="ralert is-${a.sev}"><div class="ralert__t">${esc(a.title)}</div><div class="ralert__d">${esc(a.detail)}</div><div class="ralert__a"><strong>Action:</strong> ${esc(a.action)}</div></div>`).join('') : `<div class="ralert__empty">✓ No warning signals — leading indicators holding.</div>`;
  const basisLabel = state.basis === 'month' ? 'month-on-month' : 'period-on-period';

  return `<div class="report-backdrop no-print" data-action="closeReport"><div class="report" id="reportSheet" data-action="stop">
    <div class="rpt__band">
      <div class="rpt__brand">DECMIL</div>
      <div class="rpt__headrow"><div><div class="rpt__title">Daily HSE Statistics Report</div><div class="rpt__sub">${esc(state.data.meta.site)} · ${esc(state.data.meta.project)}</div></div>
        <div class="rpt__meta"><b>${esc(v.selFull)}</b><div>${esc(HSMP.client)}</div><div>${esc(HSMP.rtioRef)}</div><div style="opacity:.75">Generated ${esc(genTs)} · HSE Advisor</div></div></div>
    </div>
    <div class="rpt__body">
      <div class="rk-row">${kpis}</div>
      <div class="rpt__sec rpt-2">
        <div class="rpt-panel rpt-panel--tint gauge-wrap"><div class="panel__t">Incident Risk Index</div><div class="panel__s">${state.basis === 'month' ? 'Monthly' : 'Weekly'} basis · ${alerts.length} active signal${alerts.length === 1 ? '' : 's'}</div>
          ${gaugeSVG(risk)}<div class="gauge__lvl" style="background:${lbg};color:${lc}"><span style="width:8px;height:8px;border-radius:50%;background:${lc};display:inline-block"></span>${lvl.label} risk — ${risk}/100</div></div>
        <div class="rpt-panel"><div class="panel__t">Take 5s — last 14 days</div><div class="panel__s">Daily count ending ${esc(v.selPill)}.</div>${areaSVG(t5vals, '#3f96b4')}</div>
      </div>
      <div class="rpt__sec rpt-2">
        <div class="rpt-panel"><div class="panel__t">Leading indicators — ${basisLabel}</div><div class="panel__s">Biggest movers in proactive activity (green up / red down).</div>${divBars(movers)}</div>
        <div class="rpt-panel"><div class="panel__t">Incident statistics — month to date</div><div class="panel__s">${esc(v.monthLabel)}.</div><div class="bignum"><span class="bignum__v">${fmt(mtd(M['total-number-of-incidents']))}</span><span class="bignum__l">total incidents MTD · ${fmt(recMtd)} recordable</span></div>${hbars(incs, '#C0392B')}</div>
      </div>
      <div class="rpt__sec"><div class="rpt__sectitle">Governing HSE targets — ${esc(HSMP.rev)}</div>${reportTargets()}</div>
      ${state.data.groups.map(table).join('')}
      <div class="rpt__sec"><div class="rpt__sectitle">Early-warning summary</div><div class="ralerts">${alertCards}</div></div>
      <div class="rpt__foot"><div>Sign-off: ____________________________</div><div>DECMIL · WASP Western Hill (10265) · ${esc(HSMP.rev)}</div></div>
      <div class="rpt__actions no-print"><button class="btn btn--close" data-action="closeReport">Close</button><button class="btn btn--print" data-action="printReport">Print / Save PDF</button></div>
    </div>
  </div></div>`;
}

// ============================ render + events ============================
function render() {
  const v = chrome();
  const active = ROOT.activeElement;
  let fid = null, ss = null, se = null;
  if (active && active.id && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) { fid = active.id; try { ss = active.selectionStart; se = active.selectionEnd; } catch (e) {} }
  const body = v.showCapture ? captureView(v) : v.showDashboard ? dashboardView(v) : warningView(v);
  APP.innerHTML = `<div class="app"><div class="main">${banner(v)}${body}</div></div>${state.report ? reportOverlay(v) : ''}`;
  if (fid) { const el = ROOT.getElementById(fid); if (el) { el.focus(); if (ss != null) try { el.setSelectionRange(ss, se); } catch (e) {} } }
}
function copyYesterday() { const e = { ...state.edits }; state.data.metrics.forEach(m => { e[m.key + '|' + selIso()] = yesterdayVal(m); }); setState({ edits: e }); }
function clearDay() { const suf = '|' + selIso(), e = {}; for (const k in state.edits) if (!k.endsWith(suf)) e[k] = state.edits[k]; setState({ edits: e }); }
const clickActions = {
  setCapture: () => setState({ view: 'capture' }), setDashboard: () => setState({ view: 'dashboard' }), setWarning: () => setState({ view: 'warning' }),
  toggleCal: () => setState({ showCal: !state.showCal, calY: state.sel.y, calM: state.sel.m }),
  calPrev: () => { let m = state.calM - 1, y = state.calY; if (m < 0) { m = 11; y--; } setState({ calM: m, calY: y }); },
  calNext: () => { let m = state.calM + 1, y = state.calY; if (m > 11) { m = 0; y++; } setState({ calM: m, calY: y }); },
  pick: el => setState({ sel: { y: +el.dataset.y, m: +el.dataset.m, d: +el.dataset.d }, showCal: false }),
  capGroup: el => setState({ capGroup: el.dataset.g }),
  useYest: el => { const m = M[el.dataset.key]; setState(s => ({ edits: { ...s.edits, [m.key + '|' + selIso()]: yesterdayVal(m) } })); },
  copyYest: copyYesterday, clearDay: clearDay,
  toggleConfig: () => setState({ showConfig: !state.showConfig }), resetCfg: () => setState({ config: { ...DEFAULT_CFG } }), basis: el => setState({ basis: el.dataset.b }),
  openReport: () => setState({ report: true }), closeReport: () => setState({ report: false }), printReport: () => window.print(), stop: () => {}
};
ROOT.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  if (a === 'stop') { e.stopPropagation(); return; }
  if (a === 'closeReport' && e.target !== el && !e.target.closest('button')) return;
  if (clickActions[a]) { e.stopPropagation(); clickActions[a](el); }
});
ROOT.addEventListener('input', e => { const el = e.target.closest('[data-action]'); if (el && el.dataset.action === 'onSearch') setState({ search: el.value }); });
ROOT.addEventListener('change', e => {
  const el = e.target.closest('[data-action]'); if (!el) return; const a = el.dataset.action;
  if (a === 'onTrend') setState({ trendMetric: el.value });
  else if (a === 'entry') { const raw = el.value.trim(); const n = raw === '' ? 0 : Math.max(0, Math.round(Number(raw)) || 0); setState(s => ({ edits: { ...s.edits, [el.dataset.key + '|' + selIso()]: n } })); }
  else if (a === 'cfg') { const n = Math.max(0, Math.round(Number(el.value)) || 0); setState(s => ({ config: { ...s.config, [el.dataset.field]: n } })); }
});
render();
}
global.DailyHseStats = { mount: mount };
}(window));
