import { UNIQUE_SKILLS } from '../config/skillData';

/** One strongest burn per enemy life; no timers or references to pooled sprites. */
export class BurnComponent {
  public damage = 0;
  public until = 0;
  public sourceUnitId: string | undefined;
  private nextTickAt = 0;

  public apply(damage: number, time: number, sourceUnitId: string): void {
    if (time > this.until || this.damage === 0) {
      this.clear();
      this.nextTickAt = time + UNIQUE_SKILLS.lava.burnTickMs;
    }
    if (damage >= this.damage) {
      this.damage = damage;
      this.sourceUnitId = sourceUnitId;
    }
    this.until = time + UNIQUE_SKILLS.lava.burnDurationMs;
  }

  public consumeTick(time: number): boolean {
    if (this.damage === 0) return false;
    if (this.nextTickAt > this.until) { this.clear(); return false; }
    if (time < this.nextTickAt) return false;
    this.nextTickAt += UNIQUE_SKILLS.lava.burnTickMs;
    return true;
  }

  public clear(): void {
    this.damage = this.until = this.nextTickAt = 0;
    this.sourceUnitId = undefined;
  }
}
