/*
 * Conformance tests for the site-specific Take 5 report.
 *
 * The oracle is the workbook itself: test/fixtures/email-report-2026-11-08.json
 * holds the 127 people pasted into the register's Email Report sheet on
 * 8 Nov 2026 together with the sheet's OWN computed columns (Include, Group,
 * Status, Flag) and its four totals. The module must reproduce every one of
 * them from the same inputs and the rules in config/site-10265.json.
 *
 * Run: node src/take5-site-report.test.js
 */
'use strict';
var R = require('./take5-site-report');
var cfg = require('../config/site-10265.json');
var ER = require('../test/fixtures/email-report-2026-11-08.json');
var CAP = require('../test/fixtures/capture-2026-11-09.json');

var failures = [];
function check(desc, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures.push(desc + ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}

// ------------------------------------------------------------------------
// 1. Per-person conformance with the Email Report sheet (127 people)
// ------------------------------------------------------------------------
var rows = ER.rows.map(function (r) { return { Name: r.Name, Role: r.Role, Crew: r.Crew, Company: r.Company, TagCount: r.sheet.tagsFromRegister }; });
var rep = R.buildReport(rows, cfg, { date: ER.reportDate });

var mism = 0;
rep.people.forEach(function (p, i) {
    var s = ER.rows[i].sheet, c = p.cls;
    var wantInclude = s.include === 1;
    if (c.included !== wantInclude || (c.group || '') !== (s.group || '') || c.status !== s.status) {
        mism++;
        if (mism <= 12) failures.push('row ' + (i + 5) + ' ' + p.role + ' / ' + p.crew + ' tags=' + p.tags +
            ' — ours {inc:' + c.included + ', grp:' + c.group + ', st:' + c.status + '} sheet {inc:' + wantInclude + ', grp:' + s.group + ', st:' + s.status + '}');
    }
    var wantZero = s.flag === 'Zero';
    if ((c.included && c.status === 'No Take 5') !== wantZero) { mism++; failures.push('zero flag mismatch row ' + (i + 5)); }
});
check('per-person mismatches vs Email Report sheet', mism, 0);

// ------------------------------------------------------------------------
// 2. Totals: Email Report A4:D8, A3 and Stats "Other / unassigned"
// ------------------------------------------------------------------------
var M = rep.groups['Maintenance'], O = rep.groups['Operations'];
check('Maintenance crew size', M.crewSize, ER.expectedTotals.Maintenance.crewSize);
check('Maintenance Take 5s', M.take5s, ER.expectedTotals.Maintenance.take5s);
check('Maintenance ratio', M.ratio, ER.expectedTotals.Maintenance.ratio);
check('Maintenance zeros', M.zeros, ER.expectedTotals.Maintenance.zeros);
check('Operations crew size', O.crewSize, ER.expectedTotals.Operations.crewSize);
check('Operations Take 5s', O.take5s, ER.expectedTotals.Operations.take5s);
check('Operations ratio', O.ratio, ER.expectedTotals.Operations.ratio);
check('Operations zeros', O.zeros, ER.expectedTotals.Operations.zeros);
check('zero count (sentence)', rep.zeroNames.length, ER.expectedTotals.zeroCount);
check('excluded people on the list carry no Take 5s', rep.totals.otherTake5s, 0);
check('sentence starts like the sheet', rep.sentence.indexOf("The 69 people who didn't do take 5s are ") === 0, true);
check('daily log row', rep.dailyLogRow, ['2026-11-08', 16, 44, 2, 77, 29, 67]);
check('date label d/M/yy', rep.dateLabel, '8/11/26');

// ------------------------------------------------------------------------
// 3. Rule precedence and edge cases
// ------------------------------------------------------------------------
function cls(p, overrides) { return R.classify(R.fromCaptureRow(p), cfg, overrides); }
check('surveyor in a Site Office crew at 0 is Optional (optional beats the crew rule)',
    cls({ Name: 'A', Role: 'Surveyor', Crew: 'Site Office - A Crew', TagCount: 0 }).status, 'Optional');
check('surveyor in a Site Office crew with tags is included In range',
    cls({ Name: 'A', Role: 'Surveyor', Crew: 'Site Office - B Crew', TagCount: 3 }).status, 'In range');
check('surveyor in a field crew with 0 is Optional (excluded)',
    cls({ Name: 'A', Role: 'Surveyor', Crew: 'Ops - A Crew', TagCount: 0 }).status, 'Optional');
check('surveyor in a field crew with tags is included In range',
    cls({ Name: 'A', Role: 'Surveyor', Crew: 'Ops - A Crew', TagCount: 3 }).status, 'In range');
check('named optional person at 0 is Optional',
    cls({ Name: 'John Brady', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: 0 }).status, 'Optional');
check('operator parked in Site Office - Adhoc is Not required (crew rule)',
    cls({ Name: 'A', Role: 'Operator - Excavator', Crew: 'Site Office - Adhoc', TagCount: 3 }).status, 'Not required');
check('Surveyor - Senior is Optional (optional beats "senior")',
    cls({ Name: 'A', Role: 'Surveyor - Senior', Crew: 'Site Office - B Crew', TagCount: 0 }).status, 'Optional');
check('Senior catches other senior roles',
    cls({ Name: 'A', Role: 'Supervisor - Senior', Crew: 'Ops - A Crew', TagCount: 3 }).status, 'Not required');
check('Below min when 0 < tags < min',
    cls({ Name: 'A', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: 2 }).status, 'Below min');
check('mechanic grouped as Maintenance', cls({ Name: 'A', Role: 'Mechanic - Heavy', Crew: 'Maint - A Crew', TagCount: 3 }).group, 'Maintenance');
check('electrician grouped as Maintenance', cls({ Name: 'A', Role: 'Auto Electrician', Crew: 'Maint - B Crew', TagCount: 3 }).group, 'Maintenance');
check('labourer grouped as Operations', cls({ Name: 'A', Role: 'Labourer', Crew: 'Adhoc', TagCount: 3 }).group, 'Operations');
check('non-trade role in a Maint crew is Maintenance (crew prefix rule)',
    cls({ Name: 'A', Role: 'Trades Assistant', Crew: 'Maint - STW', TagCount: 3 }).group, 'Maintenance');
check('crew prefix is case-insensitive and needs the start of the string',
    [cls({ Name: 'A', Role: 'Labourer', Crew: 'maintenance night', TagCount: 3 }).group,
     cls({ Name: 'A', Role: 'Labourer', Crew: 'Ops - Maint support', TagCount: 3 }).group], ['Maintenance', 'Operations']);
check('override forces a supervisor to required',
    cls({ EmployeeId: 7, Name: 'A', Role: 'Supervisor', Crew: 'Ops - A Crew', TagCount: 0 }, { 7: true }).status, 'No Take 5');
check('override forces an operator to not required',
    cls({ EmployeeId: 8, Name: 'A', Role: 'Operator - Dozer', Crew: 'Ops - A Crew', TagCount: 3 }, { 8: false }).status, 'Not required');
check('typo roles still classify (trailing space, missing space)',
    [cls({ Name: 'A', Role: 'Contracts Administrator- Senior', Crew: 'Site Office - B Crew' }).status,
     cls({ Name: 'A', Role: 'Technician ', Crew: 'Ops - STW', TagCount: 0 }).status], ['Not required', 'No Take 5']);
check('blank tags count as zero', cls({ Name: 'A', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: null }).status, 'No Take 5');
check('ratio formatting', [R.ratioOf(44, 16), R.ratioOf(29, 77), R.ratioOf(0, 0)], ['2.75:1', '0.38:1', 'n/a']);

var one = R.buildReport([{ Name: 'Only Person', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: 0 }], cfg, { date: '2026-11-09' });
check('singular sentence', one.sentence, "The 1 person who didn't do take 5s is Only Person");
var none = R.buildReport([{ Name: 'X', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: 3 }], cfg, { date: '2026-11-09' });
check('no-zeros sentence matches the sheet', none.sentence, 'All crew members completed Take 5s');

// tagsFor substitution (paper register as the count source), including "Not in register"
var sub = R.buildReport([
    { Name: 'X', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: 3 },
    { Name: 'Y', Role: 'Labourer', Crew: 'Ops - A Crew', TagCount: 3 },
    { Name: 'Z', Role: 'Surveyor', Crew: 'Ops - A Crew', TagCount: 3 }
], cfg, { date: '2026-11-09', tagsFor: function (p) { return p.name === 'X' ? 0 : null; } });
check('tagsFor overrides the row count', sub.zeroNames, ['X']);
check('not-in-register person is in crew size but not a zero', [sub.groups.Operations.crewSize, sub.groups.Operations.zeros, sub.notInRegisterNames], [2, 1, ['Y']]);
check('optional person not in register is Optional (excluded)', sub.people[2].cls.status, 'Optional');
check('sentence counts only zeros', sub.sentence, "The 1 person who didn't do take 5s is X");

// ------------------------------------------------------------------------
// 4. The 9 Nov Site Diary capture under the same rules (sanity, no oracle)
// ------------------------------------------------------------------------
var capRep = R.buildReport(CAP.rows, cfg, { date: '2026-11-09' });
check('9 Nov: everyone classified', capRep.people.length, 131);
check('9 Nov: included + not required + optional = all',
    capRep.totals.included + capRep.totals.notRequired + capRep.totals.optionalExcluded, 131);
check('9 Nov: no Site Office person included unless Optional with Take 5s',
    capRep.people.filter(function (p) { return p.cls.included && !p.cls.optional && /site office/i.test(p.crew); }).length, 0);
check('9 Nov: no supervisor/engineer/manager included',
    capRep.people.filter(function (p) { return p.cls.included && /supervisor|engineer|manager|advisor|superintendent/i.test(p.role); }).length, 0);

// email text renders both groups and the sentence
var txt = R.formatEmail(rep, cfg);
check('email text has header, sentence and table', [txt.indexOf('Take 5 Report for the 8/11/26') === 0, txt.indexOf(rep.sentence) > 0, /Crew Size\s+16/.test(txt), /Crew members Completing Zero\s+2\s+Crew members Completing Zero\s+67/.test(txt)], [true, true, true, true]);
var html = R.formatEmailHtml(rep, cfg);
check('email html has a 4-column table', (html.match(/<tr>/g) || []).length, 5);

if (failures.length) {
    console.error('FAILED (' + failures.length + ')');
    failures.forEach(function (f) { console.error('  ' + f); });
    process.exit(1);
}
console.log('All checks passed.');
console.log('  Email Report conformance: 127 people, Maint ' + M.crewSize + '/' + M.take5s + '/' + M.ratio + '/' + M.zeros +
    ' · Ops ' + O.crewSize + '/' + O.take5s + '/' + O.ratio + '/' + O.zeros + ' · zeros ' + rep.zeroNames.length);
console.log('  9 Nov Site Diary capture under site rules: included ' + capRep.totals.included + ' (Maint ' + capRep.groups.Maintenance.crewSize +
    ', Ops ' + capRep.groups.Operations.crewSize + ') · not required ' + capRep.totals.notRequired + ' · optional excluded ' + capRep.totals.optionalExcluded +
    ' · zeros ' + capRep.totals.zeros + ' · compliance ' + capRep.totals.compliancePct + '% at min ' + capRep.minPerDay);
