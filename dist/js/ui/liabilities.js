"use strict";

var _liabilityDraft = null;
var _mortgageDraft = null;
var _liabilityView = "all";

function openLiabilitiesModal(view) {
  _liabilityView = view === "debts" || view === "loans" ? view : (AppState.profile.debtStatus ? "loans" : "all");
  _liabilityDraft = {
    loans: clone(AppState.liabilities.loans || []),
    debts: clone(AppState.liabilities.debts || [])
  };
  renderLiabilitiesModal();
  el("liabilities-overlay").className = "overlay open";
}

function closeLiabilitiesModal() {
  var overlay = el("liabilities-overlay");
  if (overlay) overlay.className = "overlay";
}

function renderLiabilitiesModal() {
  var body = el("liabilities-modal-body");
  if (!body || !_liabilityDraft) return;
  el("liabilities-modal-title").textContent = _liabilityView === "debts" ? "חובות" : "החזר הלוואה קבוע";
  body.innerHTML =
    '<p class="liability-guidance">' + (_liabilityView === "debts"
      ? "יש להזין כאן חובות שאינם הלוואה מסודרת או משכנתא. תשלום מינימלי ייכלל בהוצאות החודש."
      : _liabilityView === "loans" || !_liabilityDraft.debts.length
        ? audienceText("הזן כאן החזרי הלוואות כדי שלא ייספרו פעמיים בהוצאות הקבועות.", "הזינו כאן החזרי הלוואות כדי שלא ייספרו פעמיים בהוצאות הקבועות.")
        : audienceText("הזן כאן החזרי הלוואות וחובות כדי שלא ייספרו פעמיים בתוך ההוצאות הקבועות.", "הזינו כאן החזרי הלוואות וחובות כדי שלא ייספרו פעמיים בתוך ההוצאות הקבועות.")) + '</p>' +
    (_liabilityView === "debts" ? "" : liabilitySectionHtml(
      "הלוואות",
      "התחייבויות עם תשלום חודשי קבוע",
      "loan",
      _liabilityDraft.loans,
      loanEditorRowHtml
    )) +
    (_liabilityView === "all" && _liabilityDraft.debts.length ? '<div class="liability-section-divider" aria-hidden="true"></div>' : '') +
    (_liabilityView === "loans" || (_liabilityView === "all" && !_liabilityDraft.debts.length) ? "" : liabilitySectionHtml(
      "חובות לסגירה",
      _liabilityView === "debts" ? "חובות לצמצום שאינם הלוואה מסודרת או משכנתא." : audienceText("חובות שמטרתך לפרוע במהירות. היתרה תופנה קודם לריבית הגבוהה ביותר.", "חובות שמטרתכם לפרוע במהירות. היתרה תופנה קודם לריבית הגבוהה ביותר."),
      "debt",
      _liabilityDraft.debts,
      debtEditorRowHtml
    ));
  updateLiabilitiesModalTotal();
}

function liabilitySectionHtml(title, description, kind, items, rowBuilder) {
  var rows = items.length
    ? items.map(function(item, index) { return rowBuilder(item, index); }).join("")
    : '<div class="liability-empty">עדיין לא הוזנו פרטים</div>';
  return '<section class="liability-editor-section">' +
    '<div class="liability-section-head"><div><h3>' + title + '</h3><p>' + description + '</p></div>' +
    '<button type="button" class="liability-add-btn" onclick="addLiabilityEditorRow(\'' + kind + '\')">' +
    '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>הוסף</span></button></div>' +
    '<div class="liability-editor-list">' + rows + '</div></section>';
}

/* שורת הלוואה או חוב: שם וסכום חודשי בלבד, כמו שאר ההוצאות. שאר הפרטים בעמוד ההלוואות ("לפרטים") */
function loanEditorRowHtml(loan, index) {
  return liabilitySimpleRowHtml("loan", index, loan.name, loan.monthlyPayment, "שם ההלוואה", "הלוואה");
}

function debtEditorRowHtml(debt, index) {
  return liabilitySimpleRowHtml("debt", index, debt.name, debt.minimumPayment, "שם החוב", "חוב");
}

function liabilitySimpleRowHtml(kind, index, name, monthly, placeholder, itemLabel) {
  return '<div class="exp-row expense-detail-row ' + kind + '-editor-row" data-index="' + index + '">' +
    '<span class="row-icon material-symbols-rounded expense-detail-icon" aria-hidden="true">account_balance</span>' +
    '<input type="text" class="exp-name liability-name" placeholder="' + placeholder + '" aria-label="' + placeholder + '" value="' + escapeHtml(name || "") + '">' +
    '<input type="number" class="exp-amt liability-monthly" min="0" step="any" inputmode="decimal" placeholder="0" aria-label="תשלום חודשי" value="' + (Number(monthly) || 0) + '" oninput="updateLiabilityEditorTotals()">' +
    '<button type="button" class="row-details-btn" onclick="openLiabilityDetailsFromModal(\'' + kind + '\',' + index + ')">לפרטים</button>' +
    '<button type="button" class="custom-category-remove material-symbols-rounded expense-detail-remove" ' +
      'onclick="removeLiabilityEditorRow(\'' + kind + '\',' + index + ')" aria-label="מחיקת ' + itemLabel + '">delete</button>' +
  '</div>';
}

