import Phaser from 'phaser';
import { IComponent } from '../types/game';

export class MovementComponent implements IComponent {
  public baseSpeed: number;
  public slowFactor = 1.0;
  public slowUntil = 0;

  private body: Phaser.Physics.Arcade.Body;

  constructor(body: Phaser.Physics.Arcade.Body, baseSpeed: number) {
    this.body = body;
    this.baseSpeed = baseSpeed;
  }

  public applySlow(factor: number, durationMs: number, currentTime: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowUntil = Math.max(this.slowUntil, currentTime + durationMs);
  }

  public clearModifiers(): void {
    this.slowFactor = 1.0;
    this.slowUntil = 0;
  }

  public moveInDirection(dirX: number, dirY: number, currentTime: number, speedBonus = 0): void {
    if (currentTime > this.slowUntil) {
      this.slowFactor = 1.0;
    }

    const effectiveSpeed = (this.baseSpeed + speedBonus) * this.slowFactor;
    const lenSq = dirX * dirX + dirY * dirY;
    if (lenSq > 0.0001) {
      const len = Math.sqrt(lenSq);
      const scale = Math.min(1, len);
      this.body.setVelocity(
        (dirX / len) * effectiveSpeed * scale,
        (dirY / len) * effectiveSpeed * scale
      );
    } else {
      this.body.setVelocity(0, 0);
    }
  }

  public moveAlongAngle(angleRad: number, currentTime: number): void {
    if (currentTime > this.slowUntil) {
      this.slowFactor = 1.0;
    }
    const effectiveSpeed = this.baseSpeed * this.slowFactor;
    this.body.setVelocity(
      Math.cos(angleRad) * effectiveSpeed,
      Math.sin(angleRad) * effectiveSpeed
    );
  }

  public stop(): void {
    this.body.setVelocity(0, 0);
  }

  public update(time: number, _delta: number): void {
    if (time > this.slowUntil && this.slowFactor < 1.0) {
      this.slowFactor = 1.0;
    }
  }

  public destroy(): void {
    this.stop();
  }
}
