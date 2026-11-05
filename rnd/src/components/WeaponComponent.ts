import Phaser from 'phaser';
import { BulletFireConfig, DroneSpec, IComponent, ProjectileTarget } from '../types/game';
import { soundManager } from '../systems/SoundManager';

export type FireBulletFn = (config: BulletFireConfig) => void;

export class WeaponComponent implements IComponent {
  public spec: DroneSpec;
  private lastFiredAt = 0;
  private fireCallback: FireBulletFn;

  // GC 방지를 위한 사전 할당 발사 설정 객체
  private reusableFireConfig: BulletFireConfig = {
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    damage: 0,
    color: 0xffffff,
    aoeRadius: 0,
    slowFactor: 1,
    slowDurationMs: 0,
    pierceCount: 0,
    chainCount: 0
  };

  constructor(spec: DroneSpec, fireCallback: FireBulletFn, ownerId?: string) {
    this.spec = spec;
    this.fireCallback = fireCallback;
    this.reusableFireConfig.sourceUnitId = ownerId;
  }

  public setSpec(spec: DroneSpec): void {
    this.spec = spec;
  }

  public reduceCooldown(ms: number): void {
    this.lastFiredAt -= ms;
  }

  public findNearestTarget(
    originX: number,
    originY: number,
    enemies: Phaser.GameObjects.Group
  ): (Phaser.GameObjects.Sprite & ProjectileTarget) | null {
    const children = enemies.getChildren();
    const maxRangeSq = this.spec.range * this.spec.range;
    let nearest: (Phaser.GameObjects.Sprite & ProjectileTarget) | null = null;
    let minDistSq = maxRangeSq;

    for (let i = 0; i < children.length; i++) {
      const child = children[i] as Phaser.GameObjects.Sprite & ProjectileTarget;
      if (!child.active) continue;

      const dx = child.x - originX;
      const dy = child.y - originY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= minDistSq) {
        minDistSq = distSq;
        nearest = child;
      }
    }

    return nearest;
  }

  public tryFire(
    time: number,
    originX: number,
    originY: number,
    enemies: Phaser.GameObjects.Group,
    damageMultiplier: number,
    attackSpeedMultiplier: number
  ): Phaser.GameObjects.Sprite | null {
    const cooldown = this.spec.fireRateMs / Math.max(0.2, attackSpeedMultiplier);
    if (time - this.lastFiredAt < cooldown) {
      return null;
    }

    const target = this.findNearestTarget(originX, originY, enemies);
    if (!target) {
      return null;
    }

    this.lastFiredAt = time;
    const angle = Phaser.Math.Angle.Between(originX, originY, target.x, target.y);

    this.reusableFireConfig.x = originX;
    this.reusableFireConfig.target = target;
    this.reusableFireConfig.unitTypeId = this.spec.archetype;
    this.reusableFireConfig.y = originY;
    this.reusableFireConfig.angle = angle;
    this.reusableFireConfig.speed = this.spec.bulletSpeed;
    this.reusableFireConfig.damage = Math.round(this.spec.damage * damageMultiplier);
    this.reusableFireConfig.color = this.spec.color;
    this.reusableFireConfig.aoeRadius = this.spec.aoeRadius;
    this.reusableFireConfig.slowFactor = this.spec.slowFactor;
    this.reusableFireConfig.slowDurationMs = this.spec.slowDurationMs;
    this.reusableFireConfig.pierceCount = this.spec.pierceCount;
    this.reusableFireConfig.chainCount = this.spec.chainCount;

    this.fireCallback(this.reusableFireConfig);
    soundManager.playShoot(this.spec.tier);

    return target;
  }

  public update(_time: number, _delta: number): void {}

  public destroy(): void {}
}
