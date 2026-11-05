import Phaser from 'phaser';
import { ARENA_BOUNDS } from '../config/gameData';
import { BulletFireConfig, DroneArchetype, ProjectileTarget } from '../types/game';
import { UNIT_COMBAT_STYLES, UNIT_PROJECTILE_SKILLS } from '../config/skillData';
import { skillProjectileTexture } from '../ui/skillEffectTextures';

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  public damage = 10;
  public aoeRadius = 0;
  public slowFactor = 1;
  public slowDurationMs = 0;
  public remainingPierces = 0;
  public remainingChains = 0;
  public bulletColor = 0xffffff;
  public readonly hitEnemyLives = new Set<number>();
  public sourceUnitId: string | undefined;
  public unitTypeId: DroneArchetype = 'BASIC_LASER';
  public splitPending = false;
  public flightSpeed = 0;
  public isFragment = false;
  private homingTarget: ProjectileTarget | undefined;
  private homingLifeId = 0;
  private turnRate = 0;
  public onTrail?: (unit: DroneArchetype, x: number, y: number, angle: number) => void;
  private trailMs = 0;

  private lifespanMs = 1500;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'spr_bullet', 0);
    this.setDepth(30);
  }

  public fire(config: BulletFireConfig): void {
    this.enableBody(true, config.x, config.y, true, true);
    this.setPosition(config.x, config.y);
    this.sourceUnitId = config.sourceUnitId;
    this.unitTypeId = config.unitTypeId ?? 'BASIC_LASER';
    this.isFragment = config.isFragment ?? false;
    const skill = this.isFragment ? undefined : UNIT_PROJECTILE_SKILLS[this.unitTypeId];
    this.splitPending = !!skill?.split;
    this.turnRate = skill?.homing?.turnRate ?? 0;
    this.homingTarget = this.turnRate > 0 ? config.target : undefined;
    this.homingLifeId = this.homingTarget?.lifeId ?? 0;
    this.flightSpeed = config.speed;
    this.trailMs = 0;
    this.anims.stop();
    this.setTexture(skillProjectileTexture(this.unitTypeId));
    this.setRotation(config.angle);
    const visualColor = UNIT_COMBAT_STYLES[this.unitTypeId].color;
    this.clearTint().setAlpha(1).setFlipX(false);
    this.setDepth(30);
    const scale = this.isFragment ? 0.7 : config.aoeRadius > 0 ? 1.45 : config.pierceCount > 0 ? 1.3 : 1.05;
    this.setDisplaySize(20 * scale, 20 * scale);

    this.damage = config.damage;
    this.aoeRadius = this.isFragment ? 0 : config.aoeRadius;
    this.slowFactor = this.isFragment ? 1 : config.slowFactor;
    this.slowDurationMs = this.isFragment ? 0 : config.slowDurationMs;
    this.remainingPierces = this.isFragment ? 0 : config.pierceCount;
    this.remainingChains = this.isFragment ? 0 : config.chainCount;
    this.bulletColor = visualColor;
    this.hitEnemyLives.clear();
    if (config.ignoredEnemyLifeId !== undefined) this.hitEnemyLives.add(config.ignoredEnemyLifeId);
    this.elapsedMs = 0;
    this.lifespanMs = this.isFragment ? UNIT_PROJECTILE_SKILLS.STORM_ARCHER!.split!.lifespanMs : 1500;

    if (this.body) {
      const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
      // Preserve the old 20x20 projectile's collision diameter at every visual size.
      arcadeBody.setCircle(7 * 32 / 20, 3 * 32 / 20, 3 * 32 / 20);
      arcadeBody.setVelocity(
        Math.cos(config.angle) * config.speed,
        Math.sin(config.angle) * config.speed
      );
    }
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.hitEnemyLives.clear();
    this.sourceUnitId = undefined;
    this.homingTarget = undefined;
    this.homingLifeId = this.turnRate = 0;
    this.splitPending = false;
  }

  public override update(_time: number, delta: number): void {
    if (!this.active) return;

    this.elapsedMs += delta;
    const target = this.homingTarget;
    if (target && (!target.active || target.lifeId !== this.homingLifeId)) this.homingTarget = undefined;
    else if (target) {
      const desired = Math.atan2(target.y - this.y, target.x - this.x);
      const difference = Math.atan2(Math.sin(desired - this.rotation), Math.cos(desired - this.rotation));
      const step = this.turnRate * delta / 1000;
      this.setRotation(this.rotation + Math.max(-step, Math.min(step, difference)));
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(this.rotation) * this.flightSpeed, Math.sin(this.rotation) * this.flightSpeed);
    }
    this.trailMs += delta;
    if (this.trailMs >= 90) {
      this.trailMs %= 90;
      this.onTrail?.(this.unitTypeId, this.x, this.y, this.rotation);
    }
    if (
      this.elapsedMs >= this.lifespanMs ||
      this.x < ARENA_BOUNDS.left - 20 ||
      this.x > ARENA_BOUNDS.right + 20 ||
      this.y < ARENA_BOUNDS.top - 20 ||
      this.y > ARENA_BOUNDS.bottom + 20
    ) {
      this.deactivate();
    }
  }
}

export class BulletGroup extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene, private readonly onTrail?: Bullet['onTrail']) {
    super(scene.physics.world, scene, {
      classType: Bullet,
      maxSize: 160,
      runChildUpdate: true
    });
    scene.sys.updateList.add(this as unknown as Phaser.GameObjects.GameObject);
  }

  public fireBullet(config: BulletFireConfig): Bullet | null {
    const bullet = this.get(config.x, config.y, 'spr_bullet') as Bullet | null;
    if (!bullet) return null;
    bullet.fire(config);
    bullet.onTrail = this.onTrail;
    return bullet;
  }
}
