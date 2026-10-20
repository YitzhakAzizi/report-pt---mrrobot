"use strict";

/* בדיקות לחישובים ולשמירה, בלי תלויות חיצוניות.
   הרצה מתיקיית הפרויקט: node tests/run-tests.js */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var assert = require("assert");

var ROOT = path.join(__dirname, "..");
var SCRIPTS = [
  "js/shared/constants.js", "js/shared/helpers.js", "js/shared/utils.js", "js/shared/state.js",
  "js/storage/storage.js", "js/calculations/budget.js", "js/features/export.js",
  "js/features/calendar.js", "js/features/backup.js", "js/features/payslip-reader.js"
];

function createApp() {
  var store = {};
  var localStorage = {
    getItem: function(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function(key, value) { store[key] = String(value); },
    removeItem: function(key) { delete store[key]; }
  };
  var context = vm.createContext({localStorage: localStorage, console: console, Date: Date, JSON: JSON, Math: Math, window: {}});
  SCRIPTS.forEach(function(file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {filename: file});
  });
  context.store = store;
  return context;
}

/* משק בית לבדיקה: יחיד/ה, בלי ילדים, בלי שכירות */
function household(app, income, expenses) {
  app.AppState.profile.single = true;
  app.AppState.period = {month: 9, year: 2026};
  app.AppState.income1 = [{name: "משכורת", val: income}];
  app.AppState.expenses = [];
  app.AppState.variableExpenses = [];
  app.AppState.subscriptions = [{name: "הוצאה", val: expenses}];
  app.AppState.healthBeautyExpenses = [];
  app.AppState.oneTimeExpenses = [];
  app.AppState.insurances = [];
  app.AppState.maaser.enabled = false;
}

var tests = [];
function test(name, fn) { tests.push({name: name, fn: fn}); }

test("גירעון נשמר כסכום שלילי", function() {
  var app = createApp();
  household(app, 10000, 12000);
  app.calculate();
  assert.strictEqual(app.AppState.result.balance, -2000);
});

test("תרומה רגילה מחושבת מההכנסה נטו", function() {
  var app = createApp();
  household(app, 10000, 5000);
  app.AppState.maaser.enabled = true;
  app.calculate();
  assert.strictEqual(app.AppState.result.maaser, 1000);
  assert.strictEqual(app.AppState.result.balance, 4000);
  assert.strictEqual(app.AppState.result.maaserCapped, false);
});

test("תרומה לעולם אינה יוצרת מינוס", function() {
  var app = createApp();
  household(app, 10000, 9500);
  app.AppState.maaser.enabled = true;
  app.calculate();
  assert.strictEqual(app.AppState.result.maaser, 500);
  assert.strictEqual(app.AppState.result.balance, 0);
  assert.strictEqual(app.AppState.result.maaserCapped, true);
});

test("אין תרומה כשההוצאות גבוהות מההכנסות", function() {
  var app = createApp();
  household(app, 10000, 12000);
  app.AppState.maaser.enabled = true;
  app.calculate();
  assert.strictEqual(app.AppState.result.maaser, 0);
  assert.strictEqual(app.AppState.result.balance, -2000);
});

test("חודש חדש מקבל את ההוצאות הקבועות מהחודש הקודם", function() {
  var app = createApp();
  household(app, 9000, 50);
  app.AppState.profile.renting = true;
  app.AppState.expenses = [{name: "שכר דירה", val: 4000}, {name: "ועד בית", val: 200}];
  app.AppState.insurances = [{name: "ביטוח רכב", provider: "", endDate: "", val: 300}];
  app.AppState.variableExpenses = [{name: "חשמל", val: 400}];
  app.AppState.oneTimeExpenses = [{name: "תיקון", val: 900}];
  app.calculate();
  assert.ok(app.saveData());

  app.openBudgetPeriod(10, 2026);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(app.AppState.expenses)), [{name: "שכר דירה", val: 4000}, {name: "ועד בית", val: 200}]);
  assert.strictEqual(app.sumArr(app.AppState.subscriptions), 50);
  assert.strictEqual(app.sumArr(app.AppState.insurances), 300);
  assert.strictEqual(app.AppState.income1[0].val, 0, "הכנסה מתחילה מ־0");
  assert.strictEqual(app.AppState.variableExpenses[0].name, "חשמל");
  assert.strictEqual(app.AppState.variableExpenses[0].val, 0, "הוצאה משתנה מתחילה מ־0");
  assert.strictEqual(app.sumArr(app.AppState.oneTimeExpenses), 0, "הוצאה מיוחדת אינה עוברת");
  assert.strictEqual(app.AppState.monthHasRecord, false);
  assert.deepStrictEqual(Object.keys(JSON.parse(app.store[app.STORAGE_KEY])), ["2026-09"], "צפייה אינה שומרת חודש");
});

