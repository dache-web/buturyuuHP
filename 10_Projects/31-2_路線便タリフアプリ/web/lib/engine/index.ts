import { CalculationInput, CalculationResult } from './types';
import { createCalculationContext } from './context';
import { determineRegions } from './region';
import { determineTier } from './tier';
import { determineBaseFare } from './fare';
import { applyRules } from './rules';
import { TariffData } from '../../types/gas';

export function calculateTariff(input: CalculationInput, rawData: TariffData): CalculationResult {
  try {
    // 1. Context initialization & validation
    const context = createCalculationContext(input, rawData);
    const tariff = context.master.tariffs[0];

    // 2. Determine Region
    determineRegions(context);

    // 3. Determine Tier (calculates chargeable_weight)
    determineTier(context);

    // 4. Pre-Fare Rules (exclude etc. with calculation_target = 'all')
    try {
      applyRules(context, 'all');
    } catch (e: unknown) {
      if (e instanceof Error && e.message && e.message.startsWith('EXCLUDE:')) {
        return {
          ok: false,
          total_amount: 0,
          steps: context.steps,
          error: e.message.replace('EXCLUDE: ', '')
        };
      }
      throw e;
    }

    // 5. Determine Base Fare
    determineBaseFare(context);

    // 6. Subtotal Rules (additions/subtractions)
    applyRules(context, 'subtotal');

    // 7. Final Total Rules (min_fare etc.)
    applyRules(context, 'final_total');

    // 8. Rounding
    let finalAmount = context.subtotal;
    const rUnit = tariff.rounding_unit;
    if (rUnit === undefined || isNaN(rUnit) || rUnit <= 0) {
      throw new Error("マスタ異常: rounding_unitが不正です");
    }

    const rule = tariff.default_rounding_rule;
    if (rule === 'round') {
      finalAmount = Math.round(finalAmount / rUnit) * rUnit;
    } else if (rule === 'floor') {
      finalAmount = Math.floor(finalAmount / rUnit) * rUnit;
    } else if (rule === 'ceil') {
      finalAmount = Math.ceil(finalAmount / rUnit) * rUnit;
    } else {
      throw new Error(`未知の default_rounding_rule: ${rule}`);
    }

    const roundingDiff = finalAmount - context.subtotal;
    if (roundingDiff !== 0) {
      context.steps.push({
        step_type: 'ROUNDING',
        description: '端数処理',
        amount_change: roundingDiff,
        current_subtotal: finalAmount
      });
    }

    return {
      ok: true,
      total_amount: finalAmount,
      steps: context.steps,
      tier_id: context.tier_id
    };
  } catch (error: unknown) {
    return {
      ok: false,
      total_amount: 0,
      steps: [], // or context.steps if we want partial history
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export * from './types';
