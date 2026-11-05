import type { DroneArchetype } from '../types/game';

export const UNIT_ART_CELL = 128;
export const UNIT_ART_COLUMNS = 6;

/** Every summon/recipe result has its own atlas cell, including legacy units. */
export const UNIT_ART_FRAMES: Record<DroneArchetype, number> = {
  BASIC_LASER: 0, GATLING_BOT: 1, ROCKET_BOT: 2, STUN_BOT: 3,
  PIERCE_BEAM: 4, BLACKHOLE_MISSILE: 5, CHAIN_LIGHTNING: 6,
  STONE_GUARD: 7, HERBAL_PRIEST: 8, SPARK_SPIRIT: 9, SHADOW_DAGGER: 10,
  LAVA_GOLEM: 11, THORN_GUARD: 12, STORM_ARCHER: 13, MOON_PRIEST: 14,
  PALADIN: 15, THUNDER_MAGE: 16, SHADOW_ASSASSIN: 17, WORLD_DRUID: 18,
  PHOENIX_LORD: 19, STORM_GENERAL: 20, EARTH_DEITY: 21
};
