"use strict";

function registerEvents() {
  /* המוצר מוצג בעיצוב בהיר בלבד, גם כשהמכשיר מוגדר למצב כהה */
  document.documentElement.setAttribute("data-theme", "light");

  el("sel-month").onchange = onPeriodChange;
  /* לחיצה בכל מקום בשורת סיכום פותחת את חלון העריכה שלה, לא רק על האייקון */
  el("budget-main").addEventListener("click", function(event) {
    var row = event.target.closest(".irow");
    if (!row || event.target.closest("button, input:not([readonly]), select, textarea")) return;
    var opener = row.querySelector(".row-icon-btn");
    if (opener && row.querySelector("input[readonly]")) opener.click();
  });
  el("inp-s1").oninput = onIncome1Input;
  el("inp-s2").oninput = onIncome2Input;
  document.addEventListener("keydown", function(event) {
    if (event.key !== "Escape") return;
    var deleteDialog = el("expense-delete-overlay");
    if (deleteDialog && !deleteDialog.hidden) return; /* לדיאלוג המחיקה יש טיפול משלו */
    var closers = {
      "payslip-overlay": closePayslipModal, "gen-overlay": closeGenModal, "inc-overlay": closeIncomeModal,
      "liabilities-overlay": closeLiabilitiesModal, "mortgage-overlay": closeMortgageModal, "calendar-overlay": closeCalendarModal
    };
    /* סוגרים רק את החלון העליון (האחרון במסמך מבין הפתוחים) */
    var open = Array.prototype.filter.call(document.querySelectorAll(".overlay.open"), function(overlay) { return closers[overlay.id]; });
    if (open.length) closers[open[open.length - 1].id]();
    else closeSideMenu();
  });
}

function openSideMenu() {
  var overlay = el("side-menu-overlay");
  var button = el("brand-menu-button");
  var closeButton = el("side-menu-close");
  if (!overlay) return;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  if (button) button.setAttribute("aria-expanded", "true");
  document.body.classList.add("side-menu-open");
  if (closeButton) closeButton.focus();
}

function closeSideMenu() {
  var overlay = el("side-menu-overlay");
  var button = el("brand-menu-button");
  if (!overlay || !overlay.classList.contains("open")) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("side-menu-open");
  if (button) {
    button.setAttribute("aria-expanded", "false");
    button.focus();
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UI EVENT HANDLERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function onPeriodChange() {
  var selected = parseInt(el("sel-month").value, 10);
  if (!isFinite(selected)) return;
  if (AppState.monthHasRecord) saveData();
  openBudgetPeriod(selected % 12, Math.floor(selected / 12));
  refreshWithoutSaving();
}

function updateIncomeLabel(person, value) {
  AppState.profile.incomeLabels[person] = String(value || "").trim().slice(0, 40);
  saveProfileSettings();
  flashSaved();
}

function onIncome1Input() {
  updateState("income1.0.val", toAmount(el("inp-s1").value));
}

function onIncome2Input() {
  updateState("income2.0.val", toAmount(el("inp-s2").value));
}

function addAdditionalIncome() {
  AppState.income1.push({name: "", val: 0});
  pipeline();
  var names = document.querySelectorAll("#additional-income-list .additional-income-name");
  if (names.length) names[names.length - 1].focus();
}

function updateAdditionalIncomeName(person, index, value) {
  var items = person === 2 ? AppState.income2 : AppState.income1;
  if (!items[index]) return;
  items[index].name = value;
  saveData();
  flashSaved();
}

function updateAdditionalIncomeAmount(person, index, value) {
  var items = person === 2 ? AppState.income2 : AppState.income1;
  if (!items[index]) return;
  items[index].val = toAmount(value);
  calculate();
  renderTopbarSnapshot();
  renderMaaser(AppState.result);
  renderPreAllocation(AppState.result);
  renderActions(AppState.result);
  saveData();
  flashSaved();
}

function removeAdditionalIncome(person, index) {
  var items = person === 2 ? AppState.income2 : AppState.income1;
  if (index < 1 || !items[index]) return;
  items.splice(index, 1);
  pipeline();
}