test("חודש ראשון בלי היסטוריה נפתח עם ברירות המחדל", function() {
  var app = createApp();
  app.openBudgetPeriod(3, 2027);
  assert.strictEqual(app.AppState.income1[0].val, 0);
  assert.strictEqual(app.AppState.expenses.length, app.DEFAULT_EXPENSES.length);
});

test("דוח שנתי כולל החזרי הלוואות כמו התזרים החודשי", function() {
  var app = createApp();
  household(app, 10000, 2000);
  app.AppState.liabilities.loans = [{name: "הלוואה", balance: 50000, interest: 5, monthlyPayment: 1000, endDate: "", earlyPayoff: false}];
  app.calculate();
  app.saveData();
  var html = app.annualIncomeOverviewHtml(2026, 9);
  assert.ok(html.indexOf("₪3,000") >= 0, "היציאות החודשיות צריכות להיות 3,000");
  assert.strictEqual(app.AppState.result.balance, 7000);
});

test("דוח שנתי אינו סוכם שכר דירה כשהפרופיל אינו שוכר", function() {
  var app = createApp();
  household(app, 10000, 0);
  app.AppState.subscriptions = [];
  var legacyMonth = {income1: [{name: "משכורת", val: 10000}], expenses: [{name: "שכר דירה", val: 3500}]};
  var summary = app.savedMonthSummary(legacyMonth);
  assert.strictEqual(summary.livingExpenses, 0);
});

test("סכומים שליליים או לא תקינים נקראים כ־0", function() {
  var app = createApp();
  assert.strictEqual(app.toAmount("-3000"), 0);
  assert.strictEqual(app.toAmount("abc"), 0);
  assert.strictEqual(app.toAmount("1e400"), 0);
  assert.strictEqual(app.toAmount("1250.5"), 1250.5);
});

test("מספר רץ לחודש אינו תלוי ברשימת שנים קבועה", function() {
  var app = createApp();
  var index = app.periodIndex(3, 2029);
  assert.strictEqual(index % 12, 3);
  assert.strictEqual(Math.floor(index / 12), 2029);
});

test("סכום יומי מתחלק בימי חודש התקציב שנבחר", function() {
  var app = createApp();
  var today = new Date(2026, 9, 20);
  assert.strictEqual(app.remainingDaysInLocalMonth(app.budgetReferenceDate({month: 9, year: 2026}, today)), 12);
  assert.strictEqual(app.remainingDaysInLocalMonth(app.budgetReferenceDate({month: 10, year: 2026}, today)), 30);
});

test("כשל באחסון מדווח ואינו מוצג כהצלחה", function() {
  var app = createApp();
  app.localStorage.setItem = function() { throw new Error("QuotaExceededError"); };
  household(app, 1000, 0);
  app.calculate();
  assert.strictEqual(app.saveData(), false);
  assert.strictEqual(app.consumeStorageWriteFailure(), true);
  assert.strictEqual(app.consumeStorageWriteFailure(), false);
});

test("גיבוי ושחזור מחזירים את אותם נתונים", function() {
  var app = createApp();
  household(app, 8000, 1000);
  app.calculate();
  app.saveData();
  app.saveLiabilities();
  var backup = JSON.parse(JSON.stringify(app.buildBackup()));
  var checked = app.validateBackup(backup);
  assert.ok(!checked.error, checked.error);
  assert.strictEqual(checked.monthCount, 1);

  var other = createApp();
  other.localStorage.setItem(other.STORAGE_KEY, "{\"2020-01\":{}}");
  assert.ok(other.restoreBackupData(checked.data));
  assert.strictEqual(other.store[other.STORAGE_KEY], app.store[app.STORAGE_KEY]);
});

test("גיבוי פגום או זר נדחה", function() {
  var app = createApp();
  assert.ok(app.validateBackup({app: "other", version: 1, data: {}}).error);
  assert.ok(app.validateBackup({app: "shlita-finansit", version: 1, data: {unknownKey: "1"}}).error);
  assert.ok(app.validateBackup({app: "shlita-finansit", version: 1, data: {financialData_v2: "{bad json"}}).error);
  assert.ok(app.validateBackup(null).error);
});

test("אירוע היומן כולל תאריך נכון ותזכורת", function() {
  var app = createApp();
  var ics = app.meetingIcs(new Date(2026, 10, 10));
  assert.ok(ics.indexOf("DTSTART;VALUE=DATE:20261110") >= 0);
  assert.ok(ics.indexOf("DTEND;VALUE=DATE:20261111") >= 0);
  assert.ok(ics.indexOf("BEGIN:VALARM") >= 0 && ics.indexOf("TRIGGER;RELATED=START:PT9H") >= 0);
  assert.ok(/DTSTAMP:\d{8}T\d{6}Z/.test(ics), "חותמת זמן תקינה");
  var url = app.googleCalendarUrl(new Date(2026, 10, 10));
  assert.ok(url.indexOf("dates=20261110/20261111") >= 0);
});

