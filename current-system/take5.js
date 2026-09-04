(function () {
    var MIN = 3;
    var state = {
        view: 'capture', date: null, start: null, end: null, trendMode: 'daily',
        min: MIN,
        capture: [], dash: null, search: '', crew: 'All', filter: 'all',
        // dashboard-only
        indivQuery: '', excludedCrews: [], lbMetric: 'week', tSearch: '', tCrew: 'All',
        showNotify: false, notifySending: false, notifyTo: '', notifyCc: '', notifySubject: '', notifyBody: ''
    };

    var C = {
        compliant: { v: 'var(--good)', d: 'var(--good-d)', bg: 'var(--good-bg)', label: 'On track' },
        partial:   { v: 'var(--warn)', d: 'var(--warn-d)', bg: 'var(--warn-bg)', label: 'Below min' },
        missed:    { v: 'var(--bad)',  d: 'var(--bad-d)',  bg: 'var(--bad-bg)',  label: 'No Take 5' },
        off:       { v: '#cbd2dd',     d: 'var(--faint)',  bg: '#f1f3f7',        label: 'Off site' }
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function P(o, k) {
        if (o == null) return undefined;
        if (o[k] !== undefined) return o[k];
        var lc = k.charAt(0).toLowerCase() + k.slice(1);
        return o[lc];
    }
    function pad(n) { return ('0' + n).slice(-2); }
    function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function addDays(s, n) {
        var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function prettyDate(s) {
        if (!s) return '';
        var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
        var dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
        var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
        return dow + ', ' + (+p[2]) + ' ' + mon + ' ' + p[0];
    }
    function shortDate(s) {
        if (!s) return '';
        var p = s.split('-');
        var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1] - 1];
        return (+p[2]) + ' ' + mon + ' ' + p[0];
    }
    function prettyRange(a, b) {
        if (!a || !b) return '';
        if (a === b) return prettyDate(a);
        return shortDate(a) + ' – ' + shortDate(b);
    }
    function statusOf(count) { return count >= state.min ? 'compliant' : (count > 0 ? 'partial' : 'missed'); }
    function syncMinCopy() { $('#t5MinCopy').text(state.min); }

    function pipsHtml(count, accent) {
        var html = '';
        for (var i = 0; i < state.min; i++) {
            html += '<span class="pip" style="background:' + (i < count ? accent : 'var(--line)') + '"></span>';
        }
        if (count > state.min) html += '<span class="over">+' + (count - state.min) + '</span>';
        return html;
    }

    // ---------------------------------------------------------------- data
    function loadCapture() {
        $('#t5Capture').html('<div class="panel empty">Loading on-site workers…</div>');
        $.getJSON('/Take5/GetCapture', { date: state.date })
            .done(function (resp) {
                var m = P(resp, 'MinPerDay');
                if (m) state.min = m;
                var rows = P(resp, 'Rows') || [];
                state.capture = rows.map(function (r) {
                    return { employeeId: P(r, 'EmployeeId'), name: P(r, 'Name'), gender: P(r, 'Gender'), role: P(r, 'Role'),
                             crew: P(r, 'Crew'), company: P(r, 'Company'), count: P(r, 'TagCount') || 0 };
                });
                syncMinCopy();
                renderCapture();
            })
            .fail(function () { $('#t5Capture').html('<div class="panel empty" style="color:var(--bad)">Could not load data. Please try again.</div>'); });
    }
    function loadDashboard() {
        $('#t5Dashboard').html('<div class="panel empty">Building dashboard…</div>');
        $.getJSON('/Take5/GetDashboard', { startDate: state.start, endDate: state.end, trendMode: state.trendMode })
            .done(function (d) { state.dash = d; var m = P(d, 'MinPerDay'); if (m) state.min = m; syncMinCopy(); renderDashboard(); })
            .fail(function () { $('#t5Dashboard').html('<div class="panel empty" style="color:var(--bad)">Could not load data. Please try again.</div>'); });
    }
    function saveCount(employeeId, count) {
        $.ajax({ url: '/Take5/SaveCount', type: 'POST', data: { EmployeeId: employeeId, Take5Date: state.date, TagCount: count } })
            .fail(function () { if (window.toastr) toastr.error('Could not save the Take 5 count.', 'Failed'); });
    }

    // ------------------------------------------------------------- capture
    function captureSummary() {
        var onsite = state.capture.length, comp = 0;
        state.capture.forEach(function (p) { if (statusOf(p.count) === 'compliant') comp++; });
        return { onsite: onsite, comp: comp, below: onsite - comp, pct: onsite ? Math.round(comp / onsite * 100) : 0 };
    }
    function visibleRows() {
        var q = state.search.trim().toLowerCase();
        return state.capture.filter(function (p) {
            if (state.crew !== 'All' && p.crew !== state.crew) return false;
            if (q && !((p.name || '').toLowerCase().indexOf(q) >= 0 || (p.role || '').toLowerCase().indexOf(q) >= 0 || (p.crew || '').toLowerCase().indexOf(q) >= 0)) return false;
            if (state.filter === 'below' && statusOf(p.count) === 'compliant') return false;
            if (state.filter === 'submitted' && p.count <= 0) return false;
            if (state.filter === 'ontarget' && statusOf(p.count) !== 'compliant') return false;
            return true;
        });
    }
    function renderList() {
        var sum = captureSummary(), visible = visibleRows();
        var rows = visible.map(function (p) {
            var c = C[statusOf(p.count)];
            return '<div class="wrow">' +
                '<span class="rail" style="background:' + c.v + '"></span>' +
                '<div class="who"><div class="nm">' + esc(p.name) + '</div>' +
                    '<div class="meta">' + esc(p.role || '—') + ' · ' + esc(p.crew || p.company || '—') + '</div></div>' +
                '<span class="stat-tag" style="color:' + c.d + '">' + c.label + '</span>' +
                '<div class="pips">' + pipsHtml(p.count, c.v) + '</div>' +
                '<div class="stepper">' +
                    '<button class="sbtn" data-act="dec" data-id="' + p.employeeId + '">−</button>' +
                    '<span class="sval mono">' + p.count + '</span>' +
                    '<button class="sbtn plus" data-act="inc" data-id="' + p.employeeId + '">+</button>' +
                '</div>' +
                '<button class="setmin" data-act="min" data-id="' + p.employeeId + '">Set ' + state.min + '</button>' +
            '</div>';
        }).join('');
        $('#t5Showing').text(visible.length + ' of ' + sum.onsite + ' shown');
        $('#t5List').html(rows || '<div class="empty">No on-site workers for this date. Check the prestart for ' + esc(prettyDate(state.date)) + '.</div>');
    }
    function renderCapture() {
        var sum = captureSummary(), crews = [];
        state.capture.forEach(function (p) { if (p.crew && crews.indexOf(p.crew) < 0) crews.push(p.crew); });
        crews.sort();
        var opts = ['<option value="All"' + (state.crew === 'All' ? ' selected' : '') + '>All crews</option>'];
        crews.forEach(function (c) { opts.push('<option value="' + esc(c) + '"' + (state.crew === c ? ' selected' : '') + '>' + esc(c) + '</option>'); });

        var html =
            '<div class="strip" style="margin-bottom:16px">' +
                cell('Compliant', sum.pct + '%', false) +
                cell('On track', sum.comp, false) +
                cell('Below minimum', sum.below, false) +
                cell('On site today', sum.onsite, true) +
            '</div>' +
            '<div class="panel">' +
                '<div class="phead" style="gap:10px;flex-wrap:wrap">' +
                    '<div><h3>Daily capture</h3><p>' + esc(prettyDate(state.date)) + ' · tap −/+ to log each worker\'s tags</p></div>' +
                    '<div class="toolbar" style="margin-left:auto">' +
                        '<input id="t5Search" class="field" style="min-width:190px" placeholder="Search name, role, crew" value="' + esc(state.search) + '">' +
                        '<select id="t5Crew" class="field" style="min-width:150px">' + opts.join('') + '</select>' +
                        '<div class="seg">' +
                            '<button data-filter="all" class="' + (state.filter === 'all' ? 'on' : '') + '">All</button>' +
                            '<button data-filter="submitted" class="' + (state.filter === 'submitted' ? 'on' : '') + '">Submitted</button>' +
                            '<button data-filter="ontarget" class="' + (state.filter === 'ontarget' ? 'on' : '') + '">On target</button>' +
                            '<button data-filter="below" class="' + (state.filter === 'below' ? 'on' : '') + '">Below min</button>' +
                        '</div>' +
                        '<button class="xbtn" id="t5Excel" title="Export the on-site list to Excel"><i class="fa-solid fa-file-excel"></i> Export Excel</button>' +
                    '</div>' +
                '</div>' +
                '<div style="padding:7px 20px;border-bottom:1px solid var(--line);font-size:11.5px;color:var(--faint)" class="eyebrow"><span id="t5Showing"></span></div>' +
                '<div id="t5List"></div>' +
            '</div>';
        $('#t5Capture').html(html);
        renderList();
    }
    function cell(label, val, dark) {
        return '<div class="cell' + (dark ? ' dark' : '') + '"><div class="eyebrow">' + esc(label) + '</div><div class="num mono">' + val + '</div></div>';
    }
    function applyStep(id, act) {
        var p = state.capture.filter(function (x) { return x.employeeId === id; })[0];
        if (!p) return;
        if (act === 'inc') p.count = Math.min(20, p.count + 1);
        else if (act === 'dec') p.count = Math.max(0, p.count - 1);
        else if (act === 'min') p.count = state.min;
        saveCount(id, p.count);
        renderCapture();
    }

    // ----------------------------------------------------------- dashboard
    function dashRows() {
        var d = state.dash;
        return (P(d, 'TableRows') || []).map(function (r) {
            return {
                employeeId: P(r, 'EmployeeId'),
                name: P(r, 'Name') || '',
                role: P(r, 'Role') || '',
                crew: P(r, 'Crew') || '',
                onSite: P(r, 'OnSite'),
                rangeTotal: P(r, 'RangeTotal') || 0,
                weekTotal: P(r, 'WeekTotal') || 0,
                onSiteDays: P(r, 'OnSiteDays') || 0,
                compliantDays: P(r, 'CompliantDays') || 0,
                lifetime: P(r, 'Lifetime') || 0,
                status: P(r, 'Status') || 'off',
                spark: P(r, 'Spark') || []
            };
        });
    }
    function grpKeyOf(p) { return p.crew || 'Unassigned'; }
    function sparkHtml(spark) {
        return (spark || []).map(function (v) {
            if (v === null || v === undefined) return '<span class="t5-spark-bar" style="height:5px;background:#E3E6EA"></span>';
            var c = C[statusOf(v)];
            var h = Math.max(5, Math.round(Math.min(v, 4) / 4 * 30));
            return '<span class="t5-spark-bar" style="height:' + h + 'px;background:' + c.v + '"></span>';
        }).join('');
    }

    function renderDashboard() {
        var d = state.dash;
        if (!d) { $('#t5Dashboard').html('<div class="panel empty" style="color:var(--bad)">No data.</div>'); return; }
        var min = P(d, 'MinPerDay') || MIN;
        var workers = P(d, 'OnSiteCount') || 0, toAction = P(d, 'ToActionCount') || 0;
        var pct = P(d, 'CompliantPct') || 0, roster = P(d, 'RosterCount') || 0, onLeave = P(d, 'OnLeaveCount') || 0;
        var rangeTotal = P(d, 'RangeTagTotal') || 0, avg = P(d, 'AvgPerWorker') || '0.0';
        var onSiteDays = P(d, 'OnSiteDayCount') || 0, compliantDays = P(d, 'CompliantDayCount') || 0;
        var rangeLabel = prettyRange(state.start, state.end);
        var rows = dashRows();
        var weekTotal = rows.reduce(function (a, p) { return a + p.weekTotal; }, 0);

        // ---- Hero: compliance gauge + KPI cards ----
        var gaugeColor = pct < 50 ? 'var(--bad)' : (pct < 80 ? 'var(--warn)' : 'var(--teal)');
        var kpiDefs = [
            { l: 'On site in range', v: String(workers), s: onLeave + ' on leave · ' + roster + ' on prestart', c: 'var(--navy)', bar: '#0054a6' },
            { l: 'To action', v: String(toAction), s: 'below ' + min + '/day on ≥1 day', c: toAction > 0 ? 'var(--bad-d)' : 'var(--good-d)', bar: '#C0392B' },
            { l: 'Tags this week', v: String(weekTotal), s: rangeTotal + ' in range · ' + onSiteDays + ' worker-days', c: 'var(--navy)', bar: '#3f96b4' },
            { l: 'Avg / worker-day', v: avg, s: 'target ' + min + '.0', c: 'var(--navy)', bar: '#E0A100' }
        ];
        var kpiHtml = kpiDefs.map(function (k) {
            return '<div class="t5-kpi" style="border-bottom:3px solid ' + k.bar + '">' +
                '<div class="t5-kpi-l">' + esc(k.l) + '</div>' +
                '<div class="t5-kpi-v mono" style="color:' + k.c + '">' + esc(k.v) + '</div>' +
                '<div class="t5-kpi-s">' + esc(k.s) + '</div></div>';
        }).join('');
        var hero =
            '<div class="panel t5-hero" style="padding:24px 26px;margin-bottom:18px">' +
                '<div class="gauge-wrap">' +
                    '<div class="gauge" style="--pct:' + pct + ';--gauge:' + gaugeColor + '"><div class="hole">' +
                        '<div class="pctnum mono">' + pct + '%</div><div class="pctlbl">Compliant</div></div></div>' +
                    '<div class="t5-hero-cap">' +
                        '<div class="eyebrow" style="color:var(--faint)">Compliance · ' + esc(rangeLabel) + '</div>' +
                        '<div class="t5-hero-big">' + compliantDays + ' of ' + onSiteDays + ' worker-days</div>' +
                        '<div class="t5-hero-sub">met the ' + min + '-tag daily minimum</div>' +
                    '</div>' +
                    '<div class="t5-hero-kpis">' + kpiHtml + '</div>' +
                '</div>' +
            '</div>';

        // ---- Trend (unchanged) ----
        var trend = (P(d, 'Trend') || []);
        var hasTrend = trend.some(function (t) { return (P(t, 'Pct')) >= 0; });
        var trendCols = trend.map(function (t) {
            var tp = P(t, 'Pct');
            if (tp == null) tp = -1;
            if (tp < 0) {
                return '<div class="tcol" title="' + esc(P(t, 'Label')) + ': no data">' +
                    '<div class="tv mono" style="color:var(--faint)">–</div>' +
                    '<div class="tbar" style="height:2%;background:var(--line)"></div>' +
                    '<div class="tl">' + esc(P(t, 'Label')) + '</div></div>';
            }
            var col = tp < 50 ? 'var(--bad)' : (tp < 80 ? 'var(--warn)' : 'var(--navy)');
            return '<div class="tcol" title="' + esc(P(t, 'Label')) + ': ' + tp + '%">' +
                '<div class="tv mono">' + tp + '</div>' +
                '<div class="tbar" style="height:' + Math.max(tp, 2) + '%;background:' + col + '"></div>' +
                '<div class="tl">' + esc(P(t, 'Label')) + '</div></div>';
        }).join('');
        if (!hasTrend) trendCols = '<div class="empty" style="margin:auto">Not enough history yet.</div>';
        var trendBucket = state.trendMode === 'monthly' ? 'last 12 months' : (state.trendMode === 'daily' ? 'last 14 days' : 'last 12 weeks');
        var trendSelect =
            '<select id="t5TrendMode" class="field tmode">' +
                '<option value="daily"' + (state.trendMode === 'daily' ? ' selected' : '') + '>Daily</option>' +
                '<option value="weekly"' + (state.trendMode === 'weekly' ? ' selected' : '') + '>Weekly</option>' +
                '<option value="monthly"' + (state.trendMode === 'monthly' ? ' selected' : '') + '>Monthly</option>' +
            '</select>';

        var actions = '<div class="t5-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:14px">' +
            '<button class="xbtn" id="t5DashExcel" title="Export the dashboard summary to Excel"><i class="fa-solid fa-file-excel"></i> Export Excel</button>' +
            '<button class="xbtn" id="t5Pdf" title="Export the dashboard to PDF"><i class="fa-solid fa-file-pdf"></i> Export PDF</button></div>';

        var body =
            // Hero: gauge + KPI cards
            hero +
            // Individual lookup (filter-first)
            '<div class="panel t5-web-only" style="margin-bottom:16px">' +
                '<div class="phead" style="gap:10px;flex-wrap:wrap">' +
                    '<div><h3>Individual lookup</h3><p>Find one person\u2019s Take 5 record \u2014 in range, this week, lifetime and where they rank.</p></div>' +
                    '<input id="t5Indiv" class="field" style="min-width:240px;margin-left:auto" placeholder="Search a person\u2026" value="' + esc(state.indivQuery || '') + '">' +
                '</div>' +
                '<div id="t5LookupCards">' + lookupCardsHtml() + '</div>' +
            '</div>' +
            // Action list + Compliance by crew
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px">' +
                '<div class="panel t5-web-only" style="display:flex;flex-direction:column">' +
                    '<div class="phead"><div><h3>Action list \u2014 below minimum</h3><p>On site but under ' + min + ' tags on \u22651 day in range</p></div>' +
                        '<div style="display:flex;align-items:center;gap:10px">' +
                            '<button class="xbtn" id="t5NotifyOpen" title="Email supervisors the non-compliance list"><i class="fa-solid fa-envelope"></i> Notify supervisors</button>' +
                            '<span class="count-chip" style="background:var(--bad-bg);color:var(--bad-d)">' + (P(d, 'ActionList') || []).length + '</span>' +
                        '</div></div>' +
                    '<div style="max-height:430px;overflow:auto">' + actionRowsHtml() + '</div></div>' +
                '<div class="panel">' +
                    '<div class="phead" style="gap:10px;flex-wrap:wrap"><div><h3>Compliance by crew</h3><p>Share of on-site crew meeting the minimum \u00b7 worst first</p></div>' +
                        '<div id="t5CrewDD" class="t5-web-only" style="margin-left:auto">' + crewDropdownHtml() + '</div></div>' +
                    '<div id="t5CrewBars" style="padding:12px 20px;display:flex;flex-direction:column;gap:9px;max-height:430px;overflow:auto">' + crewBarsHtml() + '</div></div>' +
            '</div>' +
            // Leaderboards
            '<div id="t5LbPair" class="t5-web-only">' + leaderboardsHtml() + '</div>' +
            // Trend
            '<div class="panel" style="padding:18px 22px 14px;margin-bottom:16px">' +
                '<div class="trend-head">' +
                    '<div><h3 style="margin:0;font-size:15px;font-weight:700">Site compliance trend</h3>' +
                    '<p style="margin:1px 0 10px;font-size:12px;color:var(--grey)">% of on-site worker-days meeting the daily minimum \u00b7 ' + trendBucket + '</p></div>' +
                    trendSelect +
                '</div>' +
                '<div class="trend">' + trendCols + '</div></div>' +
            // Running totals
            '<div class="panel t5-web-only">' +
                '<div class="phead" style="gap:10px;flex-wrap:wrap"><div><h3>Running totals \u2014 every worker</h3><p>' + rows.length + ' on site in range \u00b7 in-range / this week / lifetime tags</p></div>' +
                    '<div class="toolbar" style="margin-left:auto">' +
                        '<input id="t5TableSearch" class="field" style="min-width:160px" placeholder="Search\u2026" value="' + esc(state.tSearch || '') + '">' +
                        '<select id="t5TableCrew" class="field" style="min-width:150px">' + tableCrewOptions(rows) + '</select>' +
                    '</div></div>' +
                '<div style="overflow:auto;max-height:520px"><table class="tbl"><thead><tr>' +
                    '<th>Worker</th><th>Crew</th><th style="text-align:center">In range</th>' +
                    '<th style="text-align:center">This week</th><th style="text-align:center">Lifetime</th><th>Status</th>' +
                '</tr></thead><tbody id="t5TableBody">' + tableBodyHtml(rows) + '</tbody></table></div></div>' +
            '<div id="t5ModalMount"></div>';

        $('#t5Dashboard').html(actions + '<div id="t5DashBody">' + body + '</div>');
    }

    // -------- dashboard sub-renders (targeted updates avoid losing input focus) --------
    function actionRowsHtml() {
        var action = (P(state.dash, 'ActionList') || []);
        return action.map(function (a) {
            var c = C[P(a, 'Status') || 'missed'] || C.missed;
            var below = P(a, 'DaysBelow') || 0, days = P(a, 'OnSiteDays') || 0;
            return '<div class="lrow"><div style="flex:1;min-width:0"><div class="nm">' + esc(P(a, 'Name')) + '</div>' +
                '<div class="mt">' + esc(P(a, 'Crew') || '—') + ' · below on ' + below + '/' + days + ' ' + (days === 1 ? 'day' : 'days') + '</div></div>' +
                '<div class="t5-spark t5-spark-sm" title="Last 5 days">' + sparkHtml(P(a, 'Spark')) + '</div>' +
                '<div class="badge mono" title="On-site days below the minimum" style="background:' + c.bg + ';color:' + c.d + '">' + below + '</div></div>';
        }).join('') || '<div class="empty">Everyone on site met the minimum.</div>';
    }

    function lookupCardsHtml() {
        var rows = dashRows();
        var iq = (state.indivQuery || '').trim().toLowerCase();
        if (!iq) return '<div class="t5-lookup-empty">Start typing a name, role or crew to pull up an individual\u2019s Take 5 record.</div>';
        var byLife = rows.slice().sort(function (a, b) { return b.lifetime - a.lifetime; });
        var rankOf = {}; byLife.forEach(function (p, i) { rankOf[p.employeeId] = i + 1; });
        function crewRankOf(p) {
            var k = grpKeyOf(p);
            var grp = rows.filter(function (x) { return grpKeyOf(x) === k; }).sort(function (a, b) { return b.lifetime - a.lifetime; });
            for (var i = 0; i < grp.length; i++) { if (grp[i].employeeId === p.employeeId) return { r: i + 1, n: grp.length }; }
            return { r: 1, n: 1 };
        }
        var matches = rows.filter(function (p) {
            return p.name.toLowerCase().indexOf(iq) >= 0 || p.role.toLowerCase().indexOf(iq) >= 0 || p.crew.toLowerCase().indexOf(iq) >= 0;
        });
        if (!matches.length) return '<div class="t5-lookup-empty">No worker matches \u201c' + esc(state.indivQuery) + '\u201d.</div>';
        function statBlock(label, val, color) {
            return '<div class="t5-stat"><div class="t5-stat-l">' + esc(label) + '</div><div class="t5-stat-v mono" style="color:' + color + '">' + esc(val) + '</div></div>';
        }
        return matches.slice(0, 8).map(function (p) {
            var c = C[p.status] || C.off;
            var cr = crewRankOf(p);
            var statusLabel = p.onSite ? c.label : 'Off site';
            return '<div class="t5-lookup-card">' +
                '<div class="t5-lookup-id"><div class="nm">' + esc(p.name) + '</div><div class="mt">' + esc(p.role || '—') + ' · ' + esc(grpKeyOf(p)) + '</div></div>' +
                statBlock('In range', String(p.rangeTotal), c.d) +
                statBlock('This week', String(p.weekTotal), 'var(--navy)') +
                statBlock('Lifetime', String(p.lifetime), 'var(--navy)') +
                statBlock('Project rank', '#' + (rankOf[p.employeeId] || '-'), '#0054a6') +
                statBlock('In crew', '#' + cr.r + '/' + cr.n, '#0054a6') +
                '<div class="t5-lookup-spark"><span class="t5-spark-l">Last 5 days</span><div class="t5-spark">' + sparkHtml(p.spark) + '</div></div>' +
                '<span class="chip" style="background:' + c.bg + ';color:' + c.d + '"><span class="dot" style="background:' + c.v + '"></span>' + esc(statusLabel) + '</span>' +
            '</div>';
        }).join('');
    }

    function crewBarsHtml() {
        var roll = (P(state.dash, 'CrewRollup') || []);
        var excluded = state.excludedCrews || [];
        var visible = roll.filter(function (r) { return excluded.indexOf(P(r, 'Crew')) < 0; });
        return visible.map(function (r) {
            var rp = P(r, 'Pct') || 0;
            var col = rp < 50 ? 'var(--bad)' : (rp < 80 ? 'var(--warn)' : 'var(--teal)');
            return '<div class="crewbar"><div class="top"><span class="c">' + esc(P(r, 'Crew')) + '</span>' +
                '<span class="r mono">' + (P(r, 'Compliant') || 0) + '/' + (P(r, 'OnSite') || 0) + ' · <strong style="color:var(--navy)">' + rp + '%</strong></span></div>' +
                '<div class="track"><div style="width:' + rp + '%;background:' + col + '"></div></div></div>';
        }).join('') || '<div class="empty">No crews to show. Adjust the crew filter.</div>';
    }

    function crewDropdownHtml() {
        var roll = (P(state.dash, 'CrewRollup') || []);
        var excluded = state.excludedCrews || [];
        var items = roll.map(function (r) {
            var cr = P(r, 'Crew');
            var checked = excluded.indexOf(cr) >= 0 ? ' checked' : '';
            return '<label class="t5-crewdd-item"><input type="checkbox" class="t5-crew-ex" value="' + esc(cr) + '"' + checked + '> ' + esc(cr) + '</label>';
        }).join('');
        var clear = excluded.length ? '<button class="t5-crewdd-clear" id="t5CrewExClear">Clear (' + excluded.length + ')</button>' : '';
        var summary = excluded.length ? ('Excluding ' + excluded.length + ' crew' + (excluded.length === 1 ? '' : 's')) : 'Exclude crews';
        return '<details class="t5-crewdd"><summary>' + esc(summary) + '</summary>' +
            '<div class="t5-crewdd-list">' + (items || '<div class="t5-lookup-empty">No crews.</div>') + clear + '</div></details>';
    }

    function leaderboardsHtml() {
        var rows = dashRows();
        var metric = state.lbMetric === 'lifetime' ? 'lifetime' : 'week';
        function mv(p) { return metric === 'week' ? p.weekTotal : p.lifetime; }
        var metricNote = metric === 'week' ? 'Take 5s logged this week' : 'Take 5s logged across the whole project';
        function medal(i) { return i === 0 ? '#C9A227' : i === 1 ? '#9AA0AA' : i === 2 ? '#B87333' : '#C9CED6'; }
        function metricBtn(key, label) {
            var on = state.lbMetric === key;
            return '<button class="t5-lb-btn' + (on ? ' on' : '') + '" data-lb="' + key + '">' + label + '</button>';
        }
        var grpNames = {}; rows.forEach(function (p) { grpNames[grpKeyOf(p)] = 1; });
        var crewAgg = Object.keys(grpNames).map(function (cr) {
            var grp = rows.filter(function (p) { return grpKeyOf(p) === cr; });
            var total = grp.reduce(function (a, p) { return a + mv(p); }, 0);
            var top = grp.slice().sort(function (a, b) { return mv(b) - mv(a); })[0];
            return { crew: cr, total: total, top: top, n: grp.length };
        }).filter(function (c) { return c.total > 0; }).sort(function (a, b) { return b.total - a.total; });
        var maxCrew = crewAgg.length ? (crewAgg[0].total || 1) : 1;
        var crewLb = crewAgg.map(function (c, i) {
            return '<div class="t5-lb-row"><span class="t5-lb-medal" style="background:' + medal(i) + '">' + (i + 1) + '</span>' +
                '<div style="flex:1;min-width:0">' +
                    '<div class="t5-lb-top"><span class="t5-lb-name">' + esc(c.crew) + '</span><span class="t5-lb-val mono">' + c.total + '</span></div>' +
                    '<div class="t5-lb-track"><div style="width:' + Math.round(c.total / maxCrew * 100) + '%;background:#0054a6"></div></div>' +
                    '<div class="t5-lb-sub">Top: <strong>' + esc(c.top ? c.top.name : '—') + '</strong> (' + (c.top ? mv(c.top) : 0) + ') · ' + c.n + ' in crew</div>' +
                '</div></div>';
        }).join('') || '<div class="empty">No contributions in this window.</div>';
        var performers = rows.slice().sort(function (a, b) { return mv(b) - mv(a); }).filter(function (p) { return mv(p) > 0; }).slice(0, 10);
        var maxPerf = performers.length ? (mv(performers[0]) || 1) : 1;
        var perfLb = performers.map(function (p, i) {
            return '<div class="t5-lb-row"><span class="t5-lb-medal" style="background:' + medal(i) + '">' + (i + 1) + '</span>' +
                '<div style="flex:1;min-width:0"><div class="t5-lb-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>' +
                '<div class="t5-lb-sub">' + esc(grpKeyOf(p)) + '</div></div>' +
                '<div class="t5-lb-track" style="width:80px;flex:none"><div style="width:' + Math.round(mv(p) / maxPerf * 100) + '%;background:var(--teal,#3f96b4)"></div></div>' +
                '<span class="t5-lb-val mono" style="min-width:42px;text-align:right">' + mv(p) + '</span></div>';
        }).join('') || '<div class="empty">No contributions in this window.</div>';
        return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px">' +
            '<div class="panel"><div class="phead" style="gap:10px;flex-wrap:wrap"><div><h3>Top crews by contribution</h3><p>' + metricNote + '. Shows each crew\u2019s top contributor.</p></div>' +
                '<div class="t5-lb-toggle" style="margin-left:auto">' + metricBtn('week', 'This week') + metricBtn('lifetime', 'Project total') + '</div></div>' +
                '<div style="max-height:430px;overflow:auto">' + crewLb + '</div></div>' +
            '<div class="panel"><div class="phead"><div><h3>Top performers \u2014 whole project</h3><p>Most Take 5s ' + (metric === 'week' ? 'this week' : 'all-time') + ', combining every crew.</p></div></div>' +
                '<div style="max-height:430px;overflow:auto">' + perfLb + '</div></div>' +
        '</div>';
    }

    function tableCrewOptions(rows) {
        var crews = [];
        rows.forEach(function (p) { if (p.crew && crews.indexOf(p.crew) < 0) crews.push(p.crew); });
        crews.sort();
        var opts = ['<option value="All"' + ((state.tCrew || 'All') === 'All' ? ' selected' : '') + '>All crews</option>'];
        crews.forEach(function (c) { opts.push('<option value="' + esc(c) + '"' + (state.tCrew === c ? ' selected' : '') + '>' + esc(c) + '</option>'); });
        return opts.join('');
    }

    function tableBodyHtml(rows) {
        rows = rows || dashRows();
        var tq = (state.tSearch || '').trim().toLowerCase();
        var tCrew = state.tCrew || 'All';
        var filtered = rows.filter(function (p) {
            if (tCrew !== 'All' && p.crew !== tCrew) return false;
            if (tq && !(p.name.toLowerCase().indexOf(tq) >= 0 || p.role.toLowerCase().indexOf(tq) >= 0 || p.crew.toLowerCase().indexOf(tq) >= 0)) return false;
            return true;
        });
        var html = filtered.map(function (p) {
            var c = C[p.status] || C.off;
            return '<tr><td><div class="nm" style="font-weight:600">' + esc(p.name) + '</div>' +
                '<div class="mt" style="font-size:11.5px;color:var(--faint)">' + esc(p.role || '—') + '</div></td>' +
                '<td style="color:var(--grey)">' + esc(p.crew || '—') + '</td>' +
                '<td class="cnum mono">' + p.rangeTotal + '</td>' +
                '<td class="cnum mono" style="color:var(--grey);font-weight:600">' + p.weekTotal + '</td>' +
                '<td class="cnum mono">' + p.lifetime + '</td>' +
                '<td><span class="chip" style="background:' + c.bg + ';color:' + c.d + '"><span class="dot" style="background:' + c.v + '"></span>' + c.label + '</span></td></tr>';
        }).join('');
        return html || '<tr><td colspan="6" class="empty">No workers match.</td></tr>';
    }

    // -------- Notify supervisors --------
    function notifyBodyText() {
        var d = state.dash; if (!d) return '';
        var action = (P(d, 'ActionList') || []);
        var min = P(d, 'MinPerDay') || MIN;
        var lines = ['Take 5 non-compliance — ' + prettyRange(state.start, state.end),
            'Minimum ' + min + ' per worker per day. ' + action.length + ' on-site personnel below minimum.', ''];
        var groups = {};
        action.forEach(function (a) { var cr = P(a, 'Crew') || 'Unassigned'; (groups[cr] = groups[cr] || []).push(a); });
        Object.keys(groups).sort().forEach(function (cr) {
            lines.push(cr + ':');
            groups[cr].slice().sort(function (a, b) { return (P(a, 'TagCount') || 0) - (P(b, 'TagCount') || 0); }).forEach(function (a) {
                lines.push('  • ' + P(a, 'Name') + ' — ' + (P(a, 'TagCount') || 0) + ' tags, below on ' + (P(a, 'DaysBelow') || 0) + '/' + (P(a, 'OnSiteDays') || 0) + ' days');
            });
            lines.push('');
        });
        return lines.join('\n');
    }

    function renderNotifyModal() {
        if (!state.showNotify) { $('#t5ModalMount').html(''); return; }
        var subject = state.notifySubject || ('Take 5 Compliance — ' + prettyRange(state.start, state.end));
        var bodyVal = state.notifyBody || notifyBodyText();
        var html =
            '<div class="t5-modal-bg" id="t5NotifyBg">' +
                '<div class="t5-modal">' +
                    '<div class="t5-modal-h">Notify supervisors</div>' +
                    '<div class="t5-modal-sub">Email the non-compliance list. Edit the recipients and message, then send.</div>' +
                    '<label class="t5-modal-lbl">To</label>' +
                    '<input id="t5NotifyTo" class="t5-modal-in" placeholder="name@company.com; another@company.com" value="' + esc(state.notifyTo || '') + '">' +
                    '<label class="t5-modal-lbl">Cc <span class="t5-modal-opt">(optional)</span></label>' +
                    '<input id="t5NotifyCc" class="t5-modal-in" placeholder="cc@company.com" value="' + esc(state.notifyCc || '') + '">' +
                    '<label class="t5-modal-lbl">Subject</label>' +
                    '<input id="t5NotifySubject" class="t5-modal-in" value="' + esc(subject) + '">' +
                    '<label class="t5-modal-lbl">Message</label>' +
                    '<textarea id="t5NotifyBody" class="t5-modal-ta">' + esc(bodyVal) + '</textarea>' +
                    '<div class="t5-modal-actions">' +
                        '<button class="t5-btn-ghost" id="t5NotifyCancel">Cancel</button>' +
                        '<button class="t5-btn-primary" id="t5NotifySend"' + (state.notifySending ? ' disabled' : '') + '>' + (state.notifySending ? 'Sending…' : 'Send notification') + '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        $('#t5ModalMount').html(html);
    }

    // --------------------------------------------------------------- export
    function exportCaptureExcel() {
        if (!state.capture.length) { if (window.toastr) toastr.info('No on-site workers to export.', 'Take 5'); return; }
        var sum = captureSummary();
        var navy = '#1f396c';
        var hdr = function (v) { return { value: v, bold: true, background: navy, color: '#ffffff', textAlign: 'left' }; };

        var rows = [
            { cells: [{ value: 'Take 5 Compliance — Daily Capture', bold: true, fontSize: 15 }] },
            { cells: [{ value: prettyDate(state.date) }] },
            { cells: [{ value: 'On site: ' + sum.onsite + '   On track: ' + sum.comp + '   Below min: ' + sum.below + '   Compliance: ' + sum.pct + '%   Minimum/day: ' + state.min }] },
            { cells: [] },
            { cells: [hdr('Name'), hdr('Gender'), hdr('Role'), hdr('Crew'), hdr('Company'), hdr('Tags'), hdr('Minimum'), hdr('Status')] }
        ];

        state.capture.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); })
            .forEach(function (p) {
                var label = C[statusOf(p.count)].label;
                rows.push({ cells: [
                    { value: p.name || '' },
                    { value: p.gender || '' },
                    { value: p.role || '' },
                    { value: p.crew || '' },
                    { value: p.company || '' },
                    { value: p.count, textAlign: 'center' },
                    { value: state.min, textAlign: 'center' },
                    { value: label }
                ] });
            });

        var workbook = new kendo.ooxml.Workbook({
            sheets: [{
                title: 'Take 5 Capture',
                freezePane: { rowSplit: 5 },
                columns: [{ width: 200 }, { width: 90 }, { width: 170 }, { width: 150 }, { width: 180 }, { width: 70 }, { width: 80 }, { width: 110 }],
                rows: rows
            }]
        });

        workbook.toDataURLAsync().then(function (dataURL) {
            kendo.saveAs({ dataURI: dataURL, fileName: 'Take5_Capture_' + state.date + '.xlsx' });
        });
    }

    function buildPdfDoc(css, body) {
        return '<!doctype html><html><head><meta charset="utf-8"><title>Take 5 Dashboard - ' + esc(state.start + '_' + state.end) + '</title>' +
            '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">' +
            '<style>' + css + '</style>' +
            '<style>' +
            'html,body{margin:0;padding:0;background:#fff;}' +
            'body{font-family:Poppins,"Segoe UI",system-ui,sans-serif;padding:26px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
            '#t5 .panel,#t5 .strip{break-inside:avoid;}' +
            '#t5 div{max-height:none !important;overflow:visible !important;}' +
            '#t5 .t5-hero-kpis{grid-template-columns:repeat(2,1fr) !important;}' +
            '.pdf-head{font-size:21px;font-weight:700;color:#1f396c;margin:0;}' +
            '.pdf-sub{font-size:13px;color:#6b7280;margin:2px 0 20px;}' +
            '@media print{.pdf-note{display:none;}}' +
            '.pdf-note{font-size:11px;color:#9aa3b2;margin-top:18px;}' +
            '</style></head><body><div id="t5">' +
            '<div class="pdf-head">Take 5 Compliance — Dashboard</div>' +
            '<div class="pdf-sub">' + esc(prettyRange(state.start, state.end)) + '</div>' +
            body +
            '<div class="pdf-note">Generated ' + esc(new Date().toLocaleString()) + '</div>' +
            '</div></body></html>';
    }

    function statusLabel(key) {
        return (C[key] || C.off).label;
    }
    function sparkExport(spark) {
        return (spark || []).map(function (v) {
            if (v === null || v === undefined) return '—';
            return String(v);
        }).join(' / ');
    }

    function exportDashboardExcel() {
        var d = state.dash;
        if (!d) { if (window.toastr) toastr.info('No dashboard data to export.', 'Take 5'); return; }

        var min = P(d, 'MinPerDay') || MIN;
        var rangeLabel = prettyRange(state.start, state.end);
        var workers = P(d, 'OnSiteCount') || 0, toAction = P(d, 'ToActionCount') || 0;
        var pct = P(d, 'CompliantPct') || 0, roster = P(d, 'RosterCount') || 0, onLeave = P(d, 'OnLeaveCount') || 0;
        var rangeTotal = P(d, 'RangeTagTotal') || 0, avg = P(d, 'AvgPerWorker') || '0.0';
        var onSiteDays = P(d, 'OnSiteDayCount') || 0, compliantDays = P(d, 'CompliantDayCount') || 0;
        var rows = dashRows();
        var weekTotal = rows.reduce(function (a, p) { return a + p.weekTotal; }, 0);
        var trendBucket = state.trendMode === 'monthly' ? 'last 12 months' : (state.trendMode === 'daily' ? 'last 14 days' : 'last 12 weeks');
        var lbMetric = state.lbMetric === 'lifetime' ? 'lifetime' : 'week';
        var lbLabel = lbMetric === 'week' ? 'This week' : 'Project total';

        var navy = '#1f396c';
        var hdr = function (v) { return { value: v, bold: true, background: navy, color: '#ffffff', textAlign: 'left' }; };
        var hdrC = function (v) { return { value: v, bold: true, background: navy, color: '#ffffff', textAlign: 'center' }; };
        var titleRow = function (t) { return { cells: [{ value: t, bold: true, fontSize: 14 }] }; };
        var subRow = function (t) { return { cells: [{ value: t }] }; };
        var blank = function () { return { cells: [] }; };

        // ---- Sheet 1: Summary ----
        var summaryRows = [
            titleRow('Take 5 Compliance — Dashboard Summary'),
            subRow(rangeLabel),
            subRow('Minimum ' + min + ' tags per worker per day on site'),
            blank(),
            { cells: [hdr('Metric'), hdr('Value'), hdr('Detail')] },
            { cells: [{ value: 'Compliance' }, { value: pct + '%', textAlign: 'center' }, { value: compliantDays + ' of ' + onSiteDays + ' worker-days met the minimum' }] },
            { cells: [{ value: 'On site in range' }, { value: workers, textAlign: 'center' }, { value: onLeave + ' on leave · ' + roster + ' on prestart' }] },
            { cells: [{ value: 'To action' }, { value: toAction, textAlign: 'center' }, { value: 'below ' + min + '/day on ≥1 day' }] },
            { cells: [{ value: 'Tags this week' }, { value: weekTotal, textAlign: 'center' }, { value: rangeTotal + ' in range · ' + onSiteDays + ' worker-days' }] },
            { cells: [{ value: 'Avg / worker-day' }, { value: avg, textAlign: 'center' }, { value: 'target ' + min + '.0' }] }
        ];

        // ---- Sheet 2: Action list ----
        var action = (P(d, 'ActionList') || []);
        var actionRows = [
            titleRow('Action list — below minimum'),
            subRow('On site but under ' + min + ' tags on ≥1 day in range · ' + rangeLabel),
            blank(),
            { cells: [hdr('Name'), hdr('Crew'), hdrC('Days below'), hdrC('On-site days'), hdrC('Tags in range'), hdr('Status'), hdr('Last 5 days')] }
        ];
        action.slice().sort(function (a, b) { return (P(a, 'Name') || '').localeCompare(P(b, 'Name') || ''); })
            .forEach(function (a) {
                actionRows.push({ cells: [
                    { value: P(a, 'Name') || '' },
                    { value: P(a, 'Crew') || '—' },
                    { value: P(a, 'DaysBelow') || 0, textAlign: 'center' },
                    { value: P(a, 'OnSiteDays') || 0, textAlign: 'center' },
                    { value: P(a, 'TagCount') || 0, textAlign: 'center' },
                    { value: statusLabel(P(a, 'Status') || 'missed') },
                    { value: sparkExport(P(a, 'Spark')) }
                ] });
            });
        if (!action.length) actionRows.push({ cells: [{ value: 'Everyone on site met the minimum.' }] });

        // ---- Sheet 3: Compliance by crew ----
        var roll = (P(d, 'CrewRollup') || []);
        var crewRows = [
            titleRow('Compliance by crew'),
            subRow('Share of on-site crew meeting the daily minimum · ' + rangeLabel),
            blank(),
            { cells: [hdr('Crew'), hdrC('Compliant'), hdrC('On site'), hdrC('Compliance %')] }
        ];
        roll.slice().sort(function (a, b) { return (P(a, 'Pct') || 0) - (P(b, 'Pct') || 0); })
            .forEach(function (r) {
                crewRows.push({ cells: [
                    { value: P(r, 'Crew') || '' },
                    { value: P(r, 'Compliant') || 0, textAlign: 'center' },
                    { value: P(r, 'OnSite') || 0, textAlign: 'center' },
                    { value: (P(r, 'Pct') || 0) + '%', textAlign: 'center' }
                ] });
            });
        if (!roll.length) crewRows.push({ cells: [{ value: 'No crew data for this range.' }] });

        // ---- Sheet 4 & 5: Leaderboards ----
        function mv(p) { return lbMetric === 'week' ? p.weekTotal : p.lifetime; }
        var grpNames = {};
        rows.forEach(function (p) { grpNames[grpKeyOf(p)] = 1; });
        var crewAgg = Object.keys(grpNames).map(function (cr) {
            var grp = rows.filter(function (p) { return grpKeyOf(p) === cr; });
            var total = grp.reduce(function (a, p) { return a + mv(p); }, 0);
            var top = grp.slice().sort(function (a, b) { return mv(b) - mv(a); })[0];
            return { crew: cr, total: total, top: top, n: grp.length };
        }).filter(function (c) { return c.total > 0; }).sort(function (a, b) { return b.total - a.total; });

        var crewLbRows = [
            titleRow('Top crews by contribution'),
            subRow(lbLabel + ' · ' + rangeLabel),
            blank(),
            { cells: [hdrC('Rank'), hdr('Crew'), hdrC('Total tags'), hdr('Top contributor'), hdrC('Top tags'), hdrC('Crew size')] }
        ];
        crewAgg.forEach(function (c, i) {
            crewLbRows.push({ cells: [
                { value: i + 1, textAlign: 'center' },
                { value: c.crew },
                { value: c.total, textAlign: 'center' },
                { value: c.top ? c.top.name : '—' },
                { value: c.top ? mv(c.top) : 0, textAlign: 'center' },
                { value: c.n, textAlign: 'center' }
            ] });
        });
        if (!crewAgg.length) crewLbRows.push({ cells: [{ value: 'No contributions in this window.' }] });

        var performers = rows.slice().sort(function (a, b) { return mv(b) - mv(a); }).filter(function (p) { return mv(p) > 0; });
        var perfLbRows = [
            titleRow('Top performers'),
            subRow('Most Take 5s ' + (lbMetric === 'week' ? 'this week' : 'all-time') + ' · ' + rangeLabel),
            blank(),
            { cells: [hdrC('Rank'), hdr('Worker'), hdr('Crew'), hdrC('Tags')] }
        ];
        performers.forEach(function (p, i) {
            perfLbRows.push({ cells: [
                { value: i + 1, textAlign: 'center' },
                { value: p.name },
                { value: grpKeyOf(p) },
                { value: mv(p), textAlign: 'center' }
            ] });
        });
        if (!performers.length) perfLbRows.push({ cells: [{ value: 'No contributions in this window.' }] });

        // ---- Sheet 6: Trend ----
        var trend = (P(d, 'Trend') || []);
        var trendRows = [
            titleRow('Site compliance trend'),
            subRow('% of on-site worker-days meeting the daily minimum · ' + trendBucket),
            blank(),
            { cells: [hdr('Period'), hdrC('Compliance %')] }
        ];
        trend.forEach(function (t) {
            var tp = P(t, 'Pct');
            trendRows.push({ cells: [
                { value: P(t, 'Label') || '' },
                { value: tp == null || tp < 0 ? '—' : tp + '%', textAlign: 'center' }
            ] });
        });
        if (!trend.length) trendRows.push({ cells: [{ value: 'Not enough history yet.' }] });

        // ---- Sheet 7: Running totals ----
        var tableRows = [
            titleRow('Running totals — every worker'),
            subRow(rows.length + ' on site in range · ' + rangeLabel),
            blank(),
            { cells: [hdr('Worker'), hdr('Role'), hdr('Crew'), hdrC('In range'), hdrC('This week'), hdrC('Lifetime'), hdrC('On-site days'), hdrC('Compliant days'), hdr('Status')] }
        ];
        rows.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); })
            .forEach(function (p) {
                tableRows.push({ cells: [
                    { value: p.name },
                    { value: p.role || '—' },
                    { value: p.crew || '—' },
                    { value: p.rangeTotal, textAlign: 'center' },
                    { value: p.weekTotal, textAlign: 'center' },
                    { value: p.lifetime, textAlign: 'center' },
                    { value: p.onSiteDays, textAlign: 'center' },
                    { value: p.compliantDays, textAlign: 'center' },
                    { value: statusLabel(p.status) }
                ] });
            });
        if (!rows.length) tableRows.push({ cells: [{ value: 'No workers on site in this range.' }] });

        var workbook = new kendo.ooxml.Workbook({
            sheets: [
                { title: 'Summary', freezePane: { rowSplit: 4 }, columns: [{ width: 200 }, { width: 90 }, { width: 360 }], rows: summaryRows },
                { title: 'Action List', freezePane: { rowSplit: 4 }, columns: [{ width: 200 }, { width: 150 }, { width: 90 }, { width: 100 }, { width: 110 }, { width: 100 }, { width: 120 }], rows: actionRows },
                { title: 'Compliance by Crew', freezePane: { rowSplit: 4 }, columns: [{ width: 200 }, { width: 90 }, { width: 90 }, { width: 110 }], rows: crewRows },
                { title: 'Top Crews', freezePane: { rowSplit: 4 }, columns: [{ width: 50 }, { width: 200 }, { width: 90 }, { width: 200 }, { width: 80 }, { width: 80 }], rows: crewLbRows },
                { title: 'Top Performers', freezePane: { rowSplit: 4 }, columns: [{ width: 50 }, { width: 200 }, { width: 180 }, { width: 80 }], rows: perfLbRows },
                { title: 'Compliance Trend', freezePane: { rowSplit: 4 }, columns: [{ width: 140 }, { width: 110 }], rows: trendRows },
                { title: 'Running Totals', freezePane: { rowSplit: 4 }, columns: [{ width: 200 }, { width: 170 }, { width: 150 }, { width: 80 }, { width: 90 }, { width: 80 }, { width: 100 }, { width: 110 }, { width: 100 }], rows: tableRows }
            ]
        });

        workbook.toDataURLAsync().then(function (dataURL) {
            kendo.saveAs({ dataURI: dataURL, fileName: 'Take5_Dashboard_' + state.start + '_to_' + state.end + '.xlsx' });
        });
    }

    function exportDashboardPdf() {
        var node = document.getElementById('t5DashBody');
        if (!node || !state.dash) { return; }
        // PDF is a summary: keep aggregates only, drop the full per-worker list (web-only).
        var clone = node.cloneNode(true);
        clone.querySelectorAll('.t5-web-only').forEach(function (el) { el.parentNode.removeChild(el); });
        var body = clone.innerHTML;

        var win = window.open('', '_blank', 'width=1180,height=860');
        if (!win) { if (window.toastr) toastr.error('Pop-up blocked. Allow pop-ups for this site to export PDF.', 'Failed'); return; }
        win.document.write('<!doctype html><title>Preparing…</title><body style="font-family:sans-serif;padding:26px;color:#6b7280">Preparing PDF…</body>');

        var link = document.getElementById('t5cssLink');
        var href = link ? link.href : '/css/take5.css';

        var finish = function (css) {
            win.document.open();
            win.document.write(buildPdfDoc(css, body));
            win.document.close();
            win.focus();
            setTimeout(function () { try { win.print(); } catch (e) { } }, 350);
        };

        fetch(href).then(function (r) { return r.text(); }).then(finish).catch(function () { finish(''); });
    }

    // -------------------------------------------------------------- events
    function setTab(tab) {
        state.view = tab;
        $('#t5 .tab').removeClass('on');
        $('#t5 .tab[data-tab="' + tab + '"]').addClass('on');
        if (tab === 'capture') {
            $('#t5DayNav').show(); $('#t5RangeNav').hide();
            $('#t5Capture').show(); $('#t5Dashboard').hide(); loadCapture();
        } else {
            $('#t5DayNav').hide(); $('#t5RangeNav').show();
            $('#t5Capture').hide(); $('#t5Dashboard').show(); loadDashboard();
        }
    }
    function reload() { if (state.view === 'capture') loadCapture(); else loadDashboard(); }

    $(document).on('click', '#t5 .tab', function () { setTab($(this).data('tab')); });
    $(document).on('change', '#t5Date', function () { state.date = this.value; reload(); });
    $(document).on('click', '#t5Prev', function () { state.date = addDays(state.date, -1); document.getElementById('t5Date').value = state.date; reload(); });
    $(document).on('click', '#t5Next', function () { state.date = addDays(state.date, 1); document.getElementById('t5Date').value = state.date; reload(); });
    $(document).on('change', '#t5Start', function () {
        state.start = this.value;
        if (state.end && state.start > state.end) { state.end = state.start; document.getElementById('t5End').value = state.end; }
        loadDashboard();
    });
    $(document).on('change', '#t5End', function () {
        state.end = this.value;
        if (state.start && state.end < state.start) { state.start = state.end; document.getElementById('t5Start').value = state.start; }
        loadDashboard();
    });
    $(document).on('change', '#t5TrendMode', function () { state.trendMode = this.value; loadDashboard(); });
    $(document).on('click', '#t5Capture [data-act]', function () { applyStep(parseInt($(this).data('id'), 10), $(this).data('act')); });
    $(document).on('input', '#t5Search', function () { state.search = this.value; renderList(); });
    $(document).on('change', '#t5Crew', function () { state.crew = this.value; renderCapture(); });
    $(document).on('click', '#t5Capture .seg button[data-filter]', function () { state.filter = $(this).data('filter'); renderCapture(); });
    $(document).on('click', '#t5Excel', exportCaptureExcel);
    $(document).on('click', '#t5DashExcel', exportDashboardExcel);
    $(document).on('click', '#t5Pdf', exportDashboardPdf);

    // ---- dashboard interactions (targeted re-renders) ----
    $(document).on('input', '#t5Indiv', function () { state.indivQuery = this.value; $('#t5LookupCards').html(lookupCardsHtml()); });
    $(document).on('change', '.t5-crew-ex', function () {
        var ex = [];
        $('.t5-crew-ex:checked').each(function () { ex.push(this.value); });
        state.excludedCrews = ex;
        $('#t5CrewBars').html(crewBarsHtml());
        $('#t5CrewDD').html(crewDropdownHtml());
    });
    $(document).on('click', '#t5CrewExClear', function (e) {
        e.preventDefault();
        state.excludedCrews = [];
        $('#t5CrewBars').html(crewBarsHtml());
        $('#t5CrewDD').html(crewDropdownHtml());
    });
    $(document).on('click', '.t5-lb-btn', function () { state.lbMetric = $(this).data('lb'); $('#t5LbPair').html(leaderboardsHtml()); });
    $(document).on('input', '#t5TableSearch', function () { state.tSearch = this.value; $('#t5TableBody').html(tableBodyHtml()); });
    $(document).on('change', '#t5TableCrew', function () { state.tCrew = this.value; $('#t5TableBody').html(tableBodyHtml()); });

    // ---- notify supervisors modal ----
    $(document).on('click', '#t5NotifyOpen', function () {
        state.showNotify = true; state.notifySending = false;
        state.notifySubject = 'Take 5 Compliance — ' + prettyRange(state.start, state.end);
        state.notifyBody = notifyBodyText();
        renderNotifyModal();
    });
    $(document).on('click', '#t5NotifyCancel', function () { state.showNotify = false; renderNotifyModal(); });
    $(document).on('mousedown', '#t5NotifyBg', function (e) { if (e.target === this) { state.showNotify = false; renderNotifyModal(); } });
    $(document).on('click', '#t5NotifySend', sendNotify);

    function sendNotify() {
        if (state.notifySending) return;
        var to = ($('#t5NotifyTo').val() || '').trim();
        if (!to) { if (window.toastr) toastr.warning('Add at least one recipient.', 'Notify supervisors'); return; }
        var payload = {
            To: to,
            Cc: ($('#t5NotifyCc').val() || '').trim(),
            Subject: ($('#t5NotifySubject').val() || '').trim(),
            Body: $('#t5NotifyBody').val() || ''
        };
        // preserve edits across the re-render
        state.notifyTo = payload.To; state.notifyCc = payload.Cc;
        state.notifySubject = payload.Subject; state.notifyBody = payload.Body;
        state.notifySending = true; renderNotifyModal();

        $.ajax({ url: '/Take5/Notify', type: 'POST', data: payload })
            .done(function (res) {
                state.notifySending = false;
                if (res && (res.Sent > 0 || res.sent > 0)) {
                    state.showNotify = false; state.notifyTo = ''; state.notifyCc = '';
                    renderNotifyModal();
                    if (window.toastr) toastr.success('Supervisors notified.', 'Take 5');
                } else {
                    renderNotifyModal();
                    if (window.toastr) toastr.error((res && (res.Message || res.message)) || 'Could not send the notification.', 'Failed');
                }
            })
            .fail(function () {
                state.notifySending = false; renderNotifyModal();
                if (window.toastr) toastr.error('Could not send the notification.', 'Failed');
            });
    }

    $(function () {
        state.date = todayStr();
        state.end = state.date;
        state.start = addDays(state.date, -6);
        document.getElementById('t5Date').value = state.date;
        document.getElementById('t5Start').value = state.start;
        document.getElementById('t5End').value = state.end;
        setTab('capture');
    });
})();
