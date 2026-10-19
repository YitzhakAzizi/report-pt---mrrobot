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
  var loaded = loadData(AppState.period.month, AppState.period.year);
  if (!loaded) {
    AppState.expenses = clone(DEFAULT_EXPENSES);
    AppState.variableExpenses = clone(DEFAULT_VARIABLE_EXPENSES);
  }

  pipeline();
})();
