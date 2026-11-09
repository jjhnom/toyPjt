import { ENEMY_SPECS } from '../config/gameData';
import { ROOM_REWARD } from '../config/squadData';
import { getStageScaling, SUMMONING_CIRCLE } from '../config/stageData';
import type { EnemyArchetype, RoomNode, RoomType, StageDef, MutationId } from '../types/game';

export type KillRewardPolicy = 'linear' | 'unscaled' | 'sqrt';
export const LIVE_KILL_REWARD_POLICY: KillRewardPolicy = 'sqrt';

/** Approved live policy; linear/unscaled remain available for controlled comparisons. */
export function killReward(archetype: EnemyArchetype, stageIndex: number, policy: KillRewardPolicy = LIVE_KILL_REWARD_POLICY, mutation: MutationId = 'NONE'): number {
  const multiplier = getStageScaling(stageIndex, mutation).rewardMult;
  return Math.round(ENEMY_SPECS[archetype].mineralValue
    * (policy === 'unscaled' ? 1 : policy === 'sqrt' ? Math.sqrt(multiplier) : multiplier));
}

export function roomClearReward(type: RoomType, stageIndex: number, mutation: MutationId = 'NONE'): number {
  return Math.round((type === 'ELITE' ? ROOM_REWARD.elite : ROOM_REWARD.combat)
    * getStageScaling(stageIndex, mutation).rewardMult);
}

/** Required spawns only: boss/summoner adds depend on fight duration and are measured live. */
export function waveEnemyTypes(stage: StageDef, room: RoomNode, wave: number, totalWaves: number): EnemyArchetype[] {
  if (room.type === 'EVENT') return [SUMMONING_CIRCLE.guardian,
    ...Array<EnemyArchetype>(SUMMONING_CIRCLE.escortCount).fill(stage.enemyPoolIds[0])];
  if (room.type === 'BOSS') return ['BOSS_CORE', ...Array.from({ length: 4 }, (_, i) => stage.enemyPoolIds[i % stage.enemyPoolIds.length])];
  if (room.type === 'RECOVERY') return [];
  const count = (room.type === 'ELITE' ? 6 : 5) + wave * 2;
  const enemies = Array.from({ length: count }, (_, i) => stage.enemyPoolIds[i % stage.enemyPoolIds.length]);
  if (room.type === 'ELITE' && wave === totalWaves) enemies.push('ELITE_BRUTE');
  return enemies;
}
