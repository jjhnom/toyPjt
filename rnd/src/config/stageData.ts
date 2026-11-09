import type { StageDef, StageScaling, MutationId } from '../types/game';
import { ROOM_REWARD } from './squadData';
import { MUTATIONS, isMutationId } from './mutationData';
import { BOSS_PROFILES } from './bossData';

export const ENEMY_POOL_SIZE = 80;
export const STAGE_RECOVERY_RATIO = 0.4;
export const SPAWN_INTERVAL_MS = 140;
export const STAGE_REWARD_RATIO = 0.6;
export const SUMMONING_CIRCLE = { guardian: 'ELITE_BRUTE', escortCount: 2, vouchers: 1 } as const;
export const MAX_SAFE_STAGE_INDEX = 999;
export const ENDLESS_CAPS = { hp: 1000, damage: 20, reward: 22, waves: 4, speed: 1.45 } as const;

export const STAGES: StageDef[] = [
  { index: 0, name: '이끼 숲', themeId: 'forest', gridWidth: 3, gridHeight: 3, roomCount: 7, eliteCount: 1,
    palette: { background: 0x151d25, floor: 0x2a3439, moss: 0x54704a, wall: 0x47514b },
    enemyPoolIds: ['SWARMER'], newEnemyIds: ['SWARMER'], bossId: 'forest_guardian', bossName: '숲의 수호자',
    bossPatterns: [...BOSS_PROFILES.forest_guardian.patterns], bossPhases: 1, isFinal: false },
  { index: 1, name: '독안개 습지', themeId: 'swamp', gridWidth: 3, gridHeight: 4, roomCount: 9, eliteCount: 1,
    palette: { background: 0x171c20, floor: 0x293a32, moss: 0x89964f, wall: 0x59644b },
    enemyPoolIds: ['SWARMER', 'SPORE_SHOOTER'], newEnemyIds: ['SPORE_SHOOTER'], bossId: 'swamp_lord', bossName: '독 늪의 군주',
    bossPatterns: [...BOSS_PROFILES.swamp_lord.patterns], bossPhases: 1, isFinal: false },
  { index: 2, name: '잿불 화산', themeId: 'volcano', gridWidth: 4, gridHeight: 4, roomCount: 11, eliteCount: 2,
    palette: { background: 0x24191c, floor: 0x43302f, moss: 0xb75635, wall: 0x755148 },
    enemyPoolIds: ['SWARMER', 'SPORE_SHOOTER', 'CHASER', 'EXPLODER'], newEnemyIds: ['CHASER', 'EXPLODER'], bossId: 'lava_colossus', bossName: '용암 거신',
    bossPatterns: [...BOSS_PROFILES.lava_colossus.patterns], bossPhases: 2, isFinal: false },
  { index: 3, name: '서리 빙하', themeId: 'glacier', gridWidth: 4, gridHeight: 5, roomCount: 13, eliteCount: 3,
    palette: { background: 0x172536, floor: 0x354c5c, moss: 0x82bfc5, wall: 0x6a8f9d },
    enemyPoolIds: ['CHASER', 'SPORE_SHOOTER', 'TANK', 'SUMMONER'], newEnemyIds: ['TANK', 'SUMMONER'], bossId: 'frost_queen', bossName: '서리 여왕',
    bossPatterns: [...BOSS_PROFILES.frost_queen.patterns], bossPhases: 2, isFinal: false },
  { index: 4, name: '황혼 성채', themeId: 'citadel', gridWidth: 5, gridHeight: 5, roomCount: 15, eliteCount: 4,
    palette: { background: 0x241a30, floor: 0x3b3049, moss: 0x9c6aab, wall: 0x786184 },
    enemyPoolIds: ['SWARMER', 'CHASER', 'SPORE_SHOOTER', 'EXPLODER', 'TANK', 'SUMMONER'], newEnemyIds: [], bossId: 'twilight_king', bossName: '황혼의 마왕',
    bossPatterns: [...BOSS_PROFILES.twilight_king.patterns], bossPhases: 3, isFinal: true }
];

export function isSupportedStageIndex(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SAFE_STAGE_INDEX;
}

