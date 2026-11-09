import { UNIT_REVIVE_DELAY_MS } from '../config/squadData';

interface RevivalUnit { id: string; reviveAt: number; health: { isDead: boolean } }

/** Preserve remaining revival time across scene pauses without changing Phaser's clock. */
export class RevivalPause {
  private remaining = new Map<string, number>();
  private captured = false;
  private pendingResume = false;

  public capture(units: readonly RevivalUnit[], time: number): void {
    this.captured = true;
    // Nested pause reasons must not replace the first remaining-time snapshot.
    for (const unit of units) if (unit.health.isDead && !this.remaining.has(unit.id)) {
      this.remaining.set(unit.id, this.remainingMs(unit, time));
    }
  }

  public queueResume(): void { this.pendingResume = this.captured; }

  public applyResume(units: readonly RevivalUnit[], time: number): void {
    if (!this.pendingResume) return;
    for (const unit of units) {
      const left = this.remaining.get(unit.id);
      if (unit.health.isDead && left !== undefined) unit.reviveAt = time + left;
    }
    this.clear();
  }

  public remainingMs(unit: RevivalUnit, time: number): number {
    // Deadline subtraction can exceed the configured duration by floating-point dust.
    return !unit.health.isDead ? 0 : this.remaining.get(unit.id)
      ?? Math.min(UNIT_REVIVE_DELAY_MS, Math.max(0, unit.reviveAt - time));
  }

  public clear(): void { this.remaining.clear(); this.captured = this.pendingResume = false; }
}
