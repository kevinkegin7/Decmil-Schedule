#!/usr/bin/env node
/*
 * take5-report — build the daily Take 5 management email from a Site Diary
 * capture export, optionally reconciled against the hand-kept register.
 *
 *   node tools/take5-report.js <Take5_Capture_YYYY-MM-DD.xlsx>
 *        [--register <Decmil_Take_5_and_KPI_register.xlsm>]
 *        [--date YYYY-MM-DD] [--config config/site-10265.json]
 *        [--counts sitediary|register] [--html <out.html>] [--json <out.json>]
 *        [--verbose]
 *
 * What it does
 *   1. Reads the capture list (Name, Gender, Role, Crew, Company, Tags, Minimum, Status).
 *   2. Applies the site rules from the config (the same lists the register's
 *      Email Report sheet uses) with the shared module src/take5-site-report.js.
 *   3. If a register is given, looks each person up in its "TAKE 5's" sheet the
 *      way Email Report!Q5 does (exact name, then first word + last word) and reads
 *      their count for the date from the matching row-3 date column.
 *   4. Prints the email (sentence + Maintenance/Operations table), the Daily Log
 *      row, the warnings the register's own banner would raise, and a per-person
 *      list of every disagreement between Site Diary's tags and the register.
 *
 * Counts default to the register when one is supplied (that is what the team
 * reports from today), otherwise to Site Diary's tags. --counts overrides.
 * Nothing is written to either workbook.
 */
'use strict';
var fs = require('fs'), path = require('path');
var XLSX = require('xlsx');
var R = require('../src/take5-site-report');

// ------------------------------------------------------------------ args
var args = process.argv.slice(2), opts = { verbose: false };
var positional = [];
for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--verbose' || a === '-v') opts.verbose = true;
    else if (a.indexOf('--') === 0) { opts[a.slice(2)] = args[i + 1]; i++; }
    else positional.push(a);
}
if (!positional[0]) {
    console.error('usage: take5-report <capture.xlsx> [--register <register.xlsm>] [--date YYYY-MM-DD] [--config <site.json>] [--counts sitediary|register] [--html out.html] [--json out.json] [--verbose]');
    process.exit(2);
}
var capturePath = positional[0];
var configPath = opts.config || path.join(__dirname, '..', 'config', 'site-10265.json');
var cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// ------------------------------------------------------------------ helpers
function pad(n) { return ('0' + n).slice(-2); }
function serialToIso(serial) {
    var d = XLSX.SSF.parse_date_code(serial);
    return d ? d.y + '-' + pad(d.m) + '-' + pad(d.d) : null;
}
var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseLongDate(s) {            // "Monday, 9 Nov 2026" -> 2026-11-09
    var m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(String(s || ''));
    if (!m) return null;
    var mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
    return mon ? m[3] + '-' + pad(mon) + '-' + pad(+m[1]) : null;
}
function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function firstLast(s) {
    var t = norm(s).split(' ');
    return t.length >= 2 ? t[0] + ' ' + t[t.length - 1] : norm(s);
}
function stripNick(s) { return norm(String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\b[a-z]\.\s*/gi, ' ')); }

// ------------------------------------------------------------------ capture
var cwb = XLSX.readFile(capturePath, { raw: true });
var cws = cwb.Sheets[cwb.SheetNames[0]];
var crows = XLSX.utils.sheet_to_json(cws, { header: 1, defval: null, raw: true });
var hdrIdx = -1;
for (var r = 0; r < Math.min(crows.length, 20); r++) {
    if (crows[r] && String(crows[r][0]).trim() === 'Name') { hdrIdx = r; break; }
}
if (hdrIdx < 0) { console.error('Could not find the header row (a row starting with "Name") in ' + capturePath); process.exit(1); }
var hdr = crows[hdrIdx].map(function (h) { return String(h || '').trim(); });
function col(name) { var k = hdr.indexOf(name); return k; }
var iName = col('Name'), iGender = col('Gender'), iRole = col('Role'), iCrew = col('Crew'), iCompany = col('Company'), iTags = col('Tags'), iMin = col('Minimum'), iStatus = col('Status');
var capture = [];
for (r = hdrIdx + 1; r < crows.length; r++) {
    var row = crows[r];
    if (!row || row[iName] == null || String(row[iName]).trim() === '') continue;
    capture.push({ Name: String(row[iName]).trim(), Gender: row[iGender], Role: String(row[iRole] || '').trim(), Crew: String(row[iCrew] || '').trim(),
                   Company: String(row[iCompany] || '').trim(), TagCount: Number(row[iTags] || 0), Minimum: row[iMin], Status: row[iStatus] });
}
var captureDate = opts.date || parseLongDate(crows[1] && crows[1][0]) || (function () {
    var m = /(\d{4}-\d{2}-\d{2})/.exec(path.basename(capturePath)); return m ? m[1] : null;
}());
if (!captureDate) { console.error('Could not determine the capture date; pass --date YYYY-MM-DD'); process.exit(1); }
var summaryLine = String(crows[2] && crows[2][0] || '');
var serverMin = capture.length ? Number(capture[0].Minimum) : null;

