"use strict";

function estimateInvestmentFees(record, years, annualReturn) {
  if (!record || (record.depositFee === null && record.balanceFee === null)) return null;
  var months = Math.round(Number(years) * 12);
  var grossReturn = Number(annualReturn);
  if (!isFinite(months) || months < 12 || months > 600 || !isFinite(grossReturn) || grossReturn < -50 || grossReturn > 50) return null;

  var startingBalance = Number(record.balance) || 0;
  var monthlyDeposit = (Number(record.personalDeposit) || 0) + (Number(record.employerDeposit) || 0);
  var depositFeeRate = (Number(record.depositFee) || 0) / 100;
  var annualBalanceFeeRate = (Number(record.balanceFee) || 0) / 100;
  var monthlyReturnRate = Math.pow(1 + grossReturn / 100, 1 / 12) - 1;
  var monthlyBalanceFeeRate = annualBalanceFeeRate / 12;
  var withoutFees = startingBalance;
  var withFees = startingBalance;

  for (var month = 0; month < months; month++) {
    withoutFees = withoutFees * (1 + monthlyReturnRate) + monthlyDeposit;
    withFees = withFees * (1 + monthlyReturnRate) * (1 - monthlyBalanceFeeRate) + monthlyDeposit * (1 - depositFeeRate);
  }
  if (!isFinite(withoutFees) || !isFinite(withFees)) return null;
  return {
    currentAnnualEstimate: startingBalance * annualBalanceFeeRate + monthlyDeposit * 12 * depositFeeRate,
    withoutFees: withoutFees,
    withFees: withFees,
    difference: Math.max(0, withoutFees - withFees)
  };
}
