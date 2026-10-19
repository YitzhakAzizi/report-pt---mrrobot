"use strict";

function openAllocationSettingsModal() {
  var allocation = AppState.settings.allocation;
  el("gen-modal-title").textContent = "יתרה לחלוקה";
  el("gen-modal-body").innerHTML =
    '<div class="settings-form">' +
      allocationPercentageField("allocation-invest-input", "קרן השקעות", allocation.invest) +
      allocationPercentageField("allocation-quality-input", "קרן איכות חיים", allocation.qualityOfLife) +
      allocationPercentageField("allocation-spending-input", "בזבוזים", allocation.spending) +
      '<div class="settings-validation" id="settings-validation"></div>' +
    '</div>';

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "none";

  var apply = el("gen-apply-btn");
  apply.textContent = "עדכן ושמור ✓";
  apply.onclick = applyAllocationSettings;
  el("gen-overlay").className = "overlay open";
}

function allocationPercentageField(id, label, value) {
  return '<label class="maaser-field"><span>' + label + '</span>' +
    '<input type="number" id="' + id + '" value="' + value + '" min="0" step="any" inputmode="decimal" />' +
  '</label>';
}

function applyAllocationSettings() {
  var allocation = {
    invest: parseNonNegativeNumber(el("allocation-invest-input").value),
    qualityOfLife: parseNonNegativeNumber(el("allocation-quality-input").value),
    spending: parseNonNegativeNumber(el("allocation-spending-input").value)
  };

  if (allocation.invest === null || allocation.qualityOfLife === null || allocation.spending === null) {
    showSettingsValidation("יש להזין ערכים מספריים שאינם שליליים");
    return;
  }

  if (!isValidAllocationPercentages(allocation)) {
    showSettingsValidation("סך האחוזים חייב להיות 100%");
    return;
  }

  AppState.settings.allocation = allocation;
  saveAllocationPercentages();
  closeGenModal();
  calculate();
  render();
  flashSaved();
}

function showSettingsValidation(message) {
  var validation = el("settings-validation");
  if (validation) validation.textContent = message;
}

