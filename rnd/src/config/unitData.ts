import type { DroneArchetype, DroneTier, Element, UnitRole, UnitTypeDef } from '../types/game';

export const ELEMENT_NAMES: Record<Element, string> = {
  FOREST: '숲', WIND: '바람', FIRE: '불', FROST: '서리', LIGHTNING: '번개', EARTH: '대지', SHADOW: '암흑', LIGHT: '빛'
};
export const ELEMENT_COLORS: Record<Element, number> = {
  FOREST: 0x7cba6b, WIND: 0x82d5b5, FIRE: 0xef8953, FROST: 0x88cfe1,
  LIGHTNING: 0xe4cf70, EARTH: 0xbda17b, SHADOW: 0xb090d5, LIGHT: 0xf3e2ae
};
export const ROLE_NAMES: Record<UnitRole, string> = {
  VANGUARD: '전열', MELEE: '근접', RANGED: '원거리', MAGIC: '마법', SUPPORT: '지원'
};

export const SUPPORT_HEAL_AMOUNTS: Partial<Record<DroneArchetype, number>> = {
  HERBAL_PRIEST: 3, MOON_PRIEST: 4, WORLD_DRUID: 6
};

function unit(id: DroneArchetype, name: string, tier: DroneTier, elements: Element[], role: UnitRole,
  weaponId: DroneArchetype, summonCost?: number): UnitTypeDef {
  return { id, name, tier, elements, role, weaponId, tags: [role, ...elements],
    summonable: summonCost !== undefined, summonCost,
    maxHp: (role === 'VANGUARD' ? 180 : role === 'MELEE' ? 95 : 70) * tier,
    healAmount: SUPPORT_HEAL_AMOUNTS[id] ?? 0 };
}

// The two legacy evolutions remain available alongside the 20-unit design roster.
export const UNIT_TYPES: Record<DroneArchetype, UnitTypeDef> = Object.fromEntries([
  unit('BASIC_LASER', '숲의 사수', 1, ['FOREST'], 'RANGED', 'BASIC_LASER', 15),
  unit('GATLING_BOT', '바람 순찰자', 2, ['WIND', 'FOREST'], 'RANGED', 'GATLING_BOT', 40),
  unit('ROCKET_BOT', '불꽃 마법사', 1, ['FIRE'], 'MAGIC', 'ROCKET_BOT', 40),
  unit('STUN_BOT', '서리 현자', 3, ['FROST'], 'MAGIC', 'STUN_BOT', 40),
  unit('PIERCE_BEAM', '별빛 명궁', 3, ['LIGHT', 'WIND'], 'RANGED', 'PIERCE_BEAM'),
  unit('BLACKHOLE_MISSILE', '황혼 대마법사', 4, ['FIRE', 'FROST', 'SHADOW'], 'MAGIC', 'BLACKHOLE_MISSILE'),
  unit('CHAIN_LIGHTNING', '번개 대사제', 3, ['LIGHTNING', 'LIGHT'], 'MAGIC', 'CHAIN_LIGHTNING'),
  unit('STONE_GUARD', '석재 방패병', 1, ['EARTH'], 'VANGUARD', 'BASIC_LASER', 20),
  unit('HERBAL_PRIEST', '약초 사제', 1, ['FOREST', 'LIGHT'], 'SUPPORT', 'BASIC_LASER', 25),
  unit('SPARK_SPIRIT', '번개 정령', 1, ['LIGHTNING'], 'MAGIC', 'CHAIN_LIGHTNING', 25),
  unit('SHADOW_DAGGER', '그림자 단검수', 1, ['SHADOW'], 'MELEE', 'GATLING_BOT', 20),
  unit('LAVA_GOLEM', '용암 골렘', 2, ['FIRE', 'EARTH'], 'VANGUARD', 'ROCKET_BOT'),
  unit('THORN_GUARD', '가시 수호자', 2, ['FOREST', 'EARTH'], 'VANGUARD', 'BASIC_LASER'),
  unit('STORM_ARCHER', '폭풍 궁수', 2, ['LIGHTNING', 'WIND'], 'RANGED', 'PIERCE_BEAM'),
  unit('MOON_PRIEST', '달빛 사제', 2, ['LIGHT', 'FROST'], 'SUPPORT', 'STUN_BOT'),
  unit('PALADIN', '성기사', 3, ['LIGHT', 'EARTH'], 'VANGUARD', 'BASIC_LASER'),
  unit('THUNDER_MAGE', '뇌운 술사', 3, ['LIGHTNING'], 'MAGIC', 'CHAIN_LIGHTNING'),
  unit('SHADOW_ASSASSIN', '그림자 암살자', 3, ['SHADOW'], 'MELEE', 'GATLING_BOT'),
  unit('WORLD_DRUID', '세계수 드루이드', 3, ['FOREST', 'LIGHT'], 'SUPPORT', 'STUN_BOT'),
  unit('PHOENIX_LORD', '불사조 군주', 4, ['FIRE', 'LIGHT'], 'MAGIC', 'BLACKHOLE_MISSILE'),
  unit('STORM_GENERAL', '폭풍의 대장군', 4, ['LIGHTNING', 'WIND'], 'RANGED', 'CHAIN_LIGHTNING'),
  unit('EARTH_DEITY', '대지의 수호신', 4, ['EARTH', 'FOREST'], 'VANGUARD', 'ROCKET_BOT')
].map(def => [def.id, def])) as Record<DroneArchetype, UnitTypeDef>;

export const UNIT_WEAPON_OVERRIDES = {
  STONE_GUARD: { range: 95, damage: 22, fireRateMs: 700 },
  HERBAL_PRIEST: { damage: 8, fireRateMs: 900 },
  SPARK_SPIRIT: { damage: 12, chainCount: 1, slowFactor: 1, slowDurationMs: 0 },
  SHADOW_DAGGER: { range: 90, damage: 20, fireRateMs: 280 },
  LAVA_GOLEM: { range: 105, damage: 40, aoeRadius: 65, fireRateMs: 750 },
  THORN_GUARD: { range: 105, damage: 42, fireRateMs: 650 },
  STORM_ARCHER: { damage: 25, fireRateMs: 350, pierceCount: 2 },
  MOON_PRIEST: { damage: 18, fireRateMs: 650 },
  PALADIN: { range: 110, damage: 70, fireRateMs: 550 },
  THUNDER_MAGE: { damage: 45, chainCount: 5 },
  SHADOW_ASSASSIN: { range: 100, damage: 65, fireRateMs: 240 },
  WORLD_DRUID: { damage: 35, aoeRadius: 90 },
  PHOENIX_LORD: { damage: 120, aoeRadius: 150 },
  STORM_GENERAL: { damage: 65, chainCount: 7, pierceCount: 2 },
  EARTH_DEITY: { range: 130, damage: 100, aoeRadius: 100, fireRateMs: 600 }
};
