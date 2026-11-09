import Phaser from 'phaser';
import { ARENA_BOUNDS } from '../config/gameData';
import { HealthComponent } from '../components/HealthComponent';
import { MovementComponent } from '../components/MovementComponent';
import { WeaponComponent, FireBulletFn } from '../components/WeaponComponent';
import { SquadRoster } from '../systems/SquadRoster';
import { DroneUnit } from './DroneUnit';
import { UNIT_TYPES } from '../config/unitData';
import { SUPPORT_HEAL_INTERVAL_MS, UNIT_REVIVE_RATIO, ROOM_ENTRY_HP_RATIO, RECOVERY_ROOM_HEAL_RATIO } from '../config/squadData';
import { UNIQUE_SKILLS } from '../config/skillData';
import type { DroneArchetype, SkillEffectFn } from '../types/game';
import type { Enemy } from './Enemy';
import type { CombatMeasurements } from '../systems/CombatMeasurements';
import { HeroProgression } from '../systems/HeroProgression';
import { heroBaseStats, heroWeaponSpec } from '../config/heroData';
import type { HeroSnapshot, DamageSourceKind } from '../types/game';
import { resolveUpgradeEffects, upgradedUnitMaxHp, upgradedAttackSpeed } from '../systems/UpgradeEffects';
import { RELIC_HEAL_INTERVAL_MS, RELIC_HEAL_AMOUNT } from '../config/relicData';
import { activeCooldown } from '../config/heroAbilities';
import { HERO_CLASSES } from '../config/heroClassData';
import type { HeroClassId, PermanentRanks } from '../types/game';
import { SERVICES } from '../config/expeditionFacilities';
import type { ServiceId, ServiceQuote } from '../types/game';
import { resolveSynergies } from '../config/synergyData';

export class PlayerSquad {
  public scene: Phaser.Scene;
  public leader: Phaser.Physics.Arcade.Sprite;
  public drones: DroneUnit[] = [];
  public health: HealthComponent;
  public movement: MovementComponent;
  public readonly roster = new SquadRoster();
  public readonly hero = new HeroProgression();
  private readonly heroWeapon: WeaponComponent;
  private heroTimeMs = 0;
  private upgradeEffects = resolveUpgradeEffects(this.roster.upgrades);
  private appliedHeroHealthBonus = 0;
  private relicHealLeft = RELIC_HEAL_INTERVAL_MS;
  private activeLeft = 0;

