#!/usr/bin/env node
/*
 * Builds the self-contained browser report page from the template, inlining
 * the three shared modules, the site config and the anonymised example roster.
 *
 *   node tools/build-report-page.js            -> dist/take5-report.html (artifact form: no document wrapper)
 *                                                 dist/take5-report.standalone.html (double-click form)
 *
 * SheetJS is loaded from cdnjs at run time, so the page needs internet for
 * that one script; everything else is inside the file.
 */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

var tpl = read('tools/report-page.template.html');
var cfg = JSON.parse(read('config/site-10265.json'));
var fx = JSON.parse(read('test/fixtures/capture-2026-11-09.json'));
var sample = { rows: fx.rows.map(function (r) { return { Name: r.Name, Gender: r.Gender, Role: r.Role, Crew: r.Crew, Company: r.Company, TagCount: r.TagCount, Minimum: fx.minPerDayOnServer, Status: r.Status }; }),
               date: '2026-11-09', summaryLine: fx.summaryLine, serverMin: fx.minPerDayOnServer };
function safeJson(o) { return JSON.stringify(o).replace(/<\//g, '<\\/'); }
function safeJs(s) { return s.replace(/<\/script/gi, '<\\/script'); }

var out = tpl
    .replace('/*@@SITE_REPORT@@*/', function () { return safeJs(read('src/take5-site-report.js')); })
    .replace('/*@@VISUALS@@*/', function () { return safeJs(read('src/take5-visuals.js')); })
    .replace('/*@@WORKBOOKS@@*/', function () { return safeJs(read('src/take5-workbooks.js')); })
    .replace('/*@@CONFIG@@*/', function () { return safeJson(cfg); })
    .replace('/*@@SAMPLE@@*/', function () { return safeJson(sample); });

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/take5-report.html'), out);
fs.writeFileSync(path.join(ROOT, 'dist/take5-report.standalone.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + out + '</body></html>');
console.log('built dist/take5-report.html (' + Math.round(out.length / 1024) + ' KB) and dist/take5-report.standalone.html');
