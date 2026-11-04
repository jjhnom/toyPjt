import Phaser from 'phaser';
import { ARENA_BOUNDS } from '../config/gameData';
import { HealthComponent } from '../components/HealthComponent';
import { MovementComponent } from '../components/MovementComponent';
import { FireBulletFn } from '../components/WeaponComponent';
import { SquadRoster } from '../systems/SquadRoster';
import { DroneUnit } from './DroneUnit';

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
    onDamaged: (amount: number, current: number, max: number) => void
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
      const drone = new DroneUnit(this.scene, unit.id, unit.archetype, this.fireCallback);
      drone.setPosition(
        Phaser.Math.Clamp(this.leader.x + (index % 3 - 1) * 44, ARENA_BOUNDS.left + 20, ARENA_BOUNDS.right - 20),
        Phaser.Math.Clamp(this.leader.y + 45 + Math.floor(index / 3) * 40, ARENA_BOUNDS.top + 20, ARENA_BOUNDS.bottom - 20)
      );
      return drone;
    });
  }

  public setPositionImmediate(x: number, y: number): void {
    this.leader.setPosition(x, y);
    const count = this.drones.length;
    for (let i = 0; i < count; i++) {
      this.drones[i].setPosition(
        Phaser.Math.Clamp(x + (i % 3 - 1) * 40, ARENA_BOUNDS.left + 20, ARENA_BOUNDS.right - 20),
        Phaser.Math.Clamp(y + Math.floor(i / 3) * 40, ARENA_BOUNDS.top + 20, ARENA_BOUNDS.bottom - 20)
      );
    }
  }

  public receiveContactDamage(amount: number, time: number): boolean {
    const damaged = this.health.takeDamage(amount, time, 650);
    if (damaged) {
      this.leader.setTintFill(0xff4d4d);
      this.flashUntil = time + 160;
    }
    return damaged;
  }

  public update(
    time: number,
    delta: number,
    inputDirX: number,
    inputDirY: number,
    enemies: Phaser.GameObjects.Group,
    damageMultiplier: number,
    attackSpeedMultiplier: number,
    moveSpeedBonus: number
  ): void {
    // 본체 피격 점멸 해제 및 무적 시간 투명도 연출
    if (this.flashUntil > 0 && time >= this.flashUntil) {
      this.flashUntil = 0;
      this.leader.clearTint();
    }
    this.leader.setAlpha(time < this.health.invulnerableUntil ? 0.6 : 1.0);

    // 본체 이동 및 조향
    this.movement.moveInDirection(inputDirX, inputDirY, time, moveSpeedBonus);
    if (Math.abs(inputDirX) > 0.05 || Math.abs(inputDirY) > 0.05) {
      if (Math.abs(inputDirX) > 0.05) this.leader.setFlipX(inputDirX < 0);
    }

    // 아레나 경계 클램핑
    this.leader.x = Phaser.Math.Clamp(this.leader.x, ARENA_BOUNDS.left + 24, ARENA_BOUNDS.right - 24);
    this.leader.y = Phaser.Math.Clamp(this.leader.y, ARENA_BOUNDS.top + 24, ARENA_BOUNDS.bottom - 24);

    for (let i = 0; i < this.drones.length; i++) {
      this.drones[i].updateDrone(time, delta,
        this.leader.x + (i % 3 - 1) * 44,
        this.leader.y + 45 + Math.floor(i / 3) * 40,
        enemies, damageMultiplier, attackSpeedMultiplier);
    }
  }
}