/* שומרים את מה שהוזן ועוברים לפרטי ההלוואה בעמוד ההלוואות */
function openLiabilityDetailsFromModal(kind, index) {
  var rows = kind === "debt" ? collectDebtEditorRows(false) : collectLoanEditorRows(false);
  var target = rows[index];
  applyLiabilitiesModal();
  var saved = kind === "debt" ? AppState.liabilities.debts : AppState.liabilities.loans;
  var position = -1;
  for (var i = 0; i < saved.length; i++) {
    if (JSON.stringify(saved[i]) === JSON.stringify(target)) { position = i; break; }
  }
  openLoanDetails(kind, position);
}

function liabilityFieldHtml(label, type, className, value, suffix) {
  var safeValue = type === "text" || type === "date" ? escapeHtml(value || "") : (Number(value) || "");
  return '<label class="liability-field"><span>' + label + '</span><div class="liability-input-wrap">' +
    '<input type="' + type + '" class="' + className + '" value="' + safeValue + '"' +
      (type === "number" ? ' min="0" step="any" inputmode="decimal"' : "") +
      ' oninput="updateLiabilityEditorTotals()">' +
    (suffix ? '<b>' + suffix + '</b>' : "") + '</div></label>';
}

function liabilityRemoveButtonHtml(kind, index, itemLabel) {
  return '<button type="button" class="liability-remove-btn material-symbols-rounded" ' +
    'onclick="removeLiabilityEditorRow(\'' + kind + '\',' + index + ')" aria-label="מחיקת ' + itemLabel + '">delete</button>';
}

function addLiabilityEditorRow(kind) {
  if (!_liabilityDraft) return;
  syncLiabilityDraftFromEditor();
  if (kind === "loan") {
    _liabilityDraft.loans.push(normalizeLoan({}));
  } else {
    _liabilityDraft.debts.push(normalizeDebt({}));
  }
  renderLiabilitiesModal();
}

function removeLiabilityEditorRow(kind, index) {
  if (!_liabilityDraft) return;
  syncLiabilityDraftFromEditor();
  if (kind === "loan") _liabilityDraft.loans.splice(index, 1);
  else _liabilityDraft.debts.splice(index, 1);
  renderLiabilitiesModal();
}

function syncLiabilityDraftFromEditor() {
  if (!el("liabilities-modal-body")) return;
  if (_liabilityView !== "debts") _liabilityDraft.loans = collectLoanEditorRows(false);
  if (_liabilityView !== "loans") _liabilityDraft.debts = collectDebtEditorRows(false);
}

function collectLoanEditorRows(removeEmpty) {
  var rows = Array.from(document.querySelectorAll("#liabilities-modal-body .loan-editor-row")).map(function(row) {
    var previous = _liabilityDraft.loans[Number(row.getAttribute("data-index"))] || {};
    return normalizeLoan(Object.assign({}, previous, {
      name: row.querySelector(".liability-name").value.trim(),
      monthlyPayment: row.querySelector(".liability-monthly").value
    }));
  });
  return removeEmpty === false ? rows : rows.filter(hasMeaningfulLoan);
}

function collectDebtEditorRows(removeEmpty) {
  var rows = Array.from(document.querySelectorAll("#liabilities-modal-body .debt-editor-row")).map(function(row) {
    var previous = _liabilityDraft.debts[Number(row.getAttribute("data-index"))] || {};
    return normalizeDebt(Object.assign({}, previous, {
      name: row.querySelector(".liability-name").value.trim(),
      minimumPayment: row.querySelector(".liability-monthly").value
    }));
  });
  return removeEmpty === false ? rows : rows.filter(hasMeaningfulDebt);
}

function hasMeaningfulLoan(loan) {
  return !!(loan.name || loan.balance || loan.interest || loan.monthlyPayment || loan.endDate || loan.earlyPayoff);
}

function hasMeaningfulDebt(debt) {
  return !!(debt.name || debt.balance || debt.interest || debt.minimumPayment || debt.targetDate);
}

function updateLiabilitiesModalTotal() {
  var total = 0;
  document.querySelectorAll("#liabilities-modal-body .liability-monthly").forEach(function(input) {
    total += Number(input.value) || 0;
  });
  var output = el("liabilities-modal-total");
  if (output) output.textContent = money(total);
}

function updateLiabilityEditorTotals() {
  updateLiabilitiesModalTotal();
  updateMortgageModalTotal();
}

function applyLiabilitiesModal() {
  if (_liabilityView !== "debts") AppState.liabilities.loans = collectLoanEditorRows();
  if (_liabilityView !== "loans") AppState.liabilities.debts = collectDebtEditorRows();
  saveLiabilities();
  closeLiabilitiesModal();
  pipeline();
}

