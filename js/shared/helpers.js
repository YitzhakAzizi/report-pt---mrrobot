"use strict";

function audienceText(singleText, pluralText) {
  return AppState && AppState.profile && AppState.profile.single ? singleText : pluralText;
}

/* שם בעל/ת ההכנסה כפי שהמשתמשים הזינו, או כינוי ניטרלי כברירת מחדל */
function personName(person) {
  var names = AppState && AppState.profile && AppState.profile.names || {};
  var name = String(names[person] || "").trim();
  return name || "בן/בת זוג " + person;
}

function salaryLabel(person) {
  var salaryMonth = MONTHS[(AppState.period.month + 11) % 12];
  return "משכורת " + salaryMonth + (AppState.profile.single ? "" : " - " + personName(person));
}

function sumArr(arr) {
  var t = 0;
  arr.forEach(function(item) { t += (Number(item.val) || 0); });
  return t;
}

/* סכום שהוזן בשדה: מספר סופי שאינו שלילי, אחרת 0 */
function toAmount(value) {
  var number = parseFloat(value);
  return isFinite(number) && number > 0 ? number : 0;
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
