#!/usr/bin/env node
/*
 * Builds the Site Diary Take 5 page mock: the proposed take5.js and its two
 * modules running against a fake server, with the anonymised 9 Nov roster.
 *
 *   node tools/build-mock-page.js  -> dist/take5-mock.html (artifact form)
 *                                     dist/take5-mock.standalone.html (open-the-file form)
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function safeJs(s) { return s.replace(/<\/script/gi, '<\\/script'); }
function safeJson(o) { return JSON.stringify(o).replace(/<\//g, '<\\/'); }

var fx = JSON.parse(read('test/fixtures/capture-2026-11-09.json'));
var sample = { rows: fx.rows.map(function (r) { return { EmployeeId: r.EmployeeId, Name: r.Name, Gender: r.Gender, Role: r.Role, Crew: r.Crew, Company: r.Company, TagCount: r.TagCount }; }) };
var out = read('tools/mock-page.template.html')
    .replace('/*@@SAMPLE@@*/', function () { return safeJson(sample); })
    .replace('/*@@SITE_REPORT@@*/', function () { return safeJs(read('src/take5-site-report.js')); })
    .replace('/*@@VISUALS@@*/', function () { return safeJs(read('src/take5-visuals.js')); })
    .replace('/*@@CONFIG@@*/', function () { return safeJson(JSON.parse(read('config/site-10265.json'))); })
    .replace('/*@@TAKE5@@*/', function () { return safeJs(read('src/take5.js')); });
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/take5-mock.html'), out);
fs.writeFileSync(path.join(ROOT, 'dist/take5-mock.standalone.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + out + '</body></html>');
console.log('built dist/take5-mock.html (' + Math.round(out.length / 1024) + ' KB)');
