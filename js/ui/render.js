"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. RENDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function render() {
  renderFields();
  formatReadonlyAmounts();
  renderAudienceCopy();
  renderTopbarSnapshot();
  renderMaaser(AppState.result);
  renderPreAllocation(AppState.result);
  renderActions(AppState.result);
  renderFinancialPages();
}

/* סכומים לקריאה בלבד בשורות התקציב מוצגים כסכום כספי מעוצב (₪5,200) */
function formatReadonlyAmounts() {
  Array.prototype.forEach.call(document.querySelectorAll("#budget-main .irow input[readonly]"), function(input) {
    var amount = Number(String(input.value).replace(/[^\d.-]/g, "")) || 0;
    if (input.type !== "text") input.type = "text";
    input.value = money(amount);
    input.tabIndex = -1;
  });
}

function renderAudienceCopy() {
  var calendarChoice = el("calendar-choice-copy");
  var calendarCustom = el("calendar-custom-copy");
  var allocationQuestion = el("allocation-mode-question");
  var specialExpensesExplainer = el("special-expenses-stage-explainer");
  var specialExpensesTitle = el("special-expenses-stage-title");
  var incomeBackToDebts = el("income-back-to-debts");
  var clearLoansButton = el("clear-loans-button");
  if (calendarChoice) calendarChoice.textContent = audienceText("בחר תאריך בחודש הבא", "בחרו תאריך בחודש הבא");
  if (calendarCustom) calendarCustom.textContent = audienceText("בחר תאריך", "בחרו תאריך");
  if (specialExpensesExplainer) specialExpensesExplainer.textContent = audienceText("הזן הוצאה חד־פעמית ודחופה שקיימת רק החודש.", "הזינו הוצאה חד־פעמית ודחופה שקיימת רק החודש.");
  if (specialExpensesTitle) specialExpensesTitle.textContent = AppState.profile.debtStatus ? "הוצאות מיוחדות / בלתי צפויות" : "הוצאות מיוחדות";
  if (incomeBackToDebts) {
    incomeBackToDebts.hidden = !AppState.profile.debtStatus;
    incomeBackToDebts.parentElement.classList.toggle("has-debt-back", AppState.profile.debtStatus);
  }
  if (clearLoansButton) {
    var clearLoansLabel = AppState.profile.debtStatus ? "מחיקת הלוואות" : "מחיקת הלוואות וחובות";
    clearLoansButton.setAttribute("aria-label", clearLoansLabel);
    clearLoansButton.title = clearLoansLabel;
  }
  if (allocationQuestion) {
    var budgetMonthName = MONTHS[AppState.period.month];
    allocationQuestion.textContent = audienceText("כיצד תרצה את חודש " + budgetMonthName + "?", "כיצד תרצו את חודש " + budgetMonthName + "?");
  }
}

function renderTopbarSnapshot() {
  var debts = el("topbar-debts-total");
  var income = el("topbar-income-total");
  var r = AppState.result;
  var donations = el("topbar-donations-total");
  var allocationBalance = el("allocation-balance-total");
  if (debts) renderSnapshotAmount(debts, recoveryDebtBalance(AppState.liabilities));
  if (income) renderSnapshotAmount(income, AppState.result.total || 0);
  /* כרטיס ההוצאות: קבועות (כולל ביטוחים והתחייבויות) ומשתנות; מיוחדות רק אם הוזנו */
  var fixedTotal = (r.fixedExpenses || 0) + (r.subscriptionExpenses || 0) + (r.healthBeautyExpenses || 0) +
    (r.childrenExpenses || 0) + (r.insurance || 0) + (r.liabilityPayments || 0);
  if (el("topbar-fixed-total")) el("topbar-fixed-total").textContent = money(fixedTotal);
  if (el("topbar-variable-total")) el("topbar-variable-total").textContent = money(r.variableExpenses || 0);
  if (el("topbar-special-total")) el("topbar-special-total").textContent = money(r.oneTimeExpenses || 0);
  if (el("topbar-special-part")) el("topbar-special-part").hidden = !(r.oneTimeExpenses > 0);
  if (donations) renderSnapshotAmount(donations, AppState.result.maaser || 0);
  updateTopbarDonationVisibility();
  if (allocationBalance) allocationBalance.textContent = money(Math.max(0, AppState.result.balance || 0));
}

function renderSnapshotAmount(element, amount) {
  var formatted = money(amount);
  element.textContent = formatted;
  element.classList.toggle("snapshot-amount-long", formatted.length >= 9);
  element.classList.toggle("snapshot-amount-very-long", formatted.length >= 12);
  element.title = formatted;
}

/* כרטיסי הסיכום העליונים הם גם מפת השלבים: מספר בעיגול מחוץ לכל כרטיס,
   ונקודות שמחברות שלב לשלב. כרטיס נפתח רק כשמגיעים לשלב שלו */
