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
 * Reading and analysis live in src/take5-workbooks.js (shared with the
 * browser page); this file is the command-line front end. Counts default to
 * the register when one is supplied, otherwise to Site Diary's tags. Nothing
 * is written to either workbook.
 */
'use strict';
var fs = require('fs'), path = require('path');
var XLSX = require('xlsx');
var R = require('../src/take5-site-report');
var W = require('../src/take5-workbooks');

var args = process.argv.slice(2), opts = { verbose: false }, positional = [];
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
var cfg = JSON.parse(fs.readFileSync(opts.config || path.join(__dirname, '..', 'config', 'site-10265.json'), 'utf8'));
var capture, reg = null, A;
try {
    capture = W.parseCapture(XLSX, XLSX.readFile(positional[0], { raw: true }), path.basename(positional[0]));
    if (opts.register) reg = W.parseRegister(XLSX, XLSX.readFile(opts.register, { raw: true, bookVBA: false }));
    A = W.analyse(capture, reg, cfg, { date: opts.date, countSource: opts.counts });
} catch (e) { console.error(e.message); process.exit(1); }
var report = A.report;

function padR(s, n) { s = String(s == null ? '' : s); while (s.length < n) s += ' '; return s; }
var out = [];
out.push('TAKE 5 DAILY REPORT — ' + cfg.projectName + ' (' + cfg.project + ') — ' + A.date);
out.push('Capture: ' + path.basename(positional[0]) + ' (' + capture.rows.length + ' people)' + (reg ? ' · Register: ' + path.basename(opts.register) + ' [' + reg.sheet + ']' : ''));
out.push('Counts from: ' + (A.countSource === 'register' ? 'the register (paper counts typed into TAKE 5\'s)' : 'Site Diary tags') + ' · site minimum ' + cfg.minPerDay + '/day');
if (A.warnings.length) { out.push(''); out.push('WARNINGS'); A.warnings.forEach(function (w) { out.push('  ! ' + w); }); }
out.push(''); out.push('EMAIL'); out.push('-----');
out.push(R.formatEmail(report, cfg));
out.push('');
out.push('Daily Log row: ' + report.dailyLogRow.join(' | '));
out.push('Included ' + report.totals.included + ' (' + report.groupOrder.map(function (g) { return g + ' ' + report.groups[g].crewSize; }).join(', ') + ') · Not required ' + report.totals.notRequired + ' · Optional excluded ' + report.totals.optionalExcluded +
    (report.totals.notInRegister ? ' · Not in register ' + report.totals.notInRegister : '') + ' · In range ' + report.totals.inRange + ' · Below min ' + report.totals.belowMin + ' · Zero ' + report.totals.zeros + ' · compliance ' + report.totals.compliancePct + '%');
if (reg) {
    out.push(''); out.push('RECONCILIATION — Site Diary tags vs register count for ' + A.date); out.push('------------------------------------------------------------');
    if (A.registerDay.hasColumn) out.push('Register column for the date: ' + A.registerDay.entries + ' numeric entries, total ' + A.registerDay.total + (A.registerDay.text ? ', ' + A.registerDay.text + ' text' : '') + ' · Site Diary: ' + A.siteDiary.withTags + ' people with tags, total ' + A.siteDiary.total);
    if (A.discrepancies.length) {
        out.push(A.discrepancies.length + ' people differ:');
        A.discrepancies.forEach(function (d) { out.push('  ' + padR(d.name, 30) + padR(d.role, 32) + padR(d.crew, 22) + 'SD ' + String(d.siteDiary).padStart(2) + '  reg ' + String(d.register).padStart(7) + (d.included ? '' : '   [' + d.status + ']') + (d.match !== 'exact' ? '   match: ' + d.match : '')); });
    } else out.push('No per-person differences.');
    if (A.notInRegister.length) {
        out.push(''); out.push(A.notInRegister.length + ' on the Site Diary list but not in the register:');
        A.notInRegister.forEach(function (n) { out.push('  ' + padR(n.name, 30) + padR(n.role, 32) + padR(n.crew, 22) + '[' + n.status + ']' + (n.sd ? '  SD tags ' + n.sd : '')); });
    }
    if (A.otherRegister.length) {
        out.push(''); out.push(A.otherRegister.length + ' register entries for this date from people NOT on the Site Diary list (the Stats sheet\'s "Other / unassigned Take 5s" = ' + A.otherRegister.reduce(function (s, p) { return s + p.count; }, 0) + '):');
        A.otherRegister.forEach(function (p) { out.push('  ' + padR(p.name, 30) + padR(p.role, 32) + padR(p.crew, 22) + 'count ' + p.count); });
    }
}
if (opts.verbose) {
    out.push(''); out.push('CLASSIFICATION'); out.push('--------------');
    report.people.forEach(function (p) { out.push('  ' + padR(p.name, 30) + padR(p.role, 32) + padR(p.crew, 22) + String(p.tags).padStart(2) + '  ' + padR(p.cls.group, 12) + padR(p.cls.status, 16) + p.cls.reason); });
}
console.log(out.join('\n'));