function openSpendingModal() {
  var recoverySpending = AppState.profile.debtStatus && hasValidRecoveryPayment()
    ? Math.max(0, AppState.result.balance - AppState.recoveryPayment)
    : null;
  var spendingPercentage = hasActiveDebtPlan()
    ? DEFAULT_DEBT_PLAN_PERCENTAGES.spending
    : AppState.settings.allocation.spending;
  var monthlySpending = recoverySpending === null
    ? percentageOf(AppState.result.balance, spendingPercentage)
    : recoverySpending;
  var dailySpending = dailySpendingAmount(monthlySpending, new Date());

  el("gen-modal-title").textContent = AppState.profile.debtStatus ? "יתרה לשימוש החודש" : "בזבוזים";
  el("gen-modal-body").innerHTML =
    '<div class="settings-form">' +
      '<div class="maaser-field"><span>' + (AppState.profile.debtStatus ? "סכום יומי זמין:" : "סכום יומי לבזבוזים:") + '</span><strong>' + money(dailySpending) + '</strong></div>' +
    '</div>';

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "none";

  var apply = el("gen-apply-btn");
  apply.textContent = "סגור";
  apply.onclick = function() { closeGenModal(); };
  el("gen-overlay").className = "overlay open";
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODAL: INVESTMENT GOALS (ACCORDION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var _expandedInvestmentGoalId = null;
var _visibleInvestmentGoalIndex = null;

function openInvestGoalsModal() {
  el("gen-modal-title").textContent = "השקעות";
  _visibleInvestmentGoalIndex = firstIncompleteInvestmentGoalIndex();
  _expandedInvestmentGoalId = null;
  renderInvestGoalsModal();

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "none";

  var apply = el("gen-apply-btn");
  apply.hidden = true;
  el("investment-goal-footer").hidden = false;

  el("gen-overlay").className = "overlay open";
}

function renderInvestGoalsModal() {
  var body = el("gen-modal-body");
  if (!body) return;

  if (_visibleInvestmentGoalIndex === null) _visibleInvestmentGoalIndex = firstIncompleteInvestmentGoalIndex();
  var goalIndex = Math.max(0, Math.min(_visibleInvestmentGoalIndex, GOAL_DEFS.length - 1));
  var gd = GOAL_DEFS[goalIndex];
  var completed = !!AppState.goals[gd.id].completed;
  var html = '<div class="investment-goals-intro" aria-label="הסבר על היעד">' +
    '<p><strong>' + gd.horizon + ' · ' + gd.name + '</strong><span>' + gd.desc + '</span></p>' +
    '</div><div class="goal-accordion-list">' + buildGoalCardHtml(gd) + '</div>';
  body.innerHTML = html;
  renderInvestmentGoalFooter(goalIndex, completed);
}

function renderInvestmentGoalFooter(goalIndex, completed) {
  var footer = el("investment-goal-footer");
  if (!footer) return;

  footer.innerHTML =
    '<button type="button" class="investment-goal-footer-nav" onclick="showPreviousInvestmentGoal()"' +
      (goalIndex === 0 ? ' disabled' : '') + '>' +
      '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span><span>חזור</span></button>' +
    '<div class="investment-goal-status-choices" role="group" aria-label="סטטוס היעד">' +
      investmentGoalStatusChoice(false, completed) +
      investmentGoalStatusChoice(true, completed) +
    '</div>' +
    '<button type="button" class="investment-goal-footer-nav investment-goal-footer-next" onclick="showNextInvestmentGoal()"' +
      (!completed || goalIndex === GOAL_DEFS.length - 1 ? ' disabled' : '') + '>' +
      '<span>הבא</span><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span></button>';
}

function investmentGoalStatusChoice(value, completed) {
  var selected = completed === value;
  return '<button type="button" class="investment-goal-status-choice' + (selected ? ' selected' : '') + '" ' +
    'aria-pressed="' + selected + '" onclick="setVisibleInvestmentGoalCompletion(' + value + ')">' +
    '<span class="material-symbols-rounded" aria-hidden="true">' + (selected ? 'check_circle' : 'radio_button_unchecked') + '</span>' +
    '<span>' + (value ? 'הושלם' : 'לא הושלם') + '</span></button>';
}

function setVisibleInvestmentGoalCompletion(completed) {
  var gd = GOAL_DEFS[_visibleInvestmentGoalIndex];
  if (!gd) return;
  toggleGoalComplete(gd.id, completed);
}

function firstIncompleteInvestmentGoalIndex() {
  for (var i = 0; i < GOAL_DEFS.length; i++) {
    if (!AppState.goals[GOAL_DEFS[i].id].completed) return i;
  }
  return GOAL_DEFS.length - 1;
}

function buildGoalCardHtml(gd) {
  var g = AppState.goals[gd.id];
  var completed = !!g.completed;
  var detailsExpanded = _expandedInvestmentGoalId === gd.id;
  var cls = "goal-card-acc open" + (completed ? " completed" : "") +
    (detailsExpanded ? " details-open" : "");

  var h = '<div class="goal-card-row">';
  h += '<div class="' + cls + '">';
  h += '<div class="goal-header">';
  h += '<button type="button" class="goal-emoji" aria-label="' + (detailsExpanded ? 'סגירת' : 'פתיחת') + ' פרטי ' + gd.name + '" ' +
    'title="' + (detailsExpanded ? 'סגירת' : 'פתיחת') + ' פרטי ' + gd.name + '" aria-expanded="' + detailsExpanded + '" ' +
    'onclick="toggleInvestmentGoalDetails(\'' + gd.id + '\')"><span class="goal-emoji-symbol material-symbols-rounded" aria-hidden="true">' + gd.emoji + '</span></button>';
  h += '<div class="goal-title">' + gd.name + '</div>';
  h += '<div class="goal-header-meta">';
  h += '<div class="goal-required-box"><span>סכום נדרש</span><strong>' + money(g.target || 0) + '</strong></div>';
  h += '</div>';
  h += '</div>';

  if (detailsExpanded) {
    h += '<div class="goal-card-body goal-card-body-' + gd.id + '">';

    if (gd.id === "checking") {
      h += financialInstitutionPickerHtml("checking", "bank", g.bank, "שם הבנק");
    }

    if (gd.id === "fund") {
      h += goalDetailInputHtml("fund", "bank", g.bank, "בית השקעות");
      h += goalDetailInputHtml("fund", "fundName", g.fundName, "שם קרן כספית");
      h += goalDetailInputHtml("fund", "fundNumber", g.fundNumber, "מספר קרן כספית", "numeric");
    }

    if (gd.id === "invest") {
      h += goalDetailInputHtml("invest", "house", g.house, "בית השקעות");
    }

    h += '</div>';
  }

  h += '</div></div>';
  return h;
}

function goalDetailInputHtml(goalId, field, value, placeholder, inputMode) {
  return '<input type="text" class="goal-detail-input" value="' + escapeHtml(value || "") + '" ' +
    'placeholder="' + placeholder + '" aria-label="' + placeholder + '"' +
    (inputMode ? ' inputmode="' + inputMode + '"' : '') +
    ' oninput="updateGoalField(\'' + goalId + '\',\'' + field + '\',this.value)" />';
}

function financialInstitutionPickerHtml(goalId, field, value, placeholder) {
  var selected = null;
  for (var i = 0; i < FINANCIAL_INSTITUTIONS.length; i++) {
    if (FINANCIAL_INSTITUTIONS[i].name === value) { selected = FINANCIAL_INSTITUTIONS[i]; break; }
  }
  var label = value || placeholder;
  var html = '<details class="institution-picker"><summary aria-label="' + placeholder + '">' +
    (selected ? '<img class="institution-logo institution-selected-logo" src="' + selected.logo + '" alt="" aria-hidden="true" />' : '') +
    '<span class="institution-picker-label' + (value ? '' : ' is-placeholder') + '">' + escapeHtml(label) + '</span>' +
    '<span class="material-symbols-rounded institution-picker-arrow" aria-hidden="true">expand_more</span></summary>' +
    '<div class="institution-options" role="listbox">';
  FINANCIAL_INSTITUTIONS.forEach(function(institution, index) {
    html += '<button type="button" class="institution-option" role="option" aria-selected="' + (institution.name === value) + '" ' +
      'onclick="selectFinancialInstitution(this,\'' + goalId + '\',\'' + field + '\',' + index + ')">' +
      '<img class="institution-logo" src="' + institution.logo + '" alt="" aria-hidden="true" />' +
      '<span>' + escapeHtml(institution.name) + '</span></button>';
  });
  html += '</div></details>';
  return html;
}

function selectFinancialInstitution(button, goalId, field, index) {
  var institution = FINANCIAL_INSTITUTIONS[index];
  if (!institution) return;
  updateGoalField(goalId, field, institution.name);
  renderInvestGoalsModal();
}

function completeVisibleInvestmentGoal() {
  var gd = GOAL_DEFS[_visibleInvestmentGoalIndex];
  if (!gd) return;
  AppState.goals[gd.id].completed = true;
  saveGoals();
  _expandedInvestmentGoalId = null;
  if (_visibleInvestmentGoalIndex < GOAL_DEFS.length - 1) _visibleInvestmentGoalIndex += 1;
  renderInvestGoalsModal();
  flashSaved();
}

function showPreviousInvestmentGoal() {
  if (_visibleInvestmentGoalIndex <= 0) return;
  _visibleInvestmentGoalIndex -= 1;
  _expandedInvestmentGoalId = null;
  renderInvestGoalsModal();
}

function showNextInvestmentGoal() {
  if (_visibleInvestmentGoalIndex >= GOAL_DEFS.length - 1) return;
  _visibleInvestmentGoalIndex += 1;
  _expandedInvestmentGoalId = null;
  renderInvestGoalsModal();
}

function toggleInvestmentGoalDetails(id) {
  _expandedInvestmentGoalId = _expandedInvestmentGoalId === id ? null : id;
  renderInvestGoalsModal();
}

function updateGoalField(id, field, value) {
  AppState.goals[id][field] = value;
  saveGoals();
  flashSaved();
}

function toggleGoalComplete(id, checked) {
  AppState.goals[id].completed = checked;
  saveGoals();
  renderInvestGoalsModal();
  flashSaved();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODAL: EXPENSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var _genCollection = "expenses";

function openModal(type) {
  _genCollection = type === "insurance" ? "insurances" : "expenses";
  var isInsurance = _genCollection === "insurances";
  el("gen-modal-title").textContent = isInsurance ? "ביטוחים" : "דיור";
  var body = el("gen-modal-body");
  body.innerHTML = "";

  if (isInsurance) {
    appendInsuranceList(body, AppState.insurances);
  } else {
    var fixedExpenseItems = clone(getActiveFixedExpenseItems().filter(function(item) { return !item.customCategory; }));
    if (AppState.profile.renting && !fixedExpenseItems.some(isRentExpense)) {
      fixedExpenseItems.unshift({name: "שכר דירה", val: 0});
    }
    if (!fixedExpenseItems.some(function(item) { return item.name === "ועד בית / מיסי יישוב"; })) {
      fixedExpenseItems.push({name: "ועד בית / מיסי יישוב", val: 0});
    }
    appendExpenseGroup(body, "דיור", "", fixedExpenseItems, "expenses", "הוסף הוצאת דיור");
  }

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function openFuelExpensesModal() {
  openScopedLivingExpensesModal("fuelExpenses", "דלק / תחבורה", FUEL_EXPENSE_NAMES);
}

function openHousingUtilitiesModal() {
  openScopedLivingExpensesModal("housingUtilities", "חיובי דיור משתנים", HOUSING_UTILITY_NAMES);
}

function openSupermarketExpensesModal() {
  openScopedLivingExpensesModal("supermarketExpenses", "קניות סופר", SUPERMARKET_EXPENSE_NAMES);
}

function openOtherVariableExpensesModal() {
  _genCollection = "otherVariableExpenses";
  el("gen-modal-title").textContent = "הוצאות משתנות נוספות";
  var body = el("gen-modal-body");
  body.innerHTML = "";
  var items = (AppState.variableExpenses || []).filter(function(item) { return !item.customCategory && !isStandardVariableExpense(item); });
  appendExpenseGroup(body, "", "", items, "variableExpenses", "הוסף הוצאה משתנה");
  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function openScopedLivingExpensesModal(collection, title, names) {
  _genCollection = collection;
  el("gen-modal-title").textContent = title;
  var body = el("gen-modal-body");
  body.innerHTML = "";
  appendLivingExpenseScope(body, "", names);
  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function appendLivingExpenseScope(body, title, names) {
  var group = document.createElement("section");
  group.className = "expense-modal-group monthly-expense-modal-group";
  if (title) {
    var heading = document.createElement("h3");
    heading.className = "expense-modal-group-title";
    heading.textContent = title;
    group.appendChild(heading);
  }
  var list = document.createElement("div");
  list.className = "living-expenses-list";
  var items = (AppState.variableExpenses || []).filter(function(item) { return names.indexOf(item.name) >= 0; });
  if (!items.length) {
    items = DEFAULT_VARIABLE_EXPENSES.filter(function(item) { return names.indexOf(item.name) >= 0; });
  }
  items.forEach(function(item) { list.appendChild(buildLivingExpenseItem(item, true)); });
  group.appendChild(list);
  body.appendChild(group);
}

function openLivingExpensesModal() {
  _genCollection = "variableExpenses";
  el("gen-modal-title").textContent = "הוצאות מחיה";
  var body = el("gen-modal-body");
  body.innerHTML = "";

  var list = document.createElement("div");
  list.className = "living-expenses-list";
  (AppState.variableExpenses || []).filter(function(item) { return !item.customCategory; }).forEach(function(item) {
    list.appendChild(buildLivingExpenseItem(item));
  });

  var add = document.createElement("div");
  add.className = "add-row-btn living-expense-add";
  add.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>הוסף הוצאת מחיה</span>';
  add.onclick = function() {
    list.insertBefore(buildLivingExpenseItem({name: "", val: 0}), add);
    updateGenTotal();
  };
  list.appendChild(add);
  body.appendChild(list);

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function openOneTimeExpensesModal() {
  _genCollection = "oneTimeExpenses";
  el("gen-modal-title").textContent = "הוצאות מיוחדות החודש";
  var body = el("gen-modal-body");
  body.innerHTML = "";

  appendExpenseGroup(
    body,
    "",
    audienceText("הזן רק הוצאות חיוניות שמתרחשות החודש ואינן חוזרות באופן קבוע.", "הזינו רק הוצאות חיוניות שמתרחשות החודש ואינן חוזרות באופן קבוע."),
    (AppState.oneTimeExpenses || []).filter(function(item) { return !item.customCategory; }),
    "oneTimeExpenses",
    "הוסף הוצאה מיוחדת"
  );

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function openSubscriptionsModal() {
  _genCollection = "subscriptions";
  el("gen-modal-title").textContent = "מנויים ותקשורת";
  var body = el("gen-modal-body");
  body.innerHTML = "";
  appendExpenseGroup(body, "", "", AppState.subscriptions, "subscriptions", "הוסף שירות או מינוי");
  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function openHealthBeautyModal() {
  _genCollection = "healthBeautyExpenses";
  el("gen-modal-title").textContent = "בריאות וטיפוח";
  var body = el("gen-modal-body");
  body.innerHTML = "";
  appendExpenseGroup(body, "", "", AppState.healthBeautyExpenses, "healthBeautyExpenses", "הוסף הוצאת בריאות או טיפוח");
  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function openChildrenExpensesModal() {
  _genCollection = "childrenExpenses";
  el("gen-modal-title").textContent = "הוצאות ילדים";
  var body = el("gen-modal-body");
  body.innerHTML = "";
  appendExpenseGroup(body, "הוצאות ילדים", audienceText("הזן רק הוצאות השייכות לילדים במשק הבית.", "הזינו רק הוצאות השייכות לילדים במשק הבית."), AppState.childrenExpenses, "childrenExpenses", "הוסף הוצאת ילדים");
  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyGenModal(); };
  updateGenTotal();
  el("gen-overlay").className = "overlay open";
}

function buildLivingExpenseItem(item, lockName) {
  var wrapper = document.createElement("section");
  wrapper.className = "living-expense-item";
  var row = buildGenRow(item, "variableExpenses");
  var nameInput = row.querySelector(".exp-name");
  if (lockName && nameInput) {
    nameInput.readOnly = true;
    nameInput.classList.add("exp-name-locked");
  }
  wrapper.appendChild(row);

  var estimateType = livingExpenseEstimateType(item.name);
  if (!estimateType) return wrapper;

  if (estimateType === "bill") {
    var history = getPreviousVariableExpenseStats(item.name, AppState.period.month, AppState.period.year);
    var historyCopy = document.createElement("p");
    historyCopy.className = "living-bill-history";
    if (!history) {
      historyCopy.textContent = "אין עדיין חיובים קודמים";
    } else if (history.count === 1) {
      historyCopy.textContent = "חיוב קודם: " + money(history.last);
    } else {
      historyCopy.textContent = "חיוב קודם: " + money(history.last) + " · ממוצע: " + money(history.average);
    }
    wrapper.appendChild(historyCopy);
    return wrapper;
  }

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "living-estimate-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">calculate</span><span>' + audienceText("עזור לי להעריך", "עזרו לי להעריך") + '</span>';

  var panel = document.createElement("div");
  panel.className = "living-estimate-panel";
  panel.hidden = true;
  panel.innerHTML = livingEstimateFieldsHtml(estimateType);
  toggle.onclick = function() {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
  };
  panel.querySelector(".living-estimate-apply").onclick = function() {
    applyLivingExpenseEstimate(wrapper, estimateType);
  };

  wrapper.appendChild(toggle);
  wrapper.appendChild(panel);
  return wrapper;
}

function livingExpenseEstimateType(name) {
  if (name === "קניות סופר (מזון ומוצרי ניקוי)") return "food";
  if (name === "דלק / תחבורה") return "fuel";
  if (name === "חשמל" || name === "מים" || name === "גז" || name === "ארנונה") return "bill";
  return "";
}

function livingEstimateFieldsHtml(type) {
  var fields = "";
  if (type === "food") {
    fields = '<label><span>הוצאה ממוצעת בשבוע</span><input type="number" class="living-estimate-primary" min="0" inputmode="decimal" placeholder="0"></label>' +
      '<label><span>מספר השבועות החודש בבית</span><input type="number" class="living-estimate-secondary" min="0" max="5" inputmode="decimal" placeholder="0"></label>';
  } else if (type === "fuel") {
    fields = '<label><span>עלות תדלוק ממוצעת</span><input type="number" class="living-estimate-primary" min="0" inputmode="decimal" placeholder="0"></label>' +
      '<label><span>מספר תדלוקים בחודש</span><input type="number" class="living-estimate-secondary" min="0" inputmode="decimal" placeholder="0"></label>';
  } else {
    fields = '<label><span>סכום החשבון האחרון</span><input type="number" class="living-estimate-primary" min="0" inputmode="decimal" placeholder="0"></label>' +
      '<label><span>תדירות החשבון</span><select class="living-estimate-frequency"><option value="1">חודשי</option><option value="2">אחת לחודשיים</option></select></label>';
  }
  return '<div class="living-estimate-fields">' + fields + '</div>' +
    '<button type="button" class="living-estimate-apply">' + audienceText("השתמש בהערכה", "השתמשו בהערכה") + '</button>';
}

function applyLivingExpenseEstimate(wrapper, type) {
  var primary = toAmount(wrapper.querySelector(".living-estimate-primary").value);
  var amount = primary;
  if (type === "food") {
    amount = primary * (toAmount(wrapper.querySelector(".living-estimate-secondary").value));
  }
  if (type === "fuel") {
    amount = primary * (toAmount(wrapper.querySelector(".living-estimate-secondary").value));
  }
  if (type === "bill") {
    amount = primary / (parseFloat(wrapper.querySelector(".living-estimate-frequency").value) || 1);
  }
  wrapper.querySelector(".exp-amt").value = amount ? Math.round(amount) : "";
  updateGenTotal();
}

function openInsuranceModal() {
  openModal("insurance");
}

function appendInsuranceList(body, items) {
  var list = document.createElement("div");
  list.className = "insurance-edit-list";
  (items || []).forEach(function(item) { list.appendChild(buildInsuranceRow(item)); });

  var add = document.createElement("button");
  add.type = "button";
  add.className = "add-row-btn";
  add.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>הוסף ביטוח</span>';
  add.onclick = function() {
    list.insertBefore(buildInsuranceRow({name: "", provider: "", endDate: "", val: 0}), add);
  };
  list.appendChild(add);
  body.appendChild(list);
}

function buildInsuranceRow(item) {
  var row = document.createElement("section");
  row.className = "insurance-edit-row";
  row.innerHTML =
    '<span class="row-icon material-symbols-rounded insurance-edit-icon" aria-hidden="true">shield</span>' +
    '<button type="button" class="custom-category-remove material-symbols-rounded insurance-edit-delete" aria-label="מחיקת ביטוח" title="מחיקת ביטוח">delete</button>' +
    '<label class="insurance-edit-field"><span>סוג הביטוח</span><input type="text" class="insurance-type" placeholder="ביטוח רכב, חיים..." value="' + escapeHtml(item.name || "") + '"></label>' +
    '<label class="insurance-edit-field"><span>איפה</span><input type="text" class="insurance-provider" placeholder="שם חברת הביטוח" value="' + escapeHtml(item.provider || "") + '"></label>' +
    '<label class="insurance-edit-field"><span>תאריך סיום</span><input type="date" class="insurance-end-date" value="' + escapeHtml(item.endDate || "") + '"></label>' +
    '<label class="insurance-edit-field"><span>סכום חודשי</span><input type="number" class="insurance-monthly-amount" min="0" inputmode="decimal" placeholder="0" value="' + (Number(item.val) || 0) + '"></label>';
  row.querySelector(".insurance-edit-delete").onclick = function() { row.remove(); };
  return row;
}

function appendExpenseGroup(body, title, description, items, collection, addLabel) {
  var group = document.createElement("section");
  group.className = "expense-modal-group";
  if (title) {
    var heading = document.createElement("h3");
    heading.className = "expense-modal-group-title";
    heading.textContent = title;
    group.appendChild(heading);
  }
  if (description) {
    var guidance = document.createElement("p");
    guidance.className = "expense-modal-group-guidance";
    guidance.textContent = description;
    group.appendChild(guidance);
  }

  var list = document.createElement("div");
  list.className = "expense-modal-list";
  (items || []).forEach(function(item) { list.appendChild(buildGenRow(item, collection)); });

  var add = document.createElement("button");
  add.type = "button";
  add.className = "add-row-btn";
  add.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>' + addLabel + '</span>';
  add.onclick = function() {
    list.insertBefore(buildGenRow({name: "", val: 0}, collection), add);
    updateGenTotal();
  };
  list.appendChild(add);
  group.appendChild(list);
  body.appendChild(group);
}

function buildGenRow(item, collection) {
  var row = document.createElement("div");
  row.className = "exp-row expense-detail-row";
  row.setAttribute("data-expense-collection", collection || _genCollection);

  var iconNames = {
    expenses: "home", housingUtilities: "home", fuelExpenses: "local_gas_station",
    supermarketExpenses: "shopping_cart", otherVariableExpenses: "more_horiz",
    variableExpenses: "receipt_long", subscriptions: "subscriptions",
    healthBeautyExpenses: "spa", childrenExpenses: "family_restroom",
    oneTimeExpenses: "receipt_long", customExpenseCategory: "receipt_long"
  };
  var icon = mkText("span", "row-icon material-symbols-rounded expense-detail-icon", iconNames[_genCollection] || iconNames[collection] || "receipt_long");
  icon.setAttribute("aria-hidden", "true");

  var del = document.createElement("button");
  del.type = "button";
  del.className = "custom-category-remove material-symbols-rounded expense-detail-remove";
  del.textContent = "delete";
  del.setAttribute("aria-label", "מחיקת סוג הוצאה");
  del.title = "מחיקת סוג הוצאה";
  del.onclick = function() { row.remove(); updateGenTotal(); };

  var ni = document.createElement("input");
  ni.type = "text"; ni.className = "exp-name"; ni.value = item.name;
  ni.placeholder = "שם הסעיף"; ni.setAttribute("aria-label", "שם סוג ההוצאה"); ni.oninput = updateGenTotal;

  var ai = document.createElement("input");
  ai.type = "number"; ai.className = "exp-amt"; ai.value = Number(item.val) || 0;
  ai.min = 0; ai.inputMode = "decimal"; ai.placeholder = "0"; ai.setAttribute("aria-label", "סכום סוג ההוצאה"); ai.oninput = updateGenTotal;

  row.appendChild(icon);
  row.appendChild(ni);
  row.appendChild(ai);
  row.appendChild(del);
  return row;
}

function updateGenTotal() {
  var rows = document.querySelectorAll("#gen-modal-body .exp-row");
  var t = 0;
  rows.forEach(function(r) { t += toAmount(r.querySelector(".exp-amt").value); });
  el("gen-modal-total").textContent = money(t);
}

function applyGenModal() {
  if (_genCollection === "insurances") {
    var insuranceRows = document.querySelectorAll("#gen-modal-body .insurance-edit-row");
    var insurances = [];
    insuranceRows.forEach(function(row) {
      var insurance = {
        name: row.querySelector(".insurance-type").value.trim(),
        provider: row.querySelector(".insurance-provider").value.trim(),
        endDate: row.querySelector(".insurance-end-date").value,
        val: toAmount(row.querySelector(".insurance-monthly-amount").value)
      };
      if (insurance.name || insurance.provider || insurance.endDate || insurance.val > 0) insurances.push(insurance);
    });
    updateState("insurances", insurances);
    closeGenModal();
    return;
  }

  var rows = document.querySelectorAll("#gen-modal-body .exp-row");
  var collections = {expenses: [], variableExpenses: [], subscriptions: [], healthBeautyExpenses: [], oneTimeExpenses: [], childrenExpenses: [], insurances: []};
  rows.forEach(function(r) {
    var n = r.querySelector(".exp-name").value.trim();
    var a = toAmount(r.querySelector(".exp-amt").value);
    var collection = r.getAttribute("data-expense-collection") || _genCollection;
    if (n || a > 0) collections[collection].push({name: n || "הוצאה", val: a});
  });
  if (_genCollection === "fuelExpenses") {
    replaceVariableExpenseScope(FUEL_EXPENSE_NAMES, collections.variableExpenses);
  } else if (_genCollection === "housingUtilities") {
    replaceVariableExpenseScope(HOUSING_UTILITY_NAMES, collections.variableExpenses);
  } else if (_genCollection === "supermarketExpenses") {
    replaceVariableExpenseScope(SUPERMARKET_EXPENSE_NAMES, collections.variableExpenses);
  } else if (_genCollection === "otherVariableExpenses") {
    AppState.variableExpenses = (AppState.variableExpenses || []).filter(function(item) { return item.customCategory || isStandardVariableExpense(item); }).concat(collections.variableExpenses);
  } else if (_genCollection === "variableExpenses") {
    AppState.variableExpenses = (AppState.variableExpenses || []).filter(function(item) { return item.customCategory; }).concat(collections.variableExpenses);
  } else if (_genCollection === "subscriptions") {
    AppState.subscriptions = collections.subscriptions;
  } else if (_genCollection === "healthBeautyExpenses") {
    AppState.healthBeautyExpenses = collections.healthBeautyExpenses;
  } else if (_genCollection === "oneTimeExpenses") {
    AppState.oneTimeExpenses = (AppState.oneTimeExpenses || []).filter(function(item) { return item.customCategory; }).concat(collections.oneTimeExpenses);
  } else if (_genCollection === "childrenExpenses") {
    AppState.childrenExpenses = collections.childrenExpenses;
  } else {
    var inactiveRentExpenses = AppState.profile.renting ? [] : (AppState.expenses || []).filter(isRentExpense);
    AppState.expenses = collections.expenses.concat(inactiveRentExpenses, (AppState.expenses || []).filter(function(item) { return item.customCategory; }));
  }
  pipeline();
  closeGenModal();
}

function replaceVariableExpenseScope(names, nextItems) {
  var untouched = (AppState.variableExpenses || []).filter(function(item) {
    return item.customCategory || names.indexOf(item.name) < 0;
  });
  AppState.variableExpenses = untouched.concat(nextItems);
}

function isStandardVariableExpense(item) {
  if (item && item.customCategory) return false;
  var name = item && item.name;
  return HOUSING_UTILITY_NAMES.indexOf(name) >= 0 || FUEL_EXPENSE_NAMES.indexOf(name) >= 0 || SUPERMARKET_EXPENSE_NAMES.indexOf(name) >= 0;
}

function addCustomExpenseCategory(collection) {
  var defaults = {
    variableExpenses: "הוצאות משתנות - כללי",
    expenses: "הוצאות קבועות - כללי",
    oneTimeExpenses: "קטגוריה חדשה"
  };
  var listIds = {
    variableExpenses: "custom-variable-expenses-list",
    expenses: "custom-fixed-expenses-list",
    oneTimeExpenses: "custom-special-expenses-list"
  };
  if (!Object.prototype.hasOwnProperty.call(defaults, collection)) return;
  AppState[collection].push({name: defaults[collection], val: 0, customCategory: true, items: []});
  pipeline();
  var inputs = el(listIds[collection]).querySelectorAll(".custom-category-name");
  var newName = inputs[inputs.length - 1];
  if (newName) { newName.focus(); newName.select(); }
}

function removeCustomExpenseCategory(collection, index) {
  if (["variableExpenses", "expenses", "oneTimeExpenses"].indexOf(collection) < 0) return;
  var items = AppState[collection];
  if (!items || !items[index] || !items[index].customCategory) return;
  items.splice(index, 1);
  pipeline();
}

var _expenseDeleteAction = null;
var _expenseDeleteOpener = null;

function askDeleteExpenseCategory(name, action, allMonths) {
  _expenseDeleteAction = action;
  _expenseDeleteOpener = document.activeElement;
  el("expense-delete-message").textContent = "האם ברצונך למחוק את " + name + "?" +
    (allMonths ? " המחיקה תשפיע על כל החודשים." : "");
  var overlay = el("expense-delete-overlay");
  overlay.hidden = false;
  overlay.onkeydown = function(event) {
    if (event.key === "Escape") closeExpenseDeleteDialog();
    if (event.key === "Tab") {
      var no = el("expense-delete-no");
      var yes = el("expense-delete-yes");
      if (event.shiftKey && document.activeElement === no) { event.preventDefault(); yes.focus(); }
      else if (!event.shiftKey && document.activeElement === yes) { event.preventDefault(); no.focus(); }
    }
  };
  el("expense-delete-no").focus();
}

function closeExpenseDeleteDialog() {
  el("expense-delete-overlay").hidden = true;
  _expenseDeleteAction = null;
  if (_expenseDeleteOpener && _expenseDeleteOpener.isConnected) _expenseDeleteOpener.focus();
  _expenseDeleteOpener = null;
}

function confirmExpenseDelete() {
  var action = _expenseDeleteAction;
  var opener = _expenseDeleteOpener;
  _expenseDeleteAction = null;
  _expenseDeleteOpener = null;
  el("expense-delete-overlay").hidden = true;
  if (action) action();
  if (opener && opener.isConnected) opener.focus();
}

function confirmClearExpenseCategory(key, name) {
  if (key === "loans" && AppState.profile.debtStatus) name = "הלוואות";
  askDeleteExpenseCategory(name, function() { clearExpenseCategory(key); }, key === "loans" || key === "mortgage");
}

function clearExpenseCategory(key) {
  if (key === "variableHousing") {
    AppState.variableExpenses = AppState.variableExpenses.filter(function(item) {
      return item.customCategory || HOUSING_UTILITY_NAMES.indexOf(item.name) < 0;
    });
  } else if (key === "fuel") {
    AppState.variableExpenses = AppState.variableExpenses.filter(function(item) {
      return item.customCategory || FUEL_EXPENSE_NAMES.indexOf(item.name) < 0;
    });
  } else if (key === "supermarket") {
    AppState.variableExpenses = AppState.variableExpenses.filter(function(item) {
      return item.customCategory || SUPERMARKET_EXPENSE_NAMES.indexOf(item.name) < 0;
    });
  } else if (key === "otherVariable") {
    AppState.variableExpenses = AppState.variableExpenses.filter(function(item) { return item.customCategory || isStandardVariableExpense(item); });
  } else if (key === "housing") {
    AppState.expenses = AppState.expenses.filter(function(item) { return item.customCategory; });
  } else if (key === "subscriptions") {
    AppState.subscriptions = [];
  } else if (key === "healthBeauty") {
    AppState.healthBeautyExpenses = [];
  } else if (key === "children") {
    AppState.childrenExpenses = [];
  } else if (key === "insurances") {
    AppState.insurances = [];
  } else if (key === "loans") {
    AppState.liabilities.loans = [];
    if (!AppState.profile.debtStatus) {
      AppState.liabilities.debts = [];
      AppState.liabilities.overdraft = 0;
    }
    saveLiabilities();
  } else if (key === "mortgage") {
    AppState.liabilities.mortgages = [];
    saveLiabilities();
  } else {
    return;
  }
  pipeline();
}

function openCustomExpenseCategoryModal(collection, index) {
  if (["variableExpenses", "expenses", "oneTimeExpenses"].indexOf(collection) < 0) return;
  _genCollection = "customExpenseCategory";
  var items = AppState[collection] || [];
  var current = typeof index === "number" && items[index] && items[index].customCategory ? items[index] : null;
  if (!current) return;
  el("gen-modal-title").textContent = current.name;
  var body = el("gen-modal-body");
  body.innerHTML = "";
  var expenseTypes = Array.isArray(current.items)
    ? current.items
    : Number(current.val) > 0 ? [{name: "הוצאה", val: Number(current.val)}] : [];
  appendExpenseGroup(body, "", "", expenseTypes, collection, "הוסף סוג הוצאה");
  var error = mkText("p", "custom-category-error", "");
  error.setAttribute("role", "alert");
  body.appendChild(error);
  var remove = mkText("button", "custom-category-delete", "מחק קטגוריה");
  remove.type = "button";
  remove.onclick = function() {
    askDeleteExpenseCategory(current.name, function() {
      removeCustomExpenseCategory(collection, index);
      closeGenModal();
    });
  };
  body.appendChild(remove);
  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  updateGenTotal();
  var apply = el("gen-apply-btn");
  apply.textContent = "עדכן ושמור ✓";
  apply.onclick = function() {
    var expenseItems = [];
    var rows = body.querySelectorAll(".expense-modal-list .exp-row");
    for (var i = 0; i < rows.length; i++) {
      var itemName = rows[i].querySelector(".exp-name").value.trim();
      var amountInput = rows[i].querySelector(".exp-amt");
      var rawAmount = amountInput.value.trim();
      var itemAmount = rawAmount === "" ? 0 : Number(rawAmount);
      if (!Number.isFinite(itemAmount) || itemAmount < 0) { error.textContent = "יש להזין סכום תקין"; amountInput.focus(); return; }
      if (!itemName && itemAmount > 0) { error.textContent = "יש להזין שם לסוג ההוצאה"; rows[i].querySelector(".exp-name").focus(); return; }
      if (itemName) expenseItems.push({name: itemName, val: itemAmount});
    }
    items[index] = {name: current.name, val: sumArr(expenseItems), customCategory: true, items: expenseItems};
    pipeline();
    closeGenModal();
  };
  el("gen-overlay").className = "overlay open";
  var addExpenseType = body.querySelector(".expense-modal-list .add-row-btn");
  if (addExpenseType) addExpenseType.focus();
}


function openDreamsModal() {
  el("gen-modal-title").textContent = "קרן איכות חיים";
  var body = el("gen-modal-body");
  body.innerHTML = "";

  var arr = sortDreams(AppState.dreams.length ? AppState.dreams : [{rank: 1, name: "", val: 0}]);
  arr.forEach(function(item) { body.appendChild(buildDreamRow(item)); });

  var add = document.createElement("div");
  add.className = "add-row-btn";
  add.id = "gen-add-btn";
  add.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>הוסף יעד</span>';
  add.onclick = function() {
    body.insertBefore(buildDreamRow({rank: nextDreamRank(), name: "", val: 0}), el("gen-add-btn"));
    updateDreamsTotal();
  };
  body.appendChild(add);

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "";
  el("gen-apply-btn").textContent = "עדכן ושמור ✓";
  el("gen-apply-btn").onclick = function() { applyDreamsModal(); };
  updateDreamsTotal();
  el("gen-overlay").className = "overlay open";
}

function buildDreamRow(item) {
  var row = document.createElement("div");
  row.className = "exp-row dream-row";

  var del = document.createElement("button");
  del.className = "del-btn";
  del.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">delete</span>';
  del.onclick = function() { row.remove(); updateDreamsTotal(); };

  var ri = document.createElement("input");
  ri.type = "number"; ri.className = "dream-rank"; ri.value = item.rank || "";
  ri.min = 1; ri.inputMode = "numeric"; ri.placeholder = "דירוג"; ri.oninput = updateDreamsTotal;
  ri.setAttribute("aria-label", "דירוג");

  var ni = document.createElement("input");
  ni.type = "text"; ni.className = "exp-name dream-name"; ni.value = item.name || "";
  ni.placeholder = "שם החלום"; ni.oninput = updateDreamsTotal;

  var ai = document.createElement("input");
  ai.type = "number"; ai.className = "exp-amt dream-amt"; ai.value = item.val || "";
  ai.min = 0; ai.inputMode = "decimal"; ai.placeholder = "סכום נדרש"; ai.oninput = updateDreamsTotal;

  row.appendChild(del);
  row.appendChild(ri);
  row.appendChild(ni);
  row.appendChild(ai);
  return row;
}

function updateDreamsTotal() {
  var rows = document.querySelectorAll("#gen-modal-body .dream-row");
  var t = 0;
  rows.forEach(function(r) { t += toAmount(r.querySelector(".dream-amt").value); });
  el("gen-modal-total").textContent = money(t);
}

function applyDreamsModal() {
  var rows = document.querySelectorAll("#gen-modal-body .dream-row");
  var arr = [];
  rows.forEach(function(r) {
    var rank = parseInt(r.querySelector(".dream-rank").value, 10) || 0;
    var name = r.querySelector(".dream-name").value.trim();
    var amount = toAmount(r.querySelector(".dream-amt").value);
    if (rank > 0 || name || amount > 0) arr.push({rank: rank || nextDreamRank(), name: name || "חלום", val: amount});
  });
  AppState.dreams = sortDreams(arr);
  saveDreams();
  closeGenModal();
  flashSaved();
}

function sortDreams(arr) {
  return clone(arr).sort(function(a, b) {
    var ar = parseInt(a.rank, 10) || 999999;
    var br = parseInt(b.rank, 10) || 999999;
    if (ar !== br) return ar - br;
    return (a.name || "").localeCompare(b.name || "", "he");
  });
}

function nextDreamRank() {
  var rows = document.querySelectorAll("#gen-modal-body .dream-rank");
  var max = 0;
  rows.forEach(function(r) { max = Math.max(max, parseInt(r.value, 10) || 0); });
  if (max > 0) return max + 1;
  var savedMax = 0;
  AppState.dreams.forEach(function(d) { savedMax = Math.max(savedMax, parseInt(d.rank, 10) || 0); });
  return savedMax + 1 || 1;
}


function closeGenModal() {
  var o = el("gen-overlay"); if (o) o.className = "overlay";
  var investmentFooter = el("investment-goal-footer");
  var apply = el("gen-apply-btn");
  if (investmentFooter) investmentFooter.hidden = true;
  if (apply) apply.hidden = false;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODAL: INCOME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var _incPerson = 0;

var _payslipPerson = 1;
var _payslipOpener = null;

function openPayslipModal(person) {
  _payslipPerson = person === 2 ? 2 : 1;
  _payslipOpener = document.activeElement;
  var context = el("payslip-context");
  context.textContent = "תלוש עבור " + salaryLabel(_payslipPerson);
  el("payslip-file-input").value = "";
  el("payslip-overlay").className = "overlay open";
  renderPayslipStatus();
}

function closePayslipModal() {
  var overlay = el("payslip-overlay");
  if (overlay) overlay.className = "overlay";
  if (_payslipOpener && typeof _payslipOpener.focus === "function") _payslipOpener.focus();
}

function uploadPayslipFile(file) {
  if (!file) return;
  var allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.indexOf(file.type) === -1 && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name || "")) {
    showPayslipMessage("אפשר להעלות PDF או תמונה מסוג JPG, PNG או WEBP.", true);
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showPayslipMessage("הקובץ גדול מדי. ניתן להעלות קובץ עד 15MB.", true);
    return;
  }
  showPayslipMessage("שומרים את התלוש במכשיר…", false);
  savePayslipFile(_payslipPerson, file).then(function() {
    renderPayslipStatus();
  }).catch(function() {
    showPayslipMessage("לא הצלחנו לשמור את הקובץ במכשיר.", true);
  });
}

function renderPayslipStatus() {
  var status = el("payslip-status");
  if (!status) return;
  status.className = "payslip-status payslip-status-loading";
  status.textContent = "בודקים אם נשמר תלוש…";
  getPayslipFile(_payslipPerson).then(function(record) {
    status.innerHTML = "";
    status.className = "payslip-status";
    if (!record) {
      status.appendChild(mkText("p", "payslip-empty", "עדיין לא נשמר תלוש לחודש הזה."));
      return;
    }
    var card = mk("div", "payslip-file-card");
    var info = mk("div", "payslip-file-info");
    info.appendChild(mkText("span", "payslip-file-icon material-symbols-rounded", record.type === "application/pdf" ? "picture_as_pdf" : "image"));
    var copy = mk("div", "payslip-file-copy");
    copy.appendChild(mkText("strong", "", record.name));
    copy.appendChild(mkText("small", "", formatPayslipSize(record.size)));
    info.appendChild(copy);
    var actions = mk("div", "payslip-file-actions");
    var view = mkText("button", "payslip-view-btn", "צפייה");
    view.type = "button";
    view.onclick = viewPayslipFile;
    var remove = mkText("button", "payslip-delete-btn", "מחיקה");
    remove.type = "button";
    remove.onclick = removePayslipFile;
    actions.appendChild(view);
    actions.appendChild(remove);
    card.appendChild(info);
    card.appendChild(actions);
    status.appendChild(card);
  }).catch(function() {
    showPayslipMessage("לא הצלחנו לגשת לאחסון המקומי במכשיר.", true);
  });
}

function viewPayslipFile() {
  getPayslipFile(_payslipPerson).then(function(record) {
    if (!record || !record.file) return;
    var url = URL.createObjectURL(record.file);
    var link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
  }).catch(function() {
    showPayslipMessage("לא הצלחנו לפתוח את התלוש.", true);
  });
}

function removePayslipFile() {
  if (!window.confirm("למחוק את התלוש השמור מהמכשיר?")) return;
  deletePayslipFile(_payslipPerson).then(renderPayslipStatus).catch(function() {
    showPayslipMessage("לא הצלחנו למחוק את התלוש.", true);
  });
}

function showPayslipMessage(message, isError) {
  var status = el("payslip-status");
  if (!status) return;
  status.className = "payslip-status" + (isError ? " payslip-status-error" : " payslip-status-loading");
  status.textContent = message;
}

function formatPayslipSize(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function openIncomeModal(person) {
  _incPerson = person;
  var arr = person === 1 ? AppState.income1 : AppState.income2;

  el("inc-modal-title").textContent = "הכנסות";
  var body = el("inc-modal-body");
  body.innerHTML = "";

  arr.forEach(function(item) { body.appendChild(buildIncRow(item)); });

  var add = document.createElement("div");
  add.className = "add-row-btn";
  add.id = "inc-add-btn";
  add.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>הוסף סעיף הכנסה</span>';
  add.onclick = function() {
    body.insertBefore(buildIncRow({name: "", val: 0}), el("inc-add-btn"));
    updateIncTotal();
  };
  body.appendChild(add);

  updateIncTotal();
  el("inc-overlay").className = "overlay open";
}

function buildIncRow(item) {
  var row = document.createElement("div");
  row.className = "exp-row";

  var del = document.createElement("button");
  del.className = "del-btn"; del.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">delete</span>';
  del.onclick = function() { row.remove(); updateIncTotal(); };

  var ni = document.createElement("input");
  ni.type = "text"; ni.className = "exp-name"; ni.value = item.name;
  ni.placeholder = "מקור הכנסה"; ni.oninput = updateIncTotal;

  var ai = document.createElement("input");
  ai.type = "number"; ai.className = "exp-amt"; ai.value = item.val || "";
  ai.min = 0; ai.inputMode = "decimal"; ai.placeholder = "0"; ai.oninput = updateIncTotal;

  row.appendChild(del);
  row.appendChild(ni);
  row.appendChild(ai);
  return row;
}

function updateIncTotal() {
  var rows = document.querySelectorAll("#inc-modal-body .exp-row");
  var t = 0;
  rows.forEach(function(r) { t += toAmount(r.querySelector(".exp-amt").value); });
  var total = el("inc-modal-total");
  if (total) total.textContent = money(t);
}

function applyIncome() {
  var rows = document.querySelectorAll("#inc-modal-body .exp-row");
  var arr = [];
  rows.forEach(function(r) {
    var n = r.querySelector(".exp-name").value.trim();
    var a = toAmount(r.querySelector(".exp-amt").value);
    if (n || a > 0) arr.push({name: n || "הכנסה נוספת", val: a});
  });
  if (!arr.length) arr = [{name: "משכורת", val: 0}];
  updateState(_incPerson === 1 ? "income1" : "income2", arr);
  closeIncomeModal();
}

function closeIncomeModal() {
  var o = el("inc-overlay"); if (o) o.className = "overlay";
}
