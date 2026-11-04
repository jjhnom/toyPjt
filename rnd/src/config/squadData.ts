import type { CombinationRecipe, DroneArchetype, SummonOffer } from '../types/game';
import { UNIT_TYPES, ROLE_NAMES } from './unitData';
import { DRONE_SPECS } from './gameData';

export const SQUAD_LIMITS = { owned: 16, deployed: 6 };
export const ROOM_REWARD = { combat: 25, elite: 45 };
export const SUMMON_OFFERS: SummonOffer[] = Object.values(UNIT_TYPES)
  .filter(unit => unit.summonable).map(unit => ({ unitTypeId: unit.id, cost: unit.summonCost! }));
export const COMBINATION_RECIPES: CombinationRecipe[] = [
  { id: 'gatling', ingredients: [{ unitTypeId: 'BASIC_LASER', count: 2 }], resultUnitTypeId: 'GATLING_BOT', resultCount: 1, cost: 0, priority: 100 },
  { id: 'rocket', ingredients: [{ unitTypeId: 'BASIC_LASER', count: 3 }], resultUnitTypeId: 'ROCKET_BOT', resultCount: 1, cost: 0, priority: 100 },
  { id: 'cryo', ingredients: [{ unitTypeId: 'BASIC_LASER', count: 1 }, { unitTypeId: 'GATLING_BOT', count: 1 }], resultUnitTypeId: 'STUN_BOT', resultCount: 1, cost: 0, priority: 100 },
  { id: 'beam', ingredients: [{ unitTypeId: 'GATLING_BOT', count: 2 }], resultUnitTypeId: 'PIERCE_BEAM', resultCount: 1, cost: 0, priority: 100 },
  { id: 'blackhole', ingredients: [{ unitTypeId: 'ROCKET_BOT', count: 1 }, { unitTypeId: 'STUN_BOT', count: 1 }], resultUnitTypeId: 'BLACKHOLE_MISSILE', resultCount: 1, cost: 10, priority: 100 },
  { id: 'lightning', ingredients: [{ unitTypeId: 'STUN_BOT', count: 2 }], resultUnitTypeId: 'CHAIN_LIGHTNING', resultCount: 1, cost: 0, priority: 100 },
  { id: 'lava', ingredients: [{ unitTypeId: 'ROCKET_BOT', count: 1 }, { unitTypeId: 'STONE_GUARD', count: 1 }], resultUnitTypeId: 'LAVA_GOLEM', resultCount: 1, cost: 10, priority: 100 },
  { id: 'thorn', ingredients: [{ unitTypeId: 'BASIC_LASER', count: 1 }, { unitTypeId: 'STONE_GUARD', count: 1 }], resultUnitTypeId: 'THORN_GUARD', resultCount: 1, cost: 10, priority: 100 },
  { id: 'storm_archer', ingredients: [{ unitTypeId: 'SPARK_SPIRIT', count: 1 }, { unitTypeId: 'BASIC_LASER', count: 1 }], resultUnitTypeId: 'STORM_ARCHER', resultCount: 1, cost: 10, priority: 100 },
  { id: 'moon', ingredients: [{ unitTypeId: 'HERBAL_PRIEST', count: 2 }], resultUnitTypeId: 'MOON_PRIEST', resultCount: 1, cost: 10, priority: 100 },
  { id: 'paladin', ingredients: [{ unitTypeId: 'THORN_GUARD', count: 1 }, { unitTypeId: 'MOON_PRIEST', count: 1 }], resultUnitTypeId: 'PALADIN', resultCount: 1, cost: 25, priority: 100 },
  { id: 'thunder', ingredients: [{ kind: 'query', element: 'LIGHTNING', minTier: 2, maxTier: 2, count: 2 }], resultUnitTypeId: 'THUNDER_MAGE', resultCount: 1, cost: 25, priority: 60, kind: 'query' },
  { id: 'assassin', ingredients: [{ unitTypeId: 'SHADOW_DAGGER', count: 2 }, { unitTypeId: 'GATLING_BOT', count: 1 }], resultUnitTypeId: 'SHADOW_ASSASSIN', resultCount: 1, cost: 25, priority: 100 },
  { id: 'druid', ingredients: [{ kind: 'query', element: 'FOREST', minTier: 2, maxTier: 2, count: 1 }, { unitTypeId: 'MOON_PRIEST', count: 1 }], resultUnitTypeId: 'WORLD_DRUID', resultCount: 1, cost: 25, priority: 70, kind: 'query' },
  { id: 'phoenix', ingredients: [{ kind: 'query', element: 'FIRE', minTier: 2, maxTier: 3, count: 2 }, { unitTypeId: 'MOON_PRIEST', count: 1 }], resultUnitTypeId: 'PHOENIX_LORD', resultCount: 1, cost: 50, priority: 70, kind: 'query' },
  { id: 'general', ingredients: [{ unitTypeId: 'THUNDER_MAGE', count: 1 }, { unitTypeId: 'STORM_ARCHER', count: 1 }], resultUnitTypeId: 'STORM_GENERAL', resultCount: 1, cost: 50, priority: 100 },
  { id: 'deity', ingredients: [{ unitTypeId: 'PALADIN', count: 1 }, { unitTypeId: 'WORLD_DRUID', count: 1 }], resultUnitTypeId: 'EARTH_DEITY', resultCount: 1, cost: 50, priority: 100 },
  ...Object.values(UNIT_TYPES).flatMap(unit => ([1, 2] as const).map(star => ({
    id: `promote_${unit.id}_${star}`, ingredients: [{ unitTypeId: unit.id, count: 3 }],
    resultUnitTypeId: unit.id, resultCount: 1, cost: unit.tier * 10 * star, priority: 0,
    kind: 'promotion' as const, ingredientStar: star, resultStar: (star + 1) as 2 | 3
  })))
];

export const UNIT_MOVEMENT = Object.fromEntries(Object.values(UNIT_TYPES).map(unit => [unit.id, {
  speed: unit.role === 'VANGUARD' ? 205 : unit.role === 'MELEE' ? 285 : 235,
  preferredRange: unit.role === 'VANGUARD' || unit.role === 'MELEE' ? 55
    : Math.min(DRONE_SPECS[unit.id].range - 30, unit.role === 'SUPPORT' ? 240 : 180),
  role: ROLE_NAMES[unit.role]
}])) as Record<DroneArchetype, { speed: number; preferredRange: number; role: string }>;

export const SELL_REFUND_PER_TIER = 10;
export const UNIT_REVIVE_RATIO = 0.5;
export const UNIT_REVIVE_DELAY_MS = 12000;
export const SUPPORT_HEAL_INTERVAL_MS = 3000;
