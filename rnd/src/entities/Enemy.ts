import Phaser from 'phaser';
import { enemyTexture, enemyAnimation } from '../ui/pixelCharacters';
import { ARENA_BOUNDS, ENEMY_SPECS } from '../config/gameData';
import { HealthComponent } from '../components/HealthComponent';
import { MovementComponent } from '../components/MovementComponent';
import { EnemyArchetype, EnemySpec } from '../types/game';

export type EnemyAttackCallback = (enemy: Enemy, damage: number) => void;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private static nextLifeId = 0;
  public lifeId = 0;
  public spec: EnemySpec = ENEMY_SPECS.SWARMER;
  public health!: HealthComponent;
  public movement!: MovementComponent;

  private targetX = ARENA_BOUNDS.centerX;
  private targetY = ARENA_BOUNDS.centerY;
  private flashUntil = 0;
  private baseScale = 1;
  private lastAttackAt = 0;
  private attackAnimUntil = 0;
  private dashUntil = 0;
  private nextDashAt = 0;
  private onAttackPlayer?: EnemyAttackCallback;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, enemyTexture('SWARMER'), 0);
    this.setDepth(20);
    this.health = new HealthComponent(this.spec.maxHp);
  }

  public spawn(
    archetype: EnemyArchetype,
    x: number,
    y: number,
    hpMultiplier = 1,
    onAttackPlayer?: EnemyAttackCallback
  ): void {
    this.lifeId = ++Enemy.nextLifeId;
    this.spec = ENEMY_SPECS[archetype];
    this.onAttackPlayer = onAttackPlayer;
    this.enableBody(true, x, y, true, true);
    this.setPosition(x, y);
    this.setDepth(20);
    this.setAlpha(1);
    this.setVisible(true);

    const textureKey = enemyTexture(archetype);
    const animKey = enemyAnimation(archetype);

    this.setTexture(textureKey, 0);
    this.clearTint();
    if (this.scene.anims.exists(animKey)) {
      this.play(animKey, true);
    }

    const baseSize = archetype === 'BOSS_CORE' ? 104 : archetype === 'ELITE_BRUTE' ? 72 : 52;
    const desiredDiameter = this.spec.radius * 2.3;
    this.baseScale = desiredDiameter / baseSize;
    this.setScale(this.baseScale);

    const scaledHp = Math.round(this.spec.maxHp * hpMultiplier);
    this.health.reset(scaledHp);

    const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
    arcadeBody.setEnable(true);
    const bodyRadius = baseSize * 0.36;
    const bodyOffset = (baseSize - bodyRadius * 2) * 0.5;
    arcadeBody.setCircle(bodyRadius, bodyOffset, bodyOffset);
    arcadeBody.setBounce(0.35, 0.35);
    arcadeBody.setCollideWorldBounds(true);

    if (!this.movement) {
      this.movement = new MovementComponent(arcadeBody, this.spec.speed);
    } else {
      this.movement.baseSpeed = this.spec.speed;
      this.movement.clearModifiers();
    }

    this.flashUntil = 0;
    this.lastAttackAt = 0;
    this.attackAnimUntil = 0;
    this.dashUntil = 0;
    this.nextDashAt = this.scene.time.now + Phaser.Math.Between(1800, 3200);
  }

  public setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  public receiveDamage(
    amount: number,
    time: number,
    slowFactor = 1,
    slowDurationMs = 0
  ): boolean {
    if (!this.active) return false;

    if (slowFactor < 1 && slowDurationMs > 0 && this.movement) {
      this.movement.applySlow(slowFactor, slowDurationMs, time);
    }

    this.health.takeDamage(amount, time, 0);
    this.setTintFill(0xffffff);
    this.flashUntil = time + 65;

    if (this.health.isDead) {
      this.deactivate();
      return true;
    }
    return false;
  }

  public deactivate(): void {
    if (this.movement) {
      this.movement.stop();
    }
    this.clearTint();
    this.disableBody(true, true);
  }

  public override update(time: number, delta: number): void {
    if (!this.active || !this.movement) return;

    // 피격 점멸 및 슬로우 색상 복원
    if (this.flashUntil > 0 && time >= this.flashUntil) {
      this.flashUntil = 0;
      if (this.movement.slowFactor < 1.0) {
        this.setTint(0x67e8f9);
      } else {
        this.clearTint();
      }
    } else if (this.flashUntil === 0) {
      if (this.movement.slowFactor < 1.0) {
        this.setTint(0x67e8f9);
      } else {
        this.clearTint();
      }
    }

    // 공격 모션 스케일 복원
    if (this.attackAnimUntil > 0) {
      if (time < this.attackAnimUntil) {
        this.setScale(this.baseScale * 1.28);
      } else {
        this.attackAnimUntil = 0;
        this.setScale(this.baseScale);
      }
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // 러셔/정예/보스 돌진 가속 패턴
    const canDash =
      this.spec.archetype === 'CHASER' ||
      this.spec.archetype === 'ELITE_BRUTE' ||
      this.spec.archetype === 'BOSS_CORE';
    if (canDash && time >= this.nextDashAt && dist < 340) {
      this.dashUntil = time + 380;
      this.nextDashAt = time + Phaser.Math.Between(2400, 3800);
    }

    const speedMultiplier = time < this.dashUntil ? 1.75 : 1.0;
    this.movement.baseSpeed = this.spec.speed * speedMultiplier;
    this.movement.moveAlongAngle(angle, time);
    this.movement.update(time, delta);
    this.setFlipX(dx < 0);

    // 근접 공격 사거리 진입 시 능동 공격 판정 및 물어뜯기 모션
    const attackRange = this.spec.radius + 28;
    if (dist <= attackRange && time - this.lastAttackAt >= 680) {
      this.lastAttackAt = time;
      this.attackAnimUntil = time + 150;
      if (this.onAttackPlayer) {
        this.onAttackPlayer(this, this.spec.contactDamage);
      }
    }
  }
}

export class EnemyGroup extends Phaser.Physics.Arcade.Group {
  public onAttackPlayer?: EnemyAttackCallback;

  constructor(scene: Phaser.Scene, onAttackPlayer?: EnemyAttackCallback) {
    super(scene.physics.world, scene, {
      classType: Enemy,
      maxSize: 80,
      runChildUpdate: true
    });
    this.onAttackPlayer = onAttackPlayer;
    scene.sys.updateList.add(this as unknown as Phaser.GameObjects.GameObject);
  }

  public spawnEnemy(
    archetype: EnemyArchetype,
    x: number,
    y: number,
    hpMultiplier = 1
  ): Enemy | null {
    const enemy = this.get(x, y, enemyTexture('SWARMER')) as Enemy | null;
    if (!enemy) return null;
    enemy.spawn(archetype, x, y, hpMultiplier, this.onAttackPlayer);
    return enemy;
  }

  public updateTargetForAll(x: number, y: number): void {
    const children = this.getChildren();
    for (let i = 0; i < children.length; i++) {
      const enemy = children[i] as Enemy;
      if (enemy.active) {
        enemy.setTargetPosition(x, y);
      }
    }
  }
}
