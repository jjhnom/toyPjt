import type { RelicId } from '../types/game';

export const RELIC_IDS: readonly RelicId[] = ['COMMAND_BANNER', 'SEED_CHALICE', 'ARTISAN_SEAL'];
export const RELIC_LIMIT = 3;
export const RELIC_HEAL_INTERVAL_MS = 5000;
export const RELIC_HEAL_AMOUNT = 2;
export const RELIC_ATTACK_BONUS = 0.1;
export const RELIC_CRAFT_DISCOUNT = 0.1;
export const MAX_CRAFT_DISCOUNT = 0.4;
export const RELICS: Record<RelicId, { name: string; description: string; icon: 'gem' | 'heart' | 'book' }> = {
  COMMAND_BANNER: { name: '지휘의 깃발', description: '분대 공격력 +10%\n분대 공격 강화와 합산 · 영웅 공격 제외', icon: 'gem' },
  SEED_CHALICE: { name: '새싹 성배', description: '전투 중 5초마다 생존 아군 HP +2\n본체와 출전 동료 회복 · 전투 불능 제외', icon: 'heart' },
  ARTISAN_SEAL: { name: '장인의 인장', description: '조합·★승급 추가 마력석 비용 10% 할인\n간편 제작의 중간 조합에도 적용 · 소환 비용 제외', icon: 'book' }
};
export function isRelicId(value: unknown): value is RelicId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RELICS, value);
}
export function relicCraftDiscount(ids: readonly RelicId[]): number {
  return ids.includes('ARTISAN_SEAL') ? RELIC_CRAFT_DISCOUNT : 0;
}
export function discountedCombinationCost(cost: number, discount: number): number {
  return Math.ceil(cost * (1 - Math.min(MAX_CRAFT_DISCOUNT, Math.max(0, discount))));
}
