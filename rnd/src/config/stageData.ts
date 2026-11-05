import type { StageDef, StageScaling } from '../types/game';
import { ROOM_REWARD } from './squadData';

export const ENEMY_POOL_SIZE = 80;
export const STAGE_RECOVERY_RATIO = 0.4;
export const SPAWN_INTERVAL_MS = 140;
export const STAGE_REWARD_RATIO = 0.6;
export const SUMMONING_CIRCLE = { guardian: 'ELITE_BRUTE', escortCount: 2, vouchers: 1 } as const;

export const STAGES: StageDef[] = [
  { index: 0, name: '이끼 숲', themeId: 'forest', gridWidth: 3, gridHeight: 3, roomCount: 7, eliteCount: 1,
    palette: { background: 0x151d25, floor: 0x2a3439, moss: 0x54704a, wall: 0x47514b },
    enemyPoolIds: ['SWARMER'], newEnemyIds: ['SWARMER'], bossId: 'forest_guardian', bossName: '숲의 수호자',
    bossPatterns: ['CHARGE'], bossPhases: 1, isFinal: false },
  { index: 1, name: '독안개 습지', themeId: 'swamp', gridWidth: 3, gridHeight: 4, roomCount: 9, eliteCount: 1,
    palette: { background: 0x171c20, floor: 0x293a32, moss: 0x89964f, wall: 0x59644b },
    enemyPoolIds: ['SWARMER', 'SPORE_SHOOTER'], newEnemyIds: ['SPORE_SHOOTER'], bossId: 'swamp_lord', bossName: '독 늪의 군주',
    bossPatterns: ['CHARGE', 'POISON'], bossPhases: 1, isFinal: false },
  { index: 2, name: '잿불 화산', themeId: 'volcano', gridWidth: 4, gridHeight: 4, roomCount: 11, eliteCount: 2,
    palette: { background: 0x24191c, floor: 0x43302f, moss: 0xb75635, wall: 0x755148 },
    enemyPoolIds: ['SWARMER', 'SPORE_SHOOTER', 'CHASER', 'EXPLODER'], newEnemyIds: ['CHASER', 'EXPLODER'], bossId: 'lava_colossus', bossName: '용암 거신',
    bossPatterns: ['CHARGE', 'METEOR'], bossPhases: 2, isFinal: false },
  { index: 3, name: '서리 빙하', themeId: 'glacier', gridWidth: 4, gridHeight: 5, roomCount: 13, eliteCount: 3,
    palette: { background: 0x172536, floor: 0x354c5c, moss: 0x82bfc5, wall: 0x6a8f9d },
    enemyPoolIds: ['CHASER', 'SPORE_SHOOTER', 'TANK', 'SUMMONER'], newEnemyIds: ['TANK', 'SUMMONER'], bossId: 'frost_queen', bossName: '서리 여왕',
    bossPatterns: ['FROST', 'SUMMON'], bossPhases: 2, isFinal: false },
  { index: 4, name: '황혼 성채', themeId: 'citadel', gridWidth: 5, gridHeight: 5, roomCount: 15, eliteCount: 4,
    palette: { background: 0x241a30, floor: 0x3b3049, moss: 0x9c6aab, wall: 0x786184 },
    enemyPoolIds: ['SWARMER', 'CHASER', 'SPORE_SHOOTER', 'EXPLODER', 'TANK', 'SUMMONER'], newEnemyIds: [], bossId: 'twilight_king', bossName: '황혼의 마왕',
    bossPatterns: ['CHARGE', 'POISON', 'METEOR', 'FROST', 'SUMMON'], bossPhases: 3, isFinal: true }
];

export function getStageScaling(index: number): StageScaling {
  const n = Math.max(0, index);
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

export function stageClearReward(stage: StageDef): number {
  const combatRooms = stage.roomCount - stage.eliteCount - 3;
  return Math.round((combatRooms * ROOM_REWARD.combat + stage.eliteCount * ROOM_REWARD.elite)
    * getStageScaling(stage.index).rewardMult * STAGE_REWARD_RATIO);
}
