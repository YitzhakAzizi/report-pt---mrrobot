"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var AppState = {
  period: { month: new Date().getMonth(), year: new Date().getFullYear() },
  income1: [{name: "משכורת", val: 0}],
  income2: [{name: "משכורת", val: 0}],
  oneTimeExpenses: clone(DEFAULT_ONE_TIME_EXPENSES),
  expenses: clone(DEFAULT_EXPENSES),
  childrenExpenses: clone(DEFAULT_CHILDREN_EXPENSES),
  variableExpenses: clone(DEFAULT_VARIABLE_EXPENSES),
  subscriptions: clone(DEFAULT_SUBSCRIPTIONS),
  healthBeautyExpenses: clone(DEFAULT_HEALTH_BEAUTY_EXPENSES),
  insurances: [],
  investments: {},
  liabilities: {loans: [], debts: [], mortgages: [], overdraft: 0},
  recoveryPayment: null,
  /* "הגדרה אישית": חלוקה בסכומים שמוזנים ידנית, לכל חודש בנפרד */
  customAllocation: {active: false, amounts: {invest: 0, qualityOfLife: 0, spending: 0}},
  monthHasRecord: false,
  dreams: [],
  goals: {
    checking: {current: 0, target: 0, completed: false, bank: "", account: ""},
    fund:     {current: 0, target: 0, completed: false, fundName: "", fundNumber: "", bank: ""},
    invest:   {current: 0, target: 0, completed: false, house: "", account: "", notes: ""}
  },
  result: {
    s1: 0, s2: 0, total: 0, exp: 0, subscriptionExpenses: 0, healthBeautyExpenses: 0, insurance: 0, maaser: 0, balance: 0,
    loanPayments: 0, debtPayments: 0, mortgagePayments: 0, liabilityPayments: 0,
    priorityDebt: null
  },
  maaser: {enabled: false, charities: []},
  maaserAccount: {branch: "", account: "", bank: "", owner: ""},
  profile: {single: false, renting: false, mortgage: false, children: false, loans: false, debtStatus: false, names: {1: "", 2: ""}, incomeLabels: {1: "", 2: ""}, hiddenSalaries: {1: false, 2: false}, hiddenFixedCategories: {}},
  settings: {
    maaserPercent: DEFAULT_MAASER_PERCENTAGE,
    allocation: clone(DEFAULT_ALLOCATION_PERCENTAGES)
  }
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. UPDATE — single mutation gate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function updateState(path, value) {
  var parts = path.split(".");
  var node = AppState;
  for (var i = 0; i < parts.length - 1; i++) {
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
  pipeline();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. PIPELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function pipeline() {
  calculate();
  if (AppState.goalCompletionAdjusted) {
    saveGoals();
    AppState.goalCompletionAdjusted = false;
  }
  render();
  saveData();
  flashSaved();
}

/* חישוב ותצוגה בלי לשמור: משמש בפתיחת חודש לצפייה */
function refreshWithoutSaving() {
  calculate();
  if (AppState.goalCompletionAdjusted) {
    saveGoals();
    AppState.goalCompletionAdjusted = false;
  }
  render();
  if (storageWriteFailed) flashSaved();
}

function resetToDefaults() {
  AppState.income1 = [{name: "משכורת", val: 0}];
  AppState.income2 = [{name: "משכורת", val: 0}];
  AppState.oneTimeExpenses = clone(DEFAULT_ONE_TIME_EXPENSES);
  AppState.expenses = clone(DEFAULT_EXPENSES);
  AppState.childrenExpenses = clone(DEFAULT_CHILDREN_EXPENSES);
  AppState.variableExpenses = clone(DEFAULT_VARIABLE_EXPENSES);
  AppState.subscriptions = clone(DEFAULT_SUBSCRIPTIONS);
  AppState.healthBeautyExpenses = clone(DEFAULT_HEALTH_BEAUTY_EXPENSES);
  AppState.insurances = [];
  AppState.recoveryPayment = null;
  AppState.customAllocation = emptyCustomAllocation();
  if (AppState.maaser) AppState.maaser.enabled = false;
}

function emptyCustomAllocation() {
  return {active: false, amounts: {invest: 0, qualityOfLife: 0, spending: 0}};
}

/* סכומי החלוקה בפועל: בהגדרה אישית הסכומים שהוזנו, אחרת לפי האחוזים של הבחירה */
function allocationAmounts(balance) {
  var custom = AppState.customAllocation;
  if (custom && custom.active) {
    return {invest: custom.amounts.invest || 0, qualityOfLife: custom.amounts.qualityOfLife || 0, spending: custom.amounts.spending || 0};
  }
  var allocation = AppState.settings.allocation;
  return {
    invest: percentageOf(balance, allocation.invest),
    qualityOfLife: percentageOf(balance, allocation.qualityOfLife),
    spending: percentageOf(balance, allocation.spending)
  };
}