// ------------------------------------------------------------------ register
var reg = null;
if (opts.register) {
    var rwb = XLSX.readFile(opts.register, { raw: true, bookVBA: false });
    var rname = rwb.SheetNames.filter(function (n) { return /take ?5/i.test(n) && !/capture/i.test(n); })[0];
    if (!rname) { console.error('No "TAKE 5\'s" sheet found in ' + opts.register + ' (sheets: ' + rwb.SheetNames.join(', ') + ')'); process.exit(1); }
    var rws = rwb.Sheets[rname];
    var rrows = XLSX.utils.sheet_to_json(rws, { header: 1, defval: null, raw: true });
    var dateRow = rrows[2] || [];
    var dateCols = {};                               // iso -> first column index (like MATCH, first hit wins)
    for (var c = 6; c < dateRow.length; c++) {
        var v = dateRow[c];
        var iso = typeof v === 'number' ? serialToIso(v) : (v instanceof Date ? v.toISOString().slice(0, 10) : null);
        if (iso && dateCols[iso] === undefined) dateCols[iso] = c;
    }
    var people = [];
    for (r = 3; r < rrows.length; r++) {
        var rr = rrows[r]; if (!rr) continue;
        var full = String(rr[0] || '').trim();
        if (!full) full = (String(rr[1] || '') + ' ' + String(rr[2] || '')).trim();
        if (!full) continue;
        people.push({ row: r + 1, name: full, role: rr[3], company: rr[4], crew: rr[5], status: rr[rrows[2].length > 336 ? 336 : rr.length - 1], cells: rr });
    }
    var byExact = {}, byFirstLast = {}, byStripped = {};
    people.forEach(function (p) {
        var k = norm(p.name); if (!byExact[k]) byExact[k] = p;
        var fl = firstLast(p.name); (byFirstLast[fl] = byFirstLast[fl] || []).push(p);
        var st = stripNick(p.name); if (!byStripped[st]) byStripped[st] = p;
    });
    function findPerson(name) {
        var k = norm(name);
        if (byExact[k]) return { p: byExact[k], how: 'exact' };
        var fl = byFirstLast[firstLast(name)];
        if (fl && fl.length === 1) return { p: fl[0], how: 'first+last' };
        if (fl && fl.length > 1) return { p: fl[0], how: 'first+last (ambiguous: ' + fl.map(function (x) { return x.name; }).join(' | ') + ')' };
        var st = byStripped[stripNick(name)];
        if (st) return { p: st, how: 'normalised' };
        return null;
    }
    var dcol = dateCols[captureDate];
    reg = { sheet: rname, people: people, dateCols: dateCols, dateCol: dcol, findPerson: findPerson,
            dayEntries: 0, dayTotal: 0, dayText: 0, firstDate: Object.keys(dateCols).sort()[0], lastDate: Object.keys(dateCols).sort().slice(-1)[0] };
    if (dcol !== undefined) {
        people.forEach(function (p) {
            var v = p.cells[dcol];
            if (v === null || v === undefined || v === '') return;
            if (typeof v === 'number') { reg.dayEntries++; reg.dayTotal += v; }
            else reg.dayText++;
        });
    }
}

// ------------------------------------------------------------------ build
var countSource = opts.counts || (reg ? 'register' : 'sitediary');
if (countSource === 'register' && !reg) { console.error('--counts register needs --register'); process.exit(1); }
var lookups = {};
function registerCount(p) {
    if (!reg) return undefined;
    var f = reg.findPerson(p.name);
    lookups[p.name] = f ? { row: f.p.row, name: f.p.name, how: f.how } : null;
    if (!f) return null;
    if (reg.dateCol === undefined) return 0;
    var v = f.p.cells[reg.dateCol];
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    lookups[p.name].text = String(v);
    return 0;                                        // the sheet's IFERROR(...+0, 0) turns text into 0
}
var report = R.buildReport(capture, cfg, { date: captureDate, tagsFor: countSource === 'register' ? registerCount : undefined });
if (countSource !== 'register' && reg) capture.forEach(function (c) { registerCount({ name: c.Name }); });   // populate lookups anyway

