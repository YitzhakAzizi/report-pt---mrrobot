"use strict";

/* כל כתיבה לאחסון עוברת כאן, כדי שכשל שמירה לא יוצג למשתמש כהצלחה */
var storageWriteFailed = false;

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    storageWriteFailed = true;
    return false;
  }
}

function consumeStorageWriteFailure() {
  var failed = storageWriteFailed;
  storageWriteFailed = false;
  return failed;
}

function saveProfileSettings() {
  return writeStorage(PROFILE_SETTINGS_KEY, JSON.stringify(AppState.profile));
}

function loadProfileSettings() {
  try {
    var saved = JSON.parse(localStorage.getItem(PROFILE_SETTINGS_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    AppState.profile.single = saved.single === true;
    AppState.profile.renting = saved.renting === true;
    AppState.profile.mortgage = saved.mortgage === true;
    AppState.profile.children = saved.children === true;
    AppState.profile.loans = saved.loans === true;
    AppState.profile.debtStatus = saved.debtStatus === true;
  } catch(e) {}
}

var DOCUMENT_DB_NAME = "financialDocuments_v1";
var DOCUMENT_DB_STORE = "payslips";

function openDocumentDatabase() {
  return new Promise(function(resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    var request = window.indexedDB.open(DOCUMENT_DB_NAME, 1);
    request.onupgradeneeded = function() {
      var db = request.result;
      if (!db.objectStoreNames.contains(DOCUMENT_DB_STORE)) {
        db.createObjectStore(DOCUMENT_DB_STORE, {keyPath: "id"});
      }
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error || new Error("Unable to open document database")); };
  });
}

function payslipStorageId(person) {
  return AppState.period.year + "-" + AppState.period.month + "-" + person;
}

function getPayslipFile(person) {
  return openDocumentDatabase().then(function(db) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(DOCUMENT_DB_STORE, "readonly");
      var request = transaction.objectStore(DOCUMENT_DB_STORE).get(payslipStorageId(person));
      request.onsuccess = function() { resolve(request.result || null); };
      request.onerror = function() { reject(request.error); };
      transaction.oncomplete = function() { db.close(); };
    });
  });
}

function savePayslipFile(person, file) {
  return openDocumentDatabase().then(function(db) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(DOCUMENT_DB_STORE, "readwrite");
      transaction.objectStore(DOCUMENT_DB_STORE).put({
        id: payslipStorageId(person),
        person: person,
        budgetMonth: AppState.period.month,
        budgetYear: AppState.period.year,
        name: file.name,
        type: file.type,
        size: file.size,
        savedAt: Date.now(),
        file: file
      });
      transaction.oncomplete = function() { db.close(); resolve(); };
      transaction.onerror = function() { db.close(); reject(transaction.error); };
    });
  });
}

function deletePayslipFile(person) {
  return openDocumentDatabase().then(function(db) {
    return new Promise(function(resolve, reject) {
      var transaction = db.transaction(DOCUMENT_DB_STORE, "readwrite");
      transaction.objectStore(DOCUMENT_DB_STORE).delete(payslipStorageId(person));
      transaction.oncomplete = function() { db.close(); resolve(); };
      transaction.onerror = function() { db.close(); reject(transaction.error); };
    });
  });
}

function saveMaaser() {
  return writeStorage(MAASER_KEY, JSON.stringify(AppState.maaser));
}

function loadMaaserAccount() {
  try {
    var rawNew = localStorage.getItem(MAASER_KEY);
    if (rawNew) {
      var savedNew = JSON.parse(rawNew);
      AppState.maaser.enabled = savedNew.enabled === true;
      AppState.maaser.charities = Array.isArray(savedNew.charities) ? savedNew.charities.map(normalizeMaaserCharity) : [];
      removeLegacyEmptyMaaserCharity();
      ensureAtLeastOneMaaserCharity();
      return;
    }

    var rawLegacy = localStorage.getItem(MAASER_ACCOUNT_KEY);
    if (rawLegacy) {
      var saved = JSON.parse(rawLegacy);
      AppState.maaser.charities = [normalizeMaaserCharity({
        name: '', amount: 0, expanded: true,
        branch: saved.branch || '', account: saved.account || '', bank: saved.bank || '', owner: saved.owner || '', notes: ''
      })];
      saveMaaser();
      return;
    }
  } catch(e) {}
  ensureAtLeastOneMaaserCharity();
}

