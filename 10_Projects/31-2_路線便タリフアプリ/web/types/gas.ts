export type CompanyRow = {
  company_id: string;
  company_name: string;
  status: string;
};

export type TariffRow = {
  tariff_id: string;
  company_id: string;
  version: string;
  start_date: string;
  end_date: string;
  default_rounding_rule: string;
  vol_conversion_factor: number;
  weight_calculation_method: string;
  rounding_unit: number;
};

export type RegionRow = {
  region_id: string;
  tariff_id: string;
  prefecture: string;
  city: string;
  area_name: string;
  is_relay: boolean;
};

export type ConditionTierRow = {
  tier_id: string;
  tariff_id: string;
  condition_type: string;
  min_value: number;
  max_value: number | string;
  lower_inclusive: boolean;
  upper_inclusive: boolean;
  upper_unbounded: boolean;
};

export type FareTableRow = {
  record_id: string;
  tariff_id: string;
  region_from_id: string;
  region_to_id: string;
  tier_id: string;
  base_amount: number;
};

export type RuleRow = {
  rule_id: string;
  tariff_id: string;
  rule_name: string;
  group_logic: string;
  calculation_order: number;
  enabled: boolean;
};

export type RuleConditionRow = {
  condition_id: string;
  rule_id: string;
  condition_group_id: string;
  logic_type: string;
  condition_target: string;
  operator: string;
  condition_value: string;
  value_type: string;
};

export type RuleActionRow = {
  action_id: string;
  rule_id: string;
  action_type: string;
  action_value: string;
  calculation_target: string;
  source_field: string;
  subtract_value: number | string;
  threshold_value: number | string;
  unit_value: number | string;
  unit_type: string;
};

export type TestResultRow = {
  test_id: string;
  tariff_id: string;
  company_id: string;
  test_type: string;
  input_condition: string;
  expected_amount: string | number;
  actual_amount: string | number;
  status: string;
  error_message: string;
  executed_at: string;
  notes: string;
};

export type RawSheetData = {
  headers: string[];
  rows: unknown[][];
};

export type GasSuccessResponse = {
  ok: true;
  data: {
    "01_路線会社": RawSheetData;
    "02_タリフ基本": RawSheetData;
    "03_地域定義": RawSheetData;
    "04_条件帯定義": RawSheetData;
    "05_運賃表": RawSheetData;
    "06_ルール基本": RawSheetData;
    "07_ルール条件": RawSheetData;
    "08_ルール処理": RawSheetData;
    "09_テスト結果": RawSheetData;
  };
};

export type TariffData = {
  companies: CompanyRow[];
  tariffs: TariffRow[];
  regions: RegionRow[];
  conditionTiers: ConditionTierRow[];
  fareTables: FareTableRow[];
  rules: RuleRow[];
  ruleConditions: RuleConditionRow[];
  ruleActions: RuleActionRow[];
};

export type GasErrorResponse = {
  ok: false;
  error: string;
};

export type GasResponse = GasSuccessResponse | GasErrorResponse;