// ------------------------------------------------------------------ warnings
var warnings = [];
if (serverMin !== null && serverMin !== cfg.minPerDay)
    warnings.push('Site Diary exported Minimum/day = ' + serverMin + ' but the site rule is ' + cfg.minPerDay + '/day; its "On track" and "Compliance" figures (' + summaryLine.replace(/\s+/g, ' ') + ') are not comparable with this report.');
var exactMin = capture.filter(function (c) { return c.TagCount === cfg.minPerDay; }).length;
var withTags = capture.filter(function (c) { return c.TagCount > 0; }).length;
if (withTags && exactMin / withTags > 0.85)
    warnings.push(exactMin + ' of the ' + withTags + ' people with Site Diary tags have exactly ' + cfg.minPerDay + ' — consistent with the "Set ' + cfg.minPerDay + '" button being used as a submitted/not-submitted tick rather than a real count.');
if (reg) {
    if (reg.dateCol === undefined) warnings.push('The register has no column for ' + captureDate + ' (it covers ' + reg.firstDate + ' to ' + reg.lastDate + ').');
    else if (reg.dayEntries === 0) warnings.push('CHECK FIRST: the register column for ' + captureDate + ' is empty — nothing has been typed for this date yet, so a register-based report would show everyone at zero.');
    else if (reg.dayEntries < report.totals.included * 0.6) warnings.push('The register column for ' + captureDate + ' has only ' + reg.dayEntries + ' entries for ' + report.totals.included + ' included people — data entry looks incomplete.');
    if (reg.dayText) warnings.push(reg.dayText + ' register cell(s) for this date hold text (e.g. "Sick") which the Email Report counts as 0.');
}
var notReqWithTags = report.notRequired.filter(function (p) { return p.tags > 0; }).length;
if (notReqWithTags) warnings.push(notReqWithTags + ' Not-required people have Site Diary tags; they are excluded from the figures.');

// ------------------------------------------------------------------ discrepancies
var discrepancies = [], notInRegister = [], otherRegister = [];
if (reg) {
    report.people.forEach(function (p) {
        var lk = lookups[p.name];
        var sd = Number(capture.filter(function (c) { return c.Name === p.name; })[0].TagCount || 0);
        if (!lk) { notInRegister.push({ name: p.name, role: p.role, crew: p.crew, status: p.cls.status, sd: sd }); return; }
        if (reg.dateCol === undefined) return;
        var v = reg.people.filter(function (x) { return x.row === lk.row; })[0].cells[reg.dateCol];
        var regn = (typeof v === 'number') ? v : (v === null || v === undefined || v === '' ? null : 'text:' + v);
        if ((regn === null ? 0 : (typeof regn === 'number' ? regn : 0)) !== sd || typeof regn === 'string')
            discrepancies.push({ name: p.name, role: p.role, crew: p.crew, status: p.cls.status, included: p.cls.included, siteDiary: sd, register: regn === null ? '(blank)' : regn, match: lk.how });
    });
    // register entries for the date from people who are NOT on the Site Diary list
    if (reg.dateCol !== undefined) {
        var onList = {}; Object.keys(lookups).forEach(function (n) { if (lookups[n]) onList[lookups[n].row] = true; });
        reg.people.forEach(function (p) {
            var v = p.cells[reg.dateCol];
            if (typeof v === 'number' && v > 0 && !onList[p.row]) otherRegister.push({ name: p.name, role: p.role, crew: p.crew, count: v });
        });
    }
}

// ------------------------------------------------------------------ output
var out = [];
out.push('TAKE 5 DAILY REPORT — ' + cfg.projectName + ' (' + cfg.project + ') — ' + captureDate);
out.push('Capture: ' + path.basename(capturePath) + ' (' + capture.length + ' people)' + (reg ? ' · Register: ' + path.basename(opts.register) + ' [' + reg.sheet + ']' : ''));
out.push('Counts from: ' + (countSource === 'register' ? 'the register (paper counts typed into TAKE 5\'s)' : 'Site Diary tags') + ' · site minimum ' + cfg.minPerDay + '/day');
if (warnings.length) { out.push(''); out.push('WARNINGS'); warnings.forEach(function (w) { out.push('  ! ' + w); }); }
out.push(''); out.push('EMAIL'); out.push('-----');
out.push(R.formatEmail(report, cfg));
out.push('');
out.push('Daily Log row: ' + report.dailyLogRow.join(' | '));
out.push('Included ' + report.totals.included + ' (' + report.groupOrder.map(function (g) { return g + ' ' + report.groups[g].crewSize; }).join(', ') + ') · Not required ' + report.totals.notRequired + ' · Optional excluded ' + report.totals.optionalExcluded +
    (report.totals.notInRegister ? ' · Not in register ' + report.totals.notInRegister : '') + ' · In range ' + report.totals.inRange + ' · Below min ' + report.totals.belowMin + ' · Zero ' + report.totals.zeros + ' · compliance ' + report.totals.compliancePct + '%');
