"use strict";

var currentFinancialPage = "cashflow";
var selectedInvestmentProduct = null;
var selectedInvestmentTab = "details";
var selectedInsuranceType = null;
var FINANCIAL_PAGES = ["cashflow", "investments", "insurances", "loans"];

function showFinancialPage(page, productId, tab) {
  if (FINANCIAL_PAGES.indexOf(page) < 0) return;
  closeSideMenu();
  currentFinancialPage = page;
  el("budget-main").hidden = page !== "cashflow";
  el("investments-page").hidden = page !== "investments";
  el("insurances-page").hidden = page !== "insurances";
  el("loans-page").hidden = page !== "loans";
  el("calculator-app").classList.toggle("finance-page-open", page !== "cashflow");

  FINANCIAL_PAGES.forEach(function(name) {
    var button = el("menu-" + name);
    if (!button) return;
    var active = name === page;
    button.classList.toggle("side-menu-item-current", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
    var badge = button.querySelector(".side-menu-current-badge");
    if (badge) badge.hidden = !active;
  });

  if (page === "investments") {
    renderInvestmentCards();
    if (productId) openInvestmentProduct(productId, tab);
    else if (selectedInvestmentProduct) renderInvestmentDetail();
  } else if (page === "insurances") {
    renderInsuranceCards();
    if (productId) { openInsuranceType(productId); return; }
    if (selectedInsuranceType) renderInsuranceDetail();
  } else if (page === "loans") {
    renderLoansPage();
  }
  if (page === "investments" && productId) return;
  window.scrollTo(0, 0);
  if (page === "cashflow") el("brand-menu-button").focus({preventScroll: true});
  else el(page + "-page-title").focus({preventScroll: true});
}

function renderFinancialPages() {
  if (currentFinancialPage === "insurances") {
    renderInsuranceCards();
    if (selectedInsuranceType) renderInsuranceDetail();
  }
  /* לא בונים מחדש בזמן הקלדה, כדי שהשדה הבא לא יאבד את הפוקוס */
  if (currentFinancialPage === "loans" && !el("loans-detail").contains(document.activeElement)) renderLoansPage();
}

function investmentProduct(id) {
  return INVESTMENT_PRODUCT_DEFS.filter(function(product) { return product.id === id; })[0] || null;
}

function hasInvestmentOverviewData(record) {
  return !!(record && (record.institution || record.personalDeposit || record.employerDeposit || record.balance ||
    (record.depositFee !== null && record.depositFee !== undefined) ||
    (record.balanceFee !== null && record.balanceFee !== undefined) ||
    (record.disabilityStatus && record.disabilityStatus !== "unknown") ||
    (record.survivorsStatus && record.survivorsStatus !== "unknown") || record.disabilityMonthlyBenefit));
}

function renderInvestmentCards() {
  var grid = el("financial-product-grid");
  if (!grid) return;
  grid.innerHTML = INVESTMENT_PRODUCT_DEFS.filter(function(product) {
    return product.id !== "gemelInvest";
  }).map(function(product) {
    var record = AppState.investments[product.id] || {};
    var balance = Number(record.balance) || 0;
    var hasData = hasInvestmentOverviewData(record);
    if (product.id === "gemel") {
      var investingRecord = AppState.investments.gemelInvest || {};
      balance += Number(investingRecord.balance) || 0;
      hasData = hasData || hasInvestmentOverviewData(investingRecord);
    }
    var selected = selectedInvestmentProduct === product.id ||
      (product.id === "gemel" && selectedInvestmentProduct === "gemelInvest");
    return '<button type="button" class="financial-product' + (selected ? ' selected' : '') + '" ' +
      'onclick="openInvestmentProduct(\'' + product.id + '\')" aria-expanded="' + selected + '" aria-controls="investment-detail">' +
      '<span class="financial-product-icon material-symbols-rounded" aria-hidden="true">' + product.icon + '</span>' +
      '<span class="financial-product-copy"><strong>' + product.name + '</strong>' +
      (product.id === "gemel" ? '<small>רגילה / להשקעה</small>' : '') + '</span>' +
      '<span class="financial-product-value" title="' + (hasData ? money(balance) : 'לא הוזן') + '">' +
      (hasData ? money(balance) : 'לא הוזן') + '</span></button>';
  }).join("");
}

function openInvestmentProduct(id, tab) {
  if (!investmentProduct(id)) return;
  selectedInvestmentProduct = id;
  selectedInvestmentTab = id === "pension" && tab === "coverage" ? "coverage" : "details";
  renderInvestmentCards();
  renderInvestmentDetail();
  el("investment-detail").scrollIntoView({behavior: "smooth", block: "nearest"});
  el("investment-detail").focus({preventScroll: true});
}

function switchInvestmentTab(tab) {
  if (selectedInvestmentProduct !== "pension" || ["details", "coverage"].indexOf(tab) < 0) return;
  selectedInvestmentTab = tab;
  renderInvestmentDetail();
  el("investment-detail").focus({preventScroll: true});
}

function renderInvestmentDetail() {
  var section = el("investment-detail");
  var product = investmentProduct(selectedInvestmentProduct);
  if (!section || !product) return;
  var record = AppState.investments[product.id] || normalizeInvestmentOverview({});
  section.hidden = false;
  var html = '<div class="financial-detail-heading"><h3>' + product.name + '</h3>' +
    '<button type="button" class="financial-detail-close material-symbols-rounded" onclick="closeInvestmentDetail()" aria-label="סגירת הפרטים">close</button></div>';

  if (product.id === "gemel" || product.id === "gemelInvest") {
    html += '<div class="financial-detail-tabs" role="group" aria-label="סוג קופת הגמל">' +
      '<button type="button" onclick="openInvestmentProduct(\'gemel\')" aria-pressed="' + (product.id === "gemel") + '">קופת גמל</button>' +
      '<button type="button" onclick="openInvestmentProduct(\'gemelInvest\')" aria-pressed="' + (product.id === "gemelInvest") + '">קופת גמל להשקעה</button></div>';
  }
  if (product.id === "pension") {
    html += '<div class="financial-detail-tabs" role="group" aria-label="פרטי קרן הפנסיה">' +
      '<button type="button" onclick="switchInvestmentTab(\'details\')" aria-pressed="' + (selectedInvestmentTab === "details") + '">נתוני הקרן</button>' +
      '<button type="button" onclick="switchInvestmentTab(\'coverage\')" aria-pressed="' + (selectedInvestmentTab === "coverage") + '">כיסויים ביטוחיים</button></div>';
  }

  if (product.id === "pension" && selectedInvestmentTab === "coverage") {
    html += '<div class="financial-form-grid">' +
      financialCoverageField("financial-disability-status", "אובדן כושר עבודה", record.disabilityStatus) +
      financialCoverageField("financial-survivors-status", "ביטוח שארים", record.survivorsStatus) +
      financialNumberField("financial-disability-benefit", "קצבת נכות חודשית לפי הדוח (₪)", record.disabilityMonthlyBenefit, "1", "0") +
      '</div><p class="financial-detail-note">הכיסוי בפועל נקבע בתקנון הקרן ובדוח האישי שלכם. סימון כאן אינו אישור שהכיסוי בתוקף.</p>' +
      '<p class="financial-form-error" id="financial-form-error" role="alert"></p>' +
      '<button type="button" class="financial-save-btn" onclick="saveInvestmentCoverage()">שמור פרטי כיסוי</button>';
  } else {
    html += '<div class="financial-form-grid">' +
      financialTextField("financial-institution", "בית השקעות / בנק", record.institution) +
      financialNumberField("financial-personal", "הפקדה עצמית לחודש (₪)", record.personalDeposit, "1", "0") +
      (product.employer ? financialNumberField("financial-employer", "הפקדת מעסיק לחודש (₪)", record.employerDeposit, "1", "0") : '') +
      financialNumberField("financial-balance", "סכום מצטבר (₪)", record.balance, "1", "0") +
      financialNumberField("financial-deposit-fee", "דמי ניהול מהפקדה (%)", record.depositFee, "0.01", "0", "100") +
      financialNumberField("financial-balance-fee", "דמי ניהול מצבירה (%)", record.balanceFee, "0.01", "0", "100") +
      '</div><p class="financial-detail-note">השאירו דמי ניהול ריקים אם אינם ידועים. הזינו רק חיובים שמופיעים בדוח שלכם.</p>' +
      '<p class="financial-form-error" id="financial-form-error" role="alert"></p>' +
      '<button type="button" class="financial-save-btn" onclick="saveInvestmentDetails()">שמור נתונים</button>' +
      '<div class="financial-fee-calculator"><h4>מה המשמעות לאורך זמן?</h4>' +
      '<div class="financial-form-grid">' +
      financialNumberField("financial-years", "תקופה לחישוב (שנים)", 20, "1", "1", "50") +
      financialNumberField("financial-return", "הנחת תשואה שנתית לפני דמי ניהול (%)", 0, "0.1", "-50", "50") +
      '</div><div class="financial-fee-result" id="financial-fee-result" aria-live="polite"></div>' +
      '<p class="financial-detail-note">תרחיש להמחשה בלבד, לא תחזית או המלצה. אינו כולל מס, עלויות ביטוח, עמלות מסחר או הוצאות אחרות שלא הוזנו.</p></div>';
  }
  section.innerHTML = html;
  if (!(product.id === "pension" && selectedInvestmentTab === "coverage")) {
    ["financial-personal", "financial-employer", "financial-balance", "financial-deposit-fee", "financial-balance-fee", "financial-years", "financial-return"].forEach(function(id) {
      var input = el(id);
      if (input) input.addEventListener("input", updateFeeProjection);
    });
    updateFeeProjection();
  }
}

function closeInvestmentDetail() {
  selectedInvestmentProduct = null;
  el("investment-detail").hidden = true;
  renderInvestmentCards();
  el("investments-page-title").focus({preventScroll: true});
}

function financialTextField(id, label, value) {
  return '<label class="financial-field"><span>' + label + '</span><input type="text" id="' + id + '" maxlength="120" value="' + escapeHtml(value || "") + '"></label>';
}

function financialNumberField(id, label, value, step, min, max) {
  var shown = value === null || value === undefined ? "" : value;
  return '<label class="financial-field"><span>' + label + '</span><input type="number" id="' + id + '" step="' + step + '" min="' + min + '"' +
    (max ? ' max="' + max + '"' : '') + ' inputmode="decimal" value="' + escapeHtml(shown) + '"></label>';
}

function financialCoverageField(id, label, value) {
  return '<label class="financial-field"><span>' + label + '</span><select id="' + id + '">' +
    '<option value="unknown"' + (value === "unknown" ? ' selected' : '') + '>לא ידוע</option>' +
    '<option value="yes"' + (value === "yes" ? ' selected' : '') + '>קיים לפי הדוח</option>' +
    '<option value="no"' + (value === "no" ? ' selected' : '') + '>לא קיים לפי הדוח</option></select></label>';
}

function readFinancialNumber(id, optional, max) {
  var field = el(id);
  if (!field) return 0;
  if (field.value === "") return optional ? null : 0;
  var value = Number(field.value);
  if (!isFinite(value) || value < 0 || (max !== undefined && value > max)) return NaN;
  return value;
}

function currentInvestmentDraft() {
  var product = investmentProduct(selectedInvestmentProduct);
  if (!product) return null;
  var current = AppState.investments[product.id] || normalizeInvestmentOverview({});
  return {
    institution: el("financial-institution").value.trim().slice(0, 120),
    personalDeposit: readFinancialNumber("financial-personal", false),
    employerDeposit: product.employer ? readFinancialNumber("financial-employer", false) : 0,
    balance: readFinancialNumber("financial-balance", false),
    depositFee: readFinancialNumber("financial-deposit-fee", true, 100),
    balanceFee: readFinancialNumber("financial-balance-fee", true, 100),
    disabilityStatus: current.disabilityStatus,
    disabilityMonthlyBenefit: current.disabilityMonthlyBenefit,
    survivorsStatus: current.survivorsStatus
  };
}

function investmentDraftValid(draft) {
  return draft && [draft.personalDeposit, draft.employerDeposit, draft.balance, draft.depositFee, draft.balanceFee].every(function(value) {
    return value === null || (isFinite(value) && value >= 0);
  });
}

function saveInvestmentDetails() {
  var draft = currentInvestmentDraft();
  var error = el("financial-form-error");
  if (!investmentDraftValid(draft)) {
    error.textContent = "יש להזין סכומים לא שליליים ודמי ניהול בין 0% ל־100%.";
    return;
  }
  AppState.investments[selectedInvestmentProduct] = draft;
  saveInvestmentsOverview();
  error.textContent = "";
  renderInvestmentCards();
  updateFeeProjection();
  flashSaved();
}

function saveInvestmentCoverage() {
  var benefit = readFinancialNumber("financial-disability-benefit", false);
  var error = el("financial-form-error");
  if (!isFinite(benefit) || benefit < 0) {
    error.textContent = "יש להזין סכום כיסוי תקין שאינו שלילי.";
    return;
  }
  var record = AppState.investments.pension || normalizeInvestmentOverview({});
  record.disabilityStatus = el("financial-disability-status").value;
  record.disabilityMonthlyBenefit = benefit;
  record.survivorsStatus = el("financial-survivors-status").value;
  AppState.investments.pension = record;
  saveInvestmentsOverview();
  error.textContent = "";
  flashSaved();
}

function updateFeeProjection() {
  var resultBox = el("financial-fee-result");
  if (!resultBox) return;
  var draft = currentInvestmentDraft();
  var years = Number(el("financial-years").value);
  var annualReturn = Number(el("financial-return").value);
  if (!investmentDraftValid(draft) || el("financial-years").value === "" || el("financial-return").value === "" ||
      !Number.isInteger(years) || years < 1 || years > 50 || !isFinite(annualReturn) || annualReturn < -50 || annualReturn > 50) {
    resultBox.textContent = "בדקו את הסכומים, התקופה והנחת התשואה שהוזנו.";
    return;
  }
  var projection = estimateInvestmentFees(draft, years, annualReturn);
  if (!projection) {
    resultBox.textContent = "הזינו לפחות אחד מסוגי דמי הניהול כדי להציג אומדן.";
    return;
  }
  resultBox.innerHTML = '<div><span>דמי ניהול לשנה לפי הנתונים כיום</span><strong>' + money(projection.currentAnnualEstimate) + '</strong></div>' +
    '<div><span>שווי משוער ללא דמי ניהול</span><strong>' + money(projection.withoutFees) + '</strong></div>' +
    '<div><span>שווי משוער עם דמי ניהול</span><strong>' + money(projection.withFees) + '</strong></div>' +
    '<div class="financial-fee-difference"><span>הפרש משוער לאורך ' + years + ' שנים</span><strong>' + money(projection.difference) + '</strong></div>';
}

var INSURANCE_PAGE_TYPES = [
  {id: "car", name: "ביטוח רכב", icon: "directions_car"},
  {id: "life", name: "ביטוח חיים", icon: "favorite"},
  {id: "disability", name: "ביטוח אובדן כושר עבודה", icon: "health_and_safety"},
  {id: "other", name: "ביטוחים נוספים", icon: "shield"}
];

function insurancePageType(item) {
  var name = String(item.name || "");
  if (/רכב/.test(name)) return "car";
  if (/אובדן כושר|אכ.?ע/.test(name)) return "disability";
  if (/חיים/.test(name)) return "life";
  return "other";
}

function renderInsuranceCards() {
  var grid = el("insurance-product-grid");
  if (!grid) return;
  el("insurance-page-period").textContent = "הביטוחים המשויכים לתקציב " + MONTHS[AppState.period.month] + " " + AppState.period.year;
  var items = AppState.insurances || [];
  grid.innerHTML = INSURANCE_PAGE_TYPES.filter(function(type) {
    return type.id !== "other" || selectedInsuranceType === "other" || items.some(function(item) { return insurancePageType(item) === "other"; });
  }).map(function(type) {
    var matching = items.filter(function(item) { return insurancePageType(item) === type.id; });
    var amount = matching.reduce(function(total, item) { return total + (Number(item.val) || 0); }, 0);
    var selected = selectedInsuranceType === type.id;
    return '<button type="button" class="financial-product' + (selected ? ' selected' : '') + '" ' +
      'onclick="openInsuranceType(\'' + type.id + '\')" aria-expanded="' + selected + '" aria-controls="insurance-detail">' +
      '<span class="financial-product-icon material-symbols-rounded" aria-hidden="true">' + type.icon + '</span>' +
      '<span class="financial-product-copy"><strong>' + type.name + '</strong><small>' + (matching.length === 1 ? 'רשומה אחת' : matching.length + ' רשומות') + '</small></span>' +
      '<span class="financial-product-value" title="' + (matching.length ? money(amount) + ' לחודש' : 'לא הוזן') + '">' +
      (matching.length ? money(amount) + ' / חודש' : 'לא הוזן') + '</span></button>';
  }).join("");
}

function openInsuranceType(id) {
  if (!INSURANCE_PAGE_TYPES.some(function(type) { return type.id === id; })) return;
  selectedInsuranceType = id;
  renderInsuranceCards();
  renderInsuranceDetail();
  el("insurance-detail").scrollIntoView({behavior: "smooth", block: "nearest"});
  el("insurance-detail").focus({preventScroll: true});
}

function renderInsuranceDetail() {
  var section = el("insurance-detail");
  var type = INSURANCE_PAGE_TYPES.filter(function(item) { return item.id === selectedInsuranceType; })[0];
  if (!section || !type) return;
  var items = (AppState.insurances || []).filter(function(item) { return insurancePageType(item) === type.id; });
  section.hidden = false;
  var html = '<div class="financial-detail-heading"><h3>' + type.name + '</h3>' +
    '<button type="button" class="financial-detail-close material-symbols-rounded" onclick="closeInsuranceDetail()" aria-label="סגירת הפרטים">close</button></div>';
  /* שם וסכום נערכים בהוצאות הקבועות; כאן משלימים את הפרטים */
  html += items.length ? '<div class="financial-insurance-list">' + items.map(function(item) {
    var index = AppState.insurances.indexOf(item);
    return '<div class="financial-insurance-item"><strong>' + escapeHtml(item.name || type.name) + '</strong>' +
      '<span>תשלום חודשי: ' + money(Number(item.val) || 0) + '</span>' +
      '<div class="financial-insurance-fields">' +
      '<label class="liability-field"><span>איפה</span><div class="liability-input-wrap"><input type="text" placeholder="שם חברת הביטוח" value="' + escapeHtml(item.provider || "") + '" onchange="updateInsuranceDetail(' + index + ',\'provider\',this.value)"></div></label>' +
      '<label class="liability-field"><span>תאריך סיום</span><div class="liability-input-wrap"><input type="date" value="' + escapeHtml(item.endDate || "") + '" onchange="updateInsuranceDetail(' + index + ',\'endDate\',this.value)"></div></label>' +
      '</div></div>';
  }).join("") + '</div>' : '<p class="financial-detail-note">לא הוזנו ביטוחים מסוג זה לחודש הנוכחי.</p>';
  html += '<button type="button" class="financial-save-btn" onclick="openInsuranceModal()">הוסף או ערוך ביטוחים</button>';
  if (type.id === "disability") {
    html += '<button type="button" class="financial-link-btn" onclick="showFinancialPage(\'investments\',\'pension\',\'coverage\')">לפרטי הכיסוי בקרן הפנסיה</button>' +
      '<p class="financial-detail-note">הכיסוי בקרן הפנסיה מוצג בנפרד כדי שלא לרשום אותו אוטומטית כהוצאה נוספת.</p>';
  }
  section.innerHTML = html;
}

function closeInsuranceDetail() {
  selectedInsuranceType = null;
  el("insurance-detail").hidden = true;
  renderInsuranceCards();
  el("insurances-page-title").focus({preventScroll: true});
}

function updateInsuranceDetail(index, field, value) {
  var item = AppState.insurances[index];
  if (!item || ["provider", "endDate"].indexOf(field) < 0) return;
  item[field] = String(value || "").trim();
  saveData();
  flashSaved();
}

/* עמוד ההלוואות: הפרטים המלאים של כל הלוואה. ההחזר החודשי מוזן גם בהוצאות הקבועות */
function renderLoansPage() {
  var section = el("loans-detail");
  if (!section) return;
  var loans = AppState.liabilities.loans || [];
  var debts = AppState.liabilities.debts || [];
  var html = loans.length ? loans.map(function(loan, index) { return loanDetailCardHtml(loan, index); }).join("")
    : '<p class="financial-detail-note">עדיין לא הוזנו הלוואות. אפשר להוסיף אותן בהוצאות הקבועות, בשורה "החזר הלוואה קבוע".</p>';
  if (debts.length) {
    html += '<h3 class="loan-detail-group-title">חובות</h3>' + debts.map(function(debt, index) { return debtDetailCardHtml(debt, index); }).join("");
  }
  html += '<button type="button" class="financial-save-btn" onclick="showFinancialPage(\'cashflow\');openLiabilitiesModal()">הוסף או ערוך הלוואות</button>';
  section.innerHTML = html;
}

function loanDetailField(kind, index, field, label, type, value, suffix) {
  var safeValue = type === "number" ? (Number(value) || "") : escapeHtml(value || "");
  return '<label class="liability-field"><span>' + label + '</span><div class="liability-input-wrap">' +
    '<input type="' + type + '" value="' + safeValue + '"' + (type === "number" ? ' min="0" step="any" inputmode="decimal"' : "") +
    ' onchange="updateLiabilityDetail(\'' + kind + '\',' + index + ',\'' + field + '\',this.value)">' +
    (suffix ? '<b>' + suffix + '</b>' : "") + '</div></label>';
}

function loanDetailCardHtml(loan, index) {
  return '<div class="financial-insurance-item loan-detail-card" id="loan-detail-' + index + '" tabindex="-1">' +
    '<strong>' + escapeHtml(loan.name || "הלוואה") + '</strong>' +
    '<span>החזר חודשי: ' + money(loan.monthlyPayment) + '</span>' +
    '<div class="financial-insurance-fields">' +
      loanDetailField("loan", index, "balance", "יתרה לסילוק", "number", loan.balance, "₪") +
      loanDetailField("loan", index, "interest", "ריבית שנתית", "number", loan.interest, "%") +
      loanDetailField("loan", index, "endDate", "תאריך סיום", "date", loan.endDate, "") +
    '</div>' +
    '<label class="liability-checkbox"><input type="checkbox"' + (loan.earlyPayoff ? " checked" : "") +
      ' onchange="updateLiabilityDetail(\'loan\',' + index + ',\'earlyPayoff\',this.checked)"><span>מיועדת לפירעון מוקדם</span></label>' +
  '</div>';
}

function debtDetailCardHtml(debt, index) {
  return '<div class="financial-insurance-item loan-detail-card" id="debt-detail-' + index + '" tabindex="-1">' +
    '<strong>' + escapeHtml(debt.name || "חוב") + '</strong>' +
    '<span>תשלום מינימלי: ' + money(debt.minimumPayment) + '</span>' +
    '<div class="financial-insurance-fields">' +
      loanDetailField("debt", index, "balance", "יתרת החוב", "number", debt.balance, "₪") +
      loanDetailField("debt", index, "interest", "ריבית או עמלה", "number", debt.interest, "%") +
      loanDetailField("debt", index, "targetDate", "תאריך יעד", "date", debt.targetDate, "") +
    '</div></div>';
}

function updateLiabilityDetail(kind, index, field, value) {
  var list = kind === "debt" ? AppState.liabilities.debts : AppState.liabilities.loans;
  if (!list || !list[index]) return;
  var next = clone(list[index]);
  next[field] = value;
  list[index] = kind === "debt" ? normalizeDebt(next) : normalizeLoan(next);
  saveLiabilities();
  pipeline();
}

function openLoanDetails(kind, index) {
  showFinancialPage("loans");
  var card = el((kind === "debt" ? "debt-detail-" : "loan-detail-") + index);
  if (card) {
    card.scrollIntoView({block: "center"});
    card.focus({preventScroll: true});
  }
}