var SNAPSHOT_STEP_CARDS = [
  {card: "topbar-debts-snapshot", step: "budget-flow-debts", color: "#163a5f"},
  {card: "topbar-income-snapshot", step: "budget-flow-income", color: "#16a34a"},
  {card: "topbar-expenses-snapshot", step: "budget-flow-expenses", lastStep: "budget-flow-special-expenses", color: "#dc2626"},
  {card: "topbar-donations-snapshot", step: "budget-flow-donations", color: "#d97706"}
];

/* לחיצה על ריבוע בכרטיס ההוצאות עוברת לשלב שלו; לחיצה על שאר הכרטיס פותחת את הקבועות */
function openExpensesSnapshot(event) {
  var part = event && event.target.closest ? event.target.closest(".expense-part") : null;
  var stepId = part ? part.getAttribute("data-step") : "budget-flow-expenses";
  goToBudgetFlowStep(BUDGET_FLOW_STEP_IDS.indexOf(stepId));
}

function stepDots(className) {
  var link = mk("span", className);
  link.setAttribute("aria-hidden", "true");
  for (var i = 0; i < 3; i++) link.appendChild(mk("i", ""));
  return link;
}

/* עוטף כל כרטיס במשבצת שלב: נקודות חיבור, עיגול מספר ואז הכרטיס */
function ensureSnapshotSlots() {
  SNAPSHOT_STEP_CARDS.forEach(function(item) {
    var card = el(item.card);
    if (!card || card.parentElement.classList.contains("step-slot")) return;
    var slot = mk("div", "step-slot");
    card.parentElement.insertBefore(slot, card);
    var number = mk("span", "snapshot-step-num");
    number.setAttribute("aria-hidden", "true");
    slot.appendChild(stepDots("step-link-v"));
    slot.appendChild(stepDots("step-link-h"));
    slot.appendChild(number);
    slot.appendChild(card);
    item.slot = slot;
    item.number = number;
  });
}

function updateTopbarDonationVisibility() {
  ensureSnapshotSlots();
  var snapshotContainer = document.querySelector(".topbar-financial-snapshot");
  var currentStep = typeof budgetFlowCurrentStep === "number" ? budgetFlowCurrentStep : 0;
  var furthestStep = typeof budgetFlowFurthestStep === "number" ? budgetFlowFurthestStep : 0;
  var number = 0;
  var previousRow = null;
  var previousColor = null;
  SNAPSHOT_STEP_CARDS.forEach(function(item) {
    var card = el(item.card);
    if (!card || !item.slot) return;
    /* במסלול החובות יש שלב חובות ואין שלב תרומות */
    var inFlow = item.card === "topbar-debts-snapshot" ? AppState.profile.debtStatus
      : item.card === "topbar-donations-snapshot" ? !AppState.profile.debtStatus && hasBalanceForDonation() : true;
    item.slot.classList.toggle("out-of-flow", !inFlow);
    if (!inFlow) return;
    card.hidden = false; /* הנראות נקבעת במשבצת השלב */
    number++;
    var row = item.slot.parentElement;
    item.slot.classList.toggle("first-step", number === 1);
    item.slot.classList.toggle("link-v", number > 1 && row !== previousRow);
    item.slot.classList.toggle("link-h", number > 1 && row === previousRow);
    previousRow = row;
    /* צבע השלב, וצבע השלב הקודם לנקודות שמחברות ביניהם */
    item.slot.style.setProperty("--step-color", item.color);
    item.slot.style.setProperty("--prev-color", previousColor || item.color);
    previousColor = item.color;
    /* כרטיס יכול לכסות כמה שלבים ברצף (כרטיס ההוצאות: קבועות, משתנות ומיוחדות) */
    var stepIndex = BUDGET_FLOW_STEP_IDS.indexOf(item.step);
    var lastIndex = item.lastStep ? BUDGET_FLOW_STEP_IDS.indexOf(item.lastStep) : stepIndex;
    var isCurrent = currentStep >= stepIndex && currentStep <= lastIndex;
    item.slot.classList.toggle("revealed", stepIndex <= furthestStep);
    card.classList.toggle("step-current", isCurrent);
    card.classList.toggle("step-done", !isCurrent && stepIndex <= furthestStep);
    if (isCurrent) card.setAttribute("aria-current", "step");
    else card.removeAttribute("aria-current");
    item.number.textContent = number;
    item.number.classList.toggle("is-current", isCurrent);
    /* בכרטיס ההוצאות מודגש גם התת־ריבוע של השלב הנוכחי */
    Array.prototype.forEach.call(card.querySelectorAll(".expense-part"), function(part) {
      part.classList.toggle("is-current", BUDGET_FLOW_STEP_IDS.indexOf(part.getAttribute("data-step")) === currentStep);
    });
  });
  if (snapshotContainer) {
    /* שורה בלי שלב פתוח מוסתרת, והתוכן מתחת לכרטיסים מפנה להם מקום */
    Array.prototype.forEach.call(snapshotContainer.querySelectorAll(".snapshot-row"), function(row) {
      row.hidden = !row.querySelector(".step-slot.revealed:not(.out-of-flow)");
    });
    document.documentElement.style.setProperty("--snapshot-space", snapshotContainer.offsetHeight + "px");
  }
}

