import type { MutationId } from '../types/game';
export const MUTATION_IDS: readonly MutationId[] = ['NONE', 'ARMORED', 'FIERCE', 'SWIFT'];
export const MUTATIONS: Record<MutationId, { name: string; description: string; hp: number; damage: number; speed: number; reward: number }> = {
  NONE: { name: '기본', description: '변이 없이 기존 무한 난이도로 진행합니다.', hp: 1, damage: 1, speed: 1, reward: 1 },
  ARMORED: { name: '강철', description: '다음 스테이지 적 HP +15% · 보상 배율 +10%', hp: 1.15, damage: 1, speed: 1, reward: 1.1 },
  FIERCE: { name: '흉포', description: '다음 스테이지 적 피해 +10% · 보상 배율 +10%', hp: 1, damage: 1.1, speed: 1, reward: 1.1 },
  SWIFT: { name: '질주', description: '다음 스테이지 적 속도 +5% · 보상 배율 +10%', hp: 1, damage: 1, speed: 1.05, reward: 1.1 }
};
export function isMutationId(value: unknown): value is MutationId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MUTATIONS, value);
}