export function generateEndlessStage(index: number): StageDef {
  if (!isSupportedStageIndex(index) || index < STAGES.length) throw new RangeError('Invalid endless stage index');
  const theme = STAGES[(index - STAGES.length) % STAGES.length];
  return { ...theme, index, gridWidth: 5, gridHeight: 5, roomCount: 15,
    eliteCount: Math.min(4 + Math.floor((index - 5) / 2), 6), isFinal: false,
    palette: { ...theme.palette }, enemyPoolIds: [...STAGES[4].enemyPoolIds], newEnemyIds: [],
    bossPatterns: [...theme.bossPatterns] };
}
const endlessStages = new Map<number, StageDef>();
export function getStageDefinition(index: number): StageDef | undefined {
  if (!isSupportedStageIndex(index)) return undefined;
  if (index < STAGES.length) return STAGES[index];
  let stage = endlessStages.get(index);
  if (!stage) { stage = generateEndlessStage(index); endlessStages.set(index, stage); }
  return stage;
}

export function getStageScaling(index: number, mutation: MutationId = 'NONE'): StageScaling {
  if (!isSupportedStageIndex(index)) throw new RangeError('Invalid stage index');
  if (!isMutationId(mutation) || (index < 5 && mutation !== 'NONE')) throw new RangeError('Invalid stage mutation');
  const n = index;
  if (n >= STAGES.length) {
    const base = getStageScaling(4), m = n - 4, effect = MUTATIONS[mutation];
    return { enemyHpMult: Math.min(base.enemyHpMult * 1.15 ** m * effect.hp, ENDLESS_CAPS.hp),
      bossHpMult: Math.min(base.bossHpMult * 1.15 ** m * effect.hp, ENDLESS_CAPS.hp),
      enemyDamageMult: Math.min(base.enemyDamageMult * (1 + 0.15 * m) * effect.damage, ENDLESS_CAPS.damage),
      bossDamageMult: Math.min(base.bossDamageMult * (1 + 0.15 * m) * effect.damage, ENDLESS_CAPS.damage),
      enemySpeedMult: Math.min((1.3 + 0.01 * m) * effect.speed, ENDLESS_CAPS.speed),
      waveCountBonus: Math.min(Math.floor(n / 2), ENDLESS_CAPS.waves), spawnIntervalMult: 0.6,
      rewardMult: Math.min(base.rewardMult * 1.06 ** m * effect.reward, ENDLESS_CAPS.reward), maxActiveEnemies: Math.min(12 + 4 * n, 64) };
  }
  return {
    enemyHpMult: 1 + 0.45 * n ** 1.15,
    enemyDamageMult: 1 + 0.25 * n,
    enemySpeedMult: Math.min(1 + 0.06 * n, 1.3),
    waveCountBonus: Math.floor(n / 2),
    spawnIntervalMult: Math.max(1 - 0.07 * n, 0.6),
    rewardMult: 1 + 0.3 * n,
    bossHpMult: 1 + 0.65 * n ** 1.2,
    bossDamageMult: 1 + 0.3 * n,
    maxActiveEnemies: Math.min(12 + 4 * n, Math.floor(ENEMY_POOL_SIZE * 0.8))
  };
}

export function isMutationAvailable(index: number, mutation: unknown): mutation is MutationId {
  if (!isSupportedStageIndex(index) || !isMutationId(mutation)) return false;
  if (mutation === 'NONE') return true;
  if (index < 5) return false;
  const base = getStageScaling(index), effect = getStageScaling(index, mutation);
  const risk = mutation === 'ARMORED' ? effect.enemyHpMult > base.enemyHpMult
    : mutation === 'FIERCE' ? effect.enemyDamageMult > base.enemyDamageMult : effect.enemySpeedMult > base.enemySpeedMult;
  return risk && effect.rewardMult > base.rewardMult;
}

export function stageClearReward(stage: StageDef, mutation: MutationId = 'NONE'): number {
  const combatRooms = stage.roomCount - stage.eliteCount - 3;
  return Math.round((combatRooms * ROOM_REWARD.combat + stage.eliteCount * ROOM_REWARD.elite)
    * getStageScaling(stage.index, mutation).rewardMult * STAGE_REWARD_RATIO);
}
