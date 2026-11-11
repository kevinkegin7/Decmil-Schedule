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
var Report = require('../src/take5-site-report');
var siteCfg = require('../config/site-10265.json');

var playwright;
try { playwright = require('playwright'); }
catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

var ROOT = path.resolve(__dirname, '..');
var MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

function serve() {
    return new Promise(function (resolve) {
        var srv = http.createServer(function (req, res) {
            var url = req.url.split('?')[0];
            if (url === '/test/site-config.js') {
                // The production page gets this from /js/take5-site-config.js; here it is
                // generated from the project's config so the tests exercise the real rules.
                var cfgText = fs.readFileSync(path.join(ROOT, 'config', 'site-10265.json'), 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end('window.Take5SiteConfig = ' + cfgText + ';');
                return;
            }
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
// The harness loads the site config, so the page applies the project's rules:
// Not-required keywords on role or crew, Optional people counted only when
// they have Take 5s, and the site minimum. Expectations use the same module.
var MIN = siteCfg.minPerDay;
var people = fixture.people;
function included(p) { return Report.classify(Report.fromCaptureRow(p), siteCfg, null).included; }
var required = people.filter(included);
var exempt = people.filter(function (p) { return !included(p); });
var counted = required.filter(function (p) { return p.OnSite; });
var compliant = counted.filter(function (p) { return p.TagCount >= MIN; });
var toAction = counted.filter(function (p) { return p.TagCount < MIN; });
var pct = Math.round(compliant.length / counted.length * 100);
var exemptNames = exempt.map(function (p) { return p.Name; });
// a Not-required (not merely optional-at-zero) person, for the override test
// (on site with no Take 5s, so the Optional step of the test starts outside the denominator)
var firstExempt = exempt.filter(function (p) { return p.OnSite && !p.TagCount && Report.classify(Report.fromCaptureRow(p), siteCfg, null).status === 'Not required'; })[0];

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
    var optionalOnSite = people.filter(function (p) { return p.OnSite && Report.classify(Report.fromCaptureRow(p), siteCfg, null).optional; });
    var optionalZeroOnSite = optionalOnSite.filter(function (p) { return !p.TagCount; });
    check('not-required rows have no active stepper', await page.locator('#t5List .wrow.t5-exempt:not(.t5-optional) [data-act="inc"]').count(), 0);
    check('optional-at-zero rows keep a stepper (so their Take 5s can be entered)', await page.locator('#t5List .wrow.t5-exempt.t5-optional [data-act="inc"]').count(), optionalZeroOnSite.length);
    check('required on-site rows have a stepper', await page.locator('#t5List .wrow [data-act="inc"]').count(), counted.length + optionalZeroOnSite.length);
    check('off-site rows have no active stepper', await page.locator('#t5List .wrow.t5-off [data-act="inc"]').count(), 0);
    check('every row has the Required / Not required / Optional control', await page.locator('#t5List select.t5-ovr').count(), people.length);

    await page.click('#t5Capture .seg button[data-filter="exempt"]');
    check('Exempt filter shows only exempt rows', await page.locator('#t5List .wrow').count(), exempt.length);
    await page.click('#t5Capture .seg button[data-filter="below"]');
    check('Below-min filter excludes exempt rows', await page.locator('#t5List .wrow.t5-exempt').count(), 0);
    check('Below-min filter count', await page.locator('#t5List .wrow').count(), toAction.length);
    await page.click('#t5Capture .seg button[data-filter="all"]');

    // Override: set a Not-required person to Required, reload, confirm it stuck, then Optional, then back.
    var ovrSel = '#t5List select.t5-ovr[data-id="' + firstExempt.EmployeeId + '"]';
    assert('control marks the rule verdict', (await page.locator(ovrSel + ' option[value="notRequired"]').textContent()).indexOf('(rule)') >= 0);
    await page.selectOption(ovrSel, 'required');
    check('override → required count +1', await cellNum('Required on site'), String(counted.length + 1));
    check('override → exempt count −1', await cellNum('Exempt (not counted)'), String(exempt.length - 1));
    await page.reload();
    await page.waitForSelector('#t5List .wrow');
    check('override survives reload', await cellNum('Exempt (not counted)'), String(exempt.length - 1));
    assert('override row is labelled (manual)', (await page.locator('#t5List .wrow:has([data-id="' + firstExempt.EmployeeId + '"]) .meta').textContent()).indexOf('(manual)') >= 0);
    await page.selectOption(ovrSel, 'optional');
    check('optional at zero → back out of the denominator', await cellNum('Required on site'), String(counted.length));
    assert('optional row keeps its stepper', await page.locator('#t5List .wrow:has(' + ovrSel.replace('#t5List ', '') + ') [data-act="inc"]').count() === 1);
    await page.click('#t5List [data-act="inc"][data-id="' + firstExempt.EmployeeId + '"]');
    check('optional person with a Take 5 counts', await cellNum('Required on site'), String(counted.length + 1));
    await page.click('#t5List [data-act="dec"][data-id="' + firstExempt.EmployeeId + '"]');
    check('optional person back at zero is excluded again', await cellNum('Required on site'), String(counted.length));
    check('stored override is the string state', await page.evaluate(function (id) { return JSON.parse(localStorage.getItem('t5RequiredOverrides'))[id]; }, String(firstExempt.EmployeeId)), 'optional');
    await page.selectOption(ovrSel, 'notRequired');
    check('flip back → exempt count restored', await cellNum('Exempt (not counted)'), String(exempt.length));
    check('flip back clears the stored override', await page.evaluate(function () { return localStorage.getItem('t5RequiredOverrides'); }), '{}');
    // Legacy boolean saves are migrated.
    await page.evaluate(function (id) { var o = {}; o[id] = true; localStorage.setItem('t5RequiredOverrides', JSON.stringify(o)); }, String(firstExempt.EmployeeId));
    await page.reload();
    await page.waitForSelector('#t5List .wrow');
    check('legacy boolean override migrates to Required', await cellNum('Required on site'), String(counted.length + 1));
    await page.selectOption(ovrSel, 'notRequired');
    check('migrated override clears', await cellNum('Required on site'), String(counted.length));

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

    // Site-specific extras: minimum from the config, Optional rows labelled, daily email modal.
    console.log('\nSite rules');
    check('site minimum replaces the server minimum', await page.locator('#t5MinCopy').textContent(), String(MIN));
    var optionalAtZero = people.filter(function (p) { return Report.classify(Report.fromCaptureRow(p), siteCfg, null).status === 'Optional'; }).length;
    check('optional-at-zero rows are labelled Optional', await page.locator('#t5List .wrow.t5-exempt .stat-tag:has-text("Optional")').count(), optionalAtZero);

    // Email Report panel (the register's Email Report sheet, on the page).
    check('Daily Capture carries no report panel or Notify button', await page.locator('#t5Capture #t5EmailPanel, #t5Capture #t5EmailOpen').count(), 0);
    check('Analytic tab comes after Dashboard', await page.locator('#t5 .tab').allTextContents(), ['Daily Capture', 'Dashboard', 'Analytic']);
    await page.click('#t5 .tab[data-tab="analytics"]');
    await page.waitForSelector('#t5EmailPanel .panel');
    await page.waitForFunction(function () { return document.querySelector('#t5EmailPanel') && document.querySelector('#t5EmailPanel').textContent.indexOf('…') < 0; });
    var panelText = await page.locator('#t5EmailPanel').textContent();
    // Opening the tab re-reads the day from the server, and the mock does not keep the stepper edit above.
    var panelRows = people.filter(function (p) { return p.OnSite; });
    var panelRep = Report.buildReport(panelRows, siteCfg, { date: await page.evaluate(function () { return document.getElementById('t5Date').value; }) });
    assert('email panel title carries the sheet date', panelText.indexOf('Take 5 Report for the ' + panelRep.dateLabel) >= 0);
    assert('email panel banner shows TODAY zeros', panelText.indexOf('TODAY:') >= 0 && panelText.indexOf(panelRep.totals.zeros + ' with NO Take 5') >= 0);
    assert('report panel shows the figures only, no email greeting or sign-off', panelText.indexOf('Morning Team') < 0 && panelText.indexOf('Regards') < 0);
    assert('report panel has no copy buttons and no Daily Log row', (await page.locator('#t5PanelCopy, #t5PanelCopyHtml').count()) === 0 && panelText.indexOf('Daily Log') < 0);
    check('report panel has a Notify button', await page.locator('#t5PanelNotify').count(), 1);
    check('report panel shows a 14-day trend', await page.locator('#t5DailyTrend .tcol').count(), 14);
    assert('trend today matches the module compliance %', (await page.locator('#t5DailyTrend .tcol').last().textContent()).indexOf(panelRep.totals.compliancePct + '%') >= 0);
    var fuTable = page.locator('#t5EmailPanel table').nth(1);
    var fuRows = await fuTable.locator('tbody tr').count();
    check('follow-up table lists zeros + below-min', fuRows, panelRep.totals.zeros + panelRep.totals.belowMin);
    var firstFu = await fuTable.locator('tbody tr').first().textContent();
    assert('follow-up ranks NO TAKE 5 first', panelRep.totals.zeros === 0 || firstFu.indexOf('NO TAKE 5') >= 0);
    assert('follow-up shows last Take 5 and consistency', /\d+ of \d+ day/.test(firstFu) && /%|—/.test(firstFu));
    await page.click('#t5PanelNotify');
    await page.waitForSelector('#t5EmailPreview');
    var expected = panelRep;
    var preview = await page.locator('#t5EmailPreview').textContent();
    assert('notify preview opens with the greeting and intro', preview.indexOf('Morning Team,') >= 0 && /Please see below the Take 5's stats for \w+day \d\d\/\d\d\/\d\d:/.test(preview));
    assert('notify preview carries the report title', preview.indexOf('Take 5 Report for the ' + expected.dateLabel) >= 0);
    check('notify preview table has the four rows per group', await page.locator('#t5EmailPreview table').first().locator('tr').count(), 5);
    assert('notify preview table matches the module', (await page.locator('#t5EmailPreview table').first().textContent()).indexOf('Crew Size' + expected.groups.Maintenance.crewSize + 'Crew Size' + expected.groups.Operations.crewSize) >= 0);
    assert('no copy buttons in the notify dialog', (await page.locator('#t5EmailCopy, #t5EmailCopyHtml').count()) === 0);
    await page.fill('#t5EmailSign', 'Test Sender\nHSE Advisor');
    assert('sign-off appears in the preview', (await page.locator('#t5EmailPreview').textContent()).indexOf('Regards,Test Sender') >= 0);
    await page.click('#t5EmailClose');
    check('email modal closes', await page.locator('#t5EmailBg').count(), 0);
    // Send from Site Diary: posts the email text to the page's mail endpoint and remembers the recipients.
    await page.click('#t5PanelNotify');
    check('daily email subject defaults to the report title', await page.inputValue('#t5EmailSubject'), 'Take 5 Report for the ' + expected.dateLabel);
    await page.click('#t5EmailSend');
    assert('daily email is not sent without a recipient', !(await page.evaluate(function () { return window.__ajax.some(function (a) { return a.url === '/Take5/Notify'; }); })));
    await page.fill('#t5EmailTo', 'management@example.com');
    await page.click('#t5EmailSend');
    await page.waitForFunction(function () { return window.__ajax.some(function (a) { return a.url === '/Take5/Notify'; }); });
    var dailySent = await page.evaluate(function () { return window.__ajax.filter(function (a) { return a.url === '/Take5/Notify'; })[0].data; });
    assert('daily report is posted to the recipient with the title as subject', dailySent.To === 'management@example.com' && dailySent.Subject === 'Take 5 Report for the ' + expected.dateLabel);
    assert('daily report text has greeting, title, TODAY line and sign-off', dailySent.Body.indexOf('Morning Team,') === 0 && dailySent.Body.indexOf('Take 5 Report for the ' + expected.dateLabel) > 0 &&
        dailySent.Body.indexOf('TODAY: ' + expected.totals.zeros + ' with NO Take 5 | ' + expected.totals.belowMin + ' below minimum') > 0 && /Regards,\nTest Sender\nHSE Advisor$/.test(dailySent.Body));
    assert('daily report HTML carries the follow-up table', dailySent.IsHtml === true && (dailySent.BodyHtml.match(/NO TAKE 5<\/td>|BELOW MIN<\/td>/g) || []).length === expected.totals.zeros + expected.totals.belowMin);
    await page.waitForSelector('#t5EmailBg', { state: 'detached', timeout: 5000 }).catch(function () {});
    check('daily email modal closes after sending', await page.locator('#t5EmailBg').count(), 0);
    await page.click('#t5PanelNotify');
    check('daily email recipients are remembered', await page.inputValue('#t5EmailTo'), 'management@example.com');
    check('sign-off is remembered', await page.inputValue('#t5EmailSign'), 'Test Sender\nHSE Advisor');
    await page.click('#t5EmailClose');
    await page.evaluate(function () { window.__ajax = window.__ajax.filter(function (a) { return a.url !== '/Take5/Notify'; }); });

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

    // Stats + trend under the site rules (per-day captures; the mock serves the same roster every day).
    await page.waitForFunction(function () { var el = document.querySelector('#t5StatsPanel'); return el && el.textContent.indexOf('Loading') < 0 && el.textContent.indexOf('By day') >= 0; });
    var statsText = await page.locator('#t5StatsPanel').textContent();
    assert('stats panel has day / week / month sections', statsText.indexOf('By day') >= 0 && statsText.indexOf('By week (Sat–Fri)') >= 0 && statsText.indexOf('By month') >= 0);
    assert('stats panel draws the trend', await page.locator('#t5StatsPanel svg.t5v-spark').count() === 1);
    var dayRows = await page.locator('#t5StatsPanel table').first().locator('tbody tr').count();
    var rangeDays = await page.evaluate(function () { var a = new Date(document.getElementById('t5Start').value), b = new Date(document.getElementById('t5End').value); return Math.round((b - a) / 86400000) + 1; });
    check('one row per group per day', dayRows, rangeDays * 2);
    var firstStats = await page.locator('#t5StatsPanel table').first().locator('tbody tr').first().textContent();
    assert('stats rows carry target status', /On target|Close|Below target/.test(firstStats), firstStats);

    // Forecast panel: week and month projections per group plus the notes.
    await page.waitForSelector('#t5ForecastTiles');
    check('forecast shows four headline tiles', await page.locator('#t5ForecastTiles .t5-kpi').count(), 4);
    check('forecast has week and month tables with both groups and the total', [await page.locator('#t5ForecastPanel table').nth(0).locator('tbody tr').count(), await page.locator('#t5ForecastPanel table').nth(1).locator('tbody tr').count()], [3, 3]);
    var fcRow = await page.locator('#t5ForecastPanel table').nth(1).locator('tbody tr').last().locator('td').allTextContents();
    var fcParts = fcRow[3].split(' / ').map(Number);
    assert('forecast projected % is projected finish over target', Math.abs(Math.round(fcParts[0] / fcParts[1] * 100) - parseInt(fcRow[4], 10)) <= 1, fcRow.join(' | '));
    assert('forecast notes cover direction and run rate', /Direction:/.test(await page.locator('#t5ForecastNotes').textContent()) && /Run rate:/.test(await page.locator('#t5ForecastNotes').textContent()));
    // Exclude crews: the list stays open while several crews are ticked.
    await page.click('.t5-crewdd > summary');
    await page.locator('.t5-crew-ex').nth(0).check();
    await page.locator('.t5-crew-ex').nth(1).check();
    assert('crew filter stays open across selections', await page.evaluate(function () { return document.querySelector('.t5-crewdd').open; }));
    check('crew filter kept both selections', await page.locator('.t5-crew-ex:checked').count(), 2);
    await page.click('#t5CrewExClear');
    check('crew filter clears', await page.locator('.t5-crew-ex:checked').count(), 0);
    await page.mouse.click(5, 5);
    assert('crew filter closes on an outside click', !(await page.evaluate(function () { return document.querySelector('.t5-crewdd').open; })));
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
