"use strict";

function renderMaaser(d) {
  var box = el("maaser-box");
  var modeBox = el("maaser-mode-box");
  var card = el("maaser-card");
  var noBalance = el("maaser-no-balance");
  if (!box || !modeBox) return;
  var state = AppState.maaser || {enabled: true, charities: []};
  var canDonate = Number(d.availableBeforeMaaser) > 0;
  var effectiveEnabled = state.enabled && canDonate;
  if (noBalance) noBalance.hidden = canDonate;
  if (card) card.className = "card maaser-card" + (!effectiveEnabled ? " maaser-card-collapsed" : "");

  modeBox.innerHTML = maaserToggleHtml(effectiveEnabled, canDonate);
  box.innerHTML = maaserTitleHtml();
  if (!effectiveEnabled) return;

  box.innerHTML += maaserPercentageChoicesHtml() +
    '<label class="maaser-summary"><span>סכום לתרומה</span><div class="maaser-summary-input"><input type="number" value="' +
      formatMaaserSettingsNumber(d.maaserRequested) + '" min="0" step="any" inputmode="decimal" aria-label="סכום לתרומה" ' +
      'onchange="saveMainMaaserAmount(this.value)" /><b>₪</b></div></label>' +
    (d.maaserCapped ? '<p class="maaser-capped-note" role="status">' + escapeHtml(maaserCappedText(d)) + '</p>' : '') +
    '<div class="maaser-validation" id="maaser-validation">' + getMaaserValidationMessage() + '</div>';
}

function maaserCappedText(d) {
  return "אחרי ההוצאות נותרו " + money(d.maaser) + " בלבד, ולכן התרומה החודש תעמוד על " + money(d.maaser) +
    " במקום " + money(d.maaserRequested) + ", כדי שלא ייווצר מינוס.";
}

function maaserToggleHtml(enabled, canDonate) {
  var interestedLabel = audienceText("מעוניין לתרום החודש", "מעוניינים לתרום החודש");
  var notInterestedLabel = audienceText("לא מעוניין לתרום החודש", "לא מעוניינים לתרום החודש");
  return '<div class="maaser-toggle" role="radiogroup" aria-label="בחירת מצב תרומות">' +
      '<label class="maaser-radio' + (enabled ? ' active' : '') + (!canDonate ? ' disabled' : '') + '">' +
        '<input type="radio" name="maaser-mode" value="on"' + (enabled ? ' checked' : '') + (!canDonate ? ' disabled' : '') + ' onchange="setMaaserEnabled(true)" />' +
        '<span class="maaser-radio-dot"></span>' +
        '<span class="maaser-radio-label">' + interestedLabel + '</span>' +
      '</label>' +
      '<label class="maaser-radio' + (!enabled ? ' active' : '') + '">' +
        '<input type="radio" name="maaser-mode" value="off"' + (!enabled ? ' checked' : '') + ' onchange="setMaaserEnabled(false)" />' +
        '<span class="maaser-radio-dot"></span>' +
        '<span class="maaser-radio-label">' + notInterestedLabel + '</span>' +
      '</label>' +
  '</div>';
}

function maaserTitleHtml() {
  return '<div class="maaser-toggle-title"><button type="button" class="maaser-title-icon material-symbols-rounded" onclick="openMaaserCharitiesModal()" aria-label="ניהול עמותות" title="ניהול עמותות">volunteer_activism</button><span>תרומות</span></div>';
}

var MAASER_PRESETS = [1, 2, 5, 7.5, 10];
var _maaserCustomOpen = false;

