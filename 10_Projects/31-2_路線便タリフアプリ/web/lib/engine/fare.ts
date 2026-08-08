import { CalculationContext } from './types';

export function determineBaseFare(context: CalculationContext) {
  const { master, region_from_id, region_to_id, tier_id } = context;

  const matches = master.fares.filter(f => 
    f.region_from_id === region_from_id && 
    f.region_to_id === region_to_id && 
    f.tier_id === tier_id
  );

  if (matches.length === 0) {
    throw new Error(`運賃表に該当レコードがありません (from: ${region_from_id}, to: ${region_to_id}, tier: ${tier_id})`);
  }
  if (matches.length > 1) {
    throw new Error("マスタデータ設定エラー：基本運賃レコードが複数存在します");
  }

  context.base_fare = matches[0].base_amount;
  context.subtotal = context.base_fare;

  context.steps.push({
    step_type: 'BASE_FARE',
    description: '基本運賃',
    amount_change: context.base_fare,
    current_subtotal: context.subtotal
  });
}