function renderFields() {
  var overdraftInput = el("debt-overdraft-input");
  var debtListTotal = el("debt-list-total");
  if (overdraftInput && document.activeElement !== overdraftInput) {
    overdraftInput.value = Number(AppState.liabilities.overdraft) || 0;
    el("debt-overdraft-error").textContent = "";
  }
  if (debtListTotal) debtListTotal.value = Math.round((AppState.liabilities.debts || []).reduce(function(total, debt) {
    return total + (Number(debt.balance) || 0);
  }, 0));
  var s1el = el("inp-s1");
  var s2el = el("inp-s2");
  if (s1el) s1el.value = Number(AppState.income1[0] && AppState.income1[0].val) || "";
  if (s2el) s2el.value = Number(AppState.income2[0] && AppState.income2[0].val) || "";
  /* כותרת שורת המשכורת היא שדה טקסט אחד שנערך בלחיצה */
  [1, 2].forEach(function(person) {
    var labelInput = el("income-partner-" + person + "-name");
    if (labelInput && document.activeElement !== labelInput) labelInput.value = salaryLabel(person);
  });
  var partner1Row = el("income-partner-1-row");
  var partner2Row = el("income-partner-2-row");
  if (partner1Row) partner1Row.hidden = isSalaryHidden(1);
  if (partner2Row) partner2Row.hidden = AppState.profile.single === true || isSalaryHidden(2);
  [1, 2].forEach(function(person) {
    var restore = el("restore-salary-" + person);
    if (!restore) return;
    restore.hidden = !isSalaryHidden(person) || (person === 2 && AppState.profile.single === true);
    restore.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>' + escapeHtml(salaryLabel(person)) + '</span>';
  });
  renderAdditionalIncomeRows();

  var expEl = el("inp-exp");
  var housingUtilitiesTotal = sumNamedExpenses(AppState.variableExpenses, HOUSING_UTILITY_NAMES);
  if (expEl) expEl.value = Math.round(sumArr(getActiveFixedExpenseItems().filter(function(item) { return !item.customCategory; })));
  var variableHousingEl = el("inp-variable-housing");
  if (variableHousingEl) variableHousingEl.value = Math.round(housingUtilitiesTotal);
  var childrenRow = el("children-expenses-row");
  var childrenEl = el("inp-children-expenses");
  if (childrenRow) childrenRow.hidden = AppState.profile.children !== true;
  if (childrenEl) childrenEl.value = Math.round(AppState.result.childrenExpenses || 0);
  var oneTimeExpensesEl = el("inp-one-time-expenses");
  var oneTimeExpensesTotal = sumArr((AppState.oneTimeExpenses || []).filter(function(item) { return !item.customCategory; }));
  if (oneTimeExpensesEl) oneTimeExpensesEl.textContent = money(oneTimeExpensesTotal);
  var fuelExpensesEl = el("inp-fuel-expenses");
  if (fuelExpensesEl) fuelExpensesEl.value = Math.round(sumNamedExpenses(AppState.variableExpenses, FUEL_EXPENSE_NAMES));
  var supermarketExpensesEl = el("inp-supermarket-expenses");
  if (supermarketExpensesEl) supermarketExpensesEl.value = Math.round(sumNamedExpenses(AppState.variableExpenses, SUPERMARKET_EXPENSE_NAMES));
  var otherVariableExpenses = (AppState.variableExpenses || []).filter(function(item) {
    return !item.customCategory && !isStandardVariableExpense(item);
  });
  var otherVariableRow = el("other-variable-expenses-row");
  var otherVariableInput = el("inp-other-variable-expenses");
  if (otherVariableRow) otherVariableRow.hidden = otherVariableExpenses.length === 0;
  if (otherVariableInput) otherVariableInput.value = Math.round(sumArr(otherVariableExpenses));
  var subscriptionsEl = el("inp-subscriptions");
  if (subscriptionsEl) subscriptionsEl.value = Math.round(sumArr(AppState.subscriptions));
  var healthBeautyEl = el("inp-health-beauty");
  if (healthBeautyEl) healthBeautyEl.value = Math.round(sumArr(AppState.healthBeautyExpenses));
  var insuranceEl = el("inp-insurance");
  if (insuranceEl) insuranceEl.value = Math.round(sumArr(AppState.insurances));
  var liabilitiesEl = el("inp-liabilities");
  var mortgageEl = el("inp-mortgage");
  var mortgageRow = el("mortgage-expense-row");
  if (mortgageRow) mortgageRow.hidden = AppState.profile.mortgage !== true;
  if (liabilitiesEl) liabilitiesEl.value = Math.round(AppState.result.loanPayments + (AppState.profile.debtStatus ? 0 : AppState.result.debtPayments));
  if (mortgageEl) mortgageEl.value = Math.round(AppState.result.mortgagePayments);
  renderCustomExpenseCategories();
  renderFlatVariableExpenses();

  renderPeriodOptions();
}

