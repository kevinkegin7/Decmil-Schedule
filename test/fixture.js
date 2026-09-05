/*
 * Deterministic fixture for the Take 5 browser tests.
 *
 * Builds a 183-person site from the real role census on 10265 (see
 * src/take5-role-classification.test.js) and shapes it into the two payloads
 * take5.js consumes: /Take5/GetCapture and /Take5/GetDashboard. The server
 * aggregates in GetDashboard are computed the way the real server does today
 * — over everyone, exempt or not — so the tests can prove the patched page
 * shows different, corrected numbers.
 *
 * Loaded in the browser as a global (window.T5Fixture) and in Node via
 * require(), so the test computes its expectations from the same data.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.T5Fixture = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var CENSUS = [
        ['Operator - Dozer', 17], ['Operator - Excavator', 13], ['Supervisor - Workshop', 3],
        ['Operator - Dump Truck', 24], ['Engineer - Project', 6], ['Mechanic - Heavy', 16],
        ['Operator - Roller', 9], ['Labourer', 9], ['Serviceperson', 4], ['Tyre Fitter', 1],
        ['Mechanic - Fitter', 4], ['Environmental & Sustainability Advisor', 1],
        ['Operator - Side Tipper ', 2], ['Electrician', 2], ['Supervisor', 6], ['Operator - Loader', 10],
        ['Construction Manager', 1], ['Operator - Water Truck', 9], ['Surveyor', 7],
        ['Commercial Manager', 1], ['Surveyor - Senior', 2], ['Operator - Final Trim Grader', 6],
        ['Superintendent', 1], ['Peggy', 2], ['HSE Advisor', 3], ['Operator - Grader', 3],
        ['Area Manager', 1], ['HSE Advisor - Senior', 2], ['Supervisor - Senior', 1],
        ['Fabricator / Boilermaker', 2], ['Soil Technician', 4], ['Maintenance Administrator - Senior', 1],
        ['Contracts Administrator', 1], ['Contracts Administrator- Senior', 1], ['Traffic Controller', 2],
        ['Leading Hand', 1], ['Auto Electrician', 1], ['Site Administrator', 2], ['Project Manager', 1],
        ['Engineer - Site', 1]
    ];

    var OFFICE_RE = /administrat|manager|engineer|advisor|superintendent/i;
    var FIELD_CREWS = ['Ops - A Crew', 'Ops - B Crew', 'Maint - A Crew', 'Carpark - A Crew'];
    var MIN = 3;

    function crewFor(role, i) {
        if (OFFICE_RE.test(role)) return i % 2 ? 'Site Office - A Crew' : 'Site Office HS - B Crew';
        return FIELD_CREWS[i % FIELD_CREWS.length];
    }

    /* 183 people. Field tag counts cycle 0..4 so every status appears; office
       roles log nothing, as on the real site, so their inclusion visibly drags
       the uncorrected figures down. Two people are off site (with no tags) to
       exercise the OnSite path. */
    var people = [];
    CENSUS.forEach(function (pair) {
        for (var k = 0; k < pair[1]; k++) {
            var id = people.length + 1;
            var onSite = !(id === 5 || id === 9);
            var tags = (!onSite || OFFICE_RE.test(pair[0])) ? 0 : (id * 7) % 5;
            people.push({
                EmployeeId: id,
                Name: 'Person ' + id,
                Gender: id % 2 ? 'M' : 'F',
                Role: pair[0],
                Crew: crewFor(pair[0], id),
                Company: 'Decmil',
                OnSite: onSite,
                TagCount: tags
            });
        }
    });

    function statusOf(n) { return n >= MIN ? 'compliant' : (n > 0 ? 'partial' : 'missed'); }

    function getCapture() {
        return { MinPerDay: MIN, Rows: people.map(function (p) {
            return { EmployeeId: p.EmployeeId, Name: p.Name, Gender: p.Gender, Role: p.Role, Crew: p.Crew,
                     Company: p.Company, OnSite: p.OnSite, TagCount: p.TagCount, Status: statusOf(p.TagCount) };
        }) };
    }

    /* Single-day range, so worker-days == people. Aggregates deliberately
       include everyone, as the live server does. Half the ActionList entries
       omit EmployeeId so the name-join path is exercised too. */
    function getDashboard() {
        var onSite = people.filter(function (p) { return p.OnSite; });
        var compliant = onSite.filter(function (p) { return p.TagCount >= MIN; });
        var below = onSite.filter(function (p) { return p.TagCount < MIN; });
        var tags = onSite.reduce(function (a, p) { return a + p.TagCount; }, 0);

        var crews = {};
        onSite.forEach(function (p) {
            var c = crews[p.Crew] || (crews[p.Crew] = { Crew: p.Crew, Compliant: 0, OnSite: 0 });
            c.OnSite++; if (p.TagCount >= MIN) c.Compliant++;
        });
        var rollup = Object.keys(crews).map(function (k) { var c = crews[k]; c.Pct = Math.round(c.Compliant / c.OnSite * 100); return c; });

        return {
            MinPerDay: MIN,
            OnSiteCount: onSite.length, ToActionCount: below.length,
            CompliantPct: Math.round(compliant.length / onSite.length * 100),
            RosterCount: people.length, OnLeaveCount: 0,
            RangeTagTotal: tags, AvgPerWorker: (tags / onSite.length).toFixed(1),
            OnSiteDayCount: onSite.length, CompliantDayCount: compliant.length,
            ActionList: below.map(function (p) {
                var a = { Name: p.Name, Crew: p.Crew, DaysBelow: 1, OnSiteDays: 1, TagCount: p.TagCount,
                          Status: statusOf(p.TagCount), Spark: [p.TagCount] };
                if (p.EmployeeId % 2 === 0) a.EmployeeId = p.EmployeeId;
                return a;
            }),
            CrewRollup: rollup,
            Trend: [{ Label: 'Mon', Pct: 20 }, { Label: 'Tue', Pct: 30 }, { Label: 'Wed', Pct: -1 }],
            TableRows: people.map(function (p) {
                return { EmployeeId: p.EmployeeId, Name: p.Name, Role: p.Role, Crew: p.Crew, OnSite: p.OnSite,
                         RangeTotal: p.TagCount, WeekTotal: p.TagCount, Lifetime: p.TagCount * 3,
                         OnSiteDays: p.OnSite ? 1 : 0, CompliantDays: (p.OnSite && p.TagCount >= MIN) ? 1 : 0,
                         Status: p.OnSite ? statusOf(p.TagCount) : 'off', Spark: [p.TagCount] };
            })
        };
    }

    return { MIN: MIN, people: people, statusOf: statusOf, getCapture: getCapture, getDashboard: getDashboard };
}));
