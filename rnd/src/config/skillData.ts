import type { CombatStyle, DroneArchetype, ProjectileSkill } from '../types/game';

// Visual budgets, independent of damage and tier. Large attacks never flash the whole screen.
export const UNIT_COMBAT_STYLES: Record<DroneArchetype, CombatStyle> = {
  BASIC_LASER: { shape: 'arrow', color: 0x82d5b5, accent: 0xd6ffe5, intensity: 'S' },
  GATLING_BOT: { shape: 'streak', color: 0x9c9cff, accent: 0xe6f6ff, intensity: 'S' },
  ROCKET_BOT: { shape: 'fire', color: 0xff8a2a, accent: 0xffd05a, intensity: 'M' },
  STUN_BOT: { shape: 'frost', color: 0x67d8ff, accent: 0xb8f4ff, intensity: 'M' },
  PIERCE_BEAM: { shape: 'star', color: 0xffe6a0, accent: 0xfff5d6, intensity: 'S' },
  BLACKHOLE_MISSILE: { shape: 'void', color: 0x8c54d8, accent: 0xd59aff, intensity: 'L' },
  CHAIN_LIGHTNING: { shape: 'bolt', color: 0xffd65c, accent: 0xb78cff, intensity: 'M' },
  STONE_GUARD: { shape: 'stone', color: 0xbda17b, accent: 0xf0d7a7, intensity: 'S' },
  HERBAL_PRIEST: { shape: 'leaf', color: 0x79d878, accent: 0xfff5d6, intensity: 'S' },
  SPARK_SPIRIT: { shape: 'bolt', color: 0xb78cff, accent: 0xffd65c, intensity: 'S' },
  SHADOW_DAGGER: { shape: 'slash', color: 0x8c54d8, accent: 0xd59aff, intensity: 'S' },
  LAVA_GOLEM: { shape: 'fire', color: 0xff6938, accent: 0xffd05a, intensity: 'M' },
  THORN_GUARD: { shape: 'thorn', color: 0x79d842, accent: 0xb2f06a, intensity: 'S' },
  STORM_ARCHER: { shape: 'arrow', color: 0xb78cff, accent: 0xffd65c, intensity: 'M' },
  MOON_PRIEST: { shape: 'frost', color: 0xb8f4ff, accent: 0xffe6a0, intensity: 'M' },
  PALADIN: { shape: 'holy', color: 0xffe6a0, accent: 0xfff5d6, intensity: 'M' },
  THUNDER_MAGE: { shape: 'bolt', color: 0xffd65c, accent: 0xe9d2ff, intensity: 'M' },
  SHADOW_ASSASSIN: { shape: 'slash', color: 0xd59aff, accent: 0xffb6f2, intensity: 'M' },
  WORLD_DRUID: { shape: 'leaf', color: 0x79d878, accent: 0xffe6a0, intensity: 'M' },
  PHOENIX_LORD: { shape: 'feather', color: 0xff8a2a, accent: 0xfff5d6, intensity: 'L' },
  STORM_GENERAL: { shape: 'bolt', color: 0xb78cff, accent: 0xffd65c, intensity: 'M' },
  EARTH_DEITY: { shape: 'stone', color: 0xbda17b, accent: 0x9ceeff, intensity: 'M' }
};

export const UNIQUE_SKILLS = {
  lava: { radius: 100, intervalMs: 1000, burnDamage: 6, burnDurationMs: 2400, burnTickMs: 800 },
  assassin: { cooldownReductionMs: 120 },
  druid: { radius: 220, damageMultiplier: 1.15 },
  phoenix: { cooldownMs: 10000, reviveRatio: 0.5 },
  deity: { radius: 220, cooldownMs: 8000, shieldHp: 30, durationMs: 4000 }
} as const;

// Opt-in projectile mechanics. Fragments never inherit these effects.
export const UNIT_PROJECTILE_SKILLS: Partial<Record<DroneArchetype, ProjectileSkill>> = {
  THORN_GUARD: { poison: { damageRatio: 0.08, durationMs: 3000, tickMs: 1000 } },
  STORM_ARCHER: { split: { count: 2, damageRatio: 0.25, radius: 160, lifespanMs: 400 } },
  SPARK_SPIRIT: { homing: { turnRate: 3 } }
};

export const UNIT_SKILL_DESCRIPTIONS: Record<DroneArchetype, string> = {
  BASIC_LASER: '숲 화살 · 단일 사격', GATLING_BOT: '바람 연사 · 빠른 사격',
  ROCKET_BOT: '화염 폭발 · 범위 피해', STUN_BOT: '서리 폭발 · 범위 감속',
  PIERCE_BEAM: '별빛 관통 · 직선 연속 적중', BLACKHOLE_MISSILE: '황혼 파동 · 광역 피해/감속',
  CHAIN_LIGHTNING: '신성 번개 · 연쇄 피해/감속', STONE_GUARD: '방패 강타 · 전열 어그로',
  HERBAL_PRIEST: '약초 치유 · 3초마다 생존 아군 회복', SPARK_SPIRIT: '추적 전격 · 최초 표적 추적 + 짧은 연쇄',
  SHADOW_DAGGER: '그림자 참격 · 빠른 근접 공격', LAVA_GOLEM: '화상 오라 · 반경 100, 0.8초마다 화상 6',
  THORN_GUARD: '맹독 가시 · 3초간 초당 공격의 8% 중독, 피격 40% 반사', STORM_ARCHER: '분열 화살 · 관통 + 첫 적중 시 25% 파편 최대 2개',
  MOON_PRIEST: '달빛 치유 · 아군 회복/적 감속', PALADIN: '신성 수호 · 본체 피해 30% 분담',
  THUNDER_MAGE: '뇌운 연쇄 · 다수 적 전격', SHADOW_ASSASSIN: '처치 연계 · 처치마다 공격 대기 0.12초 단축',
  WORLD_DRUID: '세계수 가호 · 주변 동료 공격력 +15%, 중첩 없음',
  PHOENIX_LORD: '불사조 재림 · 10초마다 쓰러진 동료 1기 HP 50% 부활',
  STORM_GENERAL: '폭풍 연격 · 관통과 연쇄 번개', EARTH_DEITY: '대지 방벽 · 8초마다 주변 아군 보호막 30, 4초'
};
