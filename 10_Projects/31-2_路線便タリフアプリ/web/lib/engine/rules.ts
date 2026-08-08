import { CalculationContext, RuleBaseRow, RuleConditionRow } from './types';
import { executeAction } from './actions';

export function applyRules(context: CalculationContext, phase: 'all' | 'subtotal' | 'final_total') {
  const { master } = context;

  // 該当フェーズのルール（アクションを持つもの）を抽出
  const candidateRules = master.rules.filter(rule => {
    if (!rule.enabled) return false;
    const ruleActions = master.actions.filter(a => a.rule_id === rule.rule_id);
    return ruleActions.some(a => a.calculation_target === phase);
  });

  // calculation_order でソート
  candidateRules.sort((a, b) => a.calculation_order - b.calculation_order);

  for (const rule of candidateRules) {
    if (context.evaluated_rules.has(rule.rule_id)) continue; // skip already evaluated in this phase? Actually, evaluated_rules is per context. If a rule has multiple actions in different phases, it should not be blocked entirely, but actions block themselves.
    // However, the spec says "二重評価防止 evaluated_rules を使用し..."
    // If a rule is evaluated, we mark it.
    // If we only mark rule_id, a rule cannot fire in multiple phases.
    // Assuming one rule = one phase (its actions belong to one phase).

    const isMatch = evaluateRuleConditions(context, rule, master.conditions.filter(c => c.rule_id === rule.rule_id));
    
    if (isMatch) {
      context.evaluated_rules.add(rule.rule_id);
      
      const ruleActions = master.actions.filter(a => a.rule_id === rule.rule_id && a.calculation_target === phase);
      for (const action of ruleActions) {
        if (!context.executed_actions.has(action.action_id)) {
          executeAction(context, rule, action);
          context.executed_actions.add(action.action_id);
          
          if (phase === 'all' && action.action_type === 'exclude') {
             // Exclude stops calculation
             throw new Error(`EXCLUDE: ${action.action_value}`);
          }
        }
      }
    }
  }
}

function evaluateRuleConditions(context: CalculationContext, rule: RuleBaseRow, conditions: RuleConditionRow[]): boolean {
  if (conditions.length === 0) return true; // No conditions = always match

  // Group conditions by condition_group_id
  const groups: Record<string, RuleConditionRow[]> = {};
  for (const c of conditions) {
    if (!groups[c.condition_group_id]) {
      groups[c.condition_group_id] = [];
    }
    groups[c.condition_group_id].push(c);
  }

  const groupResults: boolean[] = [];

  for (const groupId in groups) {
    const groupConds = groups[groupId];
    const logicType = groupConds[0].logic_type.toUpperCase();
    
    let groupMatch = logicType === 'AND' ? true : false;

    for (const c of groupConds) {
      const match = evaluateSingleCondition(context, c);
      if (logicType === 'AND') {
        groupMatch = groupMatch && match;
      } else if (logicType === 'OR') {
        groupMatch = groupMatch || match;
      } else {
        // Fallback to AND if unknown logic_type inside group
        groupMatch = groupMatch && match;
      }
    }
    groupResults.push(groupMatch);
  }

  if (groupResults.length === 0) return true;

  const ruleLogic = rule.group_logic.toUpperCase();
  if (ruleLogic === 'AND') {
    return groupResults.every(r => r === true);
  } else if (ruleLogic === 'OR') {
    return groupResults.some(r => r === true);
  } else {
    // Default to AND
    return groupResults.every(r => r === true);
  }
}

function evaluateSingleCondition(context: CalculationContext, condition: RuleConditionRow): boolean {
  let targetValue: string | number | boolean;

  switch (condition.condition_target) {
    case 'region_from':
      targetValue = context.input.region_from.prefecture; // Assuming region_from matches prefecture for simplicity or city? The master data has '東京都' which is prefecture.
      // Wait, rule condition has '東京都'. It matches prefecture.
      // A more robust way: check if condition_value matches prefecture or city. But exact match is safer.
      targetValue = context.input.region_from.prefecture;
      break;
    case 'region_to_id':
      targetValue = context.region_to_id;
      break;
    case 'actual_weight':
      targetValue = context.input.actual_weight;
      break;
    case 'piece_count':
      targetValue = context.input.piece_count;
      break;
    case 'chargeable_weight':
      targetValue = context.chargeable_weight;
      break;
    case 'is_relay_to':
      targetValue = context.is_relay_to;
      break;
    case 'always':
      targetValue = true;
      break;
    default:
      throw new Error(`未対応のcondition_targetです: ${condition.condition_target}`);
  }

  const op = condition.operator;
  const cv = condition.condition_value;

  if (op === '==') {
    return targetValue == cv; // allow type coercion for boolean/string
  } else if (op === '>=') {
    return targetValue >= cv;
  } else if (op === '>') {
    return targetValue > cv;
  } else {
    throw new Error(`未対応のoperatorです: ${op}`);
  }
}
