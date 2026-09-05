/*
 * Browser tests for the patched src/take5.js.
 *
 * Serves the repo over a local HTTP server, opens test/harness.html in
 * headless Chromium and drives both tabs, asserting the numbers the page
 * shows against expectations computed from test/fixture.js with the
 * canonical classifier.
 *
 * Run:  npm test          (needs `npm install` once, for jQuery)
 * Requires Playwright's Chromium; PLAYWRIGHT_BROWSERS_PATH is honoured.
 */
'use strict';

var http = require('http'), fs = require('fs'), path = require('path');
var fixture = require('./fixture');
var Roles = require('../src/take5-role-classification');

var playwright;
try { playwright = require('playwright'); }
catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

var ROOT = path.resolve(__dirname, '..');
var MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

function serve() {
    return new Promise(function (resolve) {
        var srv = http.createServer(function (req, res) {
            var url = req.url.split('?')[0];
            var file = url === '/vendor/jquery.min.js'
                ? path.join(ROOT, 'node_modules/jquery/dist/jquery.min.js')
                : path.join(ROOT, url);
            fs.readFile(file, function (err, data) {
                if (err) { res.writeHead(404); res.end('not found: ' + url); return; }
                res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
                res.end(data);
            });
        });
        srv.listen(0, '127.0.0.1', function () { resolve({ srv: srv, port: srv.address().port }); });
    });
}

// ---------------------------------------------------------------- expectations
var MIN = fixture.MIN;
var people = fixture.people;
var required = people.filter(function (p) { return Roles.defaultRequired(p.Role); });
var exempt = people.filter(function (p) { return !Roles.defaultRequired(p.Role); });
var counted = required.filter(function (p) { return p.OnSite; });
var compliant = counted.filter(function (p) { return p.TagCount >= MIN; });
var toAction = counted.filter(function (p) { return p.TagCount < MIN; });
var pct = Math.round(compliant.length / counted.length * 100);
var exemptNames = exempt.map(function (p) { return p.Name; });

// Uncorrected figures the server sends — the page must NOT show these.
var serverDash = fixture.getDashboard();

var failures = [];
function check(desc, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    (ok ? console.log : console.error)((ok ? '  ok   ' : '  FAIL ') + desc + (ok ? '' : ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)));
    if (!ok) failures.push(desc);
}
function assert(desc, cond, detail) {
    (cond ? console.log : console.error)((cond ? '  ok   ' : '  FAIL ') + desc + (cond ? '' : (detail ? ' — ' + detail : '')));
    if (!cond) failures.push(desc);
}