/* רשימת החודשים נבנית מהנתונים: שנה אחורה, חודשיים קדימה, וכל חודש שנשמר.
   הערך של כל אפשרות הוא מספר רץ (שנה × 12 + חודש), כך שאין רשימת שנים קבועה */
var _periodOptionsSignature = "";
function renderPeriodOptions() {
  var select = el("sel-month");
  if (!select) return;
  /* הרשימה משתנה רק במעבר חודש או כשחודש נשמר לראשונה, ולא בכל הקלדה */
  var signature = AppState.period.year + "-" + AppState.period.month + ":" + AppState.monthHasRecord;
  if (signature === _periodOptionsSignature) return;
  _periodOptionsSignature = signature;
  var now = new Date();
  var current = periodIndex(now.getMonth(), now.getFullYear());
  var selected = periodIndex(AppState.period.month, AppState.period.year);
  var indexes = getSavedPeriodIndexes().concat([current - 12, current + 2, selected]);
  var first = Math.min.apply(null, indexes);
  var last = Math.max.apply(null, indexes);
  var html = "";
  for (var index = first; index <= last; index++) {
    var year = Math.floor(index / 12);
    var label = "תקציב " + MONTHS[index % 12] + (year !== now.getFullYear() ? " " + year : "");
    html += '<option value="' + index + '">' + label + '</option>';
  }
  if (select.getAttribute("data-range") !== first + "-" + last) {
    select.innerHTML = html;
    select.setAttribute("data-range", first + "-" + last);
  }
  select.value = String(selected);
}

/* עדכון סכומים אחרי עריכה בשורה, בלי לבנות מחדש את השדות (כדי לא לאבד את הפוקוס) */
function refreshAfterInlineEdit() {
  calculate();
  renderTopbarSnapshot();
  renderMaaser(AppState.result);
  renderPreAllocation(AppState.result);
  renderActions(AppState.result);
  saveData();
  flashSaved();
}

/* ━━ הוצאות משתנות כרשימה אחת (FLAT_VARIABLE_EXPENSES) ━━ */
var FLAT_VARIABLE_DISPLAY = {
  "חשמל": {icon: "bolt"},
  "מים": {icon: "water_drop"},
  "גז": {icon: "local_fire_department"},
  "ארנונה": {icon: "apartment"},
  "דלק / תחבורה": {icon: "local_gas_station"},
  "קניות סופר (מזון ומוצרי ניקוי)": {icon: "shopping_cart", label: "קניות סופר", sub: "מזון ומוצרי ניקוי"}
};

function renderFlatVariableExpenses() {
  var list = el("flat-variable-expenses-list");
  var addLabel = el("add-variable-label");
  if (addLabel) addLabel.textContent = FLAT_VARIABLE_EXPENSES ? "הוסף הוצאה" : "הוסף קטגוריה";
  if (!list) return;
  if (!FLAT_VARIABLE_EXPENSES) { list.innerHTML = ""; return; }
  Array.prototype.forEach.call(document.querySelectorAll("#budget-flow-variable-expenses .variable-category-row"), function(row) {
    row.hidden = true;
  });
  if (list.contains(document.activeElement)) return; /* לא בונים מחדש בזמן הקלדה */
  list.innerHTML = "";
  (AppState.variableExpenses || []).forEach(function(item, index) {
    if (item.customCategory) return;
    var display = FLAT_VARIABLE_DISPLAY[item.name] || {};
    var row = mk("div", "irow flat-expense-row");
    var label = mk("div", "ilabel");
    var icon = mkText("span", "row-icon material-symbols-rounded", display.icon || "receipt_long");
    icon.setAttribute("aria-hidden", "true");
    label.appendChild(icon);
    var text = mk("div", "flat-expense-text");
    if (display.icon) {
      text.appendChild(mkText("span", "label-main", display.label || item.name));
    } else {
      var name = document.createElement("input");
      name.type = "text";
      name.className = "additional-income-name";
      name.value = item.name || "";
      name.placeholder = "שם ההוצאה";
      name.setAttribute("aria-label", "שם ההוצאה");
      name.oninput = function() { item.name = name.value; saveData(); flashSaved(); };
      text.appendChild(name);
    }
    var history = item.name ? getPreviousVariableExpenseStats(item.name, AppState.period.month, AppState.period.year) : null;
    var sub = history ? "בחודש הקודם: " + money(history.last) : display.sub;
    if (sub) text.appendChild(mkText("span", "label-sub", sub));
    label.appendChild(text);

    var right = mk("div", "iright");
    var amount = document.createElement("input");
    amount.type = "number";
    amount.min = "0";
    amount.inputMode = "decimal";
    amount.placeholder = "0";
    amount.value = Number(item.val) || "";
    amount.setAttribute("aria-label", "סכום " + (display.label || item.name || "ההוצאה"));
    amount.oninput = function() { item.val = toAmount(amount.value); refreshAfterInlineEdit(); };
    var remove = mkText("button", "custom-category-remove material-symbols-rounded", "delete");
    remove.type = "button";
    remove.setAttribute("aria-label", "מחיקת " + (display.label || item.name || "ההוצאה"));
    remove.onclick = function() {
      askDeleteExpenseCategory(display.label || item.name || "ההוצאה", function() {
        var position = AppState.variableExpenses.indexOf(item);
        if (position >= 0) AppState.variableExpenses.splice(position, 1);
        pipeline();
      });
    };
    right.appendChild(amount);
    right.appendChild(remove);
    row.appendChild(label);
    row.appendChild(right);
    list.appendChild(row);
  });
}

