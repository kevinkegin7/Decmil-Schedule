/*
 * Tests for the visual report card. Renders the Email Report fixture through
 * the report module and checks the card and the Outlook HTML carry the right
 * figures, escape names, and keep the segmented bar's geometry honest.
 *
 * Run: node src/take5-visuals.test.js
 */
'use strict';
var R = require('./take5-site-report');
var V = require('./take5-visuals');
var cfg = require('../config/site-10265.json');
var ER = require('../test/fixtures/email-report-2026-11-08.json');

var failures = [];
function check(desc, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures.push(desc + ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}
function has(desc, hay, needle) { check(desc, hay.indexOf(needle) >= 0, true); }

var rows = ER.rows.map(function (r) { return { Name: r.Name, Role: r.Role, Crew: r.Crew, Company: r.Company, TagCount: r.sheet.tagsFromRegister }; });
rows.push({ Name: 'Evil <script>alert(1)</script> "Name"', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: 0 });
var rep = R.buildReport(rows, cfg, { date: ER.reportDate });

var card = V.renderCard(rep, cfg, { sourceNote: 'test', trend: [{ label: 'Mon', pct: 40 }, { label: 'Tue', pct: 55 }, { label: 'Wed', pct: null }, { label: 'Thu', pct: 70 }] });
has('card hero shows compliance %', card, '>' + rep.totals.compliancePct + '%<');
has('card has Maintenance ratio', card, rep.groups.Maintenance.ratio);
has('card has Operations ratio', card, rep.groups.Operations.ratio);
check('ratios still reflect the sheet totals plus the injected row', [rep.groups.Maintenance.ratio, rep.groups.Operations.crewSize], ['2.75:1', 78]);
has('card names the project', card, 'WASP WH Bulk Earthworks');
has('card has the segmented bar', card, 'class="t5v-seg"');
has('card has crew meters', card, 'class="t5v-crews"');
has('card has the sparkline with the last value labelled', card, '>70%<');
has('card lists people at zero', card, rep.zeroNames.length + ' with no Take 5');
check('card escapes names', card.indexOf('<script>') < 0 && card.indexOf('&lt;script&gt;') > 0, true);
has('status icon and word accompany the colour', card, '✕ well below target');

// segmented bar geometry: widths sum to the bar width, gaps between live parts
var seg = V.segmentedBarSvg([{ name: 'a', value: 3, color: '#111' }, { name: 'b', value: 0, color: '#222' }, { name: 'c', value: 1, color: '#333' }], 400, 28);
var widths = []; seg.replace(/<rect x="(\d+)" y="0" width="(\d+)"/g, function (m, x, w) { widths.push([+x, +w]); return m; });
check('zero-value part draws nothing', widths.length, 2);
check('parts span the bar with a 2px gap', [widths[0][0], widths[0][1] + 2 === widths[1][0], widths[1][0] + widths[1][1]], [0, true, 400]);
check('empty bar degrades to a message', V.segmentedBarSvg([{ name: 'a', value: 0, color: '#111' }], 400, 28).indexOf('<svg') < 0, true);

// meter clamps and fills by severity
check('meter clamps over 100', V.meterSvg(140, 'good', 100, 10).indexOf('width="100" height="10" rx="5" fill="' + V.PAL.accent + '"') > 0, true);
check('severity bands', [V.severity(0), V.severity(49), V.severity(50), V.severity(79), V.severity(80)], ['critical', 'critical', 'warning', 'warning', 'good']);

// Outlook html: tables only, figures present, no svg
var mail = V.emailHtml(rep, cfg);
check('email html has no svg', mail.indexOf('<svg') < 0, true);
has('email html has the sentence (escaped)', mail, 'The ' + rep.zeroNames.length + ' people who didn&#39;t do take 5s are');
has('email html has ratio bars', mail, 'bgcolor="' + V.PAL.critical + '"');
has('email html has the group table', mail, '<th');
check('email html escapes names', mail.indexOf('<script>') < 0, true);

// crew rows: worst first, counts add up
var cr = V.crewRows(rep);
check('crew rows sorted worst first', cr.every(function (c, i) { return i === 0 || cr[i - 1].pct <= c.pct; }), true);
check('crew rows cover all included people', cr.reduce(function (a, c) { return a + c.n; }, 0), rep.totals.included);

if (failures.length) { console.error('FAILED (' + failures.length + ')'); failures.forEach(function (f) { console.error('  ' + f); }); process.exit(1); }
console.log('All checks passed.');