(async function main() {
    var s = await serve();
    var base = 'http://127.0.0.1:' + s.port;
    var browser;
    try { browser = await playwright.chromium.launch(); }
    catch (e) { browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }); }
    var page = await browser.newPage();
    var pageErrors = [];
    page.on('pageerror', function (e) { pageErrors.push(String(e)); });

    console.log('Fixture: ' + people.length + ' people · ' + required.length + ' required · ' + exempt.length + ' exempt · ' +
        counted.length + ' required on site · expected compliance ' + pct + '%');
    console.log('Server (uncorrected) says: ' + serverDash.CompliantPct + '% · to action ' + serverDash.ToActionCount + '\n');

    async function cellNum(label) {
        return page.evaluate(function (l) {
            var cells = Array.prototype.slice.call(document.querySelectorAll('#t5Capture .cell'));
            var c = cells.filter(function (x) { return x.querySelector('.eyebrow').textContent === l; })[0];
            return c ? c.querySelector('.num').textContent : null;
        }, label);
    }

    // ------------------------------------------------------------ capture
    console.log('Daily Capture');
    await page.goto(base + '/test/harness.html');
    await page.waitForSelector('#t5List .wrow');

    check('required on site', await cellNum('Required on site'), String(counted.length));
    check('exempt (not counted)', await cellNum('Exempt (not counted)'), String(exempt.length));
    check('compliant %', await cellNum('Compliant'), pct + '%');
    check('on track', await cellNum('On track'), String(compliant.length));
    check('below minimum', await cellNum('Below minimum'), String(toAction.length));
    assert('compliant % differs from the uncorrected server figure', pct !== serverDash.CompliantPct);

    check('rows rendered', await page.locator('#t5List .wrow').count(), people.length);
    check('exempt rows marked', await page.locator('#t5List .wrow.t5-exempt').count(), exempt.length);
    check('off-site required rows marked', await page.locator('#t5List .wrow.t5-off').count(), required.length - counted.length);
    check('exempt rows have no active stepper', await page.locator('#t5List .wrow.t5-exempt [data-act="inc"]').count(), 0);
    check('required on-site rows have a stepper', await page.locator('#t5List .wrow [data-act="inc"]').count(), counted.length);
    check('off-site rows have no active stepper', await page.locator('#t5List .wrow.t5-off [data-act="inc"]').count(), 0);

    await page.click('#t5Capture .seg button[data-filter="exempt"]');
    check('Exempt filter shows only exempt rows', await page.locator('#t5List .wrow').count(), exempt.length);
    await page.click('#t5Capture .seg button[data-filter="below"]');
    check('Below-min filter excludes exempt rows', await page.locator('#t5List .wrow.t5-exempt').count(), 0);
    check('Below-min filter count', await page.locator('#t5List .wrow').count(), toAction.length);
    await page.click('#t5Capture .seg button[data-filter="all"]');

    // Override: flip the first exempt person to required, reload, confirm it stuck, flip back.
    var firstExempt = exempt[0];
    await page.click('#t5List [data-act="require"][data-id="' + firstExempt.EmployeeId + '"]');
    check('override → required count +1', await cellNum('Required on site'), String(counted.length + 1));
    check('override → exempt count −1', await cellNum('Exempt (not counted)'), String(exempt.length - 1));
    await page.reload();
    await page.waitForSelector('#t5List .wrow');
    check('override survives reload', await cellNum('Exempt (not counted)'), String(exempt.length - 1));
    assert('override row is labelled (manual)', (await page.locator('#t5List .wrow:has([data-id="' + firstExempt.EmployeeId + '"]) .meta').textContent()).indexOf('(manual)') >= 0);
    await page.click('#t5List [data-act="exempt"][data-id="' + firstExempt.EmployeeId + '"]');
    check('flip back → exempt count restored', await cellNum('Exempt (not counted)'), String(exempt.length));
    check('flip back clears the stored override', await page.evaluate(function () { return localStorage.getItem('t5RequiredOverrides'); }), '{}');

    // Stepper still saves for a required person.
    var firstReq = counted[0];
    await page.click('#t5List [data-act="inc"][data-id="' + firstReq.EmployeeId + '"]');
    var saved = await page.evaluate(function () { return window.__ajax.filter(function (a) { return a.url === '/Take5/SaveCount'; }).pop(); });
    check('stepper posts SaveCount', saved && saved.data.EmployeeId, firstReq.EmployeeId);

    // Excel export carries the Required column and everyone.
    await page.click('#t5Excel');
    var wb = await page.evaluate(function () { return window.__workbooks.pop(); });
    var hdrRow = wb.sheets[0].rows[4].cells.map(function (c) { return c.value; });
    assert('capture Excel has Required column', hdrRow.indexOf('Required') >= 0, hdrRow.join(','));
    check('capture Excel exports every person', wb.sheets[0].rows.length - 5, people.length);
    var exportedExempt = wb.sheets[0].rows.slice(5).filter(function (r) { return r.cells[5].value === 'No'; }).length;
    check('capture Excel marks exempt as Required=No', exportedExempt, exempt.length);

    // ---------------------------------------------------------- dashboard
    console.log('\nDashboard');
    await page.click('#t5 .tab[data-tab="dashboard"]');
    await page.waitForSelector('#t5HeroPct');

    check('hero compliance %', await page.locator('#t5HeroPct').textContent(), pct + '%');
    check('hero worker-days', await page.locator('#t5HeroBig').textContent(), compliant.length + ' of ' + counted.length + ' worker-days');
    check('to action (required only)', await page.locator('#t5ActionCount').textContent(), String(toAction.length));
    assert('to action differs from the uncorrected server figure', toAction.length !== serverDash.ToActionCount);

    var kpis = await page.evaluate(function () {
        return Array.prototype.slice.call(document.querySelectorAll('.t5-kpi')).map(function (k) {
            return { l: k.querySelector('.t5-kpi-l').textContent, v: k.querySelector('.t5-kpi-v').textContent, s: k.querySelector('.t5-kpi-s').textContent };
        });
    });
    check('KPI on site in range', kpis[0].v, String(counted.length));
    assert('KPI shows exempt count', kpis[0].s.indexOf(exempt.length + ' exempt not counted') === 0, kpis[0].s);
    // Tags count wherever they were logged, so the sum is over every required
    // person, not only those on site — matching the original page's behaviour.
    var reqTags = required.reduce(function (a, p) { return a + p.TagCount; }, 0);
    check('KPI tags this week (required only)', kpis[2].v, String(reqTags));
    check('KPI avg per worker-day', kpis[3].v, (reqTags / counted.length).toFixed(1));

    var actionNames = await page.evaluate(function () {
        return Array.prototype.slice.call(document.querySelectorAll('#t5ActionRows .lrow .nm')).map(function (n) { return n.textContent; });
    });
    check('action list length', actionNames.length, toAction.length);
    assert('action list contains no exempt person', !actionNames.some(function (n) { return exemptNames.indexOf(n) >= 0; }));
    assert('action list resolved entries without EmployeeId (name join)',
        toAction.some(function (p) { return p.EmployeeId % 2 === 1 && actionNames.indexOf(p.Name) >= 0; }));

    // Crew rollup: no Site Office crews (all exempt), and an Ops crew matches the required-only maths.
    var crewText = await page.locator('#t5CrewBars').textContent();
    assert('crew rollup drops all-exempt Site Office crews', crewText.indexOf('Site Office') < 0);
    function crewExpect(name) {
        var g = counted.filter(function (p) { return p.Crew === name; });
        var c = g.filter(function (p) { return p.TagCount >= MIN; }).length;
        return c + '/' + g.length + ' · ' + Math.round(c / g.length * 100) + '%';
    }
    var opsA = await page.evaluate(function () {
        var bar = Array.prototype.slice.call(document.querySelectorAll('#t5CrewBars .crewbar')).filter(function (b) { return b.querySelector('.c').textContent === 'Ops - A Crew'; })[0];
        return bar ? bar.querySelector('.r').textContent : null;
    });
    check('crew rollup Ops - A Crew (required only)', opsA, crewExpect('Ops - A Crew'));
    var serverOpsA = serverDash.CrewRollup.filter(function (c) { return c.Crew === 'Ops - A Crew'; })[0];
    assert('crew rollup differs from uncorrected server figure', opsA !== (serverOpsA.Compliant + '/' + serverOpsA.OnSite + ' · ' + serverOpsA.Pct + '%'));

    // Running totals show everyone, exempt marked.
    check('running totals rows', await page.locator('#t5TableBody tr').count(), people.length);
    check('running totals exempt rows', await page.locator('#t5TableBody tr.t5-exempt').count(), exempt.length);
    assert('running totals subtitle reconciles', (await page.locator('#t5TotalsSub').textContent()).indexOf(required.length + ' required on site in range · ' + exempt.length + ' exempt') === 0);

    // Leaderboards exclude exempt people.
    var lbNames = await page.evaluate(function () {
        return Array.prototype.slice.call(document.querySelectorAll('#t5LbPair .t5-lb-name')).map(function (n) { return n.textContent; });
    });
    assert('leaderboards contain no exempt person', !lbNames.some(function (n) { return exemptNames.indexOf(n) >= 0; }));

    // Lookup: an exempt person shows as exempt with no rank.
    await page.fill('#t5Indiv', exempt[0].Name);
    var card = await page.locator('#t5LookupCards .t5-lookup-card').first().textContent();
    assert('lookup marks exempt person', card.indexOf('Exempt — not required') >= 0);

    // Trend is labelled as uncorrected server data.
    assert('trend carries the server-figures caveat', (await page.locator('#t5Dashboard').textContent()).indexOf('still include ' + exempt.length + ' exempt roles') >= 0);

    // Notify supervisors: body built from the filtered list.
    await page.click('#t5NotifyOpen');
    var body = await page.inputValue('#t5NotifyBody');
    assert('notify body states the required count', body.indexOf(toAction.length + ' required on-site personnel below minimum') >= 0, body.split('\n')[1]);
    assert('notify body names no exempt person', !exemptNames.some(function (n) { return body.indexOf(n + ' —') >= 0; }));
    await page.fill('#t5NotifyTo', 'supervisor@example.com');
    await page.click('#t5NotifySend');
    await page.waitForFunction(function () { return window.__ajax.some(function (a) { return a.url === '/Take5/Notify'; }); });
    var sent = await page.evaluate(function () { return window.__ajax.filter(function (a) { return a.url === '/Take5/Notify'; })[0].data; });
    assert('notify posts the filtered body', sent.Body === body);

    // Dashboard Excel: summary has the exempt row; running totals has Required column.
    await page.click('#t5DashExcel');
    var dwb = await page.evaluate(function () { return window.__workbooks.pop(); });
    var summaryRows = dwb.sheets[0].rows.map(function (r) { return r.cells.map(function (c) { return c.value; }); });
    var exemptRow = summaryRows.filter(function (r) { return r[0] === 'Exempt (not counted)'; })[0];
    check('dashboard Excel exempt row', exemptRow && exemptRow[1], exempt.length);
    var complianceRow = summaryRows.filter(function (r) { return r[0] === 'Compliance'; })[0];
    check('dashboard Excel compliance row', complianceRow && complianceRow[1], pct + '%');
    check('dashboard Excel action sheet rows', dwb.sheets[1].rows.length - 4, toAction.length);
    var totalsHdr = dwb.sheets[6].rows[3].cells.map(function (c) { return c.value; });
    assert('dashboard Excel running totals has Required column', totalsHdr.indexOf('Required') >= 0, totalsHdr.join(','));

    check('no uncaught page errors', pageErrors, []);

    await browser.close();
    s.srv.close();

    console.log('');
    if (failures.length) { console.error('FAILED: ' + failures.length + ' check(s)'); process.exit(1); }
    console.log('All browser checks passed.');
})().catch(function (e) { console.error(e); process.exit(1); });
