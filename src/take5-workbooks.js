/*
 * Take 5 Compliance — reading the two workbooks
 * ---------------------------------------------
 * Shared by tools/take5-report.js (Node) and the browser report page. Takes
 * SheetJS workbooks already opened by the caller (so this file never touches
 * the file system) and turns them into what the report module needs:
 *
 *   parseCapture(wb)             the Site Diary Daily Capture export
 *   parseRegister(wb)            the register's "TAKE 5's" grid and Daily Log
 *   analyse(capture, reg, cfg,   the report, warnings, per-person
 *           opts)                reconciliation and the trend series
 *
 * Name lookup into the register follows Email Report!Q5: exact trimmed match,
 * then first word + last word, then a nickname/initial-stripped fallback the
 * sheet does not have. Plain ES5, UMD, depends on take5-site-report.js.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./take5-site-report'));
    else root.Take5Workbooks = factory(root.Take5SiteReport);
}(typeof self !== 'undefined' ? self : this, function (R) {
    'use strict';

    var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function pad(n) { return ('0' + n).slice(-2); }
    function serialToIso(XLSX, serial) {
        var d = XLSX.SSF.parse_date_code(serial);
        return d ? d.y + '-' + pad(d.m) + '-' + pad(d.d) : null;
    }
    function parseLongDate(s) {            // "Monday, 9 Nov 2026" -> 2026-11-09
        var m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(String(s || ''));
        if (!m) return null;
        var mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
        return mon ? m[3] + '-' + pad(mon) + '-' + pad(+m[1]) : null;
    }
    function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
    function firstLast(s) { var t = norm(s).split(' '); return t.length >= 2 ? t[0] + ' ' + t[t.length - 1] : norm(s); }
    function stripNick(s) { return norm(String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\b[a-z]\.\s*/gi, ' ')); }
    function dayLabel(iso) { var d = new Date(iso + 'T00:00:00Z'); return DOW[d.getUTCDay()] + ' ' + d.getUTCDate(); }
    function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10); }

    // ------------------------------------------------------------- capture
    function parseCapture(XLSX, wb, fileName) {
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        var hdrIdx = -1;
        for (var r = 0; r < Math.min(rows.length, 20); r++) if (rows[r] && String(rows[r][0]).trim() === 'Name') { hdrIdx = r; break; }
        if (hdrIdx < 0) throw new Error('This does not look like a Take 5 Capture export: no header row starting with "Name".');
        var hdr = rows[hdrIdx].map(function (h) { return String(h || '').trim(); });
        function col(name) { return hdr.indexOf(name); }
        var i = { name: col('Name'), gender: col('Gender'), role: col('Role'), crew: col('Crew'), company: col('Company'), tags: col('Tags'), min: col('Minimum'), status: col('Status') };
        var people = [];
        for (r = hdrIdx + 1; r < rows.length; r++) {
            var row = rows[r];
            if (!row || row[i.name] == null || String(row[i.name]).trim() === '') continue;
            people.push({ Name: String(row[i.name]).trim(), Gender: row[i.gender], Role: String(row[i.role] || '').trim(), Crew: String(row[i.crew] || '').trim(),
                          Company: String(row[i.company] || '').trim(), TagCount: Number(row[i.tags] || 0), Minimum: row[i.min], Status: row[i.status] });
        }
        var date = parseLongDate(rows[1] && rows[1][0]);
        if (!date && fileName) { var m = /(\d{4}-\d{2}-\d{2})/.exec(fileName); if (m) date = m[1]; }
        return { rows: people, date: date, summaryLine: String(rows[2] && rows[2][0] || ''), serverMin: people.length ? Number(people[0].Minimum) : null };
    }

    // ------------------------------------------------------------ register
    function parseRegister(XLSX, wb) {
        var rname = wb.SheetNames.filter(function (n) { return /take ?5/i.test(n) && !/capture/i.test(n); })[0];
        if (!rname) throw new Error('No "TAKE 5\'s" sheet found (sheets: ' + wb.SheetNames.join(', ') + ').');
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[rname], { header: 1, defval: null, raw: true });
        var dateRow = rows[2] || [], dateCols = {};
        for (var c = 6; c < dateRow.length; c++) {
            var v = dateRow[c];
            var iso = typeof v === 'number' ? serialToIso(XLSX, v) : (v instanceof Date ? v.toISOString().slice(0, 10) : null);
            if (iso && dateCols[iso] === undefined) dateCols[iso] = c;   // first hit wins, as MATCH does
        }
        var people = [];
        for (var r = 3; r < rows.length; r++) {
            var rr = rows[r]; if (!rr) continue;
            var full = String(rr[0] || '').trim();
            if (!full) full = (String(rr[1] || '') + ' ' + String(rr[2] || '')).trim();
            if (!full) continue;
            people.push({ row: r + 1, name: full, role: rr[3], company: rr[4], crew: rr[5], cells: rr });
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
        function dayStats(iso) {
            var c = dateCols[iso], out = { col: c, entries: 0, total: 0, text: 0, atMin: function (min) { var n = 0; if (c === undefined) return 0; people.forEach(function (p) { var v = p.cells[c]; if (typeof v === 'number' && v >= min) n++; }); return n; } };
            if (c !== undefined) people.forEach(function (p) {
                var v = p.cells[c];
                if (v === null || v === undefined || v === '') return;
                if (typeof v === 'number') { out.entries++; out.total += v; } else out.text++;
            });
            return out;
        }
        // Daily Log: what management already received each day
        var logName = wb.SheetNames.filter(function (n) { return /daily log/i.test(n); })[0], logDays = {};
        if (logName) {
            XLSX.utils.sheet_to_json(wb.Sheets[logName], { header: 1, defval: null, raw: true }).forEach(function (row, idx) {
                if (idx < 4 || typeof row[0] !== 'number') return;
                var iso = serialToIso(XLSX, row[0]), crew = Number(row[1] || 0) + Number(row[4] || 0), t5 = Number(row[2] || 0) + Number(row[5] || 0);
                if (iso && crew > 0) logDays[iso] = { crew: crew, take5s: t5 };
            });
        }
        var dates = Object.keys(dateCols).sort();
        return { sheet: rname, people: people, dateCols: dateCols, findPerson: findPerson, dayStats: dayStats, logDays: logDays,
                 firstDate: dates[0], lastDate: dates[dates.length - 1] };
    }

    // ------------------------------------------------------------- analyse
    /* opts: { date, countSource: 'register'|'sitediary', fileName } */
    function analyse(capture, reg, cfg, opts) {
        opts = opts || {};
        var date = opts.date || capture.date;
        if (!date) throw new Error('Could not determine the report date; set it explicitly.');
        var countSource = opts.countSource || (reg ? 'register' : 'sitediary');
        if (countSource === 'register' && !reg) countSource = 'sitediary';
        var day = reg ? reg.dayStats(date) : null;
        var lookups = {};
        function registerCount(p) {
            var f = reg.findPerson(p.name);
            lookups[p.name] = f ? { row: f.p.row, name: f.p.name, how: f.how } : null;
            if (!f) return null;
            if (day.col === undefined) return 0;
            var v = f.p.cells[day.col];
            if (v === null || v === undefined || v === '') return 0;
            if (typeof v === 'number') return v;
            lookups[p.name].text = String(v);
            return 0;                                   // the sheet's IFERROR(...+0, 0) turns text into 0
        }
        var report = R.buildReport(capture.rows, cfg, { date: date, tagsFor: countSource === 'register' ? registerCount : undefined });
        if (countSource !== 'register' && reg) capture.rows.forEach(function (c) { registerCount({ name: c.Name }); });

        var warnings = [];
        var withTags = capture.rows.filter(function (c) { return c.TagCount > 0; }).length;
        var exactMin = capture.rows.filter(function (c) { return c.TagCount === cfg.minPerDay; }).length;
        if (capture.serverMin !== null && capture.serverMin !== cfg.minPerDay)
            warnings.push('Site Diary exported Minimum/day = ' + capture.serverMin + ' but the site rule is ' + cfg.minPerDay + '/day; its own "On track" and "Compliance" figures (' + capture.summaryLine.replace(/\s+/g, ' ') + ') are not comparable with this report.');
        if (withTags && exactMin / withTags > 0.85)
            warnings.push(exactMin + ' of the ' + withTags + ' people with Site Diary tags have exactly ' + cfg.minPerDay + ', consistent with the "Set ' + cfg.minPerDay + '" button being used as a submitted tick rather than a count.');
        if (reg) {
            if (day.col === undefined) warnings.push('The register has no column for ' + date + ' (it covers ' + reg.firstDate + ' to ' + reg.lastDate + ').');
            else if (day.entries === 0) warnings.push('CHECK FIRST: the register column for ' + date + ' is empty. Nothing has been typed for this date yet, so a register-based report shows everyone at zero.');
            else if (day.entries < report.totals.included * 0.6) warnings.push('The register column for ' + date + ' has only ' + day.entries + ' entries for ' + report.totals.included + ' included people; data entry looks incomplete.');
            if (day.text) warnings.push(day.text + ' register cell(s) for this date hold text (e.g. "Sick"), which the Email Report counts as 0.');
        }
        var nrTags = report.notRequired.filter(function (p) { return p.tags > 0; }).length;
        if (nrTags) warnings.push(nrTags + ' Not-required people have Site Diary tags; they are excluded from the figures.');

        var discrepancies = [], notInRegister = [], otherRegister = [];
        if (reg) {
            var sdByName = {}; capture.rows.forEach(function (c) { sdByName[c.Name] = Number(c.TagCount || 0); });
            report.people.forEach(function (p) {
                var lk = lookups[p.name], sd = sdByName[p.name] || 0;
                if (!lk) { notInRegister.push({ name: p.name, role: p.role, crew: p.crew, status: p.cls.status, sd: sd }); return; }
                if (day.col === undefined) return;
                var v = reg.people.filter(function (x) { return x.row === lk.row; })[0].cells[day.col];
                var regn = (typeof v === 'number') ? v : (v === null || v === undefined || v === '' ? null : 'text:' + v);
                var regNum = regn === null ? 0 : (typeof regn === 'number' ? regn : 0);
                if (regNum !== sd || typeof regn === 'string')
                    discrepancies.push({ name: p.name, role: p.role, crew: p.crew, status: p.cls.status, included: p.cls.included, siteDiary: sd, register: regn === null ? '(blank)' : regn, match: lk.how });
            });
            if (day.col !== undefined) {
                var onList = {}; Object.keys(lookups).forEach(function (n) { if (lookups[n]) onList[lookups[n].row] = true; });
                reg.people.forEach(function (p) { var v = p.cells[day.col]; if (typeof v === 'number' && v > 0 && !onList[p.row]) otherRegister.push({ name: p.name, role: p.role, crew: p.crew, count: v }); });
            }
        }

        // trend: Daily Log as pasted (what management received), today from this report
        var trend = null, trendNote = '';
        if (reg) {
            var logged = Object.keys(reg.logDays).filter(function (d) { return d < date; }).sort().slice(-13);
            if (logged.length >= 2) {
                trend = logged.map(function (d) { var L = reg.logDays[d]; return { label: dayLabel(d), pct: Math.round(L.take5s / (L.crew * cfg.minPerDay) * 100), note: L.take5s + ' Take 5s, ' + L.crew + ' crew' }; });
                var inc = report.totals.included;
                trend.push({ label: dayLabel(date), pct: inc ? Math.round(report.totals.take5s / (inc * cfg.minPerDay) * 100) : null, note: report.totals.take5s + ' Take 5s, ' + inc + ' crew (this report)' });
                trendNote = 'Take 5s as a share of target (crew × ' + cfg.minPerDay + ') from the Daily Log as pasted each day, today from this report';
            } else {
                trend = [];
                for (var k = 13; k >= 0; k--) {
                    var iso = addDays(date, -k), s = reg.dayStats(iso);
                    trend.push({ label: dayLabel(iso), pct: s.entries >= 5 ? Math.round(s.atMin(cfg.minPerDay) / s.entries * 100) : null, note: s.entries ? s.entries + ' recorded' : 'no entries' });
                }
                trendNote = 'people with a register entry that day, share at ' + cfg.minPerDay + '+';
            }
        }
        return { date: date, countSource: countSource, report: report, warnings: warnings, discrepancies: discrepancies,
                 notInRegister: notInRegister, otherRegister: otherRegister, trend: trend, trendNote: trendNote,
                 registerDay: day ? { entries: day.entries, total: day.total, text: day.text, hasColumn: day.col !== undefined } : null,
                 siteDiary: { withTags: withTags, total: capture.rows.reduce(function (a, c) { return a + c.TagCount; }, 0) } };
    }

    return { parseCapture: parseCapture, parseRegister: parseRegister, analyse: analyse, parseLongDate: parseLongDate, dayLabel: dayLabel };
}));
