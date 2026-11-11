#!/usr/bin/env node
/*
 * Builds the single Take 5 page: the Site Diary Take 5 Compliance page mock
 * (the proposed take5.js and its modules against a fake server, with the
 * anonymised 9 Nov roster), plus the Daily HSE Stats section
 * (src/daily-hse-stats.*) behind the left-menu switch.
 *
 *   node tools/build-page.js  -> dist/take5.html (artifact form: no document wrapper)
 *                                dist/take5.standalone.html (double-click form)
 *
 * jQuery loads from cdnjs at run time; everything else is inline.
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function safeJs(s) { return s.replace(/<\/script/gi, '<\\/script'); }
function safeJson(o) { return JSON.stringify(o).replace(/<\//g, '<\\/'); }

var fx = JSON.parse(read('test/fixtures/capture-2026-11-09.json'));
// the fake server's roster (what GetCapture returns)
var sample = { rows: fx.rows.map(function (r) { return { EmployeeId: r.EmployeeId, Name: r.Name, Gender: r.Gender, Role: r.Role, Crew: r.Crew, Company: r.Company, TagCount: r.TagCount }; }) };
var out = read('tools/take5-page.template.html')
    .replace('/*@@SAMPLE@@*/', function () { return safeJson(sample); })
    .replace('/*@@SITE_REPORT@@*/', function () { return safeJs(read('src/take5-site-report.js')); })
    .replace('/*@@VISUALS@@*/', function () { return safeJs(read('src/take5-visuals.js')); })
    .replace('/*@@CONFIG@@*/', function () { return safeJson(JSON.parse(read('config/site-10265.json'))); })
    .replace('/*@@HSE_JS@@*/', function () { return safeJs(read('src/daily-hse-stats.js')); })
    .replace('/*@@HSE_DATA@@*/', function () { return safeJson(JSON.parse(read('src/daily-hse-stats.data.json'))); })
    .replace('/*@@HSE_CSS@@*/', function () { return safeJson(read('src/daily-hse-stats.css')); })
    .replace('/*@@TAKE5@@*/', function () { return safeJs(read('src/take5.js')); });
if (/\/\*@@\w+@@\*\//.test(out)) throw new Error('unfilled placeholder: ' + out.match(/\/\*@@\w+@@\*\//)[0]);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/take5.html'), out);
fs.writeFileSync(path.join(ROOT, 'dist/take5.standalone.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + out + '</body></html>');
console.log('built dist/take5.html (' + Math.round(out.length / 1024) + ' KB) and dist/take5.standalone.html');
