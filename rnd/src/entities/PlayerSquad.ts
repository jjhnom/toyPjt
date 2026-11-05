import Phaser from 'phaser';
import { ARENA_BOUNDS } from '../config/gameData';
import { HealthComponent } from '../components/HealthComponent';
import { MovementComponent } from '../components/MovementComponent';
import { FireBulletFn } from '../components/WeaponComponent';
import { SquadRoster } from '../systems/SquadRoster';
import { DroneUnit } from './DroneUnit';
import { UNIT_TYPES } from '../config/unitData';
import { SUPPORT_HEAL_INTERVAL_MS, UNIT_REVIVE_RATIO } from '../config/squadData';
import { UNIQUE_SKILLS } from '../config/skillData';
import type { DroneArchetype, SkillEffectFn } from '../types/game';
import type { Enemy } from './Enemy';

export class PlayerSquad {
  public scene: Phaser.Scene;
  public leader: Phaser.Physics.Arcade.Sprite;
  public drones: DroneUnit[] = [];
  public health: HealthComponent;
  public movement: MovementComponent;
  public readonly roster = new SquadRoster();

  private fireCallback: FireBulletFn;
  private flashUntil = 0;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    fireCallback: FireBulletFn,
    onDeath: () => void,
    onDamaged: (amount: number, current: number, max: number) => void,
    private readonly effect?: SkillEffectFn
  ) {
    this.scene = scene;
    this.fireCallback = fireCallback;

    // 1. 본체(Leader) 생성 - 64x64 애니메이션 스프라이트
    this.leader = scene.physics.add.sprite(startX, startY, 'spr_player_leader', 0);
    this.leader.setDepth(26);
    if (scene.anims.exists('anim_player_leader')) {
      this.leader.play('anim_player_leader');
    }

    const body = this.leader.body as Phaser.Physics.Arcade.Body;
    body.setCircle(18, 14, 14);
    body.setCollideWorldBounds(true);

    this.health = new HealthComponent(100, onDeath, onDamaged);
    this.movement = new MovementComponent(body, 250);

    this.syncRoster();
  }

  public syncRoster(): void {
    const deployed = this.roster.units.filter(unit => unit.deployed);
    for (const drone of this.drones) {
      if (!deployed.some(unit => unit.id === drone.id)) drone.destroy();
    }
    this.drones = deployed.map((unit, index) => {
      const existing = this.drones.find(drone => drone.id === unit.id);
      if (existing) return existing;
      const drone = new DroneUnit(this.scene, unit.id, unit.archetype, this.fireCallback, unit.star);
      drone.setPosition(
        Phaser.Math.Clamp(this.leader.x + (index % 3 - 1) * 44, ARENA_BOUNDS.left + 20, ARENA_BOUNDS.right - 20),
        Phaser.Math.Clamp(this.leader.y + 45 + Math.floor(index / 3) * 40, ARENA_BOUNDS.top + 20, ARENA_BOUNDS.bottom - 20)
      );
      this.effect?.('summon', drone.x, drone.y, drone.archetype);
      return drone;
    });
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

  public onKill(sourceUnitId?: string): void {
    const source = this.drones.find(drone => drone.id === sourceUnitId && !drone.health.isDead);
    if (source?.archetype !== 'SHADOW_ASSASSIN') return;
    source.weapon.reduceCooldown(UNIQUE_SKILLS.assassin.cooldownReductionMs);
    this.effect?.('buff', source.x, source.y, source.archetype);
  }

  private heal(target: HealthComponent, x: number, y: number, amount: number, source: DroneArchetype): void {
    if (!target.isDead && target.heal(amount) > 0) this.effect?.('heal', x, y, source);
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
    // 본체 피격 점멸 해제 및 무적 시간 투명도 연출
    if (this.flashUntil > 0 && time >= this.flashUntil) {
      this.flashUntil = 0;
      this.leader.clearTint();
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
        this.effect?.('revive', drone.x, drone.y, drone.archetype);
      }
    }
    if (combatActive) this.updateSkills(time, enemies, damageMultiplier);
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
        enemies, damageMultiplier, attackSpeedMultiplier, combatActive);
    }
  }
}
