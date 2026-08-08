import { CalculationContext } from './types';

export function determineTier(context: CalculationContext) {
  const { master, input } = context;
  const tariff = master.tariffs[0];

  // 1. Calculate chargeable weight
  if (input.actual_weight < 0 || isNaN(input.actual_weight) || !isFinite(input.actual_weight)) {
    throw new Error("Invalid actual_weight");
  }
  if (input.piece_count < 0 || isNaN(input.piece_count) || !isFinite(input.piece_count)) {
    throw new Error("Invalid piece_count");
  }

  const volFactor = tariff.vol_conversion_factor;
  if (!volFactor || volFactor <= 0 || isNaN(volFactor)) {
    throw new Error("マスタ異常: vol_conversion_factorが不正です");
  }

  let chargeableWeight = input.actual_weight;

  if (tariff.weight_calculation_method === 'volumetric' || tariff.weight_calculation_method === 'max') {
    if (input.volume_m3 === undefined || input.volume_m3 < 0 || isNaN(input.volume_m3) || !isFinite(input.volume_m3)) {
      throw new Error("Invalid volume_m3: required for volumetric/max calculation");
    }
    const volWeight = input.volume_m3 * volFactor;
    
    if (tariff.weight_calculation_method === 'volumetric') {
      chargeableWeight = volWeight;
    } else {
      chargeableWeight = Math.max(input.actual_weight, volWeight);
    }
  } else if (tariff.weight_calculation_method !== 'actual') {
    throw new Error(`未知のweight_calculation_method: ${tariff.weight_calculation_method}`);
  }

  context.chargeable_weight = chargeableWeight;

  // 2. Determine Tier
  const matchingTiers = master.tiers.filter(tier => {
    let lowerPass = false;
    if (tier.lower_inclusive) {
      lowerPass = chargeableWeight >= tier.min_value;
    } else {
      lowerPass = chargeableWeight > tier.min_value;
    }

    let upperPass = false;
    if (tier.upper_unbounded) {
      upperPass = true;
    } else {
      if (tier.upper_inclusive) {
        upperPass = chargeableWeight <= tier.max_value;
      } else {
        upperPass = chargeableWeight < tier.max_value;
      }
    }

    return lowerPass && upperPass;
  });

  if (matchingTiers.length === 0) {
    throw new Error(`条件帯が見つかりません（計算範囲外）: 重量 ${chargeableWeight}`);
  }
  if (matchingTiers.length > 1) {
    throw new Error("マスタ異常: 条件帯が重複しています");
  }

  context.tier_id = matchingTiers[0].tier_id;
}
