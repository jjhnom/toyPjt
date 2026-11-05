import { DroneArchetype, DroneSpec, EnemyArchetype, EnemySpec, RoomType } from '../types/game';
import { UNIT_TYPES, UNIT_WEAPON_OVERRIDES } from './unitData';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// 전투 룸 내부 아레나 경계 (상단 HUD, 하단 조이스틱 여백 고려)
export const ARENA_BOUNDS = {
  left: 64,
  right: GAME_WIDTH - 64,
  top: 170,
  bottom: GAME_HEIGHT - 190,
  width: GAME_WIDTH - 128,
  height: GAME_HEIGHT - 360,
  centerX: GAME_WIDTH / 2,
  centerY: (170 + (GAME_HEIGHT - 190)) / 2
};

export const ROOM_TYPE_META: Record<
  RoomType,
  { label: string; badgeText: string; color: number; hex: string }
> = {
  COMBAT: { label: '잊힌 회랑', badgeText: '전투', color: 0x3b82f6, hex: '#3b82f6' },
  ELITE: { label: '수호자의 방', badgeText: '정예', color: 0xa855f7, hex: '#a855f7' },
  EVENT: { label: '봉인된 소환진', badgeText: '소환진', color: 0xb78cff, hex: '#b78cff' },
  RECOVERY: { label: '치유의 샘', badgeText: '회복', color: 0x10b981, hex: '#10b981' },
  BOSS: { label: '마왕의 성소', badgeText: '보스', color: 0xef4444, hex: '#ef4444' }
};

const LEGACY_DRONE_SPECS = {
  BASIC_LASER: {
    archetype: 'BASIC_LASER',
    name: '숲의 사수',
    tier: 1,
    color: 0x38bdf8,
    range: 310,
    fireRateMs: 550,
    damage: 18,
    bulletSpeed: 680,
    aoeRadius: 0,
    slowFactor: 1,
    slowDurationMs: 0,
    pierceCount: 0,
    chainCount: 0
  },
  GATLING_BOT: {
    archetype: 'GATLING_BOT',
    name: '바람 순찰자',
    tier: 2,
    color: 0xfacc15,
    range: 290,
    fireRateMs: 180,
    damage: 10,
    bulletSpeed: 820,
    aoeRadius: 0,
    slowFactor: 1,
    slowDurationMs: 0,
    pierceCount: 0,
    chainCount: 0,
    evolvesFrom: 'BASIC_LASER'
  },
  ROCKET_BOT: {
    archetype: 'ROCKET_BOT',
    name: '불꽃 마법사',
    tier: 2,
    color: 0xf97316,
    range: 360,
    fireRateMs: 950,
    damage: 38,
    bulletSpeed: 500,
    aoeRadius: 85,
    slowFactor: 1,
    slowDurationMs: 0,
    pierceCount: 0,
    chainCount: 0,
    evolvesFrom: 'BASIC_LASER'
  },
  STUN_BOT: {
    archetype: 'STUN_BOT',
    name: '서리 현자',
    tier: 2,
    color: 0x2dd4bf,
    range: 320,
    fireRateMs: 520,
    damage: 16,
    bulletSpeed: 640,
    aoeRadius: 42,
    slowFactor: 0.42,
    slowDurationMs: 2000,
    pierceCount: 0,
    chainCount: 0,
    evolvesFrom: 'BASIC_LASER'
  },
  PIERCE_BEAM: {
    archetype: 'PIERCE_BEAM',
    name: '별빛 명궁',
    tier: 3,
    color: 0xfef08a,
    range: 390,
    fireRateMs: 150,
    damage: 22,
    bulletSpeed: 1050,
    aoeRadius: 0,
    slowFactor: 1,
    slowDurationMs: 0,
    pierceCount: 3,
    chainCount: 0,
    evolvesFrom: 'GATLING_BOT'
  },
  BLACKHOLE_MISSILE: {
    archetype: 'BLACKHOLE_MISSILE',
    name: '황혼 대마법사',
    tier: 3,
    color: 0xc084fc,
    range: 410,
    fireRateMs: 820,
    damage: 85,
    bulletSpeed: 560,
    aoeRadius: 135,
    slowFactor: 0.35,
    slowDurationMs: 1500,
    pierceCount: 0,
    chainCount: 0,
    evolvesFrom: 'ROCKET_BOT'
  },
  CHAIN_LIGHTNING: {
    archetype: 'CHAIN_LIGHTNING',
    name: '번개 대사제',
    tier: 3,
    color: 0x67e8f9,
    range: 360,
    fireRateMs: 420,
    damage: 34,
    bulletSpeed: 900,
    aoeRadius: 0,
    slowFactor: 0.3,
    slowDurationMs: 2200,
    pierceCount: 0,
    chainCount: 3,
    evolvesFrom: 'STUN_BOT'
  }
} satisfies Partial<Record<DroneArchetype, DroneSpec>>;