function addVariableExpense() {
  if (!FLAT_VARIABLE_EXPENSES) { addCustomExpenseCategory("variableExpenses"); return; }
  AppState.variableExpenses.push({name: "", val: 0});
  pipeline();
  var names = document.querySelectorAll("#flat-variable-expenses-list .additional-income-name");
  if (names.length) names[names.length - 1].focus();
}

function renderCustomExpenseCategories() {
  [
    {collection: "variableExpenses", list: "custom-variable-expenses-list"},
    {collection: "expenses", list: "custom-fixed-expenses-list"},
    {collection: "oneTimeExpenses", list: "custom-special-expenses-list"}
  ].forEach(function(group) {
    var list = el(group.list);
    if (!list) return;
    list.innerHTML = "";
    (AppState[group.collection] || []).forEach(function(item, index) {
      if (!item.customCategory) return;
      var row = mk("div", "irow custom-category-row");
      var label = mk("div", "ilabel");
      var icon = mkText("button", "row-icon row-icon-btn material-symbols-rounded", "receipt_long");
      icon.type = "button";
      icon.setAttribute("aria-label", "עריכת סוגי הוצאות בקטגוריה " + item.name);
      icon.title = "עריכת סוגי הוצאות בקטגוריה " + item.name;
      icon.onclick = function() { openCustomExpenseCategoryModal(group.collection, index); };
      var nameWrap = mk("div", "custom-category-name-wrap");
      var name = document.createElement("input");
      name.type = "text";
      name.className = "custom-category-name";
      name.value = item.name;
      name.setAttribute("aria-label", "שם הקטגוריה");
      name.title = "עריכת שם הקטגוריה";
      name.onblur = function() {
        var nextName = name.value.trim();
        if (!nextName) { name.value = item.name; return; }
        if (nextName === item.name) return;
        item.name = nextName;
        name.value = nextName;
        icon.setAttribute("aria-label", "עריכת סוגי הוצאות בקטגוריה " + nextName);
        icon.title = "עריכת סוגי הוצאות בקטגוריה " + nextName;
        amount.setAttribute("aria-label", "סכום " + nextName);
        remove.setAttribute("aria-label", "מחיקת קטגוריה " + nextName);
        remove.title = "מחיקת קטגוריה " + nextName;
        saveData();
        flashSaved();
      };
      name.onkeydown = function(event) { if (event.key === "Enter") name.blur(); };
      nameWrap.appendChild(name);
      label.appendChild(icon);
      label.appendChild(nameWrap);
      var amountWrap = mk("div", "iright");
      var amount = document.createElement("input");
      amount.type = "number";
      amount.readOnly = true;
      amount.value = Math.round(Number(item.val) || 0);
      amount.setAttribute("aria-label", "סכום " + item.name);
      amountWrap.appendChild(amount);
      var remove = mkText("button", "custom-category-remove material-symbols-rounded", "delete");
      remove.type = "button";
      remove.setAttribute("aria-label", "מחיקת קטגוריה " + item.name);
      remove.title = "מחיקת קטגוריה " + item.name;
      remove.onclick = function() {
        askDeleteExpenseCategory(item.name, function() { removeCustomExpenseCategory(group.collection, index); });
      };
      amountWrap.appendChild(remove);
      row.appendChild(label);
      row.appendChild(amountWrap);
      list.appendChild(row);
    });
  });
  var specialCard = el("custom-special-expenses-card");
  if (specialCard) specialCard.hidden = !el("custom-special-expenses-list").children.length;
}

function sumNamedExpenses(items, names) {
  return (items || []).reduce(function(total, item) {
    return total + (!item.customCategory && names.indexOf(item.name) >= 0 ? (Number(item.val) || 0) : 0);
  }, 0);
}

