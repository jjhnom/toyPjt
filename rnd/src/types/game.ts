import Phaser from 'phaser';

export type RoomType = 'COMBAT' | 'ELITE' | 'EVENT' | 'RECOVERY' | 'BOSS';
export type CircleChoice = 'SAFE' | 'CHALLENGE' | 'SKIP';

export type RoomState = 'ENTERING' | 'LOCKED_WAVES' | 'CLEARED' | 'TRANSITION';

export type DoorDirection = 'top' | 'bottom' | 'left' | 'right';

export interface DoorLinks {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface RoomNode {
  id: string;
  gridX: number;
  gridY: number;
  type: RoomType;
  doors: DoorLinks;
  cleared: boolean;
  visited: boolean;
  waveCount: number;
  circleChoice?: CircleChoice;
}

export type DroneTier = 1 | 2 | 3 | 4;

export type DroneArchetype =
  | 'BASIC_LASER'       // Tier 1: 단일 타겟 레이저 펄스
  | 'GATLING_BOT'       // Tier 2: 고연사 저대미지
  | 'ROCKET_BOT'        // Tier 2: 범위 폭발 피해 (AoE)
  | 'STUN_BOT'          // Tier 2: 이동 속도 저하 디버프
  | 'PIERCE_BEAM'       // Tier 3 (GATLING 합성): 관통 레이저 빔
  | 'BLACKHOLE_MISSILE' // Tier 3 (ROCKET 합성): 중력장 광역 폭발탄
  | 'CHAIN_LIGHTNING'
  | 'STONE_GUARD' | 'HERBAL_PRIEST' | 'SPARK_SPIRIT' | 'SHADOW_DAGGER'
  | 'LAVA_GOLEM' | 'THORN_GUARD' | 'STORM_ARCHER' | 'MOON_PRIEST'
  | 'PALADIN' | 'THUNDER_MAGE' | 'SHADOW_ASSASSIN' | 'WORLD_DRUID'
  | 'PHOENIX_LORD' | 'STORM_GENERAL' | 'EARTH_DEITY';

export type Element = 'FOREST' | 'WIND' | 'FIRE' | 'FROST' | 'LIGHTNING' | 'EARTH' | 'SHADOW' | 'LIGHT';
export type UnitRole = 'VANGUARD' | 'MELEE' | 'RANGED' | 'MAGIC' | 'SUPPORT';
export type SkillShape = 'arrow' | 'streak' | 'fire' | 'frost' | 'star' | 'void' | 'bolt'
  | 'stone' | 'leaf' | 'slash' | 'thorn' | 'holy' | 'feather' | 'poison';
export type SkillEffectKind = 'cast' | 'hit' | 'heal' | 'shield' | 'buff' | 'revive' | 'reflect' | 'burn' | 'summon' | 'poison' | 'split';
export type SkillEffectFn = (kind: SkillEffectKind, x: number, y: number, unit: DroneArchetype) => void;
export interface CombatStyle {
  shape: SkillShape;
  color: number;
  accent: number;
  intensity: 'S' | 'M' | 'L';
}
export interface UnitTypeDef {
  id: DroneArchetype;
  name: string;
  tier: DroneTier;
  elements: Element[];
  role: UnitRole;
  tags: string[];
  summonable: boolean;
  summonCost?: number;
  weaponId: DroneArchetype;
  maxHp: number;
  healAmount: number;
}

export type IngredientSpec =
  | { kind?: 'unit'; unitTypeId: DroneArchetype; count: number }
  | { kind: 'query'; element?: Element; role?: UnitRole; minTier?: number; maxTier?: number; count: number };

export interface DroneSpec {
  archetype: DroneArchetype;
  name: string;
  tier: DroneTier;
  color: number;
  range: number;
  fireRateMs: number;
  damage: number;
  bulletSpeed: number;
  aoeRadius: number;
  slowFactor: number;
  slowDurationMs: number;
  pierceCount: number;
  chainCount: number;
  evolvesFrom?: DroneArchetype;
}

export interface DroneInstanceData {
  id: string;
  archetype: DroneArchetype;
  tier: DroneTier;
  deployed: boolean;
  star: 1 | 2 | 3;
}

export interface CombinationRecipe {
  id: string;
  ingredients: IngredientSpec[];
  resultUnitTypeId: DroneArchetype;
  resultCount: number;
  cost: number;
  priority: number;
  kind?: 'fixed' | 'query' | 'promotion';
  resultStar?: 1 | 2 | 3;
  ingredientStar?: 1 | 2 | 3;
  hidden?: boolean;
}

export interface SummonOffer {
  unitTypeId: DroneArchetype;
  cost: number;
}

export interface QuickCraftPlan {
  unitTypeId: DroneArchetype;
  totalCost: number;
  summonCost: number;
  combinationCost: number;
  summons: { unitTypeId: DroneArchetype; count: number; unitCost: number }[];
  combinations: { recipeId: string; count: number; unitCost: number }[];
}

export type EnemyArchetype = 'SWARMER' | 'CHASER' | 'TANK' | 'ELITE_BRUTE' | 'BOSS_CORE' | 'SPORE_SHOOTER' | 'EXPLODER' | 'SUMMONER';

export interface EnemySpec {
  archetype: EnemyArchetype;
  name: string;
  maxHp: number;
  speed: number;
  contactDamage: number;
  radius: number;
  color: number;
  scoreValue: number;
  mineralValue: number;
}

/** A life ID distinguishes a live target from a recycled sprite in the enemy pool. */
export interface ProjectileTarget {
  x: number;
  y: number;
  active: boolean;
  lifeId: number;
}

export interface ProjectileSkill {
  poison?: { damageRatio: number; durationMs: number; tickMs: number };
  split?: { count: 1 | 2; damageRatio: number; radius: number; lifespanMs: number };
  homing?: { turnRate: number };
}

export interface BulletFireConfig {
  sourceUnitId?: string;
  unitTypeId?: DroneArchetype;
  target?: ProjectileTarget;
  isFragment?: boolean;
  ignoredEnemyLifeId?: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  color: number;
  aoeRadius: number;
  slowFactor: number;
  slowDurationMs: number;
  pierceCount: number;
  chainCount: number;
}

export interface RewardOption {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  accentColor: number;
  costMinerals?: number;
  apply: () => void;
}

export interface RunStats {
  stageIndex: number;
  bossesDefeated: number;
  roomsCleared: number;
  enemiesDefeated: number;
  mineralsCollected: number;
  bossDefeated: boolean;
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  moveSpeedBonus: number;
}

export interface RosterSnapshot {
  units: DroneInstanceData[];
  minerals: number;
  freeSummons: number;
  nextId: number;
}

/** Only captured after entering a fresh stage, before its first combat update. */
export interface RunCheckpoint {
  version: 1;
  savedAt: number;
  stats: RunStats;
  roster: RosterSnapshot;
  leaderHealth: { currentHp: number; maxHp: number };
  unitHealth: { id: string; currentHp: number }[];
  grid: (RoomNode | null)[][];
}

export type StageState = 'PLAYING' | 'STAGE_CLEARED' | 'STAGE_TRANSITION';
export type BossPattern = 'CHARGE' | 'POISON' | 'METEOR' | 'FROST' | 'SUMMON';
export interface StageDef {
  index: number;
  name: string;
  themeId: string;
  palette: { background: number; floor: number; moss: number; wall: number };
  gridWidth: number;
  gridHeight: number;
  roomCount: number;
  eliteCount: number;
  enemyPoolIds: EnemyArchetype[];
  newEnemyIds: EnemyArchetype[];
  bossId: string;
  bossName: string;
  bossPatterns: BossPattern[];
  bossPhases: number;
  isFinal: boolean;
}
export interface StageScaling {
  enemyHpMult: number;
  enemyDamageMult: number;
  enemySpeedMult: number;
  waveCountBonus: number;
  spawnIntervalMult: number;
  rewardMult: number;
  bossHpMult: number;
  bossDamageMult: number;
  maxActiveEnemies: number;
}

export interface IComponent {
  update(time: number, delta: number): void;
  destroy(): void;
}

export interface ITargetable extends Phaser.GameObjects.Components.Transform {
  active: boolean;
  body: Phaser.Physics.Arcade.Body | null;
}