function maaserPercentageChoicesHtml() {
  var current = Number(AppState.settings.maaserPercent) || 0;
  var isPreset = MAASER_PRESETS.some(function(value) { return Math.abs(value - current) < 0.000001; });
  var customSelected = _maaserCustomOpen || !isPreset;
  return '<div class="maaser-percentage-choices" role="group" aria-label="בחירת אחוז תרומה">' +
    MAASER_PRESETS.map(function(value) {
      var selected = !customSelected && Math.abs(value - current) < 0.000001;
      return '<button type="button" class="maaser-percentage-choice' + (selected ? ' selected' : '') + '" ' +
        'aria-pressed="' + selected + '" onclick="setMaaserPercentagePreset(' + value + ')">' + value + '%</button>';
    }).join('') +
    '<button type="button" class="maaser-percentage-choice maaser-custom-choice' + (customSelected ? ' selected' : '') + '" ' +
      'aria-pressed="' + customSelected + '" onclick="openMaaserCustomPercent()">הגדר לבד</button>' +
  '</div>' +
  (customSelected ? '<label class="maaser-custom-percent"><span>אחוז לתרומה</span><span class="maaser-custom-control">' +
    '<input type="number" id="maaser-custom-percent" value="' + formatMaaserSettingsNumber(current) + '" min="0" max="100" step="any" inputmode="decimal" ' +
    'onchange="setMaaserCustomPercent(this.value)" aria-label="אחוז תרומה מותאם"><b>%</b></span></label>' : '');
}

function openMaaserCustomPercent() {
  _maaserCustomOpen = true;
  render();
  var input = el("maaser-custom-percent");
  if (input) { input.focus(); input.select(); }
}

function setMaaserCustomPercent(value) {
  var percentage = parseNonNegativeNumber(value);
  if (percentage === null || percentage > 100) {
    showMaaserValidation("יש להזין אחוז בין 0 ל־100");
    return;
  }
  setMaaserPercentagePreset(percentage, true);
}

function setMaaserPercentagePreset(percentage, keepCustom) {
  _maaserCustomOpen = !!keepCustom;
  AppState.settings.maaserPercent = percentage;
  saveMaaserPercentage();
  calculate();
  render();
  flashSaved();
}

function saveMainMaaserAmount(value) {
  var amount = parseNonNegativeNumber(value);
  if (amount === null) {
    showMaaserValidation("יש להזין סכום מספרי שאינו שלילי");
    return;
  }
  if (AppState.result.total <= 0 && amount > 0) {
    showMaaserValidation("לא ניתן לחשב אחוז תרומה ללא הכנסות");
    return;
  }

  AppState.settings.maaserPercent = AppState.result.total > 0 ? (amount / AppState.result.total) * 100 : 0;
  saveMaaserPercentage();
  calculate();
  render();
  flashSaved();
}

function maaserInlineSettingsHtml(d) {
  return '<div class="maaser-inline-settings">' +
    '<div class="maaser-inline-copy"><strong>' + audienceText("כמה תורם?", "כמה תורמים?") + '</strong></div>' +
    '<div class="maaser-inline-inputs">' +
      '<label><span>אחוזים</span><div class="maaser-inline-control"><input type="number" id="maaser-percent-input" value="' +
        formatMaaserSettingsNumber(AppState.settings.maaserPercent) +
        '" min="0" step="any" inputmode="decimal" oninput="syncInlineMaaserFromPercent()" onchange="saveInlineMaaserSetting(\'percent\')" /><b>%</b></div></label>' +
      '<label><span>סכום</span><div class="maaser-inline-control"><input type="number" id="maaser-amount-input" value="' +
        formatMaaserSettingsNumber(d.maaserRequested) +
        '" min="0" step="any" inputmode="decimal" oninput="syncInlineMaaserFromAmount()" onchange="saveInlineMaaserSetting(\'amount\')" /><b>₪</b></div></label>' +
    '</div>' +
    '<div class="settings-validation" id="settings-validation"></div>' +
  '</div>';
}