function renderAdditionalIncomeRows() {
  var list = el("additional-income-list");
  if (!list) return;
  list.innerHTML = "";

  function appendRows(items, person) {
    items.slice(1).forEach(function(item, offset) {
      var index = offset + 1;
      var row = mk("div", "irow additional-income-row");
      /* אותו מבנה כמו שורת משכורת: אייקון שטר, שם שנערך וסכום בתיבה. מחיקה בגרירה ימינה (או בפח במחשב) */
      var label = mk("div", "ilabel additional-income-name-wrap");
      var icon = mkText("span", "row-icon material-symbols-rounded", "payments");
      icon.setAttribute("aria-hidden", "true");
      var name = document.createElement("input");
      name.type = "text";
      name.className = "additional-income-name";
      name.value = item.name || "";
      name.placeholder = "שם ההכנסה";
      name.setAttribute("aria-label", "שם ההכנסה הנוספת");
      name.oninput = function() { updateAdditionalIncomeName(person, index, name.value); };
      label.appendChild(icon);
      label.appendChild(name);

      var controls = mk("div", "iright additional-income-controls");
      var amount = document.createElement("input");
      amount.type = "number";
      amount.className = "additional-income-amount";
      amount.min = "0";
      amount.inputMode = "decimal";
      amount.placeholder = "0";
      amount.value = Number(item.val) || "";
      amount.setAttribute("aria-label", "סכום ההכנסה הנוספת");
      amount.oninput = function() { updateAdditionalIncomeAmount(person, index, amount.value); };
      var remove = mkText("button", "custom-category-remove income-extra-remove material-symbols-rounded", "delete");
      remove.type = "button";
      remove.setAttribute("aria-label", "מחיקת ההכנסה");
      remove.title = "מחיקת ההכנסה";
      remove.onclick = function() {
        askDeleteExpenseCategory(item.name || "ההכנסה הנוספת", function() { removeAdditionalIncome(person, index); });
      };
      controls.appendChild(amount);
      controls.appendChild(remove);
      row.appendChild(label);
      row.appendChild(controls);
      list.appendChild(row);
    });
  }

  appendRows(AppState.income1 || [], 1);
  if (!AppState.profile.single) appendRows(AppState.income2 || [], 2);
}

function renderActions(d) {
  var box = el("actions-box");
  if (!box) return;
  box.innerHTML = "";

  /* helper: build a standard action row */
  function addRow(iconName, title, desc, val, iconClick) {
    var row = mk("div", "action-row");
    var left = mk("div", "act-left");
    var icon = mkText("button", "act-icon material-symbols-rounded" + (iconClick ? " act-icon-btn" : ""), iconName);
    icon.type = "button";
    if (iconClick) {
      icon.onclick = iconClick;
      icon.setAttribute("aria-label", "עריכת " + title);
      icon.title = "עריכה";
    } else {
      icon.disabled = true;
      icon.setAttribute("aria-hidden", "true");
    }
    left.appendChild(icon);
    var info = mk("div", "");
    info.appendChild(mkText("span", "act-title", title));
    if (desc) info.appendChild(mkText("span", "act-desc", desc));
    left.appendChild(info);
    row.appendChild(left);
    row.appendChild(mkText("span", "act-val", money(val)));
    if (iconClick) {
      row.classList.add("action-row-link");
      row.onclick = function(event) { if (!event.target.closest("button")) iconClick(); };
    }
    box.appendChild(row);
  }

  function addDonationRow() {
    if (!AppState.profile.debtStatus && AppState.maaser && AppState.maaser.enabled) {
      addRow("volunteer_activism", "תרומות", "", d.maaser, openMaaserCharitiesModal);
    }
  }

  if (d.balance <= 0) {
    var warn = mk("div", "deficit-banner");
    warn.appendChild(mkText("span", "material-symbols-rounded", "warning"));
    warn.appendChild(mkText("span", "", "אין יתרה לחלוקה לחיסכון והשקעות בחודש זה."));
    box.appendChild(warn);
    addDonationRow();
    return;
  }

  if (AppState.profile.debtStatus) {
    if (!hasValidRecoveryPayment()) {
      box.appendChild(mkText("div", "deficit-banner", "יש לבחור סכום להחזר נוסף לפני הצגת התוכנית."));
      addDonationRow();
      return;
    }
    var extraPayment = AppState.recoveryPayment;
    var recoveryPlan = mk("div", "debt-plan-banner");
    recoveryPlan.appendChild(mkText("span", "material-symbols-rounded", "shield"));
    var recoveryText = mk("div", "");
    recoveryText.appendChild(mkText("strong", "", "תוכנית לצמצום חובות"));
    recoveryText.appendChild(mkText("span", "", "סכום ההחזר הנוסף נבחר כאן"));
    recoveryPlan.appendChild(recoveryText);
    box.appendChild(recoveryPlan);
    addRow("payments", "החזר נוסף לחוב", "", extraPayment, function() { goToBudgetFlowStep(0); });
    addRow("credit_card", "יתרה לשימוש החודש", "", d.balance - extraPayment, openSpendingModal);
    addDonationRow();
    return;
  }

  if (hasActiveDebtPlan()) {
    var priority = d.priorityDebt;
    var plan = mk("div", "debt-plan-banner");
    plan.appendChild(mkText("span", "material-symbols-rounded", "shield"));
    var planText = mk("div", "");
    planText.appendChild(mkText("strong", "", "תוכנית יציאה מחובות"));
    planText.appendChild(mkText("span", "", "היתרה מופנית קודם לחוב היקר ביותר"));
    plan.appendChild(planText);
    box.appendChild(plan);

    var priorityDescription = "מטופל ראשון: " + priority.name;
    if (priority.interest > 0) priorityDescription += " · " + priority.interest + "% ריבית";
    addRow(
      "payments",
      "החזר נוסף לחוב",
      priorityDescription,
      percentageOf(d.balance, DEFAULT_DEBT_PLAN_PERCENTAGES.debt),
      openLiabilitiesModal
    );
    addRow(
      "credit_card",
      "בזבוזים",
      "",
      percentageOf(d.balance, DEFAULT_DEBT_PLAN_PERCENTAGES.spending),
      openSpendingModal
    );
    addDonationRow();
    return;
  }

  /* 3. חלוקת היתרה */
  var allocation = AppState.settings.allocation;
  addRow("trending_up", "השקעות", "", percentageOf(d.balance, allocation.invest), openInvestGoalsModal);
  addRow("spa", "קרן איכות חיים", "", percentageOf(d.balance, allocation.qualityOfLife), openDreamsModal);
  addRow("credit_card", "בזבוזים", "", percentageOf(d.balance, allocation.spending), openSpendingModal);
  addDonationRow();
}