function ensureAtLeastOneMaaserCharity() {
  if (!Array.isArray(AppState.maaser.charities) || !AppState.maaser.charities.length) {
    AppState.maaser.charities = [normalizeMaaserCharity({})];
  }
}

function removeLegacyEmptyMaaserCharity() {
  if (AppState.maaser.charities.length !== 2) return;
  var first = AppState.maaser.charities[0];
  var isLegacyDefault = (!first.name || first.name === 'עמותה') &&
    !first.amount && !first.bank && !first.branch && !first.account && !first.owner && !first.notes;
  if (!isLegacyDefault) return;
  AppState.maaser.charities.splice(0, 1);
  saveMaaser();
}

function normalizeMaaserCharity(charity) {
  return {
    name: charity.name || '',
    amount: Number(charity.amount) || 0,
    expanded: charity.expanded !== false,
    bank: charity.bank || '',
    branch: charity.branch || '',
    account: charity.account || '',
    owner: charity.owner || '',
    notes: charity.notes || ''
  };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GOAL PERSISTENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function saveGoals() {
  return writeStorage(GOALS_KEY, JSON.stringify(AppState.goals));
}

function loadGoals() {
  try {
    var raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    ["checking", "fund", "invest"].forEach(function(k) {
      if (saved[k]) {
        var g = AppState.goals[k];
        g.current = saved[k].current || 0;
        g.completed = saved[k].completed || false;
        if (saved[k].target !== undefined) g.target = saved[k].target;
        if (k === "checking") {
          g.bank = saved[k].bank || "";
          g.account = saved[k].account || "";
        }
        if (k === "fund") {
          g.fundName = saved[k].fundName || "";
          g.fundNumber = saved[k].fundNumber || "";
          g.bank = saved[k].bank || "";
        }
        if (k === "invest") {
          g.house = saved[k].house || "";
          g.account = saved[k].account || "";
          g.notes = saved[k].notes || "";
        }
      }
    });
  } catch(e) {}
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. STORAGE SYNC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function getMonthKey(m, y) {
  return y + "-" + (m < 10 ? "0" + m : "" + m);
}

function getCurrentKey() {
  return getMonthKey(AppState.period.month, AppState.period.year);
}

function saveData() {
  try {
    var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all[getCurrentKey()] = {
      income1: AppState.income1,
      income2: AppState.income2,
      oneTimeExpenses: AppState.oneTimeExpenses,
      expenses: AppState.expenses,
      childrenExpenses: AppState.childrenExpenses,
      variableExpenses: AppState.variableExpenses,
      subscriptions: AppState.subscriptions,
      healthBeautyExpenses: AppState.healthBeautyExpenses,
      insurances: AppState.insurances,
      recoveryPayment: AppState.recoveryPayment
    };
    return writeStorage(STORAGE_KEY, JSON.stringify(all));
  } catch(e) {
    storageWriteFailed = true;
    return false;
  }
}

function loadData(month, year) {
  try {
    var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    var key = getMonthKey(month, year);
    var p = all[key];
    if (!p) return false;
    if (p.income1 && p.income1.length) AppState.income1 = p.income1;
    if (p.income2 && p.income2.length) AppState.income2 = p.income2;
    AppState.oneTimeExpenses = Array.isArray(p.oneTimeExpenses) ? p.oneTimeExpenses : clone(DEFAULT_ONE_TIME_EXPENSES);
    if (Array.isArray(p.expenses)) AppState.expenses = removeLegacyDefaultExpenses(p.expenses);
    AppState.childrenExpenses = Array.isArray(p.childrenExpenses) ? p.childrenExpenses.filter(function(item) {
      return item.name !== "הוצאות ילדים קבועות" || Number(item.val) > 0;
    }) : clone(DEFAULT_CHILDREN_EXPENSES);
    AppState.variableExpenses = Array.isArray(p.variableExpenses) ? normalizeLivingExpenses(p.variableExpenses) : clone(DEFAULT_VARIABLE_EXPENSES);
    AppState.subscriptions = Array.isArray(p.subscriptions) ? p.subscriptions : clone(DEFAULT_SUBSCRIPTIONS);
    AppState.healthBeautyExpenses = Array.isArray(p.healthBeautyExpenses) ? p.healthBeautyExpenses : clone(DEFAULT_HEALTH_BEAUTY_EXPENSES);
    AppState.insurances = Array.isArray(p.insurances) ? p.insurances.map(normalizeInsurance) : [];
    AppState.recoveryPayment = parseNonNegativeNumber(p.recoveryPayment);
    return true;
  } catch(e) {
    return false;
  }
}

function getSavedMonthData(month, year) {
  try {
    var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all[getMonthKey(month, year)] || null;
  } catch(e) {
    return null;
  }
}

function getPreviousVariableExpenseStats(expenseName, month, year) {
  try {
    var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    var selectedPeriodIndex = Number(year) * 12 + Number(month);
    var history = [];

    Object.keys(all).forEach(function(key) {
      var match = /^(\d{4})-(\d{2})$/.exec(key);
      if (!match) return;
      var savedYear = Number(match[1]);
      var savedMonth = Number(match[2]);
      if (savedMonth < 0 || savedMonth > 11 || savedYear * 12 + savedMonth >= selectedPeriodIndex) return;

      var monthData = all[key];
      var amount = (monthData && Array.isArray(monthData.variableExpenses) ? monthData.variableExpenses : []).reduce(function(total, item) {
        return item && item.name === expenseName ? total + (Number(item.val) || 0) : total;
      }, 0);
      if (amount > 0) history.push({periodIndex: savedYear * 12 + savedMonth, amount: amount});
    });

    if (!history.length) return null;
    history.sort(function(a, b) { return b.periodIndex - a.periodIndex; });
    var total = history.reduce(function(sum, entry) { return sum + entry.amount; }, 0);
    return {last: history[0].amount, average: total / history.length, count: history.length};
  } catch(e) {
    return null;
  }
}

function removeLegacyDefaultExpenses(expenses) {
  return expenses.filter(function(item) {
    if (item.customCategory) return true;
    return !LEGACY_DEFAULT_EXPENSES.some(function(def) {
      return normalizeExpenseName(item.name) === def.name && Number(item.val) === def.val;
    });
  });
}

function normalizeExpenseName(name) {
  return String(name || "")
    .replace(/\u05d9\u05e6\u05d7\u05e7/g, "בן זוג")
    .replace(/\u05d4\u05d9\u05dc\u05d4/g, "בת זוג");
}

function normalizeLivingExpenses(items) {
  var hasLegacyDefaults = items.some(function(item) {
    return item && !item.customCategory && (item.name === "מזון" || item.name === "דלק ותחבורה");
  });
  var normalized = items.map(function(item) {
    var name = item && item.name || "";
    var customCategory = !!(item && item.customCategory);
    if (!customCategory && (name === "מזון" || name === "קניות סופר - מזון ומוצרי ניקוי")) name = "קניות סופר (מזון ומוצרי ניקוי)";
    if (!customCategory && (name === "דלק" || name === "דלק ותחבורה")) name = "דלק / תחבורה";
    var normalizedItem = {name: name, val: Number(item && item.val) || 0};
    if (customCategory) {
      normalizedItem.customCategory = true;
      if (Array.isArray(item.items)) {
        normalizedItem.items = item.items.map(function(expense) {
          return {name: String(expense && expense.name || ""), val: Number(expense && expense.val) || 0};
        });
        normalizedItem.val = sumArr(normalizedItem.items);
      }
    }
    return normalizedItem;
  }).filter(function(item) {
    return item.customCategory || item.name !== "תרופות ובריאות" || item.val > 0;
  });

  var ordered = DEFAULT_VARIABLE_EXPENSES.filter(function(defaultItem) {
    return hasLegacyDefaults || normalized.some(function(item) { return !item.customCategory && item.name === defaultItem.name; });
  }).map(function(defaultItem) {
    var saved = normalized.find(function(item) { return !item.customCategory && item.name === defaultItem.name; });
    return saved || clone(defaultItem);
  });
  normalized.forEach(function(item) {
    var isDefault = DEFAULT_VARIABLE_EXPENSES.some(function(defaultItem) { return defaultItem.name === item.name; });
    if (item.customCategory || !isDefault) ordered.push(item);
  });
  return ordered;
}

function normalizeInsurance(insurance) {
  return {
    name: insurance.name || "",
    provider: insurance.provider || "",
    endDate: insurance.endDate || "",
    val: Number(insurance.val) || 0
  };
}
function saveDreams() {
  return writeStorage(DREAMS_KEY, JSON.stringify(AppState.dreams));
}

function loadDreams() {
  try {
    var raw = localStorage.getItem(DREAMS_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    if (Array.isArray(saved)) AppState.dreams = sortDreams(saved);
  } catch(e) {}
}

function saveMaaserPercentage() {
  return writeStorage(MAASER_PERCENTAGE_KEY, String(AppState.settings.maaserPercent));
}

function saveAllocationPercentages() {
  return writeStorage(ALLOCATION_PERCENTAGES_KEY, JSON.stringify(AppState.settings.allocation));
}

function loadPercentageSettings() {
  AppState.settings.maaserPercent = DEFAULT_MAASER_PERCENTAGE;
  AppState.settings.allocation = clone(DEFAULT_ALLOCATION_PERCENTAGES);

  try {
    var savedMaaserPercent = parseNonNegativeNumber(localStorage.getItem(MAASER_PERCENTAGE_KEY));
    if (savedMaaserPercent !== null) AppState.settings.maaserPercent = savedMaaserPercent;
  } catch(e) {}

  try {
    var rawAllocation = localStorage.getItem(ALLOCATION_PERCENTAGES_KEY);
    if (!rawAllocation) return;
    var savedAllocation = JSON.parse(rawAllocation);
    if (isValidAllocationPercentages(savedAllocation)) {
      AppState.settings.allocation = {
        invest: Number(savedAllocation.invest),
        qualityOfLife: Number(savedAllocation.qualityOfLife),
        spending: Number(savedAllocation.spending)
      };
    }
  } catch(e) {}
}

function saveLiabilities() {
  return writeStorage(LIABILITIES_KEY, JSON.stringify(AppState.liabilities));
}

function loadLiabilities() {
  AppState.liabilities = {loans: [], debts: [], mortgages: [], overdraft: 0};
  try {
    var raw = localStorage.getItem(LIABILITIES_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    AppState.liabilities.loans = Array.isArray(saved.loans) ? saved.loans.map(normalizeLoan) : [];
    AppState.liabilities.debts = Array.isArray(saved.debts) ? saved.debts.map(normalizeDebt) : [];
    AppState.liabilities.mortgages = Array.isArray(saved.mortgages) ? saved.mortgages.map(normalizeMortgage) : [];
    AppState.liabilities.overdraft = parseNonNegativeNumber(saved.overdraft) || 0;
  } catch(e) {
    AppState.liabilities = {loans: [], debts: [], mortgages: [], overdraft: 0};
  }
}

function normalizeLoan(loan) {
  return {
    name: String(loan && loan.name || ""),
    balance: Math.max(0, Number(loan && loan.balance) || 0),
    interest: Math.max(0, Number(loan && loan.interest) || 0),
    monthlyPayment: Math.max(0, Number(loan && loan.monthlyPayment) || 0),
    endDate: String(loan && loan.endDate || ""),
    earlyPayoff: !!(loan && loan.earlyPayoff)
  };
}

function normalizeDebt(debt) {
  return {
    name: String(debt && debt.name || ""),
    balance: Math.max(0, Number(debt && debt.balance) || 0),
    interest: Math.max(0, Number(debt && debt.interest) || 0),
    minimumPayment: Math.max(0, Number(debt && debt.minimumPayment) || 0),
    targetDate: String(debt && debt.targetDate || "")
  };
}

function normalizeMortgage(mortgage) {
  return {
    name: String(mortgage && mortgage.name || ""),
    balance: Math.max(0, Number(mortgage && mortgage.balance) || 0),
    interest: Math.max(0, Number(mortgage && mortgage.interest) || 0),
    monthlyPayment: Math.max(0, Number(mortgage && mortgage.monthlyPayment) || 0),
    interestType: mortgage && mortgage.interestType === "variable" ? "variable" : "fixed",
    indexed: !!(mortgage && mortgage.indexed),
    yearsRemaining: Math.max(0, Number(mortgage && mortgage.yearsRemaining) || 0),
    nextRateChange: String(mortgage && mortgage.nextRateChange || "")
  };
}
