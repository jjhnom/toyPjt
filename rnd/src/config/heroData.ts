import { ENEMY_SPECS } from './gameData';
import type { DroneSpec, EnemyArchetype, HeroClassId, PermanentRanks } from '../types/game';
import { HERO_CLASSES, emptyPermanentRanks } from './heroClassData';

export const HERO = { classId: 'APPRENTICE_SUMMONER', name: HERO_CLASSES.APPRENTICE_SUMMONER.name, maxLevel: 20,
  baseHp: HERO_CLASSES.APPRENTICE_SUMMONER.baseHp, hpPerLevel: 5, baseDamage: HERO_CLASSES.APPRENTICE_SUMMONER.baseDamage,
  damagePerLevel: 1, fireRateMs: HERO_CLASSES.APPRENTICE_SUMMONER.fireRateMs } as const;

export function heroXpToNext(level: number): number {
  return level >= HERO.maxLevel ? 0 : Math.floor(40 * 1.18 ** (level - 1));
}

/** Level additions precede future source-specific multipliers. No squad/star buffs are inherited. */
export function heroBaseStats(level: number, classId:HeroClassId=HERO.classId, permanent:PermanentRanks=emptyPermanentRanks()): { damage: number; maxHp: number } {
  const gained = Math.max(0, Math.min(HERO.maxLevel, level) - 1);
  const hero=HERO_CLASSES[classId];
  return { damage: hero.baseDamage + HERO.damagePerLevel * gained + permanent.power,
    maxHp: hero.baseHp + HERO.hpPerLevel * gained + permanent.vitality*5 };
}

export function heroWeaponSpec(level: number, classId:HeroClassId=HERO.classId, permanent:PermanentRanks=emptyPermanentRanks()): DroneSpec {
  const hero=HERO_CLASSES[classId];
  return { archetype: 'SPARK_SPIRIT', name: `${hero.name} 마력탄`, tier: 1, color: classId===HERO.classId?0xb78cff:hero.color,
    range: hero.range, fireRateMs: hero.fireRateMs, damage: heroBaseStats(level,classId,permanent).damage, bulletSpeed: 640,
    aoeRadius: hero.aoeRadius, slowFactor: 1, slowDurationMs: 0, pierceCount: 0, chainCount: 0 };
}

export function heroXpForEnemy(type: EnemyArchetype): number {
  return Math.max(1, Math.round(ENEMY_SPECS[type].scoreValue / 5));
}