function openMortgageModal() {
  _mortgageDraft = clone(AppState.liabilities.mortgages || []);
  renderMortgageModal();
  el("mortgage-overlay").className = "overlay open";
}

function closeMortgageModal() {
  var overlay = el("mortgage-overlay");
  if (overlay) overlay.className = "overlay";
}

function renderMortgageModal() {
  var body = el("mortgage-modal-body");
  if (!body || !_mortgageDraft) return;
  var rows = _mortgageDraft.length
    ? _mortgageDraft.map(mortgageEditorRowHtml).join("")
    : '<div class="liability-empty mortgage-empty">אין משכנתא מוזנת</div>';
  body.innerHTML =
    '<p class="liability-guidance">' + audienceText("הזן כל מסלול בנפרד. רק התשלום החודשי מופחת מהתקציב.", "הזינו כל מסלול בנפרד. רק התשלום החודשי מופחת מהתקציב.") + '</p>' +
    '<div class="mortgage-editor-list">' + rows + '</div>' +
    '<button type="button" class="add-row-btn liability-wide-add" onclick="addMortgageEditorRow()">' +
      '<span class="material-symbols-rounded" aria-hidden="true">add</span><span>הוסף מסלול משכנתא</span></button>';
  updateMortgageModalTotal();
}

function mortgageEditorRowHtml(mortgage, index) {
  return '<div class="liability-editor-row mortgage-editor-row" data-index="' + index + '">' +
    '<button type="button" class="liability-remove-btn material-symbols-rounded" ' +
      'onclick="removeMortgageEditorRow(' + index + ')" aria-label="מחיקת מסלול משכנתא">delete</button>' +
    liabilityFieldHtml("בנק או מסלול", "text", "liability-name", mortgage.name, "") +
    liabilityFieldHtml("יתרת הקרן", "number", "liability-balance", mortgage.balance, "₪") +
    liabilityFieldHtml("ריבית נוכחית", "number", "liability-interest", mortgage.interest, "%") +
    liabilityFieldHtml("תשלום חודשי", "number", "liability-monthly", mortgage.monthlyPayment, "₪") +
    '<label class="liability-field"><span>סוג הריבית</span><select class="mortgage-interest-type">' +
      '<option value="fixed"' + (mortgage.interestType !== "variable" ? " selected" : "") + '>קבועה</option>' +
      '<option value="variable"' + (mortgage.interestType === "variable" ? " selected" : "") + '>משתנה</option>' +
    '</select></label>' +
    '<label class="liability-checkbox"><input type="checkbox" class="mortgage-indexed"' +
      (mortgage.indexed ? " checked" : "") + '><span>צמודה למדד</span></label>' +
    liabilityFieldHtml("שנים שנותרו", "number", "mortgage-years", mortgage.yearsRemaining, "") +
    liabilityFieldHtml("שינוי ריבית הבא", "date", "mortgage-next-change", mortgage.nextRateChange, "") +
  '</div>';
}

function addMortgageEditorRow() {
  if (!_mortgageDraft) _mortgageDraft = [];
  syncMortgageDraftFromEditor();
  _mortgageDraft.push(normalizeMortgage({}));
  renderMortgageModal();
}

function removeMortgageEditorRow(index) {
  if (!_mortgageDraft) return;
  syncMortgageDraftFromEditor();
  _mortgageDraft.splice(index, 1);
  renderMortgageModal();
}

function syncMortgageDraftFromEditor() {
  if (!el("mortgage-modal-body")) return;
  _mortgageDraft = collectMortgageEditorRows(false);
}

function collectMortgageEditorRows(removeEmpty) {
  var rows = Array.from(document.querySelectorAll("#mortgage-modal-body .mortgage-editor-row")).map(function(row) {
    return normalizeMortgage({
      name: row.querySelector(".liability-name").value.trim(),
      balance: row.querySelector(".liability-balance").value,
      interest: row.querySelector(".liability-interest").value,
      monthlyPayment: row.querySelector(".liability-monthly").value,
      interestType: row.querySelector(".mortgage-interest-type").value,
      indexed: row.querySelector(".mortgage-indexed").checked,
      yearsRemaining: row.querySelector(".mortgage-years").value,
      nextRateChange: row.querySelector(".mortgage-next-change").value
    });
  });
  if (removeEmpty === false) return rows;
  return rows.filter(function(mortgage) {
    return !!(mortgage.name || mortgage.balance || mortgage.interest || mortgage.monthlyPayment ||
      mortgage.yearsRemaining || mortgage.nextRateChange || mortgage.indexed);
  });
}

function updateMortgageModalTotal() {
  var total = 0;
  document.querySelectorAll("#mortgage-modal-body .liability-monthly").forEach(function(input) {
    total += Number(input.value) || 0;
  });
  var output = el("mortgage-modal-total");
  if (output) output.textContent = money(total);
}

function applyMortgageModal() {
  AppState.liabilities.mortgages = collectMortgageEditorRows();
  saveLiabilities();
  closeMortgageModal();
  pipeline();
}