function maaserCharityHtml(charity, index) {
  var expanded = !!charity.expanded;
  var isOnlyCharity = AppState.maaser.charities.length <= 1;
  return '<div class="maaser-charity' + (expanded ? ' expanded' : '') + '">' +
    '<div class="maaser-charity-head">' +
      '<button type="button" class="maaser-accordion-btn material-symbols-rounded" onclick="toggleMaaserCharity(' + index + ')" aria-label="' + (expanded ? 'סגירת פרטי עמותה' : 'פתיחת פרטי עמותה') + '">' + (expanded ? 'expand_less' : 'expand_more') + '</button>' +
      '<input type="text" class="maaser-charity-name" value="' + escapeHtml(charity.name || '') + '" placeholder="שם העמותה" oninput="updateMaaserCharity(' + index + ',\'name\',this.value,this)" />' +
      '<input type="number" class="maaser-charity-amount" value="' + (Number(charity.amount) || '') + '" placeholder="0" min="0" inputmode="decimal" oninput="updateMaaserCharity(' + index + ',\'amount\',toAmount(this.value),this)" />' +
      '<button type="button" class="maaser-delete-btn material-symbols-rounded" onclick="deleteMaaserCharity(' + index + ')" aria-label="מחיקת עמותה"' + (isOnlyCharity ? ' disabled title="חייבת להישאר לפחות עמותה אחת"' : '') + '>delete</button>' +
    '</div>' +
    (expanded ? maaserCharityDetailsHtml(charity, index) : '') +
  '</div>';
}

function maaserCharityDetailsHtml(charity, index) {
  return '<div class="maaser-charity-details">' +
    maaserDetailInput(index, 'bank', 'בנק', charity.bank) +
    maaserDetailInput(index, 'branch', 'סניף', charity.branch) +
    maaserDetailInput(index, 'account', 'מספר חשבון', charity.account) +
    maaserDetailInput(index, 'owner', 'ע"ש', charity.owner) +
  '</div>';
}

function maaserDetailInput(index, field, label, value) {
  return '<label class="maaser-field"><span>' + label + '</span><input type="text" value="' + escapeHtml(value || '') + '" oninput="updateMaaserCharity(' + index + ',\'' + field + '\',this.value,this)" /></label>';
}

function setMaaserEnabled(enabled) {
  if (enabled && Number(AppState.result.availableBeforeMaaser) <= 0) return;
  AppState.maaser.enabled = enabled;
  saveMaaser();
  calculate();
  render();
  flashSaved();
}

function addMaaserCharity() {
  AppState.maaser.charities.push(defaultMaaserCharity());
  saveMaaser();
  renderMaaserCharitiesModalBody();
  flashSaved();
}

function deleteMaaserCharity(index) {
  if (AppState.maaser.charities.length <= 1) return;
  AppState.maaser.charities.splice(index, 1);
  saveMaaser();
  renderMaaserCharitiesModalBody();
  flashSaved();
}

function toggleMaaserCharity(index) {
  AppState.maaser.charities[index].expanded = !AppState.maaser.charities[index].expanded;
  saveMaaser();
  renderMaaserCharitiesModalBody();
}

function updateMaaserCharity(index, field, value, input) {
  var charity = AppState.maaser.charities[index];
  if (!charity) return;
  if (field === 'amount') {
    var oldAmount = Number(charity.amount) || 0;
    var nextAmount = Number(value) || 0;
    if (getMaaserAllocated() - oldAmount + nextAmount > AppState.result.maaserRequested) {
      if (input) input.value = oldAmount || '';
      showMaaserValidation('הסכום שהוקצה גבוה מהתרומה הכוללת. כדאי להקטין סכום או לעדכן חלוקה.');
      return;
    }
    charity.amount = nextAmount;
    updateMaaserSummaryView();
  } else {
    charity[field] = value;
  }
  saveMaaser();
  flashSaved();
}

function getMaaserAllocated() {
  return (AppState.maaser.charities || []).reduce(function(total, charity) {
    return total + (Number(charity.amount) || 0);
  }, 0);
}

function getMaaserValidationMessage() {
  return getMaaserAllocated() > AppState.result.maaserRequested ? 'הסכום שהוקצה גבוה מהתרומה הכוללת. כדאי להקטין סכום או לעדכן חלוקה.' : '';
}

function showMaaserValidation(message) {
  var msg = el('maaser-validation');
  if (msg) msg.textContent = message;
}

