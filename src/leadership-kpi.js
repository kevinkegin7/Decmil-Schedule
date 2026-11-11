/*
 * Leadership KPIs — Site Diary section.
 * Reads the document export from the client platform (SAI 360 today; other
 * platforms by adding a source block to the config) and counts each leader's
 * KPIs against the group targets: weekly ones over the Sat–Fri week, monthly
 * ones month to date. The file is read in the browser; nothing is uploaded.
 *
 *   LeadershipKpi.parse(table, config)      table = array of rows (arrays), first rows may be titles
 *   LeadershipKpi.compute(events, config, { asAt, roster, groupChoice })
 *   LeadershipKpi.mount(element, config, { roster })   needs SheetJS (window.XLSX)
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.LeadershipKpi = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    function pad(n) { return String(n).padStart(2, '0'); }
    function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
    function addDays(s, n) { var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
    function weekStartOf(s) { var p = s.split('-'), dow = new Date(+p[0], +p[1] - 1, +p[2]).getDay(); return addDays(s, -((dow + 1) % 7)); }   // Saturday
    function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
    /* "first.last" or "FIRST  LAST" -> "First Last" (the register's PROPER(SUBSTITUTE(TRIM(..),"."," "))). */
    function personName(s) {
        return String(s == null ? '' : s).replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    }
    function nameKey(s) { var w = personName(s).toLowerCase().split(' ').filter(Boolean); return w.length ? w[0] + ' ' + w[w.length - 1] : ''; }
    function toIsoDate(v, order) {
        if (v == null || v === '') return null;
        if (v instanceof Date && !isNaN(v)) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
        if (typeof v === 'number' && isFinite(v)) { var d = new Date(Math.round((v - 25569) * 86400000)); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
        var s = String(v).trim(), m;
        if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return iso(+m[1], +m[2], +m[3]);
        if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s))) {
            var y = +m[3] < 100 ? 2000 + +m[3] : +m[3], a = +m[1], b = +m[2];
            var mdy = order === 'MDY' ? !(a > 12) : (b > 12);      // fall back to the other order when the stated one is impossible
            return mdy ? iso(y, a, b) : iso(y, b, a);
        }
        return null;
    }
    /* Finds the source whose column headings are present, then turns every row into { person, metric, date }. */
    function parse(table, cfg) {
        var out = { source: null, events: [], rows: 0, counted: 0, skippedNoDate: 0, notKpi: 0, error: null };
        for (var s = 0; s < cfg.sources.length && !out.source; s++) {
            var src = cfg.sources[s];
            for (var r = 0; r < Math.min(table.length, 15); r++) {
                var heads = (table[r] || []).map(norm), idx = {}, ok = true;
                Object.keys(src.columns).forEach(function (k) { idx[k] = heads.indexOf(norm(src.columns[k])); if (idx[k] < 0 && (k === 'person' || k === 'date')) ok = false; });
                if (ok) { out.source = src.name; out._src = src; out._idx = idx; out._head = r; break; }
            }
        }
        if (!out.source) { out.error = 'This file does not look like a known export. Expected the columns ' + cfg.sources.map(function (x) { return '"' + x.columns.person + '" and "' + x.columns.date + '" (' + x.name + ')'; }).join(' or ') + '.'; return out; }
        var src2 = out._src, ix = out._idx;
        for (var i = out._head + 1; i < table.length; i++) {
            var row = table[i] || []; if (!row.some(function (v) { return v != null && v !== ''; })) continue;
            var who = personName(row[ix.person]); if (!who) continue;
            out.rows++;
            var metric = null;
            for (var k = 0; k < src2.rules.length && !metric; k++) {
                var rule = src2.rules[k], cell = ix[rule.column] >= 0 ? norm(row[ix[rule.column]]) : '';
                if (rule.equals.some(function (e) { return norm(e) === cell; })) metric = rule.metric;
            }
            if (!metric) { out.notKpi++; continue; }
            var d = toIsoDate(row[ix.date], src2.dateOrder);
            if (!d) { out.skippedNoDate++; continue; }
            out.events.push({ person: who, metric: metric, date: d }); out.counted++;
        }
        delete out._src; delete out._idx; delete out._head;
        return out;
    }
    function groupForRole(role, cfg) {
        var r = norm(role); if (!r) return null;
        for (var i = 0; i < cfg.groups.length; i++) if (cfg.groups[i].roleKeywords.some(function (k) { return r.indexOf(norm(k)) >= 0; })) return cfg.groups[i].name;
        return null;
    }
    function compute(events, cfg, opts) {
        opts = opts || {};
        var asAt = opts.asAt || events.reduce(function (a, e) { return e.date > a ? e.date : a; }, '0000-00-00');
        var ws = weekStartOf(asAt), we = addDays(ws, 6), ms = asAt.slice(0, 8) + '01', choice = opts.groupChoice || {};
        var people = {}, byName = {};
        (opts.roster || []).forEach(function (p) { var g = groupForRole(p.role, cfg); if (!g) return; var k = nameKey(p.name); byName[k] = { name: personName(p.name), role: p.role, group: g }; });
        Object.keys(byName).forEach(function (k) { people[k] = { name: byName[k].name, role: byName[k].role, group: byName[k].group, counts: {}, inFile: false }; });
        events.forEach(function (e) {
            var k = nameKey(e.person), p = people[k] || (people[k] = { name: e.person, role: '', group: null, counts: {}, inFile: true });
            p.inFile = true;
            var m = cfg.metrics.filter(function (x) { return x.key === e.metric; })[0]; if (!m) return;
            var inPeriod = m.period === 'month' ? (e.date >= ms && e.date <= asAt) : (e.date >= ws && e.date <= asAt);
            if (inPeriod) p.counts[e.metric] = (p.counts[e.metric] || 0) + 1;
        });
        var rows = Object.keys(people).map(function (k) {
            var p = people[k], group = choice[k] !== undefined ? choice[k] : p.group, G = cfg.groups.filter(function (g) { return g.name === group; })[0];
            var row = { key: k, name: p.name, role: p.role, group: group || null, hidden: choice[k] === '', counts: {}, targets: {}, weeklyMet: 0, weeklyRequired: 0, monthlyMet: 0, monthlyRequired: 0, outstanding: [] };
            cfg.metrics.forEach(function (m) {
                var n = p.counts[m.key] || 0, t = G ? (G.targets[m.key] || 0) : 0;
                row.counts[m.key] = n; row.targets[m.key] = t;
                if (t > 0) {
                    if (m.period === 'week') { row.weeklyRequired++; if (n >= t) row.weeklyMet++; } else { row.monthlyRequired++; if (n >= t) row.monthlyMet++; }
                    if (n < t) row.outstanding.push(m.label + ' ' + (t - n) + ' more');
                }
            });
            row.weekly = !G ? 'Check role' : (row.weeklyRequired === 0 ? 'n/a' : (row.weeklyMet >= row.weeklyRequired ? 'Complete' : 'Outstanding'));
            row.monthly = !G ? 'Check role' : (row.monthlyRequired === 0 ? 'n/a' : (row.monthlyMet >= row.monthlyRequired ? 'Complete' : 'In progress'));
            return row;
        }).filter(function (r) { return !r.hidden; });
        var order = cfg.groups.map(function (g) { return g.name; });
        rows.sort(function (a, b) { var x = order.indexOf(a.group), y = order.indexOf(b.group); x = x < 0 ? 99 : x; y = y < 0 ? 99 : y; return x - y || (a.name < b.name ? -1 : 1); });
        var groups = cfg.groups.map(function (g) {
            var mine = rows.filter(function (r) { return r.group === g.name; }), need = mine.filter(function (r) { return r.weeklyRequired > 0; }), done = need.filter(function (r) { return r.weekly === 'Complete'; }).length;
            return { name: g.name, people: mine.length, weeklyComplete: done, pct: need.length ? Math.round(done / need.length * 100) : null, targets: g.targets };
        });
        var allNeed = rows.filter(function (r) { return r.weeklyRequired > 0; });
        return { asAt: asAt, weekStart: ws, weekEnd: we, monthStart: ms, daysLeftInWeek: Math.round((new Date(we) - new Date(asAt)) / 86400000), rows: rows, groups: groups,
            unassigned: rows.filter(function (r) { return !r.group; }).length,
            total: { people: allNeed.length, weeklyComplete: allNeed.filter(function (r) { return r.weekly === 'Complete'; }).length } };
    }

    // ------------------------------------------------------------------ page
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function dmy(s) { var p = s.split('-'); return (+p[2]) + '/' + (+p[1]) + '/' + p[0].slice(2); }
    function mount(el, cfg, opts) {
        opts = opts || {};
        var KEY = 'leadershipKpi.groups', st = { parsed: null, file: '', asAt: '', error: '', choice: {} };
        try { st.choice = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st.choice = {}; }
        function saveChoice() { try { localStorage.setItem(KEY, JSON.stringify(st.choice)); } catch (e) { /* private mode */ } }
        function render() {
            var h = '<div class="panel"><div class="phead" style="flex-wrap:wrap"><div><h3>Leadership KPIs</h3><p>Import the document export from the client platform (' + cfg.sources.map(function (s) { return esc(s.name); }).join(', ') + '). The file is read in this browser and is not uploaded.</p></div>' +
                '<div class="toolbar"><label class="xbtn" style="cursor:pointer">Import export (Excel or CSV)<input type="file" id="lkFile" accept=".xlsx,.xlsm,.xls,.csv" style="display:none"></label>' +
                (st.parsed && !st.error ? '<label style="font-size:12.5px;color:var(--grey)">As at <input type="date" class="field" id="lkAsAt" value="' + esc(st.asAt) + '"></label>' : '') + '</div></div>';
            if (st.error) h += '<div style="background:var(--bad-bg);color:var(--bad-d);padding:10px 20px;font-weight:600;font-size:13px" id="lkError">' + esc(st.error) + '</div>';
            if (!st.parsed || st.error) { el.innerHTML = h + '<div class="empty" id="lkEmpty">No export imported yet. Targets: ' + cfg.groups.map(function (g) { return esc(g.name); }).join(' · ') + '.</div></div>'; return; }
            var R = compute(st.parsed.events, cfg, { asAt: st.asAt, roster: opts.roster, groupChoice: st.choice }), P = st.parsed;
            var wk = cfg.metrics.filter(function (m) { return m.period === 'week'; }), mo = cfg.metrics.filter(function (m) { return m.period === 'month'; });
            h += '<div style="padding:10px 20px;font-size:12.5px;color:var(--grey);border-bottom:1px solid var(--line)" id="lkSummary">' + esc(st.file) + ' · ' + esc(P.source) + ' · ' + P.rows + ' documents, ' + P.counted + ' count towards a KPI, ' + P.notKpi + ' are other document types' +
                (P.skippedNoDate ? ', ' + P.skippedNoDate + ' skipped with no readable date' : '') + ' · week ' + dmy(R.weekStart) + ' to ' + dmy(R.weekEnd) + ' (' + R.daysLeftInWeek + ' day' + (R.daysLeftInWeek === 1 ? '' : 's') + ' left) · month to date from ' + dmy(R.monthStart) + '</div>';
            if (R.unassigned) h += '<div style="background:var(--warn-bg);color:var(--warn-d);padding:10px 20px;font-weight:600;font-size:13px" id="lkCheck">' + R.unassigned + ' ' + (R.unassigned === 1 ? 'person in the export has' : 'people in the export have') + ' no leadership group yet. Pick a group in the table (or "Not a leader") and it is remembered.</div>';
            h += '<div class="t5-hero-kpis" style="padding:14px 20px" id="lkTiles">' + R.groups.concat([{ name: 'All leaders', people: R.total.people, weeklyComplete: R.total.weeklyComplete, pct: R.total.people ? Math.round(R.total.weeklyComplete / R.total.people * 100) : null }]).map(function (g) {
                var c = g.pct == null ? 'var(--faint)' : (g.pct >= 100 ? 'var(--good-d)' : (g.pct >= 50 ? 'var(--warn-d)' : 'var(--bad-d)'));
                return '<div class="t5-kpi"><div class="t5-kpi-l">' + esc(g.name) + '</div><div class="t5-kpi-v" style="color:' + c + '">' + (g.pct == null ? '–' : g.pct + '%') + '</div><div class="t5-kpi-s">' + g.weeklyComplete + ' of ' + g.people + ' complete this week</div></div>';
            }).join('') + '</div>';
            function cell(r, m) { var n = r.counts[m.key], t = r.targets[m.key]; if (!t) return '<td class="cnum mono" style="color:var(--faint)">' + (n || '–') + '</td>'; return '<td class="cnum mono" style="font-weight:600;color:' + (n >= t ? 'var(--good-d)' : 'var(--bad-d)') + '">' + n + ' / ' + t + '</td>'; }
            function status(w) { var c = w === 'Complete' ? 'var(--good-d)' : (w === 'Outstanding' ? 'var(--bad-d)' : (w === 'In progress' || w === 'Check role' ? 'var(--warn-d)' : 'var(--faint)')); return '<td style="font-weight:600;color:' + c + '">' + w + '</td>'; }
            h += '<div style="overflow:auto"><table class="tbl" id="lkTable"><thead><tr><th>Name</th><th>Group</th>' + wk.map(function (m) { return '<th style="text-align:center">' + esc(m.label) + ' (week)</th>'; }).join('') + '<th>Weekly status</th>' +
                mo.map(function (m) { return '<th style="text-align:center">' + esc(m.label) + ' (month)</th>'; }).join('') + '<th>Monthly status</th><th>Outstanding</th></tr></thead><tbody>' +
                R.rows.map(function (r) {
                    var sel = '<select class="field lk-group" data-key="' + esc(r.key) + '" style="font-size:12px;padding:5px 6px"><option value="?"' + (r.group ? '' : ' selected') + '>Check role</option>' +
                        cfg.groups.map(function (g) { return '<option' + (g.name === r.group ? ' selected' : '') + '>' + esc(g.name) + '</option>'; }).join('') + '<option value="">Not a leader (hide)</option></select>';
                    return '<tr><td style="font-weight:600">' + esc(r.name) + (r.role ? '<div class="mt">' + esc(r.role) + '</div>' : '') + '</td><td>' + sel + '</td>' + wk.map(function (m) { return cell(r, m); }).join('') + status(r.weekly) +
                        mo.map(function (m) { return cell(r, m); }).join('') + status(r.monthly) + '<td style="font-size:12.5px">' + esc(r.outstanding.join('; ')) + '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<div style="padding:10px 20px;font-size:12px;color:var(--faint)">Weekly KPIs count from Saturday to the as-at date; CCFV counts month to date. CCVS and CCFV Reds are not in the platform export, so they are not shown here.' +
                (Object.keys(st.choice).length ? ' <a href="#" id="lkReset">Reset group choices</a>' : '') + '</div></div>';
            el.innerHTML = h;
        }
        function load(file) {
            var fr = new FileReader();
            fr.onload = function () {
                try {
                    var wb = root_XLSX().read(new Uint8Array(fr.result), { type: 'array' }), best = null;
                    wb.SheetNames.forEach(function (n) { var t = root_XLSX().utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }); var p = parse(t, cfg); if (!p.error && (!best || p.counted > best.counted)) best = p; });
                    st.file = file.name;
                    if (!best) { st.parsed = null; st.error = parse([], cfg).error; }
                    else { st.parsed = best; st.error = ''; st.asAt = best.events.reduce(function (a, e) { return e.date > a ? e.date : a; }, '') || ''; if (!st.asAt) st.error = 'The export was read, but none of its ' + best.rows + ' documents is a KPI document with a date.'; }
                } catch (e) { st.parsed = null; st.error = 'Could not read that file: ' + e.message; }
                render();
            };
            fr.readAsArrayBuffer(file);
        }
        function root_XLSX() { if (typeof XLSX === 'undefined') throw new Error('the spreadsheet reader did not load'); return XLSX; }
        el.addEventListener('change', function (e) {
            if (e.target.id === 'lkFile' && e.target.files[0]) load(e.target.files[0]);
            else if (e.target.id === 'lkAsAt' && e.target.value) { st.asAt = e.target.value; render(); }
            else if (e.target.classList.contains('lk-group')) { var v = e.target.value; if (v === '?') delete st.choice[e.target.dataset.key]; else st.choice[e.target.dataset.key] = v; saveChoice(); render(); }
        });
        el.addEventListener('click', function (e) { if (e.target.id === 'lkReset') { e.preventDefault(); st.choice = {}; saveChoice(); render(); } });
        render();
    }
    return { parse: parse, compute: compute, mount: mount, personName: personName, toIsoDate: toIsoDate, weekStartOf: weekStartOf, groupForRole: groupForRole };
}));
