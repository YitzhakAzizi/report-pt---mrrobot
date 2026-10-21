"use strict";

/* דיווח שגיאות על המסך: באייפון אין כלי מפתחים, כך שהשגיאה מוצגת למשתמש וניתנת לצילום */
var APP_VERSION = "29";
function showErrorReport(message) {
  var bar = el("error-report");
  if (!bar) {
    bar = mk("div", "error-report");
    bar.id = "error-report";
    bar.setAttribute("role", "alert");
    bar.onclick = function() { bar.remove(); };
    document.body.appendChild(bar);
  }
  bar.textContent = "שגיאה (גרסה " + APP_VERSION + "): " + String(message || "לא ידועה").slice(0, 200) + " · הקישו לסגירה";
}
window.addEventListener("error", function(event) { showErrorReport(event.message); });
window.addEventListener("unhandledrejection", function(event) {
  var reason = event.reason;
  showErrorReport(reason && reason.message ? reason.message : reason);
});

(function init() {
  var now = new Date();
  AppState.period.month = now.getMonth();
  AppState.period.year = now.getFullYear();

  registerEvents();
  renderNextMeetingLabel();

  loadGoals();
  loadMaaserAccount();
  loadDreams();
  loadPercentageSettings();
  loadLiabilities();
  loadProfileSettings();
  loadInvestmentsOverview();
  openBudgetPeriod(AppState.period.month, AppState.period.year);
  refreshWithoutSaving();
})();
