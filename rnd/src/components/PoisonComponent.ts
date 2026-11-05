/** One poison per enemy life. Refreshes preserve cadence; stronger applications replace weaker ones. */
export class PoisonComponent {
  public damage = 0;
  public until = 0;
  public sourceUnitId: string | undefined;
  private nextTickAt = 0;
  private tickMs = 1000;

  public apply(damage: number, time: number, durationMs: number, tickMs: number, sourceUnitId?: string): void {
    if (time > this.until || this.damage === 0) {
      this.clear();
      this.tickMs = tickMs;
      this.nextTickAt = time + tickMs;
    } else if (damage < this.damage) {
      // A weaker ally must not keep another owner's stronger poison alive indefinitely.
      return;
    }
    this.damage = damage;
    this.sourceUnitId = sourceUnitId;
    this.until = time + durationMs;
  }

  public consumeTick(time: number): boolean {
    if (this.damage === 0) return false;
    if (this.nextTickAt > this.until) { this.clear(); return false; }
    if (time < this.nextTickAt) return false;
    this.nextTickAt += this.tickMs;
    return true;
  }

  public clear(): void {
    this.damage = this.until = this.nextTickAt = 0;
    this.sourceUnitId = undefined;
  }
}
