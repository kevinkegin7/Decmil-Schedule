/*
 * Tests for the Take 5 role classifier.
 *
 * The census below is the real role distribution returned by
 * /Take5/GetCapture on project 10265 (WASP WH Bulk Earthworks), 183 people
 * across 40 distinct job titles. Keeping the real data here means any change
 * to the patterns is checked against the site it has to work on, including
 * the two known typos in the source data.
 *
 * Run: node src/take5-role-classification.test.js
 */
'use strict';

var T = require('./take5-role-classification');

/* Live census, 4 Sept 2026. Value is headcount. */
var CENSUS = {
    'Operator - Dozer': 17,
    'Operator - Excavator': 13,
    'Supervisor - Workshop': 3,
    'Operator - Dump Truck': 24,
    'Engineer - Project': 6,
    'Mechanic - Heavy': 16,
    'Operator - Roller': 9,
    'Labourer': 9,
    'Serviceperson': 4,
    'Tyre Fitter': 1,
    'Mechanic - Fitter': 4,
    'Environmental & Sustainability Advisor': 1,
    'Operator - Side Tipper ': 2,          /* note: trailing space in source data */
    'Electrician': 2,
    'Supervisor': 6,
    'Operator - Loader': 10,
    'Construction Manager': 1,
    'Operator - Water Truck': 9,
    'Surveyor': 7,
    'Commercial Manager': 1,
    'Surveyor - Senior': 2,
    'Operator - Final Trim Grader': 6,
    'Superintendent': 1,
    'Peggy': 2,
    'HSE Advisor': 3,
    'Operator - Grader': 3,
    'Area Manager': 1,
    'HSE Advisor - Senior': 2,
    'Supervisor - Senior': 1,
    'Fabricator / Boilermaker': 2,
    'Soil Technician': 4,
    'Maintenance Administrator - Senior': 1,
    'Contracts Administrator': 1,
    'Contracts Administrator- Senior': 1,   /* note: missing space in source data */
    'Traffic Controller': 2,
    'Leading Hand': 1,
    'Auto Electrician': 1,
    'Site Administrator': 2,
    'Project Manager': 1,
    'Engineer - Site': 1
};

/* The classification agreed with HSE. Everything not listed is REQUIRED. */
var EXEMPT = [
    'Supervisor', 'Supervisor - Workshop', 'Supervisor - Senior',
    'Superintendent', 'Engineer - Project', 'Engineer - Site',
    'Construction Manager', 'Commercial Manager', 'Area Manager', 'Project Manager',
    'Contracts Administrator', 'Contracts Administrator- Senior',
    'Maintenance Administrator - Senior', 'Site Administrator',
    'HSE Advisor', 'HSE Advisor - Senior', 'Environmental & Sustainability Advisor',
    'Surveyor - Senior'
];

var failures = [];
function check(desc, actual, expected) {
    if (actual !== expected) failures.push(desc + ' — got ' + actual + ', expected ' + expected);
}

/* 1. Every role on site classifies as agreed. */
Object.keys(CENSUS).forEach(function (role) {
    var expected = EXEMPT.indexOf(role) < 0;
    check('role ' + JSON.stringify(role), T.defaultRequired(role), expected);
});

/* 2. The headcount split, which is the whole point of the change. */
var required = 0, exempt = 0;
Object.keys(CENSUS).forEach(function (role) {
    if (T.defaultRequired(role)) required += CENSUS[role]; else exempt += CENSUS[role];
});
check('required headcount', required, 148);
check('exempt headcount', exempt, 35);
check('census total', required + exempt, 183);

/* 3. Senior surveyors are exempt but surveyors are not — the one rule where
 *    a plain substring match would get it wrong, in either word order. */
check('"Surveyor" required', T.defaultRequired('Surveyor'), true);
check('"Surveyor - Senior" exempt', T.defaultRequired('Surveyor - Senior'), false);
check('"Senior Surveyor" exempt', T.defaultRequired('Senior Surveyor'), false);
check('"SURVEYOR - SENIOR" exempt', T.defaultRequired('SURVEYOR - SENIOR'), false);

/* 4. Dirty data must not change the answer. */
check('trailing space', T.defaultRequired('Operator - Side Tipper '), true);
check('missing space', T.defaultRequired('Contracts Administrator- Senior'), false);
check('doubled separators', T.defaultRequired('Operator  -  Dozer  '), true);
check('lower case', T.defaultRequired('site administrator'), false);

/* 5. Field roles that sit close to an exempt pattern must survive it. */
check('Auto Electrician required', T.defaultRequired('Auto Electrician'), true);
check('Serviceperson required', T.defaultRequired('Serviceperson'), true);
check('Soil Technician required', T.defaultRequired('Soil Technician'), true);
check('Leading Hand required', T.defaultRequired('Leading Hand'), true);
check('Traffic Controller required', T.defaultRequired('Traffic Controller'), true);
check('Peggy required', T.defaultRequired('Peggy'), true);

/* 6. Unseen titles fail safe towards required, so an unknown role lands in
 *    the report to be questioned rather than disappearing from the maths. */
check('blank role required', T.defaultRequired(''), true);
check('null role required', T.defaultRequired(null), true);
check('unknown role required', T.defaultRequired('Dogman'), true);
/* ...but new office titles are still caught by the stems. */
check('unseen "Site Supervisor" exempt', T.defaultRequired('Site Supervisor'), false);
check('unseen "Administration Officer" exempt', T.defaultRequired('Administration Officer'), false);
check('unseen "Engineer - Graduate" exempt', T.defaultRequired('Engineer - Graduate'), false);

/* 7. A per-person override beats the role pattern in both directions. */
check('override makes supervisor required',
    T.isRequired({ employeeId: 7, role: 'Supervisor' }, { 7: true }), true);
check('override exempts an operator',
    T.isRequired({ employeeId: 8, role: 'Operator - Dozer' }, { 8: false }), false);
check('override for another id is ignored',
    T.isRequired({ employeeId: 9, role: 'Operator - Dozer' }, { 7: false }), true);
check('PascalCase row shape works',
    T.isRequired({ EmployeeId: 10, Role: 'Project Manager' }, null), false);

/* 8. isCounted also honours OnSite, which take5.js currently discards. */
check('off-site operator not counted',
    T.isCounted({ employeeId: 1, role: 'Operator - Dozer', onSite: false }, null), false);
check('on-site operator counted',
    T.isCounted({ employeeId: 1, role: 'Operator - Dozer', onSite: true }, null), true);
check('on-site manager not counted',
    T.isCounted({ employeeId: 2, role: 'Project Manager', onSite: true }, null), false);
check('missing OnSite assumed on site',
    T.isCounted({ employeeId: 3, role: 'Labourer' }, null), true);

if (failures.length) {
    console.error('FAILED (' + failures.length + ')');
    failures.forEach(function (f) { console.error('  ' + f); });
    process.exit(1);
}
console.log('All checks passed.');
console.log('  40 distinct roles · ' + required + ' required · ' + exempt + ' exempt · ' + (required + exempt) + ' total');