if (reg) {
    out.push(''); out.push('RECONCILIATION — Site Diary tags vs register count for ' + captureDate); out.push('------------------------------------------------------------');
    if (reg.dateCol !== undefined) out.push('Register column for the date: ' + reg.dayEntries + ' numeric entries, total ' + reg.dayTotal + (reg.dayText ? ', ' + reg.dayText + ' text' : '') + ' · Site Diary: ' + withTags + ' people with tags, total ' + capture.reduce(function (a, c) { return a + c.TagCount; }, 0));
    if (discrepancies.length) {
        out.push(discrepancies.length + ' people differ:');
        discrepancies.forEach(function (d) { out.push('  ' + d.name.padEnd(30) + (d.role || '').padEnd(32) + (d.crew || '').padEnd(22) + 'SD ' + String(d.siteDiary).padStart(2) + '  reg ' + String(d.register).padStart(7) + (d.included ? '' : '   [' + d.status + ']') + (d.match !== 'exact' ? '   match: ' + d.match : '')); });
    } else out.push('No per-person differences.');
    if (notInRegister.length) {
        out.push(''); out.push(notInRegister.length + ' on the Site Diary list but not in the register' + (notInRegister.every(function (n) { return !/No Take 5|In range|Below min/.test(n.status); }) ? ' (all excluded by the site rules):' : ':'));
        notInRegister.forEach(function (n) { out.push('  ' + n.name.padEnd(30) + (n.role || '').padEnd(32) + (n.crew || '').padEnd(22) + '[' + n.status + ']' + (n.sd ? '  SD tags ' + n.sd : '')); });
    }
    if (otherRegister.length) {
        out.push(''); out.push(otherRegister.length + ' register entries for this date from people NOT on the Site Diary list (the Stats sheet\'s "Other / unassigned Take 5s" = ' + otherRegister.reduce(function (a, p) { return a + p.count; }, 0) + '):');
        otherRegister.forEach(function (p) { out.push('  ' + p.name.padEnd(30) + String(p.role || '').padEnd(32) + String(p.crew || '').padEnd(22) + 'count ' + p.count); });
    }
}
if (opts.verbose) {
    out.push(''); out.push('CLASSIFICATION'); out.push('--------------');
    report.people.forEach(function (p) { out.push('  ' + p.name.padEnd(30) + p.role.padEnd(32) + p.crew.padEnd(22) + String(p.tags).padStart(2) + '  ' + (p.cls.group || '').padEnd(12) + p.cls.status.padEnd(16) + p.cls.reason); });
}
console.log(out.join('\n'));
if (opts.html) {
    var V = require('../src/take5-visuals');
    // Trend: the register's Daily Log sheet holds what management already receives
    // each day (crew size, Take 5s and zeros per group). Plot Take 5s as a share of
    // target (crew × minimum) for the 13 logged days before the report date, then
    // today's figure from this report. Falls back to a register proxy without it.
    var trend = null, trendNote = '';
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function dayLabel(iso) { var d = new Date(iso + 'T00:00:00Z'); return DOW[d.getUTCDay()] + ' ' + d.getUTCDate(); }
    if (reg) {
        var logName = rwb.SheetNames.filter(function (n) { return /daily log/i.test(n); })[0];
        var logDays = {};
        if (logName) {
            XLSX.utils.sheet_to_json(rwb.Sheets[logName], { header: 1, defval: null, raw: true }).forEach(function (row, idx) {
                if (idx < 4 || typeof row[0] !== 'number') return;      // row 3 is the live formula row; history starts below the header
                var iso = serialToIso(row[0]), crew = Number(row[1] || 0) + Number(row[4] || 0), t5 = Number(row[2] || 0) + Number(row[5] || 0);
                if (iso && crew > 0) logDays[iso] = { pct: Math.round(t5 / (crew * cfg.minPerDay) * 100), note: t5 + ' Take 5s, ' + crew + ' crew' };
            });
        }
        var logged = Object.keys(logDays).filter(function (d) { return d < captureDate; }).sort().slice(-13);
        if (logged.length >= 2) {
            trend = logged.map(function (d) { return { label: dayLabel(d), pct: logDays[d].pct, note: logDays[d].note }; });
            var inc = report.totals.included;
            trend.push({ label: dayLabel(captureDate), pct: inc ? Math.round(report.totals.take5s / (inc * cfg.minPerDay) * 100) : null, note: report.totals.take5s + ' Take 5s, ' + inc + ' crew (this report)' });
            trendNote = 'Take 5s as a share of target (crew × ' + cfg.minPerDay + ') from the Daily Log as pasted each day, today from this report';
        } else {
            trend = [];
            var base = new Date(captureDate + 'T00:00:00Z');
            for (var k = 13; k >= 0; k--) {
                var d = new Date(base.getTime() - k * 86400000), iso = d.toISOString().slice(0, 10);
                var c = reg.dateCols[iso], n = 0, ok = 0;
                if (c !== undefined) reg.people.forEach(function (p) { var v = p.cells[c]; if (typeof v === 'number') { n++; if (v >= cfg.minPerDay) ok++; } });
                trend.push({ label: dayLabel(iso), pct: n >= 5 ? Math.round(ok / n * 100) : null, note: n ? n + ' recorded' : 'no entries' });
            }
            trendNote = 'people with a register entry that day, share at ' + cfg.minPerDay + '+';
        }
    }
    var cardHtml = V.renderCard(report, cfg, {
        width: 720,
        sourceNote: 'Counts: ' + (countSource === 'register' ? 'paper register' : 'Site Diary tags') + ' · ' + captureDate,
        trend: trend, trendNote: trendNote
    });
    var page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Take 5 Report ' + report.dateLabel + '</title>' +
        '<style>:root{color-scheme:light}body{margin:0;padding:24px;background:#f9f9f7;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b0b0b}' +
        '.wrap{max-width:760px;margin:0 auto}h2{font-size:14px;margin:28px 0 8px}pre{white-space:pre-wrap;font:12.5px/1.5 Consolas,Menlo,monospace;background:#fcfcfb;border:1px solid rgba(11,11,11,.1);border-radius:8px;padding:14px}' +
        '.warn{font-size:13px;color:#52514e;background:#fff7e0;border:1px solid #f0d58a;border-radius:8px;padding:10px 14px;margin:0 0 18px}' +
        'table.t5t{border-collapse:collapse;font-size:12.5px;width:100%}table.t5t th,table.t5t td{border:1px solid #e1e0d9;padding:4px 8px;text-align:left}table.t5t th{background:#f0efec}</style></head><body><div class="wrap">' +
        (warnings.length ? '<div class="warn"><b>Check first</b><ul style="margin:6px 0 0;padding-left:18px">' + warnings.map(function (w) { return '<li>' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>'; }).join('') + '</ul></div>' : '') +
        cardHtml +
        '<h2>Email text</h2><pre>' + R.formatEmail(report, cfg).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>' +
        '<h2>Email, formatted for Outlook</h2><div style="background:#fcfcfb;border:1px solid rgba(11,11,11,.1);border-radius:8px;padding:14px">' + V.emailHtml(report, cfg) + '</div>' +
        '<h2>Table view — every person</h2><table class="t5t"><tr><th>Name</th><th>Role</th><th>Crew</th><th>Count</th><th>Group</th><th>Status</th><th>Reason</th></tr>' +
        report.people.map(function (p) { function e(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); } return '<tr><td>' + e(p.name) + '</td><td>' + e(p.role) + '</td><td>' + e(p.crew) + '</td><td>' + p.tags + '</td><td>' + e(p.cls.group) + '</td><td>' + e(p.cls.status) + '</td><td>' + e(p.cls.reason) + '</td></tr>'; }).join('') +
        '</table></div></body></html>';
    fs.writeFileSync(opts.html, page); console.error('HTML written to ' + opts.html);
}
if (opts.json) { fs.writeFileSync(opts.json, JSON.stringify({ date: captureDate, countSource: countSource, warnings: warnings, report: report, discrepancies: discrepancies, notInRegister: notInRegister, otherRegister: otherRegister }, null, 1)); console.error('JSON written to ' + opts.json); }
