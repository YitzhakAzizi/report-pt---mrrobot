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
  profile: {single: false, renting: false, mortgage: false, children: false, loans: false, debtStatus: false},
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
}
