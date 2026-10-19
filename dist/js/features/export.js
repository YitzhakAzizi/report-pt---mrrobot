"use strict";

function exportPDF() {
  if (AppState.profile.debtStatus && !hasValidRecoveryPayment()) {
    alert("יש לבחור סכום להחזר נוסף לפני הפקת הדוח.");
    return;
  }
  var month = AppState.period.month;
  var year = AppState.period.year;
  var result = AppState.result;
  var allocation = AppState.settings.allocation;
  var balance = Math.max(0, result.balance);
  var loanAndDebtPaid = result.loanPayments + result.debtPayments;
  var loanAndDebtRemaining = sumLiabilityBalances(
    (AppState.liabilities.loans || []).concat(AppState.liabilities.debts || [])
  );
  var mortgageRemaining = AppState.profile.mortgage ? sumLiabilityBalances(AppState.liabilities.mortgages || []) : 0;

  function detailRows(items) {
    var visible = (items || []).filter(function(item) {
      return Number(item.val) > 0;
    });
    if (!visible.length) return '<div class="detail-empty">טרם הוזן פירוט</div>';
    return '<div class="detail-list">' + visible.map(function(item) {
      return '<div class="detail-row"><span>' + escapeHtml(item.name || "ללא שם") +
        '</span><strong>' + money(Number(item.val) || 0) + '</strong></div>';
    }).join("") + '</div>';
  }

  function summaryCard(label, value, tone, details) {
    return '<article class="summary-card ' + tone + '">' +
      '<div class="summary-head"><span class="summary-tag">' + label + '</span>' +
      '<strong class="summary-value">' + value + '</strong></div>' +
      '<div class="summary-details">' + details + '</div>' +
    '</article>';
  }

  function amountLine(label, amount) {
    return '<div class="amount-line"><span>' + label + '</span><strong>' + money(amount) + '</strong></div>';
  }

  function allocationCard(label, amount) {
    return '<article class="allocation-card"><div class="allocation-main">' +
      '<span class="allocation-label">' + label + '</span><strong class="allocation-value">' + money(amount) + '</strong></div></article>';
  }

  var salaryMonth = MONTHS[(month + 11) % 12];
  var incomeDetails = amountLine(
    AppState.profile.single ? "משכורת " + salaryMonth : "משכורת " + salaryMonth + " - בן זוג",
    Number(AppState.income1[0] && AppState.income1[0].val) || 0
  );
  if (!AppState.profile.single) {
    incomeDetails += amountLine("משכורת " + salaryMonth + " - בת זוג", Number(AppState.income2[0] && AppState.income2[0].val) || 0);
  }
  (AppState.income1 || []).slice(1).forEach(function(item) {
    incomeDetails += amountLine(item.name || "הכנסה נוספת", Number(item.val) || 0);
  });
  if (!AppState.profile.single) {
    (AppState.income2 || []).slice(1).forEach(function(item) {
      incomeDetails += amountLine(item.name || "הכנסה נוספת", Number(item.val) || 0);
    });
  }
  var liabilitiesDetails =
    amountLine("שולם החודש", loanAndDebtPaid) +
    amountLine("יתרה לסילוק", loanAndDebtRemaining);
  if (AppState.profile.debtStatus && AppState.liabilities.overdraft > 0) {
    liabilitiesDetails += amountLine("מינוס בחשבון", AppState.liabilities.overdraft);
  }
  var mortgageDetails =
    amountLine("שולם החודש", result.mortgagePayments) +
    amountLine("יתרת משכנתא", mortgageRemaining);

  var investmentAmount = percentageOf(balance, allocation.invest);
  var qualityAmount = percentageOf(balance, allocation.qualityOfLife);
  var spendingAmount = percentageOf(balance, allocation.spending);
  var css = [
    "@page{size:A4 landscape;margin:10mm}",
    "*{box-sizing:border-box}",
    "body{font-family:'Heebo','Segoe UI',Arial,sans-serif;background:#f4f8f6;margin:0;padding:24px;direction:rtl;color:#0f172a}",
    ".report{max-width:1040px;margin:0 auto}.report-panel{background:#fff;border-radius:22px;padding:22px;box-shadow:0 12px 34px rgba(22,58,95,.08)}.tasks-panel{margin-top:14px}.overview-panel{margin-top:88px}",
    ".summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
    ".summary-card{min-width:0;padding:14px;border:1px solid #dfe8e4;border-radius:18px;background:#f9fcfa}",
    ".summary-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:800}.summary-tag{display:inline-flex;padding:5px 9px;border-radius:9px}.summary-card .summary-tag{background:#e8f1fb;color:#2563a6}",
    ".summary-value{color:#163a5f;font-family:'Heebo',sans-serif;font-size:14px;font-weight:700;direction:ltr;white-space:nowrap}",
    ".summary-details{margin-top:8px;border-top:1px solid #e5e7eb;padding-top:7px}",
    ".detail-row,.amount-line{display:flex;justify-content:space-between;gap:7px;padding:3px 0;color:#64748b;font-size:10px}",
    ".detail-row strong,.amount-line strong{color:#334155;direction:ltr;white-space:nowrap}.detail-empty{padding:7px 0;color:#94a3b8;font-size:10px;text-align:center}",
    ".section-space{height:30px}",
    ".section-title,.annual-head h2{text-align:center;color:#64748b;font-family:'Rubik','Heebo',sans-serif;font-size:12px;font-weight:700;margin:0 0 10px}",
    ".allocation-grid{display:grid;grid-template-columns:1fr;gap:8px}",
    ".allocation-card{padding:9px 14px;border:1px solid #e5e7eb;border-radius:14px;background:#fbfcfd}",
    ".allocation-main{display:flex;align-items:center;justify-content:space-between;gap:10px}.allocation-label{color:#163a5f;font-size:12px;font-weight:800}",
    ".allocation-value{color:#163a5f;font-family:'Heebo',sans-serif;font-size:15px;font-weight:700;direction:ltr;white-space:nowrap}",
    ".allocation-instructions{margin:0;padding:0 22px 0 0;color:#475569;font-size:11px;line-height:1.75;text-align:right}.allocation-instructions li{padding:5px 4px 5px 0;border-bottom:1px solid #edf2ef}.allocation-instructions li:last-child{border-bottom:none}.allocation-instructions strong{color:#163a5f;direction:ltr;white-space:nowrap}",
    ".annual-head{text-align:center;margin-bottom:11px}",
    ".annual-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}",
    ".annual-total{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid #dfe8e4;border-radius:15px;background:#f9fcfa;font-size:11px;font-weight:800}",
    ".annual-total strong{color:#163a5f;font-family:'Heebo',sans-serif;font-size:14px;font-weight:700;direction:ltr}.annual-tag{padding:5px 9px;border-radius:9px}.annual-total .annual-tag{background:#e8f1fb;color:#2563a6}",
    ".months-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}",
    ".month-card{min-height:78px;padding:8px 7px;border-radius:13px;display:flex;flex-direction:column;align-items:stretch;justify-content:center;text-align:center;border:2px solid transparent}",
    ".month-card.complete{background:#e8f5ef;color:#176b5b}.month-card.unknown{background:#f1eafd;color:#70529b}.month-card.selected{border-color:#22c55e}",
    ".month-name{font-size:10px;font-weight:800;margin-bottom:5px}.month-finance-row{display:flex;justify-content:space-between;gap:5px;padding:2px 0;font-size:8.5px}.month-finance-row strong{direction:ltr;white-space:nowrap;font-size:8.5px}",
    "@media(max-width:760px){body{padding:10px}.report-panel{padding:16px}.summary-grid,.annual-summary{grid-template-columns:repeat(2,1fr)}.months-grid{grid-template-columns:repeat(3,1fr)}}",
    "@media print{body{padding:0;background:#fff}.report{max-width:none}.report-panel{box-shadow:none;border:1px solid #edf0ef}.overview-panel{margin-top:0;break-before:page;page-break-before:always}.summary-card,.allocation-card,.annual-total,.month-card{-webkit-print-color-adjust:exact;print-color-adjust:exact}}"
  ].join("");

  var title = "דוח - " + MONTHS[month];
  var tasksHtml = "";
  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>' + title +
    '</title><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&family=Rubik:wght@500;600;700;800&display=swap" rel="stylesheet"><style>' +
    css + '</style></head><body><main class="report">';
  html += '<section class="report-panel allocation-panel"><div class="section-title">חלוקה חודשית</div>';
  html += '<div class="allocation-grid">';
  if (AppState.profile.debtStatus) {
    var recoverySpendingAmount = Math.max(0, balance - AppState.recoveryPayment);
    html += allocationCard("החזר נוסף לחוב", AppState.recoveryPayment);
    html += allocationCard("יתרה לשימוש החודש", recoverySpendingAmount);
    tasksHtml = '<ol class="allocation-instructions">' +
      '<li>להעביר להחזר נוסף של חוב לפי בחירה - <strong>' + money(AppState.recoveryPayment) + '</strong></li>' +
      '<li>היתרה הזמינה לשימוש החודש - <strong>' + money(recoverySpendingAmount) + '</strong></li></ol>';
  } else if (result.priorityDebt) {
    var debtPaymentAmount = percentageOf(balance, DEFAULT_DEBT_PLAN_PERCENTAGES.debt);
    var debtSpendingAmount = percentageOf(balance, DEFAULT_DEBT_PLAN_PERCENTAGES.spending);
    html += allocationCard("החזר נוסף לחוב", debtPaymentAmount);
    html += allocationCard("בזבוזים", debtSpendingAmount);
    tasksHtml = '<ol class="allocation-instructions">' +
      '<li>העבר להחזר נוסף של ' + escapeHtml(result.priorityDebt.name) + ' - <strong>' + money(debtPaymentAmount) + '</strong></li>' +
      '<li>משוך במזומן את סכום הבזבוזים החודשי - <strong>' + money(debtSpendingAmount) + '</strong></li></ol>';
  } else {
    html += allocationCard("קרן השקעות", investmentAmount);
    html += allocationCard("קרן איכות חיים", qualityAmount);
    html += allocationCard("בזבוזים", spendingAmount);
    tasksHtml = '<ol class="allocation-instructions">' +
      '<li>העבר לתיק ההשקעות - <strong>' + money(investmentAmount) + '</strong></li>' +
      '<li>העבר לקרן הכספית - <strong>' + money(qualityAmount) + '</strong></li>' +
      '<li>משוך במזומן את סכום הבזבוזים החודשי - <strong>' + money(spendingAmount) + '</strong></li></ol>';
  }
  html += '</div></section>';
  html += '<section class="report-panel tasks-panel"><div class="section-title">משימות</div>' + tasksHtml + '</section>';
  html += '<section class="report-panel overview-panel">';
  html += '<section><div class="section-title">תמונה חודשית</div><div class="summary-grid">';
  html += summaryCard("הכנסות", money(result.total), "income", incomeDetails);
  var activeExpenseDetails = AppState.oneTimeExpenses.concat(AppState.variableExpenses, AppState.subscriptions || [], AppState.healthBeautyExpenses || [], getActiveFixedExpenseItems(), AppState.insurances);
  if (AppState.profile.children) activeExpenseDetails = activeExpenseDetails.concat(AppState.childrenExpenses || []);
  html += summaryCard("הוצאות", money(result.exp + result.insurance), "outflow", detailRows(activeExpenseDetails));
  html += summaryCard("הלוואות", money(loanAndDebtPaid), "outflow", liabilitiesDetails);
  if (AppState.profile.mortgage) html += summaryCard("משכנתא", money(result.mortgagePayments), "outflow", mortgageDetails);
  html += '</div></section><div class="section-space" aria-hidden="true"></div>';
  html += annualIncomeOverviewHtml(year, month);
  html += '</section>';
  html += '</main></body></html>';

  var reportWindow = window.open("", "_blank", "width=1100,height=800");
  if (!reportWindow) {
    alert("נא לאפשר חלונות קופצים.");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  setTimeout(function() { reportWindow.print(); }, 600);
}

function sumLiabilityBalances(items) {
  return (items || []).reduce(function(total, item) {
    return total + (Number(item.balance) || 0);
  }, 0);
}

function incomeComparisonText(currentIncome, month, year) {
  var previousMonth = month - 1;
  var previousYear = year;
  if (previousMonth < 0) {
    previousMonth = 11;
    previousYear--;
  }

  var previousData = getSavedMonthData(previousMonth, previousYear);
  if (!previousData) return "";

  var previousIncome = sumArr(previousData.income1 || []) + sumArr(previousData.income2 || []);
  if (previousIncome <= 0) return "";
  var difference = currentIncome - previousIncome;
  if (difference > 0) return "החודש הכנסת " + money(difference) + " יותר מחודש שעבר";
  if (difference < 0) return "החודש הרווחת " + money(Math.abs(difference)) + " פחות מחודש שעבר";
  return "החודש הכנסת סכום זהה לחודש שעבר";
}

function annualIncomeOverviewHtml(year, selectedMonth, systemDate) {
  var annualIncome = 0;
  var annualExpenses = 0;
  var averageExpenseTotal = 0;
  var monthsWithIncome = 0;
  var months = [];

  MONTHS.forEach(function(monthName, monthIndex) {
    var saved = getSavedMonthData(monthIndex, year);
    var income = saved ? sumArr(saved.income1 || []) + sumArr(saved.income2 || []) : 0;
    var expenses = saved ? sumArr(saved.oneTimeExpenses || []) + sumArr(saved.expenses || []) + sumArr(saved.variableExpenses || []) + sumArr(saved.subscriptions || []) + sumArr(saved.healthBeautyExpenses || []) + sumArr(saved.childrenExpenses || []) + sumArr(saved.insurances || []) : 0;
    var hasIncome = income > 0;
    if (hasIncome) {
      annualIncome += income;
      averageExpenseTotal += expenses;
      monthsWithIncome++;
    }
    if (saved) annualExpenses += expenses;

    months.push({
      name: monthName,
      className: hasIncome ? "complete" : "unknown",
      income: hasIncome ? money(income) : "?",
      expenses: hasIncome ? money(expenses) : "?"
    });
  });

  var averageIncome = monthsWithIncome ? annualIncome / monthsWithIncome : 0;
  var averageExpenses = monthsWithIncome ? averageExpenseTotal / monthsWithIncome : 0;

  var html = '<section class="annual"><div class="annual-head"><h2>תמונה שנתית</h2></div>';
  html += '<div class="annual-summary">' +
    '<div class="annual-total income"><span class="annual-tag">הכנסה שנתית</span><strong>' +
      money(annualIncome) + '</strong></div>' +
    '<div class="annual-total expenses"><span class="annual-tag">הוצאה שנתית</span><strong>' +
      money(annualExpenses) + '</strong></div>' +
    '<div class="annual-total income"><span class="annual-tag">ממוצע הכנסות חודשי</span><strong>' +
      money(averageIncome) + '</strong></div>' +
    '<div class="annual-total expenses"><span class="annual-tag">ממוצע הוצאות חודשי</span><strong>' +
      money(averageExpenses) + '</strong></div></div>';
  html += '<div class="months-grid">';

  months.forEach(function(month, monthIndex) {
    var className = month.className;
    if (monthIndex === selectedMonth) className += " selected";
    html += '<div class="month-card ' + className + '"><span class="month-name">' + month.name + '</span>' +
      '<div class="month-finance-row"><span>הכנסות:</span><strong>' + month.income + '</strong></div>' +
      '<div class="month-finance-row"><span>הוצאות:</span><strong>' + month.expenses + '</strong></div></div>';
  });

  return html + '</div></section>';
}