if (opts.html) {
    var V = require('../src/take5-visuals');
    function e(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    var cardHtml = V.renderCard(report, cfg, { width: 720, sourceNote: 'Counts: ' + (A.countSource === 'register' ? 'paper register' : 'Site Diary tags') + ' · ' + A.date, trend: A.trend, trendNote: A.trendNote });
    var page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Take 5 Report ' + report.dateLabel + '</title>' +
        '<style>:root{color-scheme:light}body{margin:0;padding:24px;background:#f9f9f7;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0b0b0b}' +
        '.wrap{max-width:760px;margin:0 auto}h2{font-size:14px;margin:28px 0 8px}pre{white-space:pre-wrap;font:12.5px/1.5 Consolas,Menlo,monospace;background:#fcfcfb;border:1px solid rgba(11,11,11,.1);border-radius:8px;padding:14px}' +
        '.warn{font-size:13px;color:#52514e;background:#fff7e0;border:1px solid #f0d58a;border-radius:8px;padding:10px 14px;margin:0 0 18px}' +
        'table.t5t{border-collapse:collapse;font-size:12.5px;width:100%}table.t5t th,table.t5t td{border:1px solid #e1e0d9;padding:4px 8px;text-align:left}table.t5t th{background:#f0efec}</style></head><body><div class="wrap">' +
        (A.warnings.length ? '<div class="warn"><b>Check first</b><ul style="margin:6px 0 0;padding-left:18px">' + A.warnings.map(function (w) { return '<li>' + e(w) + '</li>'; }).join('') + '</ul></div>' : '') +
        cardHtml +
        '<h2>Email text</h2><pre>' + e(R.formatEmail(report, cfg)) + '</pre>' +
        '<h2>Email, formatted for Outlook</h2><div style="background:#fcfcfb;border:1px solid rgba(11,11,11,.1);border-radius:8px;padding:14px">' + V.emailHtml(report, cfg) + '</div>' +
        '<h2>Table view — every person</h2><table class="t5t"><tr><th>Name</th><th>Role</th><th>Crew</th><th>Count</th><th>Group</th><th>Status</th><th>Reason</th></tr>' +
        report.people.map(function (p) { return '<tr><td>' + e(p.name) + '</td><td>' + e(p.role) + '</td><td>' + e(p.crew) + '</td><td>' + p.tags + '</td><td>' + e(p.cls.group) + '</td><td>' + e(p.cls.status) + '</td><td>' + e(p.cls.reason) + '</td></tr>'; }).join('') +
        '</table></div></body></html>';
    fs.writeFileSync(opts.html, page); console.error('HTML written to ' + opts.html);
}
if (opts.json) { fs.writeFileSync(opts.json, JSON.stringify(A, null, 1)); console.error('JSON written to ' + opts.json); }
