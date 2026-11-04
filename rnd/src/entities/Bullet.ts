import Phaser from 'phaser';
import { ARENA_BOUNDS } from '../config/gameData';
import { BulletFireConfig } from '../types/game';

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  public damage = 10;
  public aoeRadius = 0;
  public slowFactor = 1;
  public slowDurationMs = 0;
  public remainingPierces = 0;
  public remainingChains = 0;
  public bulletColor = 0xffffff;
  public readonly hitEnemyLives = new Set<number>();

  private lifespanMs = 1500;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'spr_bullet', 0);
    this.setDepth(30);
  }

  public fire(config: BulletFireConfig): void {
    this.enableBody(true, config.x, config.y, true, true);
    this.setPosition(config.x, config.y);
    this.setRotation(config.angle);
    this.setTint(config.color);
    this.setDepth(30);
    if (this.scene.anims.exists('anim_bullet')) {
      this.play('anim_bullet', true);
    }

    const scale = config.aoeRadius > 0 ? 1.45 : config.pierceCount > 0 ? 1.3 : 1.05;
    this.setScale(scale);

    this.damage = config.damage;
    this.aoeRadius = config.aoeRadius;
    this.slowFactor = config.slowFactor;
    this.slowDurationMs = config.slowDurationMs;
    this.remainingPierces = config.pierceCount;
    this.remainingChains = config.chainCount;
    this.bulletColor = config.color;
    this.hitEnemyLives.clear();
    this.elapsedMs = 0;
    this.lifespanMs = 1500;

    if (this.body) {
      const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
      arcadeBody.setCircle(7, 3, 3);
      arcadeBody.setVelocity(
        Math.cos(config.angle) * config.speed,
        Math.sin(config.angle) * config.speed
      );
    }
  }

  public deactivate(): void {
    this.disableBody(true, true);
    this.hitEnemyLives.clear();
  }

  public override update(_time: number, delta: number): void {
    if (!this.active) return;

    this.elapsedMs += delta;
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
  constructor(scene: Phaser.Scene) {
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
    return bullet;
  }
}
