import type { TalentId } from '../types/game';
export const TALENT_IDS: readonly TalentId[] = ['COMMAND', 'VITALITY', 'FOCUS'];
export const TALENTS: Record<TalentId, { name: string; description: string }> = {
  COMMAND: { name: '분대 지휘', description: '선택마다 분대 공격 +3%\n강화·깃발과 합산 · 영웅 공격 제외' },
  VITALITY: { name: '소환사의 활력', description: '선택마다 본체 최대 HP +10\n현재 HP는 회복하지 않습니다.' },
  FOCUS: { name: '회복 집중', description: '선택마다 클래스 회복 스킬 대기 -1초\n기본 18초 · 최소 12초' }
};
export const COMMAND_HEAL = { amount: 10, cooldownMs: 18000, minCooldownMs: 12000 } as const;
export function isTalentId(value: unknown): value is TalentId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TALENTS, value);
}
export function talentRank(talents: readonly TalentId[], id: TalentId): number {
  return talents.reduce((count, value) => count + Number(value === id), 0);
}
export function activeCooldown(talents: readonly TalentId[]): number {
  return Math.max(COMMAND_HEAL.minCooldownMs, COMMAND_HEAL.cooldownMs - 1000 * talentRank(talents, 'FOCUS'));
}
