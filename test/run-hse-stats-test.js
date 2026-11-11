#!/usr/bin/env node
/* Browser check of the Daily HSE Stats section inside the built preview page. */
'use strict';
var path = require('path'), { chromium } = require('playwright');
var ROOT = path.join(__dirname, '..'), failed = 0;
function ok(name, cond, detail) { if (cond) console.log('  ok   ' + name); else { failed++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } }
(async function () {
    var browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1300, height: 950 } }), errors = [];
    page.on('pageerror', function (e) { errors.push(e.message); });
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
    ok('no uncaught page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    if (failed) { console.log('\nFAILED: ' + failed + ' check(s)'); process.exit(1); }
    console.log('\nAll Daily HSE Stats checks passed.');
}()).catch(function (e) { console.error(e); process.exit(1); });
