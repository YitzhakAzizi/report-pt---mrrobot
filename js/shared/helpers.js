"use strict";

function audienceText(singleText, pluralText) {
  return AppState && AppState.profile && AppState.profile.single ? singleText : pluralText;
}

function sumArr(arr) {
  var t = 0;
  arr.forEach(function(item) { t += (Number(item.val) || 0); });
  return t;
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
