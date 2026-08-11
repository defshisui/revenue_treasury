import type { LGUConfig } from "../types/treasury";

export function calculateRPT(
  config: LGUConfig,
  marketValue: number,
  assessmentLevel: number,
  isEarlyPayment: boolean,
  isDelinquent: boolean,
) {
  const assessedValue = marketValue * (assessmentLevel / 100);
  const basicTax = assessedValue * config.basicRptRate;
  const sefTax = assessedValue * config.sefRate;
  const specialLevy = assessedValue * config.specialLevyRate;

  let penalty = 0;
  let discount = 0;

  if (isDelinquent) {
    penalty = (basicTax + sefTax) * config.penaltyRatePerMonth * 3;
  } else if (isEarlyPayment) {
    discount = (basicTax + sefTax) * config.discountRateEarly;
  }

  const totalAssessment = Math.max(
    0,
    basicTax + sefTax + specialLevy + penalty - discount,
  );

  return { assessedValue, basicTax, sefTax, specialLevy, penalty, discount, totalAssessment };
}