function updateMaaserSummaryView() {
  var allocated = getMaaserAllocated();
  var remaining = Math.max(0, AppState.result.maaserRequested - allocated);
  var allocatedEl = el('maaser-allocated-val');
  var remainingEl = el('maaser-remaining-val');
  if (allocatedEl) allocatedEl.textContent = money(allocated);
  if (remainingEl) remainingEl.textContent = money(remaining);
  showMaaserValidation(getMaaserValidationMessage());
}

function defaultMaaserCharity() {
  return {name: '', amount: 0, expanded: true, bank: '', branch: '', account: '', owner: '', notes: ''};
}

function openMaaserCharitiesModal() {
  el("gen-modal-title").textContent = "תרומות";
  renderMaaserCharitiesModalBody();

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "none";

  var apply = el("gen-apply-btn");
  apply.textContent = "סגור";
  apply.onclick = function() { closeGenModal(); };
  el("gen-overlay").className = "overlay open";
}

function renderMaaserCharitiesModalBody() {
  var body = el("gen-modal-body");
  if (!body) return;
  var charities = (AppState.maaser && AppState.maaser.charities) || [];
  body.innerHTML = '<div class="maaser-charities maaser-charities-modal">' + charities.map(maaserCharityHtml).join('') + '</div>' +
    '<button type="button" class="add-row-btn maaser-add-btn" onclick="addMaaserCharity()"><span class="material-symbols-rounded" aria-hidden="true">add</span><span>הוסף עמותה</span></button>' +
    '<div class="maaser-validation" id="maaser-validation">' + getMaaserValidationMessage() + '</div>';
}

function openMaaserSettingsModal() {
  el("gen-modal-title").textContent = "תרומות";
  el("gen-modal-body").innerHTML = maaserInlineSettingsHtml(AppState.result);

  var totalRow = el("gen-modal-total-row");
  if (totalRow) totalRow.style.display = "none";

  var apply = el("gen-apply-btn");
  apply.textContent = "סגור";
  apply.onclick = function() { closeGenModal(); };
  el("gen-overlay").className = "overlay open";
}

function showInlineMaaserValidation(message) {
  var validation = el("settings-validation") || el("maaser-validation");
  if (validation) validation.textContent = message;
}

function syncInlineMaaserFromPercent() {
  var percentage = parseNonNegativeNumber(el("maaser-percent-input").value);
  showInlineMaaserValidation("");
  if (percentage === null) return;
  el("maaser-amount-input").value = formatMaaserSettingsNumber(percentageOf(AppState.result.total, percentage));
}

function syncInlineMaaserFromAmount() {
  var amount = parseNonNegativeNumber(el("maaser-amount-input").value);
  showInlineMaaserValidation("");
  if (amount === null) return;
  if (AppState.result.total <= 0) {
    if (amount > 0) showInlineMaaserValidation("לא ניתן לחשב אחוז תרומה ללא הכנסות");
    el("maaser-percent-input").value = 0;
    return;
  }
  el("maaser-percent-input").value = formatMaaserSettingsNumber((amount / AppState.result.total) * 100);
}

function formatMaaserSettingsNumber(value) {
  return Number(Number(value).toFixed(6));
}

function saveInlineMaaserSetting(source) {
  var amount = parseNonNegativeNumber(el("maaser-amount-input").value);
  var percentage = parseNonNegativeNumber(el("maaser-percent-input").value);
  if (source === "amount") {
    if (amount === null) {
      showInlineMaaserValidation("יש להזין סכום מספרי שאינו שלילי");
      return;
    }
    if (AppState.result.total <= 0 && amount > 0) {
      showInlineMaaserValidation("לא ניתן לחשב אחוז תרומה ללא הכנסות");
      return;
    }
    percentage = AppState.result.total > 0 ? (amount / AppState.result.total) * 100 : 0;
  }
  if (percentage === null) {
    showInlineMaaserValidation("יש להזין אחוז מספרי שאינו שלילי");
    return;
  }

  AppState.settings.maaserPercent = percentage;
  saveMaaserPercentage();
  calculate();
  render();
  flashSaved();
}
