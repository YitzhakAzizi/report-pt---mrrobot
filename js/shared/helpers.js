"use strict";

function audienceText(singleText, pluralText) {
  return AppState && AppState.profile && AppState.profile.single ? singleText : pluralText;
}

/* השמות בגרסה האישית; אפשר לשנות אותם בלחיצה על השם במסך ההכנסות */
var DEFAULT_PERSON_NAMES = {1: "יצחק", 2: "הילה"};

/* שם בעל/ת ההכנסה כפי שהמשתמשים הזינו, או כינוי ניטרלי כברירת מחדל */
function personName(person) {
  var names = AppState && AppState.profile && AppState.profile.names || {};
  var name = String(names[person] || "").trim();
  return name || DEFAULT_PERSON_NAMES[person] || "בן/בת זוג " + person;
}

/* כותרת שורת המשכורת, כולה טקסט אחד שנערך בלחיצה ("משכורת יצחק").
   אם עוד לא נערכה, נבנית מהשם שנשמר בגרסה קודמת או משם ברירת המחדל */
function salaryLabel(person) {
  var labels = AppState && AppState.profile && AppState.profile.incomeLabels || {};
  var label = String(labels[person] || "").trim();
  return label || "משכורת " + personName(person);
}

function sumArr(arr) {
  var t = 0;
  arr.forEach(function(item) { t += (Number(item.val) || 0); });
  return t;
}

/* סכום שהוזן בשדה: מספר סופי שאינו שלילי, אחרת 0 */
function toAmount(value) {
  return parseNonNegativeNumber(value) || 0;
}

function parseNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  var number = Number(value);
  return isFinite(number) && number >= 0 ? number : null;
}

function isValidAllocationPercentages(percentages) {
  if (!percentages) return false;
  var invest = parseNonNegativeNumber(percentages.invest);
  var qualityOfLife = parseNonNegativeNumber(percentages.qualityOfLife);
  var spending = parseNonNegativeNumber(percentages.spending);
  if (invest === null || qualityOfLife === null || spending === null) return false;
  return Math.abs(invest + qualityOfLife + spending - 100) < 0.000000001;
}
