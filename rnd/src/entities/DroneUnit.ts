import Phaser from 'phaser';
import { unitTexture, unitAnimation } from '../ui/pixelCharacters';
import { ARENA_BOUNDS, DRONE_SPECS } from '../config/gameData';
import { UNIT_MOVEMENT, UNIT_REVIVE_DELAY_MS } from '../config/squadData';
import { UNIT_TYPES } from '../config/unitData';
import { HealthComponent } from '../components/HealthComponent';
import { FireBulletFn, WeaponComponent } from '../components/WeaponComponent';
import { DroneArchetype, DroneSpec } from '../types/game';

export class DroneUnit extends Phaser.GameObjects.Sprite {
  public id: string;
  public archetype: DroneArchetype;
  public spec: DroneSpec;
  public weapon: WeaponComponent;
  public readonly health: HealthComponent;
  public lastHealAt = 0;
  public star: 1 | 2 | 3;
  public reviveAt = 0;
  private recoilTimerMs = 0;
  private readonly fallbackAngle: number;

  constructor(
    scene: Phaser.Scene,
    id: string,
    archetype: DroneArchetype,
    fireCallback: FireBulletFn,
    star: 1 | 2 | 3 = 1
  ) {
    const spec = DRONE_SPECS[archetype];
    const texKey = unitTexture(archetype);

    super(scene, 0, 0, texKey, 0);
    this.id = id;
    this.star = star;
    this.health = new HealthComponent(Math.round(UNIT_TYPES[archetype].maxHp * (1 + 0.5 * (star - 1))),
      () => { this.reviveAt = this.scene.time.now + UNIT_REVIVE_DELAY_MS; this.setActive(false).setVisible(false); });
    this.fallbackAngle = Number(id.split('_')[1]) * 2.4;
    this.archetype = archetype;
    this.spec = spec;

    this.setDepth(24);

    this.weapon = new WeaponComponent(spec, fireCallback);
    scene.add.existing(this);
    this.playTierAnimation();
  }

  private playTierAnimation(): void {
    const animKey = unitAnimation(this.archetype);
    if (this.scene.anims.exists(animKey)) {
      this.play(animKey, true);
    }
  }

  public upgradeTo(newArchetype: DroneArchetype): void {
    this.archetype = newArchetype;
    this.spec = DRONE_SPECS[newArchetype];
    this.setTexture(unitTexture(newArchetype), 0);
    this.weapon.setSpec(this.spec);
    this.playTierAnimation();
  }

  public findNearestTarget(
    enemies: Phaser.GameObjects.Group
  ): Phaser.GameObjects.Sprite | null {
    return this.weapon.findNearestTarget(this.x, this.y, enemies);
  }

  public updateDrone(
    time: number,
    delta: number,
    targetX: number,
    targetY: number,
    enemies: Phaser.GameObjects.Group,
    damageMultiplier: number,
    attackSpeedMultiplier: number
  ): void {
    if (this.health.isDead) return;
    const movement = UNIT_MOVEMENT[this.archetype];
    let nearest: Phaser.GameObjects.Sprite | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const child of enemies.getChildren()) {
      const enemy = child as Phaser.GameObjects.Sprite;
      if (!enemy.active) continue;
      const distance = Phaser.Math.Distance.Squared(this.x, this.y, enemy.x, enemy.y);
      if (distance < nearestDistance) { nearest = enemy; nearestDistance = distance; }
    }
    if (nearest) {
      const distance = Math.sqrt(nearestDistance);
      const angle = distance > 0.01
        ? Math.atan2(this.y - nearest.y, this.x - nearest.x)
        : this.fallbackAngle;
      targetX = nearest.x + Math.cos(angle) * movement.preferredRange;
      targetY = nearest.y + Math.sin(angle) * movement.preferredRange;
      if (Math.abs(distance - movement.preferredRange) < 18) {
        targetX = this.x;
        targetY = this.y;
      }
    }
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const step = Math.min(distance, movement.speed * delta / 1000);
    if (distance > 0.01) {
      this.x += dx / distance * step;
      this.y += dy / distance * step;
    }
    this.x = Phaser.Math.Clamp(this.x, ARENA_BOUNDS.left + 20, ARENA_BOUNDS.right - 20);
    this.y = Phaser.Math.Clamp(this.y, ARENA_BOUNDS.top + 20, ARENA_BOUNDS.bottom - 20);

    const target = this.weapon.tryFire(
      time,
      this.x,
      this.y,
      enemies,
      damageMultiplier * (1 + 0.5 * (this.star - 1)),
      attackSpeedMultiplier
    );

    if (target) {
      this.setFlipX(target.x < this.x);
      this.recoilTimerMs = 90;
      this.setScale(1);
    } else if (this.recoilTimerMs > 0) {
      this.recoilTimerMs -= delta;
      if (this.recoilTimerMs <= 0) {
        this.setScale(1.0);
      }
    } else {
      if (nearest) this.setFlipX(nearest.x < this.x);
      this.setScale(1.0);
    }
  }
}
