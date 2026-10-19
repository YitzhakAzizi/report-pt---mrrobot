"use strict";

function investmentAmount(value) {
  var number = Number(value);
  return isFinite(number) && number >= 0 ? number : 0;
}

function investmentPercent(value) {
  if (value === "" || value === null || value === undefined) return null;
  var number = Number(value);
  return isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function normalizeInvestmentOverview(item) {
  item = item && typeof item === "object" ? item : {};
  var validCoverage = {unknown: true, yes: true, no: true};
  return {
    institution: String(item.institution || "").slice(0, 120),
    personalDeposit: investmentAmount(item.personalDeposit),
    employerDeposit: investmentAmount(item.employerDeposit),
    balance: investmentAmount(item.balance),
    depositFee: investmentPercent(item.depositFee),
    balanceFee: investmentPercent(item.balanceFee),
    disabilityStatus: validCoverage[item.disabilityStatus] ? item.disabilityStatus : "unknown",
    disabilityMonthlyBenefit: investmentAmount(item.disabilityMonthlyBenefit),
    survivorsStatus: validCoverage[item.survivorsStatus] ? item.survivorsStatus : "unknown"
  };
}

function loadInvestmentsOverview() {
  AppState.investments = {};
  try {
    var saved = JSON.parse(localStorage.getItem(INVESTMENTS_OVERVIEW_KEY) || "{}");
    INVESTMENT_PRODUCT_DEFS.forEach(function(product) {
      AppState.investments[product.id] = normalizeInvestmentOverview(saved && saved[product.id]);
    });
  } catch(e) {
    INVESTMENT_PRODUCT_DEFS.forEach(function(product) {
      AppState.investments[product.id] = normalizeInvestmentOverview({});
    });
  }
}

function saveInvestmentsOverview() {
  try { localStorage.setItem(INVESTMENTS_OVERVIEW_KEY, JSON.stringify(AppState.investments)); } catch(e) {}
}