export const DRONE_SPECS = Object.fromEntries(Object.values(UNIT_TYPES).map(unit => [unit.id, {
  ...LEGACY_DRONE_SPECS[unit.weaponId as keyof typeof LEGACY_DRONE_SPECS],
  ...UNIT_WEAPON_OVERRIDES[unit.id as keyof typeof UNIT_WEAPON_OVERRIDES],
  archetype: unit.id, name: unit.name, tier: unit.tier
}])) as Record<DroneArchetype, DroneSpec>;

export const TIER2_ARCHETYPES: DroneArchetype[] = ['GATLING_BOT', 'ROCKET_BOT', 'STUN_BOT'];

export const TIER2_TO_TIER3_MAP: Partial<Record<DroneArchetype, DroneArchetype>> = {
  GATLING_BOT: 'PIERCE_BEAM',
  ROCKET_BOT: 'BLACKHOLE_MISSILE',
  STUN_BOT: 'CHAIN_LIGHTNING'
};

export const ENEMY_SPECS: Record<EnemyArchetype, EnemySpec> = {
  SPORE_SHOOTER: { archetype: 'SPORE_SHOOTER', name: '포자 사수', maxHp: 70, speed: 100, contactDamage: 10, radius: 16, color: 0xa3b864, scoreValue: 20, mineralValue: 8 },
  EXPLODER: { archetype: 'EXPLODER', name: '잿불 폭탄', maxHp: 50, speed: 165, contactDamage: 18, radius: 16, color: 0xff9259, scoreValue: 22, mineralValue: 8 },
  SUMMONER: { archetype: 'SUMMONER', name: '빙하 주술사', maxHp: 100, speed: 85, contactDamage: 12, radius: 19, color: 0x86cfef, scoreValue: 28, mineralValue: 10 },
  SWARMER: {
    archetype: 'SWARMER',
    name: '이끼 슬라임',
    maxHp: 36,
    speed: 145,
    contactDamage: 8,
    radius: 14,
    color: 0xf43f5e,
    scoreValue: 10,
    mineralValue: 4
  },
  CHASER: {
    archetype: 'CHASER',
    name: '동굴 고블린',
    maxHp: 62,
    speed: 185,
    contactDamage: 12,
    radius: 17,
    color: 0xfb923c,
    scoreValue: 18,
    mineralValue: 7
  },
  TANK: {
    archetype: 'TANK',
    name: '바위 골렘',
    maxHp: 175,
    speed: 92,
    contactDamage: 20,
    radius: 24,
    color: 0xa3e635,
    scoreValue: 35,
    mineralValue: 14
  },
  ELITE_BRUTE: {
    archetype: 'ELITE_BRUTE',
    name: '고대의 수호자',
    maxHp: 380,
    speed: 125,
    contactDamage: 26,
    radius: 30,
    color: 0xc084fc,
    scoreValue: 90,
    mineralValue: 32
  },
  BOSS_CORE: {
    archetype: 'BOSS_CORE',
    name: '황혼의 마왕',
    maxHp: 1850,
    speed: 105,
    contactDamage: 35,
    radius: 46,
    color: 0xef4444,
    scoreValue: 500,
    mineralValue: 150
  }
};
