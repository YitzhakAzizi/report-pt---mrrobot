"use strict";

var BUDGET_FLOW_STEP_IDS = [
  "budget-flow-debts",
  "budget-flow-income",
  "budget-flow-donations",
  "budget-flow-expenses",
  "budget-flow-variable-expenses",
  "budget-flow-special-expenses",
  "budget-flow-calculate",
  "budget-flow-result"
];
var budgetFlowCalculationTimer = null;
var budgetFlowCurrentStep = 0;
var budgetFlowFurthestStep = 0;

function startBudgetFlow() {
  if (budgetFlowCalculationTimer) {
    clearTimeout(budgetFlowCalculationTimer);
    budgetFlowCalculationTimer = null;
  }
  budgetFlowFurthestStep = AppState.profile.debtStatus ? 0 : 1;
  resetBudgetFlowCalculation();
  goToBudgetFlowStep(budgetFlowFurthestStep, false);
}

function goToBudgetFlowStep(stepIndex, shouldScroll) {
  if (!AppState.profile.debtStatus && stepIndex === 0) stepIndex = 1;
  /* במסלול החובות אין שלב תרומות: מדלגים עליו בכיוון התנועה */
  var donationsStep = BUDGET_FLOW_STEP_IDS.indexOf("budget-flow-donations");
  if (AppState.profile.debtStatus && stepIndex === donationsStep) {
    stepIndex = budgetFlowCurrentStep > donationsStep ? donationsStep - 1 : donationsStep + 1;
  }
  if (stepIndex < 0 || stepIndex >= BUDGET_FLOW_STEP_IDS.length) return;
  var overdraftInput = el("debt-overdraft-input");
  if (AppState.profile.debtStatus && budgetFlowCurrentStep === 0 && stepIndex !== 0 &&
      overdraftInput && parseNonNegativeNumber(overdraftInput.value) === null) {
    el("debt-overdraft-error").textContent = "יש להזין סכום מינוס תקין שאינו שלילי";
    overdraftInput.focus();
    return;
  }
  budgetFlowCurrentStep = stepIndex;
  budgetFlowFurthestStep = Math.max(budgetFlowFurthestStep, stepIndex);

  BUDGET_FLOW_STEP_IDS.forEach(function(stepId, index) {
    var step = el(stepId);
    if (!step) return;
    step.hidden = index !== stepIndex;
    step.classList.toggle("budget-flow-step-active", index === stepIndex);
  });

  updateTopbarDonationVisibility();

  var activeStep = el(BUDGET_FLOW_STEP_IDS[stepIndex]);
  if (!activeStep) return;

  if (shouldScroll !== false) {
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeStep.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "start"});
  }

  setTimeout(function() {
    var firstControl = activeStep.querySelector("button:not([disabled]), input:not([disabled]), select:not([disabled])");
    if (firstControl) firstControl.focus({preventScroll: true});
  }, 80);
}

function updateDebtStepOverdraft(value) {
  var overdraft = parseNonNegativeNumber(value);
  var error = el("debt-overdraft-error");
  if (error) error.textContent = overdraft === null ? "יש להזין סכום מינוס תקין שאינו שלילי" : "";
  if (overdraft === null) return;
  AppState.liabilities.overdraft = overdraft;
  saveLiabilities();
  pipeline();
}

function resetBudgetFlowCalculation() {
  var calculation = el("budget-flow-calculation");
  var button = el("budget-flow-calculate-btn");
  var loader = el("budget-flow-loader");
  if (calculation) calculation.setAttribute("aria-busy", "false");
  if (button) {
    button.hidden = false;
    button.disabled = !!(AppState.result && AppState.result.balance <= 0) ||
      (AppState.profile.debtStatus && !hasValidRecoveryPayment());
  }
  if (loader) loader.hidden = true;
}

function calculateBudgetFlow() {
  var calculation = el("budget-flow-calculation");
  var button = el("budget-flow-calculate-btn");
  var loader = el("budget-flow-loader");
  if (!calculation || !button || !loader || budgetFlowCalculationTimer) return;

  pipeline();
  if (AppState.profile.debtStatus && !hasValidRecoveryPayment()) {
    renderRecoveryDashboard(AppState.result);
    return;
  }
  if (AppState.result.balance <= 0) {
    renderPreAllocation(AppState.result);
    return;
  }
  calculation.setAttribute("aria-busy", "true");
  button.disabled = true;
  button.hidden = true;
  loader.hidden = false;

  budgetFlowCalculationTimer = setTimeout(function() {
    budgetFlowCalculationTimer = null;
    calculation.setAttribute("aria-busy", "false");
    resetBudgetFlowCalculation();
    goToBudgetFlowStep(7);
  }, 700);
}
