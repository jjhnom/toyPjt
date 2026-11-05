import { IComponent } from '../types/game';

export class HealthComponent implements IComponent {
  public maxHp: number;
  public currentHp: number;
  public invulnerableUntil = 0;
  public shieldHp = 0;
  public shieldUntil = 0;
  private onDeathCallback?: () => void;
  private onDamagedCallback?: (amount: number, current: number, max: number) => void;

  constructor(
    maxHp: number,
    onDeath?: () => void,
    onDamaged?: (amount: number, current: number, max: number) => void
  ) {
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.onDeathCallback = onDeath;
    this.onDamagedCallback = onDamaged;
  }

  public reset(maxHp: number): void {
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.invulnerableUntil = 0;
    this.clearShield();
  }

  public takeDamage(amount: number, currentTime = 0, iFrameMs = 0): boolean {
    if (this.currentHp <= 0) return false;
    if (currentTime > 0 && currentTime < this.invulnerableUntil) return false;

    if (amount <= 0) return false;
    this.update(currentTime, 0);
    const incoming = Math.max(1, Math.round(amount));
    const absorbed = Math.min(incoming, this.shieldHp);
    this.shieldHp -= absorbed;
    const finalDamage = incoming - absorbed;
    this.currentHp = Math.max(0, this.currentHp - finalDamage);

    if (iFrameMs > 0 && currentTime > 0) {
      this.invulnerableUntil = currentTime + iFrameMs;
    }

    if (finalDamage > 0 && this.onDamagedCallback) {
      this.onDamagedCallback(finalDamage, this.currentHp, this.maxHp);
    }

    if (this.currentHp <= 0) {
      this.clearShield();
      this.onDeathCallback?.();
    }

    return true;
  }

  public heal(amount: number): number {
    const before = this.currentHp;
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    return this.currentHp - before;
  }

  public applyShield(amount: number, until: number): void {
    if (this.isDead) return;
    this.shieldHp = Math.max(this.shieldHp, amount);
    this.shieldUntil = Math.max(this.shieldUntil, until);
  }

  public clearShield(): void {
    this.shieldHp = this.shieldUntil = 0;
  }

  public get ratio(): number {
    return this.maxHp > 0 ? this.currentHp / this.maxHp : 0;
  }

  public get isDead(): boolean {
    return this.currentHp <= 0;
  }

  public update(time: number, _delta: number): void {
    if (time >= this.shieldUntil) this.clearShield();
  }

  public destroy(): void {
    this.onDeathCallback = undefined;
    this.onDamagedCallback = undefined;
  }
}
