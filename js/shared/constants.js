"use strict";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONSTANTS & CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

var DEFAULT_EXPENSES = [
  {name: "ועד בית / מיסי יישוב", val: 0}
];
var DEFAULT_CHILDREN_EXPENSES = [
  {name: "מסגרות וחינוך", val: 0},
  {name: "צהרון או מטפלת", val: 0},
  {name: "חוגים", val: 0}
];
var DEFAULT_ONE_TIME_EXPENSES = [
  {name: "טיפול או תיקון לרכב", val: 0},
  {name: "טכנאי / מתקין / בעל מקצוע", val: 0},
  {name: "תיקון או רכישה חיונית לבית", val: 0},
  {name: "הוצאה רפואית חד-פעמית", val: 0}
];
var DEFAULT_VARIABLE_EXPENSES = [
  {name: "דלק / תחבורה", val: 0},
  {name: "קניות סופר (מזון ומוצרי ניקוי)", val: 0},
  {name: "חשמל", val: 0},
  {name: "מים", val: 0},
  {name: "גז", val: 0},
  {name: "ארנונה", val: 0}
];
var HOUSING_UTILITY_NAMES = ["חשמל", "מים", "גז", "ארנונה"];
var FUEL_EXPENSE_NAMES = ["דלק / תחבורה"];
var SUPERMARKET_EXPENSE_NAMES = ["קניות סופר (מזון ומוצרי ניקוי)"];
var DEFAULT_SUBSCRIPTIONS = [
  {name: "אינטרנט", val: 0},
  {name: "סלולר", val: 0},
  {name: "Netflix", val: 0},
  {name: "צפייה ומוזיקה", val: 0},
  {name: "חדר כושר / סטודיו", val: 0},
  {name: "תוכנות ואפליקציות", val: 0}
];
var DEFAULT_HEALTH_BEAUTY_EXPENSES = [
  {name: "תרופות", val: 0},
  {name: "טיפולים רפואיים", val: 0},
  {name: "טיפולי שיניים", val: 0},
  {name: "מספרה", val: 0},
  {name: "קוסמטיקה וטיפוח", val: 0}
];

var LEGACY_DEFAULT_EXPENSES = [
  {name: "ביטוח רכב (בן זוג)", val: 250},
  {name: "ביטוח רכב (בת זוג)", val: 450},
  {name: "ציפורניים", val: 250},
  {name: "שכר דירה", val: 3500},
  {name: "פלאפון", val: 21.9},
  {name: "יוטיוב פרימיום", val: 30},
  {name: "חדר כושר וסטודיו", val: 125},
  {name: "קורס אנגלית", val: 180},
  {name: "אינטרנט", val: 95},
  {name: "אוכל", val: 2000},
  {name: "דלק (בן זוג)", val: 1000},
  {name: "דלק (בת זוג)", val: 500},
  {name: "מים וחשמל", val: 350}
];

/* 3 goals only. auto=true means target is auto-calculated from expenses × multiplier */
var GOAL_DEFS = [
  {id: "checking", emoji: "account_balance", name: "עובר ושב", auto: true, multiplier: 2, desc: "מכסת שני חודשי מחיה ללא הכנסות", horizon: "טווח קצר"},
  {id: "fund",     emoji: "shield", name: "קרן חירום", auto: true, multiplier: 4, desc: "מכסת ארבעה חודשי מחיה ללא הכנסות", horizon: "טווח בינוני"},
  {id: "invest",   emoji: "trending_up", name: "קרן השקעות", auto: true, multiplier: 300, desc: "יציאה לחופש כלכלי", horizon: "טווח ארוך"}
];

var FINANCIAL_INSTITUTIONS = [
  {name: "בנק הפועלים", logo: "assets/banks/hapoalim.png"},
  {name: "בנק לאומי", logo: "assets/banks/leumi.png"},
  {name: "Pepper", logo: "assets/banks/pepper.png"},
  {name: "בנק דיסקונט", logo: "assets/banks/discount.png"},
  {name: "מזרחי טפחות", logo: "assets/banks/mizrahi.png"},
  {name: "הבנק הבינלאומי", logo: "assets/banks/fibi.png"},
  {name: "מרכנתיל", logo: "assets/banks/mercantile.png"},
  {name: "בנק יהב", logo: "assets/banks/yahav.png"},
  {name: "בנק מסד", logo: "assets/banks/massad.svg"},
  {name: "בנק ירושלים", logo: "assets/banks/jerusalem.png"},
  {name: "ONE ZERO", logo: "assets/banks/one-zero.png"},
  {name: "Esh Bank", logo: "assets/banks/esh.png"},
  {name: "אוצר החייל", logo: "assets/banks/otsar.png"},
  {name: "פאג״י", logo: "assets/banks/pagi.png"},
  {name: "בנק הדואר", logo: "assets/banks/postal.png"}
];

var STORAGE_KEY = "financialData_v2";
var GOALS_KEY = "goalsData_v1";
var MAASER_ACCOUNT_KEY = "maaserAccount_v1";
var MAASER_KEY = "maaserData_v2";
var DREAMS_KEY = "dreamsData_v1";
var MAASER_PERCENTAGE_KEY = "maaserPercentage_v1";
var ALLOCATION_PERCENTAGES_KEY = "allocationPercentages_v1";
var LIABILITIES_KEY = "liabilitiesData_v1";
var PROFILE_SETTINGS_KEY = "profileSettings_v1";
var INVESTMENTS_OVERVIEW_KEY = "investmentsOverview_v1";

var INVESTMENT_PRODUCT_DEFS = [
  {id: "pension", name: "קרן פנסיה", icon: "savings", employer: true},
  {id: "training", name: "קרן השתלמות", icon: "school", employer: true},
  {id: "cash", name: "קרן כספית", icon: "account_balance", employer: false},
  {id: "gemel", name: "קופת גמל", icon: "assured_workload", employer: true},
  {id: "gemelInvest", name: "קופת גמל להשקעה", icon: "trending_up", employer: false},
  {id: "portfolio", name: "תיק השקעות", icon: "monitoring", employer: false}
];

var DEFAULT_MAASER_PERCENTAGE = 10;
var DEFAULT_ALLOCATION_PERCENTAGES = {invest: 50, qualityOfLife: 20, spending: 30};
var ALLOCATION_MODES = [
  {id: "today", name: "חודש מפנק", allocation: {invest: 30, qualityOfLife: 30, spending: 40}},
  {id: "balanced", name: "חודש מאוזן", allocation: {invest: 50, qualityOfLife: 20, spending: 30}},
  {id: "future", name: "חודש מחושב", allocation: {invest: 70, qualityOfLife: 15, spending: 15}}
];
/* הוצאות משתנות כרשימה אחת (כל פריט בשורה משלו, עם עריכה ישירה) במקום קטגוריות.
   false מחזיר את התצוגה הקודמת בקטגוריות (חיובי דיור, דלק, סופר) */
var FLAT_VARIABLE_EXPENSES = true;

var DEFAULT_DEBT_PLAN_PERCENTAGES = {debt: 70, spending: 30};
