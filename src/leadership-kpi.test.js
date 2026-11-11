'use strict';
var K = require('./leadership-kpi.js'), cfg = require('../config/leadership-kpi-10265.json'), failed = 0;
function eq(name, got, want) { var ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : ' — got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want))); }
// Synthetic export in the SAI 360 layout: a title row, then headings, then documents.
var H = ['Type', 'Doc No', 'Title', 'Start Date', 'Created By', 'Template'];
var T = [['Document export'], H,
    ['LIF', 1, 'x', '10/19/2026', 'alex.sample', 'pthaReview'], ['LIF', 2, 'x', '10/20/2026', 'alex.sample', 'pthaReview'], ['LIF', 3, 'x', '10/20/2026', 'ALEX.SAMPLE', 'qsiRecord'],
    ['LIF', 4, 'x', '10/21/2026', 'alex.sample', 'spotlight'], ['AREA_INSP', 5, 'x', '10/21/2026', 'alex.sample', 'generalInspection'],
    ['LIF', 6, 'x', '10/02/2026', 'alex.sample', 'cccReview'], ['LIF', 7, 'x', '10/16/2026', 'alex.sample', 'pthaReview'],      // 16 Oct is the week before
    ['LIF', 8, 'x', '10/22/2026', 'jo.example', 'qsiRecord'], ['SRA', 9, 'x', '10/22/2026', 'jo.example', 'journey'], ['LIF', 10, 'x', '', 'jo.example', 'qsiRecord'],
    [null, null, null, null, null, null]];
var P = K.parse(T, cfg);
eq('source recognised from its headings', P.source, 'SAI 360');
eq('documents / counted / other types / no date', [P.rows, P.counted, P.notKpi, P.skippedNoDate], [10, 8, 1, 1]);
eq('user names become display names', P.events[2].person, 'Alex Sample');
eq('US dates are read month first', P.events[0].date, '2026-10-19');
eq('week starts Saturday', K.weekStartOf('2026-10-23'), '2026-10-17');
var R = K.compute(P.events, cfg, { asAt: '2026-10-23', roster: [{ name: 'Alex Sample', role: 'HSE Advisor' }, { name: 'Sam Nodocs', role: 'Supervisor' }, { name: 'Pat Operator', role: 'Operator - Dozer' }] });
var alex = R.rows.filter(function (r) { return r.name === 'Alex Sample'; })[0], jo = R.rows.filter(function (r) { return r.name === 'Jo Example'; })[0], sam = R.rows.filter(function (r) { return r.name === 'Sam Nodocs'; })[0];
eq('group comes from the roster role', alex.group, 'HSE Advisors');
eq('weekly counts stay inside the Sat–Fri week', [alex.counts.PTHA, alex.counts.QSI, alex.counts.Spotlight, alex.counts.AreaInsp], [2, 1, 1, 1]);
eq('CCFV counts month to date', alex.counts.CCFV, 1);
eq('all four weekly KPIs met', [alex.weeklyMet, alex.weeklyRequired, alex.weekly], [4, 4, 'Complete']);
eq('monthly still in progress with the gap listed', [alex.monthly, alex.outstanding], ['In progress', ['CCFV 9 more']]);
eq('a leader on the roster with no documents is Outstanding', [sam.weekly, sam.outstanding.length], ['Outstanding', 5]);
eq('someone in the export but not matched to a role needs checking', [jo.group, jo.weekly], [null, 'Check role']);
eq('non-leaders on the roster are not listed', R.rows.length, 3);
var R2 = K.compute(P.events, cfg, { asAt: '2026-10-23', groupChoice: { 'jo example': 'Project Offsite Leaders', 'alex sample': '' } });
eq('a chosen group applies its targets; "not a leader" hides the person', [R2.rows.length, R2.rows[0].weekly, R2.rows[0].monthly], [1, 'Complete', 'In progress']);
eq('group summary', R.groups.filter(function (g) { return g.name === 'HSE Advisors'; })[0].pct, 100);
eq('unknown layout is reported', /does not look like/.test(K.parse([['a', 'b'], [1, 2]], cfg).error), true);
eq('Excel serial and day-first dates', [K.toIsoDate(46316), K.toIsoDate('23/10/2026', 'MDY'), K.toIsoDate('2026-10-23T00:00')], ['2026-10-21', '2026-10-23', '2026-10-23']);
if (failed) { console.log('FAILED: ' + failed); process.exit(1); }
console.log('All checks passed.');
