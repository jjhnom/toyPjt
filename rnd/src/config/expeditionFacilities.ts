import type { DroneInstanceData, ServiceId, SupplyChoice } from '../types/game';

export const AWAKENING = { maxLevel: 10, step: 0.05, baseCost: 80, growth: 1.35 } as const;
export const SERVICES: Record<ServiceId, { name: string; cost: number; description: string }> = {
  HEAL: { name: '분대 완치', cost: 40, description: '생존 본체와 출전 동료를 완치합니다.\n쓰러진 동료는 부활하지 않습니다.' },
  REVIVE: { name: '즉시 부활', cost: 30, description: '쓰러진 출전 동료 모두를 최대 HP 50%로 부활시킵니다.\n본체·생존 동료 HP와 스킬 대기는 유지합니다.' }
};
export const SIDE_SUPPLY = { minStageIndex: 2, vouchers: 2, minerals: 25 } as const;
export const SUPPLY_CHOICES: readonly SupplyChoice[] = ['VOUCHERS', 'MINERALS'];
export function awakeningMultiplier(level = 0): number { return 1 + AWAKENING.step * level; }
export function validAwakening(unit: Pick<DroneInstanceData, 'awakening' | 'star'>): boolean {
  return unit.awakening === undefined || (Number.isSafeInteger(unit.awakening) && unit.awakening >= 0 &&
    unit.awakening <= AWAKENING.maxLevel && (unit.awakening === 0 || unit.star === 3));
}
export function awakeningCost(unit: DroneInstanceData): number | null {
  const level = unit.awakening ?? 0;
  return validAwakening(unit) && unit.star === 3 && level < AWAKENING.maxLevel
    ? Math.ceil(AWAKENING.baseCost * unit.tier * AWAKENING.growth ** level) : null;
}
/** Bind destructive consent to the exact instances and their current awakening levels. */
export function awakeningConsent(units: readonly DroneInstanceData[]): string {
  return units.filter(unit => (unit.awakening ?? 0) > 0).map(unit => `${unit.id}:${unit.awakening}`).sort().join('|');
}