function renderPreAllocation(d) {
  var box = el("pre-allocation-balance");
  var warningBox = el("pre-allocation-warning");
  if (!box) return;
  box.innerHTML = "";

  var isDeficit = d.balance < 0;
  box.classList.toggle("is-deficit", isDeficit);
  box.appendChild(mkText("span", "", isDeficit ? "גירעון החודש" : "סה״כ יתרה"));

  /* גירעון מוצג בסכומו האמיתי ולא כאפס */
  var value = mkText("strong", "", money(d.balance));
  box.appendChild(value);

  var hasSpecialExpenseDeficit = d.balance <= 0 && d.oneTimeExpenses > 0 && d.balance + d.oneTimeExpenses > 0;
  if (warningBox) {
    warningBox.innerHTML = "";
    warningBox.hidden = d.balance > 0;
  }
  if (d.balance <= 0) {
    var calmWarning = hasSpecialExpenseDeficit || (d.maaserCapped && !isDeficit);
    var warning = mk("div", "deficit-banner" + (calmWarning ? " special-expense-deficit-banner" : ""));
    warning.appendChild(mkText("span", "material-symbols-rounded", "warning"));
    var deficitText = isDeficit
      ? "ההוצאות וההתחייבויות גבוהות מההכנסות ב־" + money(-d.balance) + " החודש. כדאי לבדוק אילו הוצאות אפשר לצמצם או לדחות."
      : d.maaserCapped
        ? "התרומה הותאמה ל־" + money(d.maaser) + " כדי שלא ייווצר מינוס, ולא נותרה יתרה לחלוקה לחיסכון והשקעות בחודש זה."
        : "אין יתרה לחלוקה לחיסכון והשקעות בחודש זה.";
    warning.appendChild(mkText("span", "", hasSpecialExpenseDeficit
      ? "ההוצאות המיוחדות משאירות את התקציב " + (isDeficit ? "בגירעון של " + money(-d.balance) : "ללא יתרה לחלוקה") + ". החודש מומלץ לדחות או לצמצם אותן לפני שממשיכים."
      : deficitText));
    if (warningBox) warningBox.appendChild(warning);
  }

  renderRecoveryDashboard(d);
  renderAllocationModes();
  var allocationModes = el("allocation-mode-box");
  var allocationQuestion = el("allocation-mode-question");
  var allocationCustomButton = el("allocation-custom-btn");
  var calculateButton = el("budget-flow-calculate-btn");
  if (d.balance <= 0 || (AppState.profile.debtStatus && !hasValidRecoveryPayment())) {
    if (allocationModes) allocationModes.hidden = true;
    if (allocationQuestion) allocationQuestion.hidden = true;
    if (el("allocation-pick-hint")) el("allocation-pick-hint").hidden = true;
    if (allocationCustomButton) allocationCustomButton.hidden = true;
    if (calculateButton) calculateButton.disabled = true;
  } else if (calculateButton) {
    calculateButton.disabled = false;
  }
}

