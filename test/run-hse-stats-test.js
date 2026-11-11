#!/usr/bin/env node
/* Browser check of the Daily HSE Stats section inside the built preview page. */
'use strict';
var path = require('path'), { chromium } = require('playwright');
var ROOT = path.join(__dirname, '..'), failed = 0;
function ok(name, cond, detail) { if (cond) console.log('  ok   ' + name); else { failed++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } }
(async function () {
    var browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1300, height: 950 } }), errors = [];
    page.on('pageerror', function (e) { errors.push(e.message); });
    await page.route('**/xlsx.full.min.js', function (r) { r.fulfill({ path: path.join(ROOT, 'node_modules/xlsx/dist/xlsx.full.min.js') }); });
    await page.route('**/jquery.min.js', function (r) { r.fulfill({ path: path.join(ROOT, 'node_modules/jquery/dist/jquery.min.js') }); });
    await page.goto('file://' + path.join(ROOT, 'dist/take5.standalone.html'));
    await page.waitForSelector('#t5List .wrow');
    console.log('\nDaily HSE Stats');
    await page.click('.side [data-view="hse"]');
    var host = page.locator('#hseMount');
    await host.locator('.banner__title').waitFor();
    ok('section title', (await host.locator('.banner__title').textContent()) === 'Daily HSE Stats');
    ok('Take 5 page is hidden while the section is open', await page.locator('#viewPage').isHidden());
    ok('three views', (await host.locator('.banner .seg').allTextContents()).join('|') === 'Daily Capture|Dashboard|Early Warning');
    ok('no second sidebar or sign-in bar inside the section', (await host.locator('.sidebar, .topbar').count()) === 0);
    ok('no personal names in the section', !/Manny|Kegin|@decmil/i.test(await page.evaluate(function () { return document.getElementById('hseMount').shadowRoot.innerHTML; })));
    var rows = await host.locator('.cap__row').count();
    ok('capture lists every metric', rows === 32, String(rows));
    var first = host.locator('.cap__row').first(), mtdBefore = Number((await first.locator('.cell-mtd').textContent()).replace(/,/g, ''));
    var before = Number(await first.locator('input.num').inputValue() || 0);
    await first.locator('input.num').fill(String(before + 5)); await first.locator('input.num').blur();
    var mtdAfter = Number((await host.locator('.cap__row').first().locator('.cell-mtd').textContent()).replace(/,/g, ''));
    ok('typing a number updates month to date', mtdAfter === mtdBefore + 5, mtdBefore + ' -> ' + mtdAfter);
    ok('typed numbers are kept in this browser', await page.evaluate(function () { return Object.keys(JSON.parse(localStorage.getItem('dailyHseStats.edits') || '{}')).length === 1; }));
    await host.locator('.banner .seg', { hasText: 'Dashboard' }).click();
    ok('dashboard renders', (await host.locator('main.page').count()) === 1 && (await host.locator('svg').count()) > 0);
    await host.locator('.banner .seg', { hasText: 'Early Warning' }).click();
    ok('early warning renders', (await host.locator('main.page').textContent()).length > 200);
    await host.locator('[data-action="openReport"]').first().click();
    ok('daily report opens', (await host.locator('#reportSheet').count()) === 1);
    await host.locator('button.btn--close').click();
    ok('daily report closes', (await host.locator('#reportSheet').count()) === 0);
    await page.click('.side [data-view="page"]');
    ok('switching back shows the Take 5 page', await page.locator('#viewPage').isVisible() && await page.locator('#viewHse').isHidden());
    ok('Take 5 styles are untouched by the section', (await page.locator('#t5 .tab.on').textContent()) === 'Daily Capture');
    console.log('\nLeadership KPIs');
    var XLSX = require('xlsx'), os = require('os'), fs = require('fs');
    var sheet = XLSX.utils.aoa_to_sheet([['Type', 'Doc No', 'Start Date', 'Created By', 'Template'],
        ['LIF', 1, '10/19/2026', 'alex.sample', 'pthaReview'], ['LIF', 2, '10/20/2026', 'alex.sample', 'qsiRecord'], ['AREA_INSP', 3, '10/21/2026', 'alex.sample', 'generalInspection'],
        ['LIF', 4, '10/22/2026', 'jo.example', 'qsiRecord'], ['SRA', 5, '10/22/2026', 'jo.example', 'journey']]);
    var book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Export');
    var tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-')), 'synthetic-export.xlsx'); XLSX.writeFile(book, tmp);
    await page.click('.side [data-view="kpi"]');
    await page.waitForSelector('#lkEmpty');
    await page.setInputFiles('#lkFile', tmp);
    await page.waitForSelector('#lkTable');
    ok('export is recognised and counted', /SAI 360 · 5 documents, 4 count towards a KPI, 1 are other/.test(await page.locator('#lkSummary').textContent()), await page.locator('#lkSummary').textContent());
    ok('as-at date defaults to the latest document', (await page.inputValue('#lkAsAt')) === '2026-10-22');
    ok('people with no group are flagged', /2 people in the export have no leadership group/.test(await page.locator('#lkCheck').textContent()));
    await page.locator('#lkTable tbody tr', { hasText: 'Alex Sample' }).locator('select').selectOption('Superintendents');
    var alexRow = await page.locator('#lkTable tbody tr', { hasText: 'Alex Sample' }).locator('td').allTextContents();
    ok('choosing a group applies its targets', alexRow[2] === '1 / 1' && alexRow[3] === '1 / 1' && alexRow[5] === '1 / 1' && alexRow[6] === 'Complete', alexRow.slice(2, 8).join(' | '));
    await page.locator('#lkTable tbody tr', { hasText: 'Jo Example' }).locator('select').selectOption('');
    ok('"Not a leader" hides the person', (await page.locator('#lkTable tbody tr').count()) === 1);
    ok('group choices are remembered', await page.evaluate(function () { return Object.keys(JSON.parse(localStorage.getItem('leadershipKpi.groups'))).length === 2; }));
    await page.click('.side [data-view="page"]');
    ok('no uncaught page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    if (failed) { console.log('\nFAILED: ' + failed + ' check(s)'); process.exit(1); }
    console.log('\nAll Daily HSE Stats checks passed.');
}()).catch(function (e) { console.error(e); process.exit(1); });
