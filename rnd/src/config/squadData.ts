import type { CombinationRecipe, DroneArchetype, SummonOffer } from '../types/game';

export const SQUAD_LIMITS = { owned: 16, deployed: 6 };
export const ROOM_REWARD = { combat: 25, elite: 45 };
export const SUMMON_OFFERS: SummonOffer[] = [
  { unitTypeId: 'BASIC_LASER', cost: 15 },
  { unitTypeId: 'GATLING_BOT', cost: 40 },
  { unitTypeId: 'ROCKET_BOT', cost: 40 },
  { unitTypeId: 'STUN_BOT', cost: 40 }
];
// Project recipes; these are not the original StarCraft map's recipes.
export const COMBINATION_RECIPES: CombinationRecipe[] = [
  { id: 'gatling', ingredients: [{ unitTypeId: 'BASIC_LASER', count: 2 }], resultUnitTypeId: 'GATLING_BOT', resultCount: 1, cost: 0 },
  { id: 'rocket', ingredients: [{ unitTypeId: 'BASIC_LASER', count: 3 }], resultUnitTypeId: 'ROCKET_BOT', resultCount: 1, cost: 0 },
  { id: 'cryo', ingredients: [{ unitTypeId: 'BASIC_LASER', count: 1 }, { unitTypeId: 'GATLING_BOT', count: 1 }], resultUnitTypeId: 'STUN_BOT', resultCount: 1, cost: 0 },
  { id: 'beam', ingredients: [{ unitTypeId: 'GATLING_BOT', count: 2 }], resultUnitTypeId: 'PIERCE_BEAM', resultCount: 1, cost: 0 },
  { id: 'blackhole', ingredients: [{ unitTypeId: 'ROCKET_BOT', count: 1 }, { unitTypeId: 'STUN_BOT', count: 1 }], resultUnitTypeId: 'BLACKHOLE_MISSILE', resultCount: 1, cost: 10 },
  { id: 'lightning', ingredients: [{ unitTypeId: 'STUN_BOT', count: 2 }], resultUnitTypeId: 'CHAIN_LIGHTNING', resultCount: 1, cost: 0 }
];

export const UNIT_MOVEMENT: Record<DroneArchetype, { speed: number; preferredRange: number; role: string }> = {
  BASIC_LASER: { speed: 235, preferredRange: 150, role: '돌격' },
  GATLING_BOT: { speed: 250, preferredRange: 120, role: '돌격' },
  ROCKET_BOT: { speed: 190, preferredRange: 270, role: '포격' },
  STUN_BOT: { speed: 220, preferredRange: 240, role: '지원' },
  PIERCE_BEAM: { speed: 240, preferredRange: 240, role: '관통' },
  BLACKHOLE_MISSILE: { speed: 190, preferredRange: 290, role: '포격' },
  CHAIN_LIGHTNING: { speed: 225, preferredRange: 230, role: '지원' }
};
