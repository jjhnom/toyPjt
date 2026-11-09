import { UPGRADES, MAX_ATTACK_SPEED_MULTIPLIER, MAX_DAMAGE_REDUCTION } from '../config/upgradeData';
import { UNIT_TYPES } from '../config/unitData';
import type { DroneArchetype, UpgradeLevels, RelicId, TalentId } from '../types/game';
import { talentRank } from '../config/heroAbilities';
import { RELIC_ATTACK_BONUS } from '../config/relicData';
import { awakeningMultiplier } from '../config/expeditionFacilities';

/** Stable effect IDs are the six upgrade keys; derive from levels once, never accumulate per render/frame. */
export function resolveUpgradeEffects(levels: UpgradeLevels, relics: readonly RelicId[] = [], talents: readonly TalentId[] = [],
  synergy = {attack:0,speed:0,defense:0}) {
  return {
    squadAttack: 1 + levels.squadAttack * UPGRADES.squadAttack.step + (relics.includes('COMMAND_BANNER') ? RELIC_ATTACK_BONUS : 0)
      + 0.03 * talentRank(talents, 'COMMAND') + synergy.attack,
    squadSpeed: 1 + levels.squadSpeed * UPGRADES.squadSpeed.step + synergy.speed,
    squadHealth: 1 + levels.squadHealth * UPGRADES.squadHealth.step,
    heroAttack: levels.heroAttack * UPGRADES.heroAttack.step,
    heroHealth: levels.heroHealth * UPGRADES.heroHealth.step + 10 * talentRank(talents, 'VITALITY'),
    damageReduction: Math.min(MAX_DAMAGE_REDUCTION, levels.defense * UPGRADES.defense.step + synergy.defense),
    relicHealing: relics.includes('SEED_CHALICE')
  };
}

export function upgradedUnitMaxHp(type: DroneArchetype, star: number, healthMultiplier: number, awakening = 0): number {
  return Math.round(UNIT_TYPES[type].maxHp * (1 + 0.5 * (star - 1)) * healthMultiplier * awakeningMultiplier(awakening));
}

export function upgradedAttackSpeed(legacyMultiplier: number, upgradeMultiplier: number): number {
  return Math.min(MAX_ATTACK_SPEED_MULTIPLIER, legacyMultiplier * upgradeMultiplier);
}
