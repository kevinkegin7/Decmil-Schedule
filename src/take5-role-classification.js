/*
 * Take 5 Compliance — role classification
 * ---------------------------------------
 * Decides whether a person on the prestart/roster is REQUIRED to complete
 * daily Take 5 tags, or is EXEMPT (office / management / non-field roles).
 *
 * Why this exists
 * ---------------
 * /Take5/GetCapture returns every person the roster puts on site, including
 * office and management personnel. take5.js then uses the raw row count as
 * the compliance denominator:
 *
 *     var onsite = state.capture.length;      // capture.js line 96
 *     pct: Math.round(comp / onsite * 100)
 *
 * So personnel who were never expected to log a Take 5 dilute the percentage
 * and cap it below 100%. On project 10265 that is 35 of 183 people — a hard
 * ceiling of 81% no matter how well the crews perform.
 *
 * The personnel record carries NO occupation category or staff/field flag —
 * only a free-text `Role` string — so classification is by pattern match on
 * that string. Because pattern matching on free text is inherently fallible,
 * a per-person override is a required part of the design, not an optional
 * extra. See docs/take5-role-exemption-spec.md.
 *
 * Classification agreed with HSE (Kevin Kegin), Sept 2026:
 *   EXEMPT   supervisors (all grades), superintendents, engineers, managers,
 *            administrators, advisors (HSE / Environmental), senior surveyors
 *   REQUIRED everyone else, explicitly including surveyors, soil technicians,
 *            peggys, leading hands, traffic controllers and all trades
 *
 * This file is plain ES5 with no dependencies so it can be used directly by
 * take5.js in the browser. The equivalent C# is in the spec document; both
 * MUST be kept in step or the capture tab and the dashboard will disagree.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Take5Roles = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /*
     * Normalise a free-text role for matching.
     *
     * The live data is not clean — it contains "Operator - Side Tipper " with a
     * trailing space and "Contracts Administrator- Senior" with a missing one.
     * Folding case and collapsing every run of non-alphanumerics to a single
     * space makes matching immune to that class of typo, so a fat-fingered
     * title cannot silently flip someone into the wrong bucket.
     *
     *   "Contracts Administrator- Senior" -> "contracts administrator senior"
     *   "Operator - Side Tipper "         -> "operator side tipper"
     *   "Fabricator / Boilermaker"        -> "fabricator boilermaker"
     */
    function normRole(role) {
        return String(role == null ? '' : role)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    /*
     * Senior surveyors are exempt but surveyors are not, so this is tested
     * before the general rules. Word order is not assumed — both
     * "Surveyor - Senior" and "Senior Surveyor" are caught.
     */
    var SENIOR_SURVEYOR_RE = /\bsurveyor\b.*\bsenior\b|\bsenior\b.*\bsurveyor\b/;

    /*
     * General exemptions. Each alternative is word-bounded so it matches a
     * whole word rather than a fragment, with one deliberate exception:
     * `administrat` is an unbounded stem so it covers Administrator,
     * Administration and Administrative alike.
     *
     * Care has been taken that no field role on 10265 collides with these:
     * "Auto Electrician", "Serviceperson", "Soil Technician", "Leading Hand"
     * and "Traffic Controller" all pass through as REQUIRED.
     */
    var EXEMPT_RE = /\bsupervisor\b|\bsuperintendent\b|\bengineer\b|\bmanager\b|administrat|\badvisor\b/;

    /*
     * The default requirement for a role, before any per-person override.
     *
     * A blank or missing role returns true (required). Failing safe towards
     * "required" means an unknown role shows up in the report and gets
     * questioned, rather than silently vanishing from the denominator — the
     * failure mode we are trying to eliminate in the first place.
     */
    function defaultRequired(role) {
        var n = normRole(role);
        if (!n) return true;
        if (SENIOR_SURVEYOR_RE.test(n)) return false;
        return !EXEMPT_RE.test(n);
    }

    /*
     * The effective requirement for one person: an explicit per-person
     * override always beats the role pattern. `overrides` maps employee id to
     * a boolean. Pass the map the server sends (see the spec); omit it and
     * you get pure role-based classification.
     */
    function isRequired(person, overrides) {
        if (!person) return true;
        var id = person.employeeId != null ? person.employeeId : person.EmployeeId;
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, id)) {
            return !!overrides[id];
        }
        var role = person.role != null ? person.role : person.Role;
        return defaultRequired(role);
    }

    /*
     * A person counts towards compliance only if they are BOTH on site and
     * required. `onSite` is sent by GetCapture today but currently discarded
     * by take5.js; when it is absent we assume present, since GetCapture is
     * documented to return the on-site list.
     */
    function isCounted(person, overrides) {
        if (!person) return false;
        var on = person.onSite != null ? person.onSite : person.OnSite;
        if (on === false) return false;
        return isRequired(person, overrides);
    }

    return {
        normRole: normRole,
        defaultRequired: defaultRequired,
        isRequired: isRequired,
        isCounted: isCounted,
        SENIOR_SURVEYOR_RE: SENIOR_SURVEYOR_RE,
        EXEMPT_RE: EXEMPT_RE
    };
}));
