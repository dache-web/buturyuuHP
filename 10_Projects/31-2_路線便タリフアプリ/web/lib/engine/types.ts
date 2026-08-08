export interface CalculationInput {
  company_id: string;
  tariff_id: string;
  region_from: { prefecture: string; city: string; };
  region_to: { prefecture: string; city: string; };
  actual_weight: number;
  piece_count: number;
  volume_m3?: number;
}

export interface CalculationStep {
  step_type: 'BASE_FARE' | 'RULE_APPLIED' | 'ROUNDING' | 'EXCLUDE';
  description: string;
  amount_change: number;
  current_subtotal: number;
  metadata?: Record<string, unknown>;
}

export interface CalculationResult {
  ok: boolean;
  total_amount: number;
  steps: CalculationStep[];
  error?: string;
  tier_id?: string;
}

// Master Data Row Types
export interface TariffBaseRow {
  tariff_id: string;
  company_id: string;
  version: string;
  start_date: string;
  end_date: string;
  default_rounding_rule: string;
  vol_conversion_factor: number;
  weight_calculation_method: string;
  rounding_unit: number;
}

export interface RegionRow {
  region_id: string;
  tariff_id: string;
  region_name: string;
  prefecture: string;
  city: string;
  is_relay: boolean;
}

export interface TierRow {
  tier_id: string;
  tariff_id: string;
  condition_type: string;
  min_value: number;
  max_value: number;
  lower_inclusive: boolean;
  upper_inclusive: boolean;
  upper_unbounded: boolean;
}

export interface FareRow {
  record_id: string;
  tariff_id: string;
  region_from_id: string;
  region_to_id: string;
  tier_id: string;
  base_amount: number;
}

export interface RuleBaseRow {
  rule_id: string;
  tariff_id: string;
  rule_name: string;
  group_logic: string;
  calculation_order: number;
  enabled: boolean;
}

export interface RuleConditionRow {
  condition_id: string;
  rule_id: string;
  condition_group_id: string;
  logic_type: string;
  condition_target: string;
  operator: string;
  condition_value: string | number | boolean;
  value_type: string;
}

export interface RuleActionRow {
  action_id: string;
  rule_id: string;
  action_type: string;
  action_value: number | string;
  calculation_target: string;
  threshold_value: number;
  unit_value: number;
  unit_type: string;
  source_field: string;
  subtract_value: number;
}

export interface TariffMasterData {
  tariffs: TariffBaseRow[];
  regions: RegionRow[];
  tiers: TierRow[];
  fares: FareRow[];
  rules: RuleBaseRow[];
  conditions: RuleConditionRow[];
  actions: RuleActionRow[];
}

export interface CalculationContext {
  input: CalculationInput;
  master: TariffMasterData; 
  region_from_id: string;
  region_to_id: string;
  is_relay_to: boolean;
  tier_id: string;
  chargeable_weight: number;
  base_fare: number;
  subtotal: number;
  final_total: number;
  evaluated_rules: Set<string>;
  executed_actions: Set<string>;
  steps: CalculationStep[];
}