  private fireCallback: FireBulletFn;
  private flashUntil = 0;
  private measurements: CombatMeasurements | null = null;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    fireCallback: FireBulletFn,
    onDeath: () => void,
    onDamaged: (amount: number, current: number, max: number) => void,
    private readonly effect?: SkillEffectFn,
    initialHero?:{classId:HeroClassId;permanent:PermanentRanks}
  ) {
    this.scene = scene;
    this.fireCallback = fireCallback;
    if(initialHero)this.hero.restore({...this.hero.snapshot(),classId:initialHero.classId,permanent:initialHero.permanent});

    // 1. 본체(Leader) 생성 - 64x64 애니메이션 스프라이트
    this.leader = scene.physics.add.sprite(startX, startY, 'spr_player_leader', 0);
    this.leader.setDepth(26);
    if (scene.anims.exists('anim_player_leader')) {
      this.leader.play('anim_player_leader');
    }

    const body = this.leader.body as Phaser.Physics.Arcade.Body;
    body.setCircle(18, 14, 14);
    body.setCollideWorldBounds(true);

    this.health = new HealthComponent(heroBaseStats(1,this.hero.classId,this.hero.permanent).maxHp, onDeath, onDamaged);
    this.movement = new MovementComponent(body, 250);
    this.heroWeapon = new WeaponComponent(heroWeaponSpec(1,this.hero.classId,this.hero.permanent), fireCallback, 'hero', 'hero');
    this.heroWeapon.restoreCooldown(this.heroTimeMs, 0);

    this.syncRoster();
    this.applyHeroTint();
  }

  public heroSnapshot(): HeroSnapshot { return this.hero.snapshot(this.heroWeapon.cooldownRemaining(this.heroTimeMs), this.activeLeft); }

  public activeRemaining(): number { return this.activeLeft; }

  public serviceQuote(id: ServiceId): ServiceQuote | null {
    if (!Object.prototype.hasOwnProperty.call(SERVICES, id) || this.health.isDead) return null;
    const useful = id === 'HEAL' ? this.health.currentHp < this.health.maxHp ||
      this.drones.some(unit => !unit.health.isDead && unit.health.currentHp < unit.health.maxHp)
      : this.drones.some(unit => unit.health.isDead);
    if (!useful) return null;
    const stateKey = `${this.health.currentHp}/${this.health.maxHp}|` + this.drones.map(unit =>
      `${unit.id}:${unit.health.currentHp}/${unit.health.maxHp}`).sort().join('|');
    return { id, cost: SERVICES[id].cost, stateKey };
  }

  /** Management owns authorization; validate all targets and the quote before the single debit. */
  public buyService(quote: ServiceQuote, managementAllowed: boolean): boolean {
    if (!managementAllowed || !quote) return false;
    const current = this.serviceQuote(quote.id);
    if (!current || current.cost !== quote.cost || current.stateKey !== quote.stateKey ||
      !this.roster.payService(current.id, current.cost)) return false;
    if (quote.id === 'HEAL') {
      this.health.heal(this.health.maxHp);
      for (const unit of this.drones) if (!unit.health.isDead) unit.health.heal(unit.health.maxHp);
    } else for (const unit of this.drones) if (unit.health.isDead) {
      unit.health.heal(Math.max(1, Math.round(unit.health.maxHp * UNIT_REVIVE_RATIO)));
      unit.health.invulnerableUntil = 0; unit.reviveAt = 0;
      unit.setActive(true).setVisible(true);
      this.measurements?.recordRevival('service');
    }
    return true;
  }
  public activeDuration(): number { return activeCooldown(this.hero.talents); }
  public castCommandHeal(combatActive: boolean): boolean {
    if (!combatActive || this.health.isDead || this.activeLeft > 0) return false;
    let healed = 0;
    const ability=HERO_CLASSES[this.hero.classId];
    const heal = (target: HealthComponent, x: number, y: number) => {
      const effective = target.isDead ? 0 : target.heal(ability.heal);
      this.measurements?.recordHealing('COMMAND_HEAL', target === this.health ? 'leader' : 'unit', ability.heal, effective, target.isDead);
      if (effective > 0) { healed += effective; this.effect?.('heal', x, y, 'HERBAL_PRIEST'); }
    };
    heal(this.health, this.leader.x, this.leader.y);
    if(!ability.selfOnly)for (const drone of this.drones) heal(drone.health, drone.x, drone.y);
    const cleansed=ability.cleanse&&this.movement.slowFactor<1&&this.scene.time.now<=this.movement.slowUntil;
    if(cleansed){this.movement.clearModifiers();this.effect?.('buff',this.leader.x,this.leader.y,'SPARK_SPIRIT');}
    if (healed <= 0&&!cleansed) return false;
    this.activeLeft = this.activeDuration(); return true;
  }

  public relicHealingRemaining(): number { return this.relicHealLeft; }

  public restoreRelicHealing(remaining: number | undefined): void {
    this.relicHealLeft = remaining ?? RELIC_HEAL_INTERVAL_MS;
  }

  public restoreHero(saved: HeroSnapshot | undefined): void {
    if (!saved || !this.hero.restore(saved)) return;
    this.activeLeft = saved.activeRemainingMs ?? 0;
    this.refreshHeroWeapon();
    this.heroWeapon.restoreCooldown(this.heroTimeMs, saved.attackRemainingMs);
    this.applyHeroTint();
  }

  public recordHeroKill(kind: DamageSourceKind, xp: number): number {
    const before = heroBaseStats(this.hero.level,this.hero.classId,this.hero.permanent).maxHp;
    const levels = this.hero.recordKill(kind, xp);
    if (levels > 0) {
      this.health.maxHp += heroBaseStats(this.hero.level,this.hero.classId,this.hero.permanent).maxHp - before;
      this.refreshHeroWeapon();
    }
    return levels;
  }

  public syncRoster(): void {
    const hadRelicHealing = this.upgradeEffects.relicHealing;
    this.upgradeEffects = resolveUpgradeEffects(this.roster.upgrades, this.roster.relicIds(), this.hero.talents, resolveSynergies(this.roster.units));
    this.activeLeft = Math.min(this.activeLeft, this.activeDuration());
    if (hadRelicHealing !== this.upgradeEffects.relicHealing) this.relicHealLeft = RELIC_HEAL_INTERVAL_MS;
    const deployed = this.roster.units.filter(unit => unit.deployed);
    for (const drone of this.drones) {
      if (!deployed.some(unit => unit.id === drone.id)) drone.destroy();
    }
    this.drones = deployed.map((unit, index) => {
      const existing = this.drones.find(drone => drone.id === unit.id);
      if (existing) { existing.awakening = unit.awakening ?? 0; return existing; }
      const drone = new DroneUnit(this.scene, unit.id, unit.archetype, this.fireCallback, unit.star, unit.awakening ?? 0);
      // A new summon starts full at its upgraded maximum; buying HP never heals existing units.
      drone.health.reset(upgradedUnitMaxHp(unit.archetype, unit.star, this.upgradeEffects.squadHealth, unit.awakening));
      drone.setPosition(
        Phaser.Math.Clamp(this.leader.x + (index % 3 - 1) * 44, ARENA_BOUNDS.left + 20, ARENA_BOUNDS.right - 20),
        Phaser.Math.Clamp(this.leader.y + 45 + Math.floor(index / 3) * 40, ARENA_BOUNDS.top + 20, ARENA_BOUNDS.bottom - 20)
      );
      this.effect?.('summon', drone.x, drone.y, drone.archetype);
      return drone;
    });
    this.applyUpgradeEffects();
    this.setCombatMeasurements(this.measurements);
  }

  private refreshHeroWeapon(): void {
    const spec = heroWeaponSpec(this.hero.level,this.hero.classId,this.hero.permanent);
    spec.damage += this.upgradeEffects.heroAttack;
    this.heroWeapon.setSpec(spec);
  }

  private applyHeroTint():void {
    if(this.hero.classId==='APPRENTICE_SUMMONER')this.leader.clearTint();
    else this.leader.setTint(HERO_CLASSES[this.hero.classId].color);
  }

  private applyUpgradeEffects(): void {
    this.health.maxHp += this.upgradeEffects.heroHealth - this.appliedHeroHealthBonus;
    this.appliedHeroHealthBonus = this.upgradeEffects.heroHealth;
    this.health.currentHp = Math.min(this.health.currentHp, this.health.maxHp);
    this.health.damageReduction = this.upgradeEffects.damageReduction;
    this.refreshHeroWeapon();
    for (const drone of this.drones) {
      drone.health.maxHp = upgradedUnitMaxHp(drone.archetype, drone.star, this.upgradeEffects.squadHealth, drone.awakening);
      drone.health.currentHp = Math.min(drone.health.currentHp, drone.health.maxHp);
      drone.health.damageReduction = this.upgradeEffects.damageReduction;
    }
  }

  public setCombatMeasurements(measurements: CombatMeasurements | null): void {
    this.measurements = measurements;
    this.health.damageObserver = measurements?.leaderDamage;
    for (const drone of this.drones) drone.health.damageObserver = measurements?.allyDamage;
  }

  public setPositionImmediate(x: number, y: number): void {
    this.leader.setPosition(x, y);
    (this.leader.body as Phaser.Physics.Arcade.Body).reset(x, y);
    const count = this.drones.length;
    for (let i = 0; i < count; i++) {
      this.drones[i].setPosition(
        Phaser.Math.Clamp(x + (i % 3 - 1) * 40, ARENA_BOUNDS.left + 20, ARENA_BOUNDS.right - 20),
        Phaser.Math.Clamp(y + Math.floor(i / 3) * 40, ARENA_BOUNDS.top + 20, ARENA_BOUNDS.bottom - 20)
      );
    }
  }

  public receiveContactDamage(amount: number, time: number): boolean {
    if (time < this.health.invulnerableUntil) return false;
    const protector = this.drones.find(drone => !drone.health.isDead &&
      (drone.archetype === 'PALADIN' || drone.archetype === 'EARTH_DEITY'));
    if (protector) {
      const absorbed = Math.round(amount * (protector.archetype === 'EARTH_DEITY' ? 0.4 : 0.3));
      if (absorbed > 0) {
        protector.health.takeDamage(absorbed, time, 0);
        this.effect?.('hit', protector.x, protector.y, protector.archetype);
      }
      amount -= absorbed;
    }
    const damaged = this.health.takeDamage(amount, time, 650);
    if (damaged) {
      this.leader.setTintFill(0xff4d4d);
      this.flashUntil = time + 160;
    }
    return damaged;
  }

  public reviveFallen(): void {
    for (const drone of this.drones) {
      if (!drone.health.isDead) continue;
      drone.health.heal(Math.round(drone.health.maxHp * UNIT_REVIVE_RATIO));
      drone.health.invulnerableUntil = 0;
      drone.reviveAt = 0;
      drone.setActive(true).setVisible(true);
      this.measurements?.recordRevival('room');
      this.effect?.('revive', drone.x, drone.y, drone.archetype);
    }
  }

  public clearCombatEffects(): void {
    this.health.clearShield();
    for (const drone of this.drones) {
      drone.health.clearShield();
      drone.attackBuffMultiplier = 1;
      drone.hadAttackBuff = false;
      drone.lastSkillAt = this.scene.time.now;
    }
  }

  /** Real room transitions give survivors the same minimum HP as a room revival. */
  public recoverForRoomEntry(): void {
    this.reviveFallen();
    for (const drone of this.drones) {
      const missing = Math.round(drone.health.maxHp * ROOM_ENTRY_HP_RATIO) - drone.health.currentHp;
      if (missing > 0 && drone.health.heal(missing) > 0) this.effect?.('heal', drone.x, drone.y, drone.archetype);
    }
  }

  /** The room state owns the once-only gate; ordinary healing never revives dead units. */
  public recoverAtSpring(): { leaderHealed: number; unitHealed: number; unitsRecovered: number } {
    const result = { leaderHealed: this.health.isDead ? 0 : this.health.heal(Math.round(this.health.maxHp * RECOVERY_ROOM_HEAL_RATIO)),
      unitHealed: 0, unitsRecovered: 0 };
    for (const drone of this.drones) {
      if (drone.health.isDead) continue;
      const amount = drone.health.heal(Math.round(drone.health.maxHp * RECOVERY_ROOM_HEAL_RATIO));
      if (amount <= 0) continue;
      result.unitHealed += amount; result.unitsRecovered++;
      this.effect?.('heal', drone.x, drone.y, drone.archetype);
    }
    return result;
  }

  public onKill(sourceUnitId?: string): void {
    const source = this.drones.find(drone => drone.id === sourceUnitId && !drone.health.isDead);
    if (source?.archetype !== 'SHADOW_ASSASSIN') return;
    source.weapon.reduceCooldown(UNIQUE_SKILLS.assassin.cooldownReductionMs);
    this.effect?.('buff', source.x, source.y, source.archetype);
  }

  private heal(target: HealthComponent, x: number, y: number, amount: number, source: DroneArchetype): void {
    const dead = target.isDead;
    const effective = dead ? 0 : target.heal(amount);
    this.measurements?.recordHealing(source, target === this.health ? 'leader' : 'unit', amount, effective, dead);
    if (effective > 0) this.effect?.('heal', x, y, source);
  }

  private healFromRelic(target: HealthComponent, x: number, y: number): void {
    const effective = target.isDead ? 0 : target.heal(RELIC_HEAL_AMOUNT);
    this.measurements?.recordHealing('SEED_CHALICE', target === this.health ? 'leader' : 'unit',
      RELIC_HEAL_AMOUNT, effective, target.isDead);
    if (effective > 0) this.effect?.('heal', x, y, 'HERBAL_PRIEST');
  }

  private updateSkills(time: number, enemies: Phaser.GameObjects.Group, damageMultiplier: number): void {
    for (const drone of this.drones) {
      if (drone.health.isDead) continue;
      if (drone.archetype === 'WORLD_DRUID') {
        const radiusSq = UNIQUE_SKILLS.druid.radius ** 2;
        for (const ally of this.drones) {
          if (ally === drone || ally.health.isDead || (ally.x - drone.x) ** 2 + (ally.y - drone.y) ** 2 > radiusSq) continue;
          ally.attackBuffMultiplier = Math.max(ally.attackBuffMultiplier, UNIQUE_SKILLS.druid.damageMultiplier);
        }
      } else if (drone.archetype === 'LAVA_GOLEM' && time - drone.lastSkillAt >= UNIQUE_SKILLS.lava.intervalMs) {
        drone.lastSkillAt = time;
        let applied = false;
        for (const child of enemies.getChildren()) {
          const enemy = child as Enemy;
          if (!enemy.active || (enemy.x - drone.x) ** 2 + (enemy.y - drone.y) ** 2 > UNIQUE_SKILLS.lava.radius ** 2) continue;
          enemy.burn.apply(Math.round(UNIQUE_SKILLS.lava.burnDamage * drone.star * damageMultiplier), time, drone.id);
          applied = true;
        }
        if (applied) this.effect?.('burn', drone.x, drone.y, drone.archetype);
      } else if (drone.archetype === 'PHOENIX_LORD' && time - drone.lastSkillAt >= UNIQUE_SKILLS.phoenix.cooldownMs) {
        const fallen = this.drones.find(ally => ally !== drone && ally.health.isDead);
        if (!fallen) continue;
        drone.lastSkillAt = time;
        fallen.health.heal(Math.round(fallen.health.maxHp * UNIQUE_SKILLS.phoenix.reviveRatio));
        fallen.health.invulnerableUntil = time + 650;
        fallen.reviveAt = 0;
        fallen.setActive(true).setVisible(true);
        this.measurements?.recordRevival('phoenix');
        this.effect?.('revive', fallen.x, fallen.y, drone.archetype);
      } else if (drone.archetype === 'EARTH_DEITY' && time - drone.lastSkillAt >= UNIQUE_SKILLS.deity.cooldownMs) {
        drone.lastSkillAt = time;
        const radiusSq = UNIQUE_SKILLS.deity.radius ** 2;
        const amount = UNIQUE_SKILLS.deity.shieldHp * drone.star;
        if ((this.leader.x - drone.x) ** 2 + (this.leader.y - drone.y) ** 2 <= radiusSq) {
          this.health.applyShield(amount, time + UNIQUE_SKILLS.deity.durationMs);
          this.effect?.('shield', this.leader.x, this.leader.y, drone.archetype);
        }
        for (const ally of this.drones) {
          if (ally.health.isDead || (ally.x - drone.x) ** 2 + (ally.y - drone.y) ** 2 > radiusSq) continue;
          ally.health.applyShield(amount, time + UNIQUE_SKILLS.deity.durationMs);
          this.effect?.('shield', ally.x, ally.y, drone.archetype);
        }
      }
    }
  }

  public findEnemyTarget(enemyX: number, enemyY: number): DroneUnit | null {
    let target: DroneUnit | null = null;
    let nearest = (enemyX - this.leader.x) ** 2 + (enemyY - this.leader.y) ** 2;
    let hasVanguard = false;
    for (const drone of this.drones) {
      if (drone.health.isDead) continue;
      const dist = (drone.x - enemyX) ** 2 + (drone.y - enemyY) ** 2;
      const vanguard = UNIT_TYPES[drone.archetype].role === 'VANGUARD' && dist < 300 ** 2;
      if ((vanguard && !hasVanguard) || (vanguard === hasVanguard && dist < nearest)) {
        target = drone;
        nearest = dist;
        hasVanguard = vanguard;
      }
    }
    return target;
  }

  public update(
    time: number,
    delta: number,
    inputDirX: number,
    inputDirY: number,
    enemies: Phaser.GameObjects.Group,
    damageMultiplier: number,
    attackSpeedMultiplier: number,
    moveSpeedBonus: number,
    combatActive = true
  ): void {
    // This clock advances only when the squad updates, so management/background pauses freeze fire cooldowns.
    this.heroTimeMs += Math.max(0, delta);
    if (combatActive) this.activeLeft = Math.max(0, this.activeLeft - Math.max(0, delta));
    const squadDamage = damageMultiplier * this.upgradeEffects.squadAttack;
    const squadSpeed = upgradedAttackSpeed(attackSpeedMultiplier, this.upgradeEffects.squadSpeed);
    // 본체 피격 점멸 해제 및 무적 시간 투명도 연출
    if (this.flashUntil > 0 && time >= this.flashUntil) {
      this.flashUntil = 0;
      this.applyHeroTint();
    }
    this.leader.setAlpha(time < this.health.invulnerableUntil ? 0.6 : 1.0);
    this.health.update(time, delta);
    for (const drone of this.drones) {
      drone.health.update(time, delta);
      drone.attackBuffMultiplier = 1;
      if (drone.health.isDead && time >= drone.reviveAt) {
        drone.health.heal(Math.round(drone.health.maxHp * UNIT_REVIVE_RATIO));
        drone.health.invulnerableUntil = time + 650;
        drone.setActive(true).setVisible(true);
        this.measurements?.recordRevival('automatic');
        this.effect?.('revive', drone.x, drone.y, drone.archetype);
      }
    }
    if (combatActive && !this.health.isDead && this.upgradeEffects.relicHealing) {
      this.relicHealLeft = Math.max(0, this.relicHealLeft - Math.max(0, delta));
      if (this.relicHealLeft === 0) {
        // One tick at most: a stalled frame cannot produce a burst of accumulated healing.
        this.relicHealLeft = RELIC_HEAL_INTERVAL_MS;
        this.healFromRelic(this.health, this.leader.x, this.leader.y);
        for (const drone of this.drones) this.healFromRelic(drone.health, drone.x, drone.y);
      }
    }
    if (combatActive) this.updateSkills(time, enemies, squadDamage);
    for (const drone of this.drones) {
      if (drone.attackBuffMultiplier > 1 && !drone.hadAttackBuff)
        this.effect?.('buff', drone.x, drone.y, 'WORLD_DRUID');
      drone.hadAttackBuff = drone.attackBuffMultiplier > 1;
    }

    // 본체 이동 및 조향
    this.movement.moveInDirection(inputDirX, inputDirY, time, moveSpeedBonus);
    if (Math.abs(inputDirX) > 0.05 || Math.abs(inputDirY) > 0.05) {
      if (Math.abs(inputDirX) > 0.05) this.leader.setFlipX(inputDirX < 0);
    }

    // 아레나 경계 클램핑
    this.leader.x = Phaser.Math.Clamp(this.leader.x, ARENA_BOUNDS.left + 24, ARENA_BOUNDS.right - 24);
    this.leader.y = Phaser.Math.Clamp(this.leader.y, ARENA_BOUNDS.top + 24, ARENA_BOUNDS.bottom - 24);

    if (combatActive && !this.health.isDead) this.heroWeapon.tryFire(this.heroTimeMs,
      this.leader.x, this.leader.y, enemies, 1, 1);

    for (let i = 0; i < this.drones.length; i++) {
      const drone = this.drones[i];
      const type = UNIT_TYPES[drone.archetype];
      if (!drone.health.isDead && type.healAmount > 0 && time - drone.lastHealAt >= SUPPORT_HEAL_INTERVAL_MS) {
        drone.lastHealAt = time;
        this.heal(this.health, this.leader.x, this.leader.y, type.healAmount * drone.star, drone.archetype);
        for (const ally of this.drones) this.heal(ally.health, ally.x, ally.y, type.healAmount * drone.star, drone.archetype);
      }
      drone.updateDrone(time, delta,
        this.leader.x + (i % 3 - 1) * 44,
        this.leader.y + 45 + Math.floor(i / 3) * 40,
        enemies, squadDamage, squadSpeed, combatActive);
    }
  }
}
