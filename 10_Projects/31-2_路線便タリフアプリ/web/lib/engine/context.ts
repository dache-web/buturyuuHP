import { CalculationInput, CalculationContext, TariffMasterData } from './types';
import type { TariffData } from '../../types/gas';

export function createCalculationContext(input: CalculationInput, rawData: TariffData): CalculationContext {
  // Extract tariffs
  const allTariffs = rawData.tariffs.map(r => ({
    tariff_id: String(r.tariff_id),
    company_id: String(r.company_id),
    version: String(r.version),
    start_date: String(r.start_date),
    end_date: String(r.end_date),
    default_rounding_rule: String(r.default_rounding_rule),
    vol_conversion_factor: Number(r.vol_conversion_factor),
    weight_calculation_method: String(r.weight_calculation_method || 'actual'),
    rounding_unit: Number(r.rounding_unit || 1)
  }));

  const tariffs = allTariffs.filter(t => t.tariff_id === input.tariff_id);

  if (tariffs.length === 0) {
    throw new Error(`Tariff not found: ${input.tariff_id}`);
  }
  if (tariffs.length > 1) {
    throw new Error(`Master data error: Multiple tariffs found for ${input.tariff_id}`);
  }

  const tariff = tariffs[0];
  if (tariff.company_id !== input.company_id) {
    throw new Error(`Company ID mismatch: expected ${tariff.company_id}, got ${input.company_id}`);
  }

  // Extract other master data
  const regions = rawData.regions
    .filter(r => r.tariff_id === input.tariff_id)
    .map(r => ({
      region_id: String(r.region_id),
      tariff_id: String(r.tariff_id),
      region_name: String(r.area_name), // Or whatever corresponds
      prefecture: String(r.prefecture),
      city: String(r.city),
      is_relay: Boolean(r.is_relay)
    }));

  const tiers = rawData.conditionTiers
    .filter(r => r.tariff_id === input.tariff_id)
    .map(r => ({
      tier_id: String(r.tier_id),
      tariff_id: String(r.tariff_id),
      condition_type: String(r.condition_type),
      min_value: Number(r.min_value),
      max_value: Number(r.max_value),
      lower_inclusive: Boolean((r as Record<string, unknown>).lower_inclusive ?? true), // fallback for Phase 1
      upper_inclusive: Boolean((r as Record<string, unknown>).upper_inclusive ?? true),
      upper_unbounded: Boolean((r as Record<string, unknown>).upper_unbounded ?? false)
    }));

  const fares = rawData.fareTables
    .filter(r => r.tariff_id === input.tariff_id)
    .map(r => ({
      record_id: String(r.record_id),
      tariff_id: String(r.tariff_id),
      region_from_id: String(r.region_from_id),
      region_to_id: String(r.region_to_id),
      tier_id: String(r.tier_id),
      base_amount: Number(r.base_amount)
    }));

  const rules = rawData.rules
    .filter(r => r.tariff_id === input.tariff_id)
    .map(r => ({
      rule_id: String(r.rule_id),
      tariff_id: String(r.tariff_id),
      rule_name: String(r.rule_name),
      group_logic: String(r.group_logic),
      calculation_order: Number(r.calculation_order),
      enabled: Boolean(r.enabled)
    }));

  const ruleIds = new Set(rules.map(r => r.rule_id));

  const conditions = rawData.ruleConditions
    .filter(r => ruleIds.has(String(r.rule_id)))
    .map(r => ({
      condition_id: String(r.condition_id),
      rule_id: String(r.rule_id),
      condition_group_id: String(r.condition_group_id),
      logic_type: String(r.logic_type),
      condition_target: String(r.condition_target),
      operator: String(r.operator),
      condition_value: String(r.value_type) === 'number' ? Number(r.condition_value) : String(r.value_type) === 'boolean' ? (String(r.condition_value).toUpperCase() === 'TRUE') : String(r.condition_value),
      value_type: String(r.value_type)
    }));

  const actions = rawData.ruleActions
    .filter(r => ruleIds.has(String(r.rule_id)))
    .map(r => ({
      action_id: String(r.action_id),
      rule_id: String(r.rule_id),
      action_type: String(r.action_type),
      action_value: r.action_value,
      calculation_target: String(r.calculation_target),
      threshold_value: Number(r.threshold_value || 0),
      unit_value: Number(r.unit_value || 0),
      unit_type: String(r.unit_type || ''),
      source_field: String((r as Record<string, unknown>).source_field || ''),
      subtract_value: Number((r as Record<string, unknown>).subtract_value || 0)
    }));

  const master: TariffMasterData = { tariffs, regions, tiers, fares, rules, conditions, actions };

  return {
    input,
    master,
    region_from_id: '',
    region_to_id: '',
    is_relay_to: false,
    tier_id: '',
    chargeable_weight: 0,
    base_fare: 0,
    subtotal: 0,
    final_total: 0,
    evaluated_rules: new Set<string>(),
    executed_actions: new Set<string>(),
    steps: []
  };
}
