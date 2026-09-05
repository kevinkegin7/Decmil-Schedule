/*
 * Stands in for the Site Diary server and the Kendo/toastr globals so
 * src/take5.js can run unmodified in a plain browser page.
 *
 *   $.getJSON  → resolves from T5Fixture by URL
 *   $.ajax     → records the call (SaveCount / Notify) and resolves
 *   kendo      → Workbook captures its config into window.__workbooks
 *   toastr     → records messages into window.__toasts
 */
(function () {
    'use strict';
    window.__ajax = [];
    window.__workbooks = [];
    window.__toasts = [];

    $.getJSON = function (url) {
        var d = $.Deferred();
        setTimeout(function () {
            if (url === '/Take5/GetCapture') d.resolve(T5Fixture.getCapture());
            else if (url === '/Take5/GetDashboard') d.resolve(T5Fixture.getDashboard());
            else d.reject();
        }, 0);
        return d.promise();
    };
    $.ajax = function (opts) {
        window.__ajax.push(opts);
        var d = $.Deferred();
        setTimeout(function () { d.resolve({ Sent: 1 }); }, 0);
        return d.promise();
    };

    window.kendo = {
        ooxml: {
            Workbook: function (cfg) {
                window.__workbooks.push(cfg);
                this.toDataURLAsync = function () { return Promise.resolve('data:application/octet-stream;base64,'); };
            }
        },
        saveAs: function () { }
    };
    window.toastr = {};
    ['info', 'error', 'success', 'warning'].forEach(function (k) {
        window.toastr[k] = function (msg, title) { window.__toasts.push({ level: k, msg: msg, title: title }); };
    });
}());
