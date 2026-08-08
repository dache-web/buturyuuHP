import { CalculationContext, RuleActionRow, RuleBaseRow } from './types';

export function executeAction(context: CalculationContext, rule: RuleBaseRow, action: RuleActionRow) {
  const type = action.action_type;
  let amountChange = 0;

  if (type === 'fixed_add') {
    amountChange = Number(action.action_value);
    context.subtotal += amountChange;
  } 
  else if (type === 'exclude') {
    // handled in rules.ts to throw exception
    amountChange = 0;
  } 
  else if (type === 'multiply_field_add') {
    const fieldName = action.source_field as keyof typeof context.input;
    const rawVal = context.input[fieldName];
    if (typeof rawVal !== 'number') {
       throw new Error(`multiply_field_add: source_field '${action.source_field}' is not a number`);
    }
    const val = rawVal - action.subtract_value;
    if (val > 0) {
      amountChange = val * Number(action.action_value);
      context.subtotal += amountChange;
    }
  } 
  else if (type === 'excess_weight_add') {
    const excess = context.chargeable_weight - action.threshold_value;
    if (excess > 0) {
      const units = Math.ceil(excess / action.unit_value);
      amountChange = units * Number(action.action_value);
      context.subtotal += amountChange;
    }
  } 
  else if (type === 'min_fare') {
    const minFare = Number(action.action_value);
    // This action targets final_total, so it should compare with context.subtotal or final_total?
    // Since it's applied in final_total phase, context.final_total is basically subtotal before rounding.
    // Let's set context.final_total here. Wait, rules.ts applies this and mutates context.
    // To be safe, min_fare applies to context.final_total if we are in final_total phase.
    // Actually, let's just mutate context.subtotal, because rounding happens after all phases.
    if (context.subtotal < minFare) {
      amountChange = minFare - context.subtotal;
      context.subtotal = minFare;
    }
  } 
  else {
    throw new Error(`未対応のaction_typeです: ${type}`);
  }

  // Record step if there's a change or it's an exclude
  if (amountChange !== 0 || type === 'exclude') {
    context.steps.push({
      step_type: type === 'exclude' ? 'EXCLUDE' : 'RULE_APPLIED',
      description: rule.rule_name,
      amount_change: amountChange,
      current_subtotal: context.subtotal,
      metadata: { rule_id: rule.rule_id, action_id: action.action_id }
    });
  }
}
