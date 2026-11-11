/*
 * Take 5 Compliance — visual report card
 * --------------------------------------
 * Draws the daily report (src/take5-site-report.js output) as a card for the
 * Site Diary page and the standalone HTML report, plus an email-safe HTML
 * version for Outlook, which drops SVG and most CSS.
 *
 * Forms, chosen by the data's job:
 *   compliance %            hero figure + meter (one ratio against a limit)
 *   Maintenance/Operations  stat tiles: ratio vs the 3.0 target, with a meter
 *   In range/Below/Zero     tall segmented bar, legend of names
 *   compliance by crew      meter list, worst first
 *   14-day history          sparkline (when the caller supplies it)
 *
 * Colour does one job per mark. Magnitude meters are a single blue; the three
 * states that mean good / warning / critical wear the reserved status colours
 * and always carry an icon and a label as well. Text never takes a data colour.
 * The card is light-only by design (it is an email asset), on the reference
 * palette's light chart surface.
 *
 * Plain ES5, no dependencies, UMD like the other modules.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Take5Visuals = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Reference palette (light surface). Status steps are fixed; blue is categorical slot 1.
    var PAL = {
        surface: '#fcfcfb', plane: '#f9f9f7', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
        grid: '#e1e0d9', axis: '#c3c2b7', border: 'rgba(11,11,11,0.10)',
        accent: '#2a78d6', accentTrack: '#b7d3f6',        // blue 450 fill, blue 150 track
        good: '#0ca30c', warning: '#fab219', critical: '#d03b3b',
        warningTrack: '#fde9bd', criticalTrack: '#f3c9c9', // lighter steps of the same hues
        successText: '#006300', deemph: '#c3c2b7'
    };
    var FONT = 'system-ui,-apple-system,"Segoe UI",sans-serif';

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function pct(n, d) { return d > 0 ? Math.round(n / d * 100) : 0; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function severity(p) { return p >= 80 ? 'good' : (p >= 50 ? 'warning' : 'critical'); }
    function fillFor(sev) { return sev === 'good' ? PAL.accent : (sev === 'warning' ? PAL.warning : PAL.critical); }
    function trackFor(sev) { return sev === 'good' ? PAL.accentTrack : (sev === 'warning' ? PAL.warningTrack : PAL.criticalTrack); }
    function iconFor(sev) { return sev === 'good' ? '✓' : (sev === 'warning' ? '!' : '✕'); }
    function wordFor(sev) { return sev === 'good' ? 'on target' : (sev === 'warning' ? 'below target' : 'well below target'); }

    /* A meter: fill carries severity, the track is a lighter step of the same hue. */
    function meterSvg(valuePct, sev, w, h, title) {
        w = w || 220; h = h || 10;
        var p = clamp(valuePct, 0, 100), fw = Math.round(w * p / 100);
        return '<svg class="t5v-meter" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(title || (p + '%')) + '" style="display:block">' +
            (title ? '<title>' + esc(title) + '</title>' : '') +
            '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '" fill="' + trackFor(sev) + '"/>' +
            (fw > 0 ? '<rect x="0" y="0" width="' + Math.max(fw, h) + '" height="' + h + '" rx="' + (h / 2) + '" fill="' + fillFor(sev) + '"/>' : '') +
            '</svg>';
    }

    /* Tall segmented bar: one whole split into parts, labels inside where they fit. */
    function segmentedBarSvg(parts, w, h) {
        w = w || 560; h = h || 28;
        var total = 0; parts.forEach(function (p) { total += p.value; });
        if (!total) return '<div style="color:' + PAL.muted + ';font-size:12px">No required people on the list.</div>';
        var gap = 2, x = 0, out = [];
        var live = parts.filter(function (p) { return p.value > 0; });
        var avail = w - gap * (live.length - 1);
        live.forEach(function (p, i) {
            var pw = Math.round(avail * p.value / total);
            if (i === live.length - 1) pw = w - x;                       // absorb rounding
            var share = pct(p.value, total);
            var label = p.value + ' · ' + share + '%';
            var textW = label.length * 7.2 + 16;                        // ~12px font, generous padding
            out.push('<g><title>' + esc(p.name + ': ' + p.value + ' (' + share + '%)') + '</title>' +
                '<rect x="' + x + '" y="0" width="' + pw + '" height="' + h + '" rx="4" fill="' + p.color + '"/>' +
                (pw >= textW ? '<text x="' + (x + 8) + '" y="' + (h / 2 + 4) + '" font-family="' + FONT + '" font-size="12" font-weight="600" fill="' + (p.inkOnFill || '#ffffff') + '">' + esc(label) + '</text>' : '') +
                '</g>');
            x += pw + gap;
        });
        return '<svg class="t5v-seg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Required people by status" style="display:block;max-width:100%">' + out.join('') + '</svg>';
    }

    /* Sparkline: 2px line in the de-emphasis hue, current point in the accent with a
       surface ring, end value labelled, first and last dates on the axis. */
    function sparklineSvg(series, w, h, opts) {
        w = w || 320; h = h || 64; opts = opts || {};
        var pts = (series || []).filter(function (s) { return s && typeof s.pct === 'number'; });
        if (pts.length < 2) return '<div style="color:' + PAL.muted + ';font-size:12px">Not enough history for a trend.</div>';
        var padL = 6, padR = 44, padT = 10, padB = 18, pw = w - padL - padR, ph = h - padT - padB;
        var n = series.length, step = pw / Math.max(n - 1, 1);
        function X(i) { return padL + i * step; }
        function Y(v) { return padT + ph - ph * clamp(v, 0, 100) / 100; }
        var d = '', last = null, lastIdx = -1;
        series.forEach(function (s, i) {
            if (!s || typeof s.pct !== 'number') { return; }
            d += (d ? ' L' : 'M') + X(i).toFixed(1) + ' ' + Y(s.pct).toFixed(1);
            last = s; lastIdx = i;
        });
        var targetY = Y(opts.target != null ? opts.target : 100);
        var hits = series.map(function (s, i) {
            if (!s || typeof s.pct !== 'number') return '';
            return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(s.pct).toFixed(1) + '" r="12" fill="transparent"><title>' + esc(s.label + ': ' + s.pct + '%' + (s.note ? ' · ' + s.note : '')) + '</title></circle>';
        }).join('');
        return '<svg class="t5v-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(opts.title || 'Trend') + '" style="display:block;max-width:100%">' +
            '<line x1="' + padL + '" y1="' + (padT + ph) + '" x2="' + (padL + pw) + '" y2="' + (padT + ph) + '" stroke="' + PAL.axis + '" stroke-width="1"/>' +
            (opts.target != null ? '<line x1="' + padL + '" y1="' + targetY.toFixed(1) + '" x2="' + (padL + pw) + '" y2="' + targetY.toFixed(1) + '" stroke="' + PAL.grid + '" stroke-width="1"/>' : '') +
            '<path d="' + d + '" fill="none" stroke="' + PAL.deemph + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
            (last ? '<circle cx="' + X(lastIdx).toFixed(1) + '" cy="' + Y(last.pct).toFixed(1) + '" r="6" fill="' + PAL.surface + '"/>' +
                    '<circle cx="' + X(lastIdx).toFixed(1) + '" cy="' + Y(last.pct).toFixed(1) + '" r="4" fill="' + PAL.accent + '"/>' +
                    '<text x="' + (X(lastIdx) + 9).toFixed(1) + '" y="' + (Y(last.pct) + 4).toFixed(1) + '" font-family="' + FONT + '" font-size="12" font-weight="600" fill="' + PAL.ink + '">' + last.pct + '%</text>' : '') +
            '<text x="' + padL + '" y="' + (h - 4) + '" font-family="' + FONT + '" font-size="10" fill="' + PAL.muted + '">' + esc(series[0] && series[0].label || '') + '</text>' +
            '<text x="' + (padL + pw) + '" y="' + (h - 4) + '" text-anchor="end" font-family="' + FONT + '" font-size="10" fill="' + PAL.muted + '">' + esc(series[n - 1] && series[n - 1].label || '') + '</text>' +
            hits +
            '</svg>';
    }

    // ------------------------------------------------------------------ card
    function crewRows(report) {
        var byCrew = {};
        report.people.forEach(function (p) {
            if (!p.cls.included) return;
            var k = p.crew || 'Unassigned';
            var c = byCrew[k] || (byCrew[k] = { crew: k, n: 0, inRange: 0, zeros: 0 });
            c.n++; if (p.cls.status === 'In range') c.inRange++; if (p.cls.status === 'No Take 5') c.zeros++;
        });
        return Object.keys(byCrew).map(function (k) { var c = byCrew[k]; c.pct = pct(c.inRange, c.n); return c; })
            .sort(function (a, b) { return (a.pct - b.pct) || (b.n - a.n) || a.crew.localeCompare(b.crew); });
    }

    function statusParts(report) {
        var t = report.totals;
        return [
            { name: 'In range (≥' + report.minPerDay + ')', value: t.inRange, color: PAL.good, inkOnFill: '#ffffff' },
            { name: 'Below minimum', value: t.belowMin, color: PAL.warning, inkOnFill: '#0b0b0b' },
            { name: 'No Take 5', value: t.zeros, color: PAL.critical, inkOnFill: '#ffffff' },
            { name: 'Not in register', value: t.notInRegister || 0, color: PAL.muted, inkOnFill: '#ffffff' }
        ];
    }

    /* The card. opts: { title, sourceNote, trend: [{label, pct, note}], trendNote, width } */
    function renderCard(report, cfg, opts) {
        opts = opts || {};
        var t = report.totals, min = report.minPerDay;
        var comp = t.compliancePct, sev = severity(comp);
        var W = opts.width || 640;
        var s = {
            card: 'font-family:' + FONT + ';color:' + PAL.ink + ';background:' + PAL.surface + ';border:1px solid ' + PAL.border + ';border-radius:12px;padding:20px 22px;max-width:' + W + 'px;box-sizing:border-box',
            label: 'font-size:12px;color:' + PAL.ink2 + ';letter-spacing:.02em;text-transform:uppercase;margin:0 0 4px',
            sub: 'font-size:12.5px;color:' + PAL.ink2 + ';margin:6px 0 0',
            h: 'font-size:14px;font-weight:700;margin:22px 0 8px;color:' + PAL.ink,
            tile: 'flex:1;min-width:220px;border:1px solid ' + PAL.border + ';border-radius:10px;padding:12px 14px;background:' + PAL.surface
        };
        var L = [];
        L.push('<div class="t5v-card" style="' + s.card + '">');
        // header
        L.push('<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">' +
            '<div><div style="' + s.label + '">Take 5 compliance · ' + esc((cfg && cfg.projectName) || '') + (cfg && cfg.project ? ' (' + esc(cfg.project) + ')' : '') + '</div>' +
            '<div style="font-size:18px;font-weight:700">' + esc(opts.title || ('Daily report — ' + report.dateLabel)) + '</div></div>' +
            (opts.sourceNote ? '<div style="font-size:12px;color:' + PAL.muted + ';max-width:260px;text-align:right">' + esc(opts.sourceNote) + '</div>' : '') +
            '</div>');
        // hero + meter
        L.push('<div class="t5v-hero" style="display:flex;align-items:flex-end;gap:18px;margin-top:16px;flex-wrap:wrap">' +
            '<div><div style="font-size:52px;font-weight:600;line-height:1">' + comp + '%</div>' +
            '<div style="' + s.sub + '">' + t.inRange + ' of ' + t.included + ' required people at ' + min + ' or more today · <span style="font-weight:600">' + esc(iconFor(sev) + ' ' + wordFor(sev)) + '</span></div></div>' +
            '<div style="flex:1;min-width:200px;padding-bottom:10px">' + meterSvg(comp, sev, 280, 10, 'Compliance ' + comp + '% of required people') + '</div>' +
            '</div>');
        // group tiles
        L.push('<div class="t5v-tiles" style="display:flex;gap:12px;margin-top:18px;flex-wrap:wrap">');
        report.groupOrder.forEach(function (g) {
            var G = report.groups[g];
            var ratio = G.crewSize ? G.take5s / G.crewSize : 0;
            var delta = G.crewSize ? ratio - min : 0;
            var gp = G.target ? pct(G.take5s, G.target) : 0, gsev = G.crewSize ? severity(gp) : 'good';
            var deltaTxt = G.crewSize ? ((delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(2) + ' vs ' + min.toFixed(1) + ' target') : 'no one on site';
            // Icon and colour follow the delta's direction; the meter below carries how close.
            var deltaIcon = !G.crewSize ? '' : (delta >= 0 ? '✓ ' : (gsev === 'critical' ? '✕ ' : '! '));
            var deltaCol = delta >= 0 ? PAL.successText : PAL.critical;
            L.push('<div class="t5v-tile" style="' + s.tile + '">' +
                '<div style="' + s.label + '">' + esc(g) + '</div>' +
                '<div style="display:flex;align-items:baseline;gap:10px"><div style="font-size:28px;font-weight:600">' + esc(G.ratio) + '</div>' +
                '<div style="font-size:12.5px;font-weight:600;color:' + deltaCol + '">' + esc(deltaIcon + deltaTxt) + '</div></div>' +
                '<div style="margin:8px 0 6px">' + meterSvg(gp, gsev, 240, 8, esc(g) + ': ' + G.take5s + ' of ' + G.target + ' target Take 5s (' + gp + '%)') + '</div>' +
                '<div style="font-size:12px;color:' + PAL.ink2 + '">' + G.crewSize + ' crew · ' + G.take5s + ' Take 5s · <span style="color:' + (G.zeros ? PAL.critical : PAL.ink2) + ';font-weight:' + (G.zeros ? 600 : 400) + '">' + G.zeros + ' at zero</span>' + (G.belowMin ? ' · ' + G.belowMin + ' below min' : '') + '</div>' +
                '</div>');
        });
        L.push('</div>');
        // segmented bar
        var parts = statusParts(report);
        L.push('<div style="' + s.h + '">Required people by status</div>');
        L.push(segmentedBarSvg(parts, W - 46, 28));
        L.push('<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:' + PAL.ink2 + '">' +
            parts.filter(function (p) { return p.value > 0; }).map(function (p) {
                return '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + p.color + ';vertical-align:-1px;margin-right:6px"></span>' + esc(p.name) + '</span>';
            }).join('') + '</div>');
        // crews
        var rows = crewRows(report);
        if (rows.length) {
            L.push('<div style="' + s.h + '">Compliance by crew <span style="font-weight:400;color:' + PAL.muted + '">· share of required crew at ' + min + ' or more · worst first</span></div>');
            L.push('<div class="t5v-crews" style="display:grid;grid-template-columns:minmax(120px,1fr) 2fr auto;gap:6px 12px;align-items:center;font-size:12.5px">');
            rows.forEach(function (c) {
                var csev = severity(c.pct);
                L.push('<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(c.crew) + '">' + esc(c.crew) + '</div>' +
                    '<div>' + meterSvg(c.pct, csev, 260, 8, c.crew + ': ' + c.inRange + ' of ' + c.n + ' at minimum (' + c.pct + '%)') + '</div>' +
                    '<div style="font-variant-numeric:tabular-nums;color:' + PAL.ink2 + ';white-space:nowrap">' + c.inRange + '/' + c.n + ' · <span style="font-weight:600;color:' + PAL.ink + '">' + esc(iconFor(csev)) + ' ' + c.pct + '%</span></div>');
            });
            L.push('</div>');
        }
        // trend
        if (opts.trend && opts.trend.length) {
            L.push('<div style="' + s.h + '">Last ' + opts.trend.length + ' days' + (opts.trendNote ? ' <span style="font-weight:400;color:' + PAL.muted + '">· ' + esc(opts.trendNote) + '</span>' : '') + '</div>');
            L.push(sparklineSvg(opts.trend, 360, 70, { title: 'Compliance trend', target: 100 }));
        }
        // lists
        if (report.zeroNames.length) {
            L.push('<div style="' + s.h + '"><span style="color:' + PAL.critical + '">✕</span> ' + report.zeroNames.length + ' with no Take 5</div>');
            L.push('<div style="font-size:12.5px;line-height:1.55;color:' + PAL.ink2 + '">' + esc(report.zeroNames.join(', ')) + '</div>');
        }
        if (report.belowMinNames.length) {
            L.push('<div style="' + s.h + '"><span style="color:' + PAL.warning + '">!</span> ' + report.belowMinNames.length + ' below the ' + min + '/day minimum</div>');
            L.push('<div style="font-size:12.5px;line-height:1.55;color:' + PAL.ink2 + '">' + esc(report.belowMinNames.join(', ')) + '</div>');
        }
        L.push('<div style="margin-top:16px;font-size:11px;color:' + PAL.muted + '">Not required: ' + t.notRequired + ' · Optional at zero: ' + t.optionalExcluded + (t.notInRegister ? ' · Not in register: ' + t.notInRegister : '') + ' · Minimum ' + min + ' per person per day</div>');
        L.push('</div>');
        return L.join('');
    }

    // ------------------------------------------------------------ email html
    /* Outlook-safe: tables, bgcolor, inline styles, no SVG. Bars are two-cell
       tables so they survive Word's HTML engine. */
    function barHtml(valuePct, sev, w) {
        w = w || 160;
        var p = clamp(valuePct, 0, 100), fw = Math.max(Math.round(w * p / 100), p > 0 ? 6 : 0), rw = w - fw;
        return '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:' + w + 'px"><tr>' +
            (fw ? '<td width="' + fw + '" bgcolor="' + fillFor(sev) + '" style="width:' + fw + 'px;height:9px;line-height:9px;font-size:1px;background:' + fillFor(sev) + '">&nbsp;</td>' : '') +
            (rw ? '<td width="' + rw + '" bgcolor="' + trackFor(sev) + '" style="width:' + rw + 'px;height:9px;line-height:9px;font-size:1px;background:' + trackFor(sev) + '">&nbsp;</td>' : '') +
            '</tr></table>';
    }
    function emailHtml(report, cfg) {
        var t = report.totals, min = report.minPerDay, comp = t.compliancePct, sev = severity(comp);
        var td = 'style="font-family:Arial,sans-serif;font-size:13px;color:#0b0b0b;padding:4px 10px;border:1px solid #c3c2b7"';
        var th = 'style="font-family:Arial,sans-serif;font-size:13px;color:#0b0b0b;padding:4px 10px;border:1px solid #c3c2b7;background:#f0efec;text-align:left"';
        var H = [];
        H.push('<div style="font-family:Arial,sans-serif;color:#0b0b0b">');
        H.push('<p style="font-size:15px;margin:0 0 4px"><b>Take 5 Report for the ' + esc(report.dateLabel) + '</b></p>');
        H.push('<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:6px 0 12px"><tr>' +
            '<td style="font-family:Arial,sans-serif;font-size:40px;font-weight:bold;padding:0 14px 0 0;vertical-align:bottom">' + comp + '%</td>' +
            '<td style="font-family:Arial,sans-serif;font-size:12px;color:#52514e;vertical-align:bottom;padding-bottom:6px">' + t.inRange + ' of ' + t.included + ' required people at ' + min + ' or more · ' + esc(iconFor(sev) + ' ' + wordFor(sev)) + '<br>' + barHtml(comp, sev, 220) + '</td></tr></table>');
        H.push('<p style="font-size:13px;margin:0 0 10px">' + esc(report.sentence) + '</p>');
        // group table with ratio bars
        H.push('<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">');
        H.push('<tr><th ' + th + '></th>' + report.groupOrder.map(function (g) { return '<th ' + th + '>' + esc(g) + '</th><th ' + th + '>' + esc(report.dateLabel) + '</th>'; }).join('') + '</tr>');
        var rowsWanted = (cfg && cfg.email && cfg.email.tableRows) || ['Crew Size', 'Take 5s', 'Ratio', 'Crew members Completing Zero'];
        rowsWanted.forEach(function (r) {
            H.push('<tr><td ' + td + '>' + esc(r) + '</td>' + report.groupOrder.map(function (g) {
                var G = report.groups[g];
                var v = r === 'Crew Size' ? G.crewSize : r === 'Take 5s' ? G.take5s : r === 'Ratio' ? G.ratio : G.zeros;
                var extra = '';
                if (r === 'Ratio') { var gp = G.target ? pct(G.take5s, G.target) : 0; extra = barHtml(gp, G.crewSize ? severity(gp) : 'good', 120); }
                return '<td ' + td + '><b>' + esc(v) + '</b></td><td ' + td + '>' + (extra || '') + '</td>';
            }).join('') + '</tr>');
        });
        H.push('</table>');
        // crews
        var rows = crewRows(report);
        if (rows.length) {
            H.push('<p style="font-size:12px;color:#52514e;margin:12px 0 4px"><b>Compliance by crew</b> — share of required crew at ' + min + ' or more, worst first</p>');
            H.push('<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">');
            rows.forEach(function (c) {
                var csev = severity(c.pct);
                H.push('<tr><td style="font-family:Arial,sans-serif;font-size:12px;padding:2px 10px 2px 0">' + esc(c.crew) + '</td><td style="padding:2px 10px 2px 0">' + barHtml(c.pct, csev, 160) + '</td>' +
                    '<td style="font-family:Arial,sans-serif;font-size:12px;color:#52514e;padding:2px 0">' + c.inRange + '/' + c.n + ' · <b style="color:#0b0b0b">' + esc(iconFor(csev)) + ' ' + c.pct + '%</b></td></tr>');
            });
            H.push('</table>');
        }
        if (report.belowMinNames.length) H.push('<p style="font-size:12px;margin:10px 0 0">Below the ' + min + '/day minimum: ' + esc(report.belowMinNames.join(', ')) + '</p>');
        H.push('</div>');
        return H.join('');
    }

    return { renderCard: renderCard, emailHtml: emailHtml, meterSvg: meterSvg, segmentedBarSvg: segmentedBarSvg,
             sparklineSvg: sparklineSvg, crewRows: crewRows, severity: severity, PAL: PAL };
}));
