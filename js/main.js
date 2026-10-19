"use strict";

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
