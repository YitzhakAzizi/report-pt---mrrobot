"use strict";

/* דיווח שגיאות על המסך: באייפון אין כלי מפתחים, כך שהשגיאה מוצגת למשתמש וניתנת לצילום */
var APP_VERSION = "64";
function showErrorReport(message) {
  var bar = el("error-report");
  if (!bar) {
    bar = mk("div", "error-report");
    bar.id = "error-report";
    bar.setAttribute("role", "alert");
    bar.onclick = function() { bar.remove(); };
    document.body.appendChild(bar);
  }
  bar.textContent = "שגיאה (גרסה " + APP_VERSION + "): " + String(message || "לא ידועה").slice(0, 200) + " · הקישו לסגירה";
}
window.addEventListener("error", function(event) { showErrorReport(event.message); });
window.addEventListener("unhandledrejection", function(event) {
  var reason = event.reason;
  showErrorReport(reason && reason.message ? reason.message : reason);
});

(function init() {
  var now = new Date();
  AppState.period.month = now.getMonth();
  AppState.period.year = now.getFullYear();

  registerEvents();
  renderNextMeetingLabel();

  loadGoals();
  loadMaaserAccount();
  loadDreams();
  loadPercentageSettings();
  loadLiabilities();
  loadProfileSettings();
  loadInvestmentsOverview();
  openBudgetPeriod(AppState.period.month, AppState.period.year);
  addCarTestOnce();
  applyFixedDefaultsOnce();
  refreshWithoutSaving();
})();

/* "טסט לרכב" נוסף להוצאות המשתנות. פעם אחת בלבד, כדי שמחיקה שלו בהמשך תישאר מחיקה */
function addCarTestOnce() {
  var flag = "addedCarTest_v1";
  try { if (localStorage.getItem(flag)) return; } catch(e) { return; }
  var items = AppState.variableExpenses || [];
  if (!items.some(function(item) { return !item.customCategory && item.name === "טסט לרכב"; })) {
    var fuel = items.findIndex(function(item) { return item.name === "דלק / תחבורה"; });
    items.splice(fuel >= 0 ? fuel + 1 : items.length, 0, {name: "טסט לרכב", val: 0});
    if (AppState.monthHasRecord) saveData();
  }
  writeStorage(flag, "1");
}

/* ברירת מחדל חדשה להוצאות הקבועות: שכירות, הלוואה קבועה וביטוח רכב.
   פעם אחת בלבד: סעיפי ברירת המחדל הישנים יורדים רק אם הסכום שלהם 0 (כסף לא נמחק), והשלושה נוספים */
function applyFixedDefaultsOnce() {
  /* הרשימה בתוך הפונקציה: היא רצה בזמן הטעינה, לפני שמשתנים בהמשך הקובץ מקבלים ערך */
  var OLD_FIXED_DEFAULT_NAMES = ["ועד בית / מיסי יישוב", "ביטוחים", "החזר הלוואה קבוע", "אינטרנט", "סלולר", "Netflix", "צפייה ומוזיקה",
    "חדר כושר / סטודיו", "תוכנות ואפליקציות", "תרופות", "טיפולים רפואיים", "טיפולי שיניים", "מספרה", "קוסמטיקה וטיפוח"];
  var flag = "fixedDefaults_v2";
  try { if (localStorage.getItem(flag)) return; } catch(e) { return; }
  var keep = function(item) { return item.customCategory || OLD_FIXED_DEFAULT_NAMES.indexOf(item.name) < 0 || Number(item.val) > 0; };
  AppState.expenses = (AppState.expenses || []).filter(keep);
  AppState.subscriptions = (AppState.subscriptions || []).filter(keep);
  AppState.healthBeautyExpenses = (AppState.healthBeautyExpenses || []).filter(keep);
  DEFAULT_EXPENSES.slice().reverse().forEach(function(def) {
    if (!AppState.expenses.some(function(item) { return !item.customCategory && item.name === def.name; })) AppState.expenses.unshift(clone(def));
  });
  if (AppState.monthHasRecord) saveData();
  writeStorage(flag, "1");
}
