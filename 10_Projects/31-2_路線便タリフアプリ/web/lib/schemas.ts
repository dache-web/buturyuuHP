import { z } from "zod";

const booleanSchema = z.preprocess(
  (val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      return lower === "true";
    }
    return false;
  },
  z.boolean()
);

const dateStringSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      return val.replace(/\//g, "-");
    }
    return val;
  },
  z.string()
);

const strictNumberSchema = z.preprocess((val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return val; // Let it fall through to fail z.number() if not explicitly allowed
    const parsed = Number(trimmed);
    if (!isNaN(parsed)) return parsed;
  }
  return val;
}, z.number());

const positiveStrictNumberSchema = z.preprocess((val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return val;
    const parsed = Number(trimmed);
    if (!isNaN(parsed)) return parsed;
  }
  return val;
}, z.number().positive());

const numberOrEmptyStringSchema = z.preprocess((val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return "";
    const parsed = Number(trimmed);
    if (!isNaN(parsed)) return parsed;
  }
  return val;
}, z.union([z.number(), z.literal("")]));

const numberOrStringSchema = z.union([z.number(), z.string()]);

export const companyRowSchema = z.object({
  company_id: z.coerce.string(),
  company_name: z.coerce.string(),
  status: z.coerce.string(),
});

export const tariffRowSchema = z.object({
  tariff_id: z.coerce.string(),
  company_id: z.coerce.string(),
  version: z.coerce.string(),
  start_date: dateStringSchema,
  end_date: dateStringSchema,
  default_rounding_rule: z.coerce.string(),
  vol_conversion_factor: strictNumberSchema,
  weight_calculation_method: z.coerce.string(),
  rounding_unit: positiveStrictNumberSchema,
});

export const regionRowSchema = z.object({
  region_id: z.coerce.string(),
  tariff_id: z.coerce.string(),
  prefecture: z.coerce.string(),
  city: z.coerce.string(),
  area_name: z.coerce.string(),
  is_relay: booleanSchema,
});

export const conditionTierRowSchema = z.object({
  tier_id: z.coerce.string(),
  tariff_id: z.coerce.string(),
  condition_type: z.coerce.string(),
  min_value: strictNumberSchema,
  max_value: numberOrEmptyStringSchema,
  lower_inclusive: booleanSchema,
  upper_inclusive: booleanSchema,
  upper_unbounded: booleanSchema,
});

export const fareTableRowSchema = z.object({
  record_id: z.coerce.string(),
  tariff_id: z.coerce.string(),
  region_from_id: z.coerce.string(),
  region_to_id: z.coerce.string(),
  tier_id: z.coerce.string(),
  base_amount: strictNumberSchema,
});

export const ruleRowSchema = z.object({
  rule_id: z.coerce.string(),
  tariff_id: z.coerce.string(),
  rule_name: z.coerce.string(),
  group_logic: z.coerce.string(),
  calculation_order: strictNumberSchema,
  enabled: booleanSchema,
});

export const ruleConditionRowSchema = z.object({
  condition_id: z.coerce.string(),
  rule_id: z.coerce.string(),
  condition_group_id: z.coerce.string(),
  logic_type: z.coerce.string(),
  condition_target: z.coerce.string(),
  operator: z.coerce.string(),
  condition_value: z.coerce.string(),
  value_type: z.coerce.string(),
});

export const ruleActionRowSchema = z.object({
  action_id: z.coerce.string(),
  rule_id: z.coerce.string(),
  action_type: z.coerce.string(),
  action_value: z.coerce.string(),
  calculation_target: z.coerce.string(),
  source_field: z.coerce.string(),
  subtract_value: numberOrEmptyStringSchema,
  threshold_value: numberOrEmptyStringSchema,
  unit_value: numberOrEmptyStringSchema,
  unit_type: z.coerce.string(),
});

export const testResultRowSchema = z.object({
  test_id: z.coerce.string(),
  tariff_id: z.coerce.string(),
  company_id: z.coerce.string(),
  test_type: z.coerce.string(),
  input_condition: z.coerce.string(),
  expected_amount: numberOrStringSchema,
  actual_amount: numberOrStringSchema,
  status: z.coerce.string(),
  error_message: z.coerce.string(),
  executed_at: z.coerce.string(),
  notes: z.coerce.string(),
});
