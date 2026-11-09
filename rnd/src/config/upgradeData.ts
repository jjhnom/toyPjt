import type { UpgradeId, UpgradeLevels } from '../types/game';

export const UPGRADE_IDS: readonly UpgradeId[] = ['squadAttack', 'squadSpeed', 'squadHealth', 'heroAttack', 'heroHealth', 'defense'];
export const UPGRADES: Record<UpgradeId, { name: string; baseCost: number; maxLevel: number; step: number }> = {
  squadAttack: { name: '분대 공격', baseCost: 50, maxLevel: 10, step: 0.05 },
  squadSpeed: { name: '분대 공속', baseCost: 60, maxLevel: 10, step: 0.1 },
  squadHealth: { name: '분대 체력', baseCost: 40, maxLevel: 10, step: 0.1 },
  heroAttack: { name: '영웅 공격', baseCost: 40, maxLevel: 10, step: 1 },
  heroHealth: { name: '영웅 체력', baseCost: 30, maxLevel: 10, step: 10 },
  defense: { name: '공통 방어', baseCost: 70, maxLevel: 10, step: 0.05 }
};
export const MAX_ATTACK_SPEED_MULTIPLIER = 2.5;
export const MAX_DAMAGE_REDUCTION = 0.5;

export function emptyUpgrades(): UpgradeLevels {
  return { squadAttack: 0, squadSpeed: 0, squadHealth: 0, heroAttack: 0, heroHealth: 0, defense: 0 };
}

export function isUpgradeId(value: unknown): value is UpgradeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UPGRADES, value);
}

export function isUpgradeLevels(value: unknown): value is UpgradeLevels {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.keys(value).length !== UPGRADE_IDS.length) return false;
  const levels = value as Record<string, unknown>;
  return UPGRADE_IDS.every(id => Number.isSafeInteger(levels[id]) && (levels[id] as number) >= 0 &&
    (levels[id] as number) <= UPGRADES[id].maxLevel);
}

/** Current level -> next level. Capped upgrades have no purchasable quote. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  if (!isUpgradeId(id) || !Number.isSafeInteger(level) || level < 0 || level >= UPGRADES[id].maxLevel) return null;
  return Math.ceil(UPGRADES[id].baseCost * 1.35 ** level);
}

export function upgradeEffectLabel(id: UpgradeId, level: number): string {
  const flat = id === 'heroHealth' || id === 'heroAttack';
  const amount = Math.round(UPGRADES[id].step * level * (flat ? 1 : 100));
  return id === 'defense' ? `받는 피해 -${amount}%` : id === 'heroHealth' ? `최대 HP +${amount}`
    : id === 'heroAttack' ? `공격력 +${amount}` : `+${amount}%`;
}