function renderRecoveryDashboard(d) {
  var dashboard = el("recovery-dashboard");
  var overview = el("recovery-overview");
  if (!dashboard) return;
  dashboard.hidden = !AppState.profile.debtStatus;
  if (overview) overview.hidden = dashboard.hidden;
  if (dashboard.hidden) return;

  var totalDebt = recoveryDebtBalance(AppState.liabilities);
  var limit = recoveryPaymentLimit();
  var paymentInput = el("recovery-payment-input");
  var message = el("recovery-payment-message");
  el("recovery-debts-total").textContent = money(totalDebt);
  el("recovery-expenses-total").textContent = money(d.exp + d.insurance + d.liabilityPayments);
  paymentInput.disabled = d.balance <= 0 || totalDebt <= 0;
  paymentInput.max = String(limit);
  if (document.activeElement !== paymentInput) {
    paymentInput.value = AppState.recoveryPayment === null ? "" : AppState.recoveryPayment;
  }
  el("recovery-remaining-total").textContent = money(Math.max(0, d.balance - (hasValidRecoveryPayment() ? AppState.recoveryPayment : 0)));

  var enteredInvalid = paymentInput.value !== "" && parseNonNegativeNumber(paymentInput.value) === null;
  var paymentInvalid = enteredInvalid || (AppState.recoveryPayment !== null && !hasValidRecoveryPayment());
  paymentInput.setAttribute("aria-invalid", paymentInvalid ? "true" : "false");
  message.classList.toggle("is-error", paymentInvalid);
  if (totalDebt <= 0) {
    message.textContent = "כדי לבנות תוכנית, יש להזין מינוס או חוב לסגירה.";
  } else if (d.balance <= 0) {
    message.textContent = "אין יתרה להחזר נוסף. קודם צריך לאזן את הוצאות החודש.";
  } else if (enteredInvalid) {
    message.textContent = "יש להזין סכום תקין שאינו שלילי.";
  } else if (AppState.recoveryPayment === null) {
    message.textContent = "יש לבחור סכום להחזר נוסף. אפשר להזין גם 0.";
  } else if (!hasValidRecoveryPayment()) {
    message.textContent = "הסכום לא יכול לעלות על היתרה או על החוב הרשום (עד " + money(limit) + ").";
  } else {
    message.textContent = "הסכום הנותר נשאר זמין לשימוש החודש.";
  }
  var calculateButton = el("budget-flow-calculate-btn");
  if (calculateButton) calculateButton.disabled = d.balance <= 0 || !hasValidRecoveryPayment();
}

function updateRecoveryPayment(value) {
  AppState.recoveryPayment = parseNonNegativeNumber(value);
  saveData();
  renderRecoveryDashboard(AppState.result);
  flashSaved();
}

function renderAllocationModes() {
  var box = el("allocation-mode-box");
  var question = el("allocation-mode-question");
  var customButton = el("allocation-custom-btn");
  if (!box) return;
  if (AppState.profile.debtStatus || hasActiveDebtPlan()) {
    box.hidden = true;
    if (question) question.hidden = true;
    if (el("allocation-pick-hint")) el("allocation-pick-hint").hidden = true;
    if (customButton) customButton.hidden = true;
    box.innerHTML = "";
    return;
  }

  box.hidden = false;
  if (question) question.hidden = false;
  if (el("allocation-pick-hint")) el("allocation-pick-hint").hidden = false;
  if (customButton) customButton.hidden = false;
  box.innerHTML = ALLOCATION_MODES.map(function(mode) {
    var selected = allocationsMatch(AppState.settings.allocation, mode.allocation);
    return '<button type="button" class="allocation-mode' + (selected ? ' selected' : '') + '" ' +
      'aria-pressed="' + selected + '" onclick="setAllocationMode(\'' + mode.id + '\')">' +
      '<strong>' + mode.name + '</strong>' +
      '<span>השקעות ' + mode.allocation.invest + '%</span>' +
      '<span>איכות חיים ' + mode.allocation.qualityOfLife + '%</span>' +
      '<span>בזבוזים ' + mode.allocation.spending + '%</span>' +
    '</button>';
  }).join("");
}

function allocationsMatch(current, candidate) {
  return Number(current.invest) === candidate.invest &&
    Number(current.qualityOfLife) === candidate.qualityOfLife &&
    Number(current.spending) === candidate.spending;
}

function setAllocationMode(modeId) {
  var selectedMode = null;
  for (var i = 0; i < ALLOCATION_MODES.length; i++) {
    if (ALLOCATION_MODES[i].id === modeId) {
      selectedMode = ALLOCATION_MODES[i];
      break;
    }
  }
  if (!selectedMode) return;

  AppState.settings.allocation = clone(selectedMode.allocation);
  saveAllocationPercentages();
  calculate();
  render();
  flashSaved();
}



/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SAVE DOT FLASHER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var _saveTimer = null;
function flashSaved() {
  var dot = el("save-dot");
  if (!dot) return;
  var failed = consumeStorageWriteFailure();
  dot.classList.toggle("save-failed", failed);
  dot.setAttribute("role", failed ? "alert" : "status");
  dot.children[0].textContent = failed ? "!" : "✓";
  dot.children[1].textContent = failed ? "השמירה נכשלה. ייתכן שהאחסון בדפדפן מלא או חסום." : "נשמר";
  dot.classList.add("show");
  clearTimeout(_saveTimer);
  /* הודעת כשל נשארת גלויה עד לשמירה מוצלחת הבאה */
  if (!failed) _saveTimer = setTimeout(function() { dot.classList.remove("show"); }, 1800);
}
