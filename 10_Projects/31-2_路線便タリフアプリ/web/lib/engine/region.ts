import { CalculationContext } from './types';

export function determineRegions(context: CalculationContext) {
  const { master, input } = context;

  context.region_from_id = findRegionId(master.regions, input.region_from.prefecture, input.region_from.city);
  context.region_to_id = findRegionId(master.regions, input.region_to.prefecture, input.region_to.city);

  const regionTo = master.regions.find(r => r.region_id === context.region_to_id);
  if (regionTo) {
    context.is_relay_to = regionTo.is_relay;
  }
}

function findRegionId(regions: { region_id: string; prefecture: string; city: string }[], targetPrefecture: string, targetCity: string): string {
  // 1. Exact match
  const exactMatches = regions.filter(r => r.prefecture === targetPrefecture && r.city === targetCity);
  if (exactMatches.length === 1) return exactMatches[0].region_id;
  if (exactMatches.length > 1) throw new Error("マスタ異常: 地域定義が重複しています (完全一致)");

  // 2. Prefecture match + city="*" (or empty)
  const prefMatches = regions.filter(r => r.prefecture === targetPrefecture && (r.city === "*" || r.city === ""));
  if (prefMatches.length === 1) return prefMatches[0].region_id;
  if (prefMatches.length > 1) throw new Error("マスタ異常: 地域定義が重複しています (市区町村アスタリスク)");

  // 3. All match
  const allMatches = regions.filter(r => r.prefecture === "*" && r.city === "*");
  if (allMatches.length === 1) return allMatches[0].region_id;
  if (allMatches.length > 1) throw new Error("マスタ異常: 地域定義が重複しています (全国アスタリスク)");

  throw new Error(`対象地域外です: ${targetPrefecture} ${targetCity}`);
}
