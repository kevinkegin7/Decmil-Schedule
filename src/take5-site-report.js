/*
 * Take 5 Compliance — site-specific daily report
 * ----------------------------------------------
 * Reproduces, from a Site Diary capture list, the daily management report
 * that the Decmil "Take 5 and KPI register" workbook builds by hand on its
 * Email Report sheet: who is required to do a Take 5, who did none, and the
 * Maintenance / Operations table (crew size, Take 5s, ratio, zeros).
 *
 * The rules are NOT hard-coded here. They come from a per-project config
 * (see config/site-10265.json), transcribed from the workbook's keyword lists:
 *
 *   notRequired.roleKeywords        role contains any      → Not required
 *   notRequired.roleOrCrewKeywords  role OR crew contains  → Not required
 *   optional.nameOrRoleKeywords     name or role contains  → Optional: counted
 *                                   only on days they have Take 5s
 *   groups.maintenanceRoleKeywords  role contains any      → Maintenance,
 *                                   otherwise Operations
 *   minPerDay                       the daily minimum (3 on 10265)
 *
 * Precedence, exactly as the workbook applies it:
 *   1. an explicit per-person override (required: true/false) wins
 *   2. Optional (name/role keywords)  → included only when they have Take 5s;
 *      at zero they are excluded with status "Optional". This is tested
 *      BEFORE the Not-required rules, so a surveyor in a "Site Office" crew
 *      is Optional, not Not required.
 *   3. Not required (keywords)        → excluded, status "Not required"
 *   4. everyone else is Included: "In range" (>= min), "Below min" (1..min-1),
 *      "No Take 5" (0; these form the email's "didn't do take 5s" list)
 *
 * Take 5 counts can come from Site Diary's own tag counts or from the paper
 * register; this module does not care which. It is plain ES5 with no
 * dependencies so take5.js can use it in the browser unchanged, and the
 * workbook's own per-person columns are the conformance test
 * (src/take5-site-report.test.js).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Take5SiteReport = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ------------------------------------------------------------ helpers
    function P(o, k) {
        if (o == null) return undefined;
        if (o[k] !== undefined) return o[k];
        var lc = k.charAt(0).toLowerCase() + k.slice(1);
        if (o[lc] !== undefined) return o[lc];
        var uc = k.charAt(0).toUpperCase() + k.slice(1);
        return o[uc];
    }
    function lower(s) { return String(s == null ? '' : s).toLowerCase(); }
    function containsAny(haystack, keywords) {
        var h = lower(haystack);
        if (!h) return null;
        for (var i = 0; i < (keywords || []).length; i++) {
            var k = lower(keywords[i]).trim();
            if (k && h.indexOf(k) >= 0) return keywords[i];
        }
        return null;
    }
    function num(v) {
        if (v === null || v === undefined || v === '') return 0;
        var n = Number(v);
        return isNaN(n) ? 0 : n;
    }
    function pad(n) { return ('0' + n).slice(-2); }

    /* Accepts a Site Diary capture row (PascalCase from the API, camelCase from
       take5.js state, or the Excel export's column names) and returns the flat
       shape the report works on. `tags` may be overridden by the caller, e.g.
       with a count from the paper register. */
    function fromCaptureRow(r, tagsOverride) {
        var tags = tagsOverride !== undefined ? tagsOverride
            : (P(r, 'TagCount') !== undefined ? P(r, 'TagCount') : (P(r, 'Tags') !== undefined ? P(r, 'Tags') : P(r, 'count')));
        return {
            employeeId: P(r, 'EmployeeId'),
            name: String(P(r, 'Name') || '').trim(),
            gender: P(r, 'Gender'),
            role: String(P(r, 'Role') || '').trim(),
            crew: String(P(r, 'Crew') || '').trim(),
            company: String(P(r, 'Company') || '').trim(),
            onSite: P(r, 'OnSite'),
            tags: num(tags)
        };
    }

    // ------------------------------------------------------- classification
    /* Classify one person under a site config. Returns:
       { required, optional, included, group, status, reason }
       `overrides` maps employeeId (or name, when no id) to a boolean "required". */
    function classify(person, config, overrides) {
        var cfg = config || {};
        var nr = cfg.notRequired || {}, opt = cfg.optional || {}, grp = cfg.groups || {};
        var min = num(cfg.minPerDay) || 3;
        var key = person.employeeId != null ? person.employeeId : person.name;
        var out = { required: true, optional: false, included: true, group: '', status: '', reason: '' };

        var hitRole = containsAny(person.role, nr.roleKeywords);
        // The workbook searches the Not-required list in role+" "+crew and the
        // Optional list in name+" "+role (Email Report AA5 / AB5).
        var hitRC = containsAny(person.role + ' ' + person.crew, nr.roleOrCrewKeywords);
        var hitOpt = containsAny(person.name + ' ' + person.role, opt.nameOrRoleKeywords);

        // Overrides: 'required' | 'notRequired' | 'optional' (booleans accepted: true/false).
        var forced = overrides && Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : null;
        if (forced === true) forced = 'required'; else if (forced === false) forced = 'notRequired';
        if (forced === 'notRequired') {
            out.required = false; out.included = false; out.status = 'Not required'; out.reason = 'manual override';
            return out;
        }
        // Optional is tested BEFORE Not required, as the workbook does: a surveyor in a
        // "Site Office" crew is Optional (counted when they have Take 5s), not excluded.
        if (forced === 'optional' || (forced !== 'required' && hitOpt)) {
            out.optional = true;
            if (person.tags <= 0) {
                out.included = false; out.status = 'Optional';
                out.reason = forced === 'optional' ? 'manual override, no Take 5s' : 'optional ("' + hitOpt + '") with no Take 5s';
                return out;
            }
            out.reason = forced === 'optional' ? 'manual override, with Take 5s' : 'optional ("' + hitOpt + '") with Take 5s';
        } else if (forced !== 'required' && (hitRole || hitRC)) {
            out.required = false; out.included = false; out.status = 'Not required';
            out.reason = hitRole ? ('role contains "' + hitRole + '"') : ('role/crew contains "' + hitRC + '"');
            return out;
        }
        if (forced === 'required' && !out.reason) out.reason = 'manual override';
        out.included = true;
        // Group: crew prefix (LEFT(crew,5)="Maint" in the workbook) or a role keyword.
        var crewHit = null, prefixes = grp.maintenanceCrewPrefixes || [];
        for (var i = 0; i < prefixes.length; i++) {
            if (prefixes[i] && lower(person.crew).indexOf(lower(prefixes[i])) === 0) { crewHit = prefixes[i]; break; }
        }
        var m = crewHit || containsAny(person.role, grp.maintenanceRoleKeywords);
        out.group = m ? (grp.maintenanceLabel || 'Maintenance') : (grp.operationsLabel || 'Operations');
        if (person.inRegister === false) {
            // Counted in crew size, but with no count source they are neither a
            // zero nor in range (Email Report S5 = "Not in register").
            out.status = 'Not in register';
            out.reason = out.reason || 'no entry for this name in the count source';
            return out;
        }
        out.status = person.tags >= min ? 'In range' : (person.tags > 0 ? 'Below min' : 'No Take 5');
        return out;
    }

    /* The rule's own verdict for a person, ignoring overrides: 'required',
       'notRequired' or 'optional'. Used by the page to show the default and to
       store an override only when it differs. */
    function ruleStatus(person, config) {
        var c = classify({ employeeId: person.employeeId, name: person.name, role: person.role, crew: person.crew, tags: 1, inRegister: true }, config, null);
        return c.optional ? 'optional' : (c.required ? 'required' : 'notRequired');
    }

    // --------------------------------------------------------------- report
    function ratioOf(take5s, crewSize) {
        return crewSize > 0 ? (take5s / crewSize).toFixed(2) + ':1' : 'n/a';
    }
    function fmtDate(iso, fmt) {
        if (!iso) return '';
        var p = String(iso).slice(0, 10).split('-');
        var d = +p[2], m = +p[1], y = p[0];
        if (fmt === 'dd/MM/yyyy') return pad(d) + '/' + pad(m) + '/' + y;
        return d + '/' + m + '/' + y.slice(2);                      // d/M/yy, as the workbook prints
    }

    /* Build the daily report.
         rows     capture rows (any of the accepted shapes)
         config   site config object
         opts     { date: 'YYYY-MM-DD', overrides: {id: bool}, tagsFor: function(person, row) -> number|null|undefined }
       `tagsFor` lets the caller substitute a count source (e.g. the paper
       register) per person: a number replaces the row's tags, `null` means the
       person has no entry in that source ("Not in register"), and `undefined`
       keeps the row's own tags. */
    function buildReport(rows, config, opts) {
        opts = opts || {};
        var cfg = config || {};
        var min = num(cfg.minPerDay) || 3;
        var grp = cfg.groups || {};
        var labels = [grp.maintenanceLabel || 'Maintenance', grp.operationsLabel || 'Operations'];
        var people = (rows || []).map(function (r) {
            var p = fromCaptureRow(r);
            if (opts.tagsFor) {
                var t = opts.tagsFor(p, r);
                if (t === null) { p.tags = 0; p.inRegister = false; }
                else if (t !== undefined) { p.tags = num(t); p.inRegister = true; }
            }
            p.cls = classify(p, cfg, opts.overrides);
            return p;
        });

        var groups = {};
        function newGroup(l) { return { label: l, crewSize: 0, take5s: 0, zeros: 0, belowMin: 0, inRange: 0, notInRegister: 0, zeroNames: [], belowMinNames: [], notInRegisterNames: [] }; }
        labels.forEach(function (l) { groups[l] = newGroup(l); });
        var zeroNames = [], belowMinNames = [], notInRegisterNames = [], otherTake5s = 0, notRequired = [], optionalOut = [];
        people.forEach(function (p) {
            var c = p.cls;
            if (!c.included) {
                otherTake5s += p.tags;
                (c.status === 'Optional' ? optionalOut : notRequired).push(p);
                return;
            }
            var g = groups[c.group] || (groups[c.group] = newGroup(c.group));
            g.crewSize++; g.take5s += p.tags;
            if (c.status === 'No Take 5') { g.zeros++; g.zeroNames.push(p.name); zeroNames.push(p.name); }
            else if (c.status === 'Below min') { g.belowMin++; g.belowMinNames.push(p.name); belowMinNames.push(p.name); }
            else if (c.status === 'Not in register') { g.notInRegister++; g.notInRegisterNames.push(p.name); notInRegisterNames.push(p.name); }
            else g.inRange++;
        });
        Object.keys(groups).forEach(function (k) {
            var g = groups[k];
            g.ratio = ratioOf(g.take5s, g.crewSize);
            g.target = g.crewSize * min;
            g.overUnder = g.take5s - g.target;
            g.pctOfTarget = g.target > 0 ? Math.round(g.take5s / g.target * 100) : 0;
            g.targetStatus = g.target === 0 ? 'n/a' : (g.take5s >= g.target ? 'On target' : 'Below target');
        });

        var included = people.filter(function (p) { return p.cls.included; });
        var totalIncluded = included.length;
        var totalTake5s = included.reduce(function (a, p) { return a + p.tags; }, 0);
        var compliant = included.filter(function (p) { return p.cls.status === 'In range'; }).length;

        var tmpl = (cfg.email && cfg.email.sentence) || "The {zeroCount} people who didn't do take 5s are {zeroNames}";
        var sentence = zeroNames.length === 0
            ? ((cfg.email && cfg.email.noZerosSentence) || 'All crew members completed Take 5s')
            : tmpl.replace('{zeroCount}', String(zeroNames.length)).replace('{zeroNames}', zeroNames.join(', '));
        if (zeroNames.length === 1) sentence = sentence.replace(' people who ', ' person who ').replace(' are ', ' is ');

        var m = groups[labels[0]], o = groups[labels[1]];
        return {
            date: opts.date || '',
            dateLabel: fmtDate(opts.date, cfg.email && cfg.email.dateFormat),
            minPerDay: min,
            people: people,
            groups: groups,
            groupOrder: labels,
            totals: {
                onList: people.length, included: totalIncluded, notRequired: notRequired.length,
                optionalExcluded: optionalOut.length, take5s: totalTake5s, otherTake5s: otherTake5s,
                zeros: zeroNames.length, belowMin: belowMinNames.length, inRange: compliant,
                notInRegister: notInRegisterNames.length,
                compliancePct: totalIncluded ? Math.round(compliant / totalIncluded * 100) : 0,
                avgPerPerson: totalIncluded ? +(totalTake5s / totalIncluded).toFixed(2) : 0
            },
            zeroNames: zeroNames, belowMinNames: belowMinNames, notInRegisterNames: notInRegisterNames,
            notRequired: notRequired, optionalExcluded: optionalOut,
            sentence: sentence,
            dailyLogRow: [opts.date || '', m.crewSize, m.take5s, m.zeros, o.crewSize, o.take5s, o.zeros]
        };
    }

    /* Plain-text email body: the sentence, then the two-group table, matching
       Email Report!A3 and A4:D8. */
    function formatEmail(report, config) {
        var cfg = config || {};
        var rowsWanted = (cfg.email && cfg.email.tableRows) || ['Crew Size', 'Take 5s', 'Ratio', 'Crew members Completing Zero'];
        var L = [];
        L.push('Take 5 Report for the ' + report.dateLabel);
        L.push('');
        L.push(report.sentence);
        L.push('');
        var g0 = report.groups[report.groupOrder[0]], g1 = report.groups[report.groupOrder[1]];
        function cellsFor(g) {
            return { 'Crew Size': g.crewSize, 'Take 5s': g.take5s, 'Ratio': g.ratio, 'Crew members Completing Zero': g.zeros };
        }
        var c0 = cellsFor(g0), c1 = cellsFor(g1);
        var w = 30;
        function padR(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
        L.push(padR(g0.label, w) + padR(report.dateLabel, 10) + '   ' + padR(g1.label, w) + report.dateLabel);
        rowsWanted.forEach(function (r) {
            L.push(padR(r, w) + padR(c0[r], 10) + '   ' + padR(r, w) + c1[r]);
        });
        if (report.belowMinNames.length) {
            L.push('');
            L.push('Below the ' + report.minPerDay + '/day minimum: ' + report.belowMinNames.join(', '));
        }
        return L.join('\n');
    }

    /* HTML table version for pasting into Outlook. */
    function formatEmailHtml(report, config) {
        var cfg = config || {};
        var rowsWanted = (cfg.email && cfg.email.tableRows) || ['Crew Size', 'Take 5s', 'Ratio', 'Crew members Completing Zero'];
        function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
        var g0 = report.groups[report.groupOrder[0]], g1 = report.groups[report.groupOrder[1]];
        function cellsFor(g) { return { 'Crew Size': g.crewSize, 'Take 5s': g.take5s, 'Ratio': g.ratio, 'Crew members Completing Zero': g.zeros }; }
        var c0 = cellsFor(g0), c1 = cellsFor(g1);
        var td = 'style="border:1px solid #999;padding:4px 8px"';
        var h = '<p>' + esc(report.sentence) + '</p>';
        h += '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">';
        h += '<tr><th ' + td + '>' + esc(g0.label) + '</th><th ' + td + '>' + esc(report.dateLabel) + '</th><th ' + td + '>' + esc(g1.label) + '</th><th ' + td + '>' + esc(report.dateLabel) + '</th></tr>';
        rowsWanted.forEach(function (r) {
            h += '<tr><td ' + td + '>' + esc(r) + '</td><td ' + td + '>' + esc(c0[r]) + '</td><td ' + td + '>' + esc(r) + '</td><td ' + td + '>' + esc(c1[r]) + '</td></tr>';
        });
        h += '</table>';
        return h;
    }

    return {
        fromCaptureRow: fromCaptureRow,
        classify: classify,
        ruleStatus: ruleStatus,
        buildReport: buildReport,
        formatEmail: formatEmail,
        formatEmailHtml: formatEmailHtml,
        ratioOf: ratioOf,
        fmtDate: fmtDate
    };
}));
