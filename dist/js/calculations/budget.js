"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. LOGIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function calculate() {
  var s1 = sumArr(AppState.income1);
  var s2 = AppState.profile.single ? 0 : sumArr(AppState.income2);
  var fixedExpenses = sumArr(getActiveFixedExpenseItems());
  var childrenExpenses = AppState.profile.children ? sumArr(AppState.childrenExpenses) : 0;
  var variableExpenses = sumArr(AppState.variableExpenses);
  var subscriptionExpenses = sumArr(AppState.subscriptions);
  var healthBeautyExpenses = sumArr(AppState.healthBeautyExpenses);
  var oneTimeExpenses = sumArr(AppState.oneTimeExpenses);
  var exp = fixedExpenses + variableExpenses + subscriptionExpenses + healthBeautyExpenses + oneTimeExpenses + childrenExpenses;
  var insurance = sumArr(AppState.insurances);
  var expenseTotal = exp + insurance;
  var total = s1 + s2;
  var loanPayments = sumLoanMonthlyPayments(AppState.liabilities.loans);
  var debtPayments = sumDebtMinimumPayments(AppState.liabilities.debts);
  var mortgagePayments = AppState.profile.mortgage ? sumMortgageMonthlyPayments(AppState.liabilities.mortgages) : 0;
  var liabilityPayments = loanPayments + debtPayments + mortgagePayments;
  var priorityDebt = getPriorityDebt(AppState.liabilities);
  var maaserEnabled = !AppState.profile.debtStatus && !!(AppState.maaser && AppState.maaser.enabled);
  var availableBeforeMaaser = total - expenseTotal - liabilityPayments;
  var maaser = maaserEnabled && availableBeforeMaaser > 0 ? percentageOf(total, AppState.settings.maaserPercent) : 0; // תרומה מחושבת מההכנסה רק כאשר נשארה יתרה לאחר הוצאות והתחייבויות
  var balance = total - expenseTotal - liabilityPayments - maaser;
  AppState.result = {
    s1: s1, s2: s2, total: total, exp: exp, fixedExpenses: fixedExpenses,
    variableExpenses: variableExpenses, subscriptionExpenses: subscriptionExpenses, healthBeautyExpenses: healthBeautyExpenses, oneTimeExpenses: oneTimeExpenses, childrenExpenses: childrenExpenses,
    insurance: insurance, maaser: maaser, availableBeforeMaaser: availableBeforeMaaser, balance: balance,
    loanPayments: loanPayments,
    debtPayments: debtPayments,
    mortgagePayments: mortgagePayments,
    liabilityPayments: liabilityPayments,
    priorityDebt: priorityDebt
  };

  /* auto-calculate goal targets from all monthly expenses and commitments */
  var monthlyCommitments = fixedExpenses + variableExpenses + subscriptionExpenses + healthBeautyExpenses + childrenExpenses + insurance + liabilityPayments;
  GOAL_DEFS.forEach(function(gd) {
    if (gd.auto) {
      var goal = AppState.goals[gd.id];
      var previousTarget = Number(goal.target) || 0;
      var nextTarget = monthlyCommitments * gd.multiplier;
      if (gd.id === "checking" && goal.completed && nextTarget > previousTarget && Number(goal.current) < nextTarget) {
        goal.completed = false;
        AppState.goalCompletionAdjusted = true;
      }
      goal.target = nextTarget;
    }
  });
}

function isRentExpense(item) {
  return !!item && !item.customCategory && String(item.name || "").trim() === "שכר דירה";
}

function getActiveFixedExpenseItems() {
  return AppState.profile.renting
    ? (AppState.expenses || [])
    : (AppState.expenses || []).filter(function(item) { return !isRentExpense(item); });
}

function rentExpenseTotal() {
  return (AppState.expenses || []).reduce(function(total, item) {
    return total + (isRentExpense(item) ? (Number(item.val) || 0) : 0);
  }, 0);
}

function sumLoanMonthlyPayments(loans) {
  return (loans || []).reduce(function(total, loan) {
    return total + (Number(loan.monthlyPayment) || 0);
  }, 0);
}

function sumDebtMinimumPayments(debts) {
  return (debts || []).reduce(function(total, debt) {
    return total + (Number(debt.minimumPayment) || 0);
  }, 0);
}

function sumMortgageMonthlyPayments(mortgages) {
  return (mortgages || []).reduce(function(total, mortgage) {
    return total + (Number(mortgage.monthlyPayment) || 0);
  }, 0);
}

function getPriorityDebt(liabilities) {
  var candidates = [];
  (liabilities.debts || []).forEach(function(debt) {
    if (Number(debt.balance) > 0) {
      candidates.push({
        type: "debt",
        name: debt.name || "חוב",
        balance: Number(debt.balance) || 0,
        interest: Number(debt.interest) || 0
      });
    }
  });
  (liabilities.loans || []).forEach(function(loan) {
    if (loan.earlyPayoff === true && Number(loan.balance) > 0) {
      candidates.push({
        type: "loan",
        name: loan.name || "הלוואה",
        balance: Number(loan.balance) || 0,
        interest: Number(loan.interest) || 0
      });
    }
  });
  candidates.sort(function(a, b) {
    if (b.interest !== a.interest) return b.interest - a.interest;
    return a.balance - b.balance;
  });
  return candidates.length ? candidates[0] : null;
}

function hasActiveDebtPlan() {
  return !!(AppState.result && AppState.result.priorityDebt);
}

function recoveryDebtBalance(liabilities) {
  var total = Number(liabilities.overdraft) || 0;
  (liabilities.debts || []).forEach(function(debt) { total += Number(debt.balance) || 0; });
  (liabilities.loans || []).forEach(function(loan) {
    if (loan.earlyPayoff) total += Number(loan.balance) || 0;
  });
  return total;
}

function recoveryPaymentLimit() {
  return Math.min(Math.max(0, AppState.result.balance || 0), recoveryDebtBalance(AppState.liabilities));
}

function hasValidRecoveryPayment() {
  return AppState.recoveryPayment !== null &&
    parseNonNegativeNumber(AppState.recoveryPayment) !== null &&
    recoveryDebtBalance(AppState.liabilities) > 0 &&
    AppState.recoveryPayment <= recoveryPaymentLimit();
}

function percentageOf(amount, percentage) {
  return amount * (percentage / 100);
}

function remainingDaysInLocalMonth(date) {
  var localDate = date || new Date();
  var lastDay = new Date(localDate.getFullYear(), localDate.getMonth() + 1, 0).getDate();
  return lastDay - localDate.getDate() + 1;
}

function dailySpendingAmount(monthlySpending, date) {
  return monthlySpending / remainingDaysInLocalMonth(date);
}