/* תלוש מומצא במבנה של מלם שכר: אותן תוויות ומיקומים, סכומים בדויים */
function fakeMalamPayslipItems() {
  function t(s, x, y, w) { return {s: s, x: x, y: y, w: w || 30}; }
  return [
    t("ינואר 2027", 345, 775, 55),
    t("- ניכויי חובה -", 348, 496, 48),
    t("מס הכנסה", 330, 478, 31), t("1,100.00", 115, 478), t("0.00", 170, 478, 16), t("1,100.00", 226, 478),
    t("ביטוח לאומי", 325, 467, 36), t("400.00", 122, 467, 24), t("400.00", 233, 467, 24),
    t("ביטוח בריאות", 320, 457, 41), t("500.00", 122, 457, 24), t("500.00", 233, 457, 24),
    t("הפרשות מעסיק לגמל", 500, 459, 76),
    t("קרן פנסיה", 504, 449, 50), t("650.00", 480, 449, 24), t("6.50", 440, 449, 16),
    t("קרן פנסיה", 504, 438, 50), t("833.00", 480, 438, 24),
    t("כלל השתלמות", 511, 428, 43), t("750.00", 480, 428, 24),
    t("- קופות גמל -", 349, 433, 48),
    t("קרן פנסיה", 315, 412, 43), t("700.00", 118, 412, 24), t("10,000.00", 230, 412),
    t("כלל השתלמות", 316, 402, 43), t("250.00", 118, 402, 24),
    t("בסיס לפנסיה", 515, 407, 39), t("10,000.00", 470, 407),
    t('סה"כ ניכויים שוטף', 194, 373, 66),
    t("סך תשלומים", 266, 95, 33), t("ניכויי חובה", 229, 95, 28), t("שכר נטו", 191, 95, 21),
    t("ניכויי משרד", 148, 95, 30), t('ניכויי חו"ז', 109, 95, 25), t("סכום בבנק", 62, 95, 27),
    t("13,000.00", 267, 72), t("2,000.00", 229, 72, 26), t("11,000.00", 187, 72), t("0.00", 155, 72, 16),
    t("950.00", 109, 72, 26), t("10,050.00", 58, 70, 39)
  ];
}

test("קריאת תלוש: כל השדות מזוהים לפי התוויות", function() {
  var app = createApp();
  var r = app.parsePayslipItems(fakeMalamPayslipItems());
  assert.strictEqual(r.month, "ינואר 2027");
  assert.strictEqual(r.gross, 13000);
  assert.strictEqual(r.incomeTax, 1100);
  assert.strictEqual(r.nationalInsurance, 400);
  assert.strictEqual(r.health, 500);
  assert.strictEqual(r.mandatory, 2000);
  assert.strictEqual(r.net, 11000);
  assert.strictEqual(r.savings, 950);
  assert.strictEqual(r.bank, 10050);
  assert.strictEqual(r.pensionEmployee, 700);
  assert.strictEqual(r.studyEmployee, 250);
  assert.strictEqual(r.pensionEmployer, 1483);
  assert.strictEqual(r.studyEmployer, 750);
  assert.strictEqual(r.consistent, true);
});

test("קריאת תלוש: סכומים שלא מסתדרים מסומנים", function() {
  var app = createApp();
  var items = fakeMalamPayslipItems().map(function(item) { return item.s === "10,050.00" ? Object.assign({}, item, {s: "9,000.00"}) : item; });
  var r = app.parsePayslipItems(items);
  assert.strictEqual(r.bank, 9000);
  assert.strictEqual(r.consistent, false);
});

test("קריאת תלוש: קובץ בלי תוויות מוכרות לא מזוהה", function() {
  var app = createApp();
  var r = app.parsePayslipItems([{s: "מסמך אחר", x: 100, y: 500, w: 40}, {s: "1,234.00", x: 50, y: 480, w: 30}]);
  assert.strictEqual(r.found, false);
});

test("משכורת שהוסרה לא נספרת, והכנסה נוספת של אותו אדם כן", function() {
  var app = createApp();
  household(app, 0, 0);
  app.AppState.profile.single = false;
  app.AppState.income1 = [{name: "משכורת", val: 9000}];
  app.AppState.income2 = [{name: "משכורת", val: 7000}, {name: "שכירות", val: 1500}];
  app.AppState.profile.hiddenSalaries = {1: false, 2: true};
  app.calculate();
  assert.strictEqual(app.AppState.result.total, 10500);
  app.AppState.profile.hiddenSalaries[2] = false;
  app.calculate();
  assert.strictEqual(app.AppState.result.total, 17500);
});

var failed = 0;
tests.forEach(function(t) {
  try {
    t.fn();
    console.log("✓ " + t.name);
  } catch(e) {
    failed++;
    console.log("✗ " + t.name + "\n    " + e.message);
  }
});
console.log("\n" + (tests.length - failed) + "/" + tests.length + " passed");
process.exit(failed ? 1 : 0);
